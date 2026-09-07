import assert from 'node:assert/strict';
import test from 'node:test';
import { CITY_PEDESTRIAN_COUNT, CITY_PEDESTRIAN_ROUTES, createCityPedestrians, CITY_TRAIN_PERIOD, cityTrainPosition, cityVehiclePosition, pedestrianPose } from '../src/designs/city/motion.ts';
import { createCityBuildings, SHIBUYA_CROSSWALKS, isCityWaitingPositionClear } from '../src/designs/city/layout.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';
import { CITY_PAVEMENT_HEIGHT, CITY_VEHICLE_SCALE, SHIBUYA_STATION, cityOnCarriageway, cityVehiclePoint, citySurfaceDistance, roadMetres } from '../src/designs/city/road-network.ts';
import { CITY_VEHICLES } from '../src/designs/city/vehicles.ts';
import { isCityStreetApproachClear } from '../src/designs/city/street-layout.ts';
import { cityStationFrontageFrame, SHIBUYA_STATION_PASSAGE } from '../src/designs/city/station-frontage-layout.ts';
import { SHIBUYA_WORKSITE } from '../src/designs/city/construction-layout.ts';

test('commuters keep to crossing corridors, clear traffic, and never wrap in the street', () => {
  for (const seed of [0, .5, 1]) {
    const buildings = createCityBuildings(generateQRMatrix(`Shibuya ${seed}`, 'H').modules);
    const pedestrians = createCityPedestrians(seed, buildings);
    assert.equal(pedestrians.length, CITY_PEDESTRIAN_COUNT);
    for (const person of pedestrians) {
      const route = CITY_PEDESTRIAN_ROUTES[person.route];
      const dx = Math.cos(route.angle), dz = -Math.sin(route.angle);
      for (let time = 0; time < 80; time += .2) {
        const pose = pedestrianPose(person, time);
        assert.ok(citySurfaceDistance(pose.x, pose.z, [SHIBUYA_WORKSITE]) < 0, 'A pedestrian entered the fenced worksite.');
        assert.ok(isCityStreetApproachClear(pose.x, pose.z), `Pedestrian ${person.index} walked through street furniture at ${time}.`);
        assert.ok(buildings.every(b => {
          if (citySurfaceDistance(pose.x, pose.z, [b.groundEnvelope ?? b.envelope]) < 0) return true;
          if (!person.station || b.kind !== 'station-front') return false;
          const local = cityStationFrontageFrame(b).local(pose);
          return local.u > 10.7 && local.u < 22.4 && local.depth > -1.3 && local.depth <= 7.51;
        }),
          'A pedestrian approach entered a generated building.');
        const lateral = -(pose.x - route.x) * dz + (pose.z - route.z) * dx;
        if (cityOnCarriageway(pose.x, pose.z)) assert.ok(Math.abs(lateral) < route.width / 2, 'A pedestrian left the zebra crossing lane.');
        if (time % 20 >= 12) {
          assert.ok(!cityOnCarriageway(pose.x, pose.z), 'Traffic moved before pedestrians cleared.');
          if (!person.station) assert.equal(pose.walking, false, 'The curb crowd moved during vehicle traffic.');
          if (!pose.walking && !pose.insideStation) {
            assert.ok(isCityWaitingPositionClear(pose.x, pose.z, buildings),
              `Pedestrian ${person.index}, seed ${seed}, time ${time} waited outside clear sidewalk space.`);
            assert.ok(Math.abs(pose.groundHeight - CITY_PAVEMENT_HEIGHT) < 1e-9);
          }
        }
        const next = pedestrianPose(person, time + .001);
        assert.ok(Math.hypot(next.x - pose.x, next.z - pose.z) < .0002,
          `Pedestrian ${person.index}, seed ${seed}, time ${time} jumped between frames.`);
      }
      for (const boundary of [20, 40, 60, 80]) {
        const before = pedestrianPose(person, boundary - .0001);
        const after = pedestrianPose(person, boundary + .0001);
        assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < .0001);
        assert.ok(Math.abs(Math.cos(after.heading) - Math.cos(before.heading)) < .001);
      }
    }
    const waiting = pedestrians.map(person => pedestrianPose(person, 15)).filter(p => !p.walking && !p.insideStation);
    for (let a = 0; a < waiting.length; a++) for (let b = a + 1; b < waiting.length; b++) {
      assert.ok(Math.hypot(waiting[a].x - waiting[b].x, waiting[a].z - waiting[b].z) > .0048,
        `Waiting commuters ${a}/${b}, seed ${seed} overlap.`);
    }
  }
});

test('traffic holds outside every crossing until the pedestrian clearance ends', () => {
  for (let i = 0; i < 12; i++) {
    const queued = cityVehiclePosition(i, 4);
    assert.deepEqual(cityVehiclePosition(i, 11.9), queued);
    for (const route of SHIBUYA_CROSSWALKS) {
      const dx = Math.cos(route.angle), dz = -Math.sin(route.angle);
      const along = Math.abs((queued.x - route.x) * dx + (queued.z - route.z) * dz);
      const across = Math.abs(-(queued.x - route.x) * dz + (queued.z - route.z) * dx);
      const radius = CITY_VEHICLES[i].length * CITY_VEHICLE_SCALE / 2;
      assert.ok(along > route.length / 2 + radius || across > route.width / 2 + radius, `Queue ${i} blocks ${route.id}.`);
    }
    assert.notEqual(cityVehiclePosition(i, 14).z, queued.z);
    // Cars wrap only beyond the edge of the artwork.
    for (const time of [19.999, 20]) {
      const p = cityVehiclePosition(i, time);
      assert.ok(Math.max(Math.abs(p.x), Math.abs(p.z)) > .49 + CITY_VEHICLES[i].length * CITY_VEHICLE_SCALE);
    }
    for (let time = 0; time < 20; time += .05) {
      const p = cityVehiclePosition(i, time), spec = CITY_VEHICLES[i];
      // Include projecting mirrors and bumpers, not just the structural body.
      for (const x of [-spec.width / 2 - .003, 0, spec.width / 2 + .003]) for (const z of [-spec.length / 2 - .002, 0, spec.length / 2 + .002]) {
        const corner = cityVehiclePoint(p, x, z);
        if (Math.max(Math.abs(corner.x), Math.abs(corner.z)) < .49) {
          assert.ok(cityOnCarriageway(corner.x, corner.z), `Vehicle ${i} left the surveyed carriageway at ${time.toFixed(2)}.`);
        }
      }
    }
  }
});

test('the scramble mixes opposing streams, varies walking pace, and replays deterministically', () => {
  const buildings = createCityBuildings(generateQRMatrix('Shibuya scramble', 'H').modules);
  const people = createCityPedestrians(.5, buildings);
  const lanes = CITY_PEDESTRIAN_ROUTES.map(() => [new Set<number>(), new Set<number>()]);
  const speeds: number[] = [];
  let unmarkedDiagonal = 0;
  for (let time = 1; time < 10; time += .25) for (const person of people) {
    const pose = pedestrianPose(person, time);
    if (pose.pathProgress < .3 || pose.pathProgress > .7) continue;
    const route = CITY_PEDESTRIAN_ROUTES[person.route];
    const lateral = (pose.x - route.x) * Math.sin(route.angle) + (pose.z - route.z) * Math.cos(route.angle);
    if (Math.abs(lateral) > roadMetres(.2)) lanes[person.route][Number(person.direction > 0)].add(Math.sign(lateral));
    const next = pedestrianPose(person, time + .01);
    speeds.push(Math.hypot(next.x - pose.x, next.z - pose.z) / .01);
    if (route.id === 'counter-scramble' && cityOnCarriageway(pose.x, pose.z)) unmarkedDiagonal++;
  }
  assert.ok(lanes.every(directions => directions.every(sides => sides.size === 2)), 'Opposing walkers split into rigid lanes.');
  assert.ok(unmarkedDiagonal > 80, 'The crowd did not mix across the second diagonal.');
  speeds.sort((a, b) => a - b);
  assert.ok(speeds[Math.floor(speeds.length * .85)] > speeds[Math.floor(speeds.length * .15)] * 1.5,
    'The crowd moves at one uniform pace.');

  const snapshot = people.map(person => pedestrianPose(person, 4.25));
  // Seeking through either trip must not advance or mutate the saved crowd.
  for (const time of [38, 1, 27, 0, 19]) for (const person of people) pedestrianPose(person, time);
  assert.deepEqual(people.map(person => pedestrianPose(person, 4.25)), snapshot);
  for (const person of people) assert.deepEqual(pedestrianPose(person, 84.25), snapshot[person.index]);
});

test('station commuters enter the recessed JR doorway, emerge gradually, and wait for their next crossing', () => {
  const buildings = createCityBuildings([[true]]), people = createCityPedestrians(.5, buildings);
  const commuters = people.filter(p => p.station), frame = cityStationFrontageFrame(buildings.find(b => b.kind === 'station-front')!);
  assert.ok(commuters.length >= 12 && commuters.length <= 18, 'The station needs a smaller, visible flow within the crowd.');
  assert.deepEqual([...new Set(commuters.map(p => p.route))].sort(), [2, 3, 4]);
  const departures: number[] = [];
  for (const person of commuters) {
    let entered = false, exited = false, hiddenSeconds = 0, waitingSeconds = 0;
    for (let time = 0; time < 80; time += .05) {
      const pose = pedestrianPose(person, time), next = pedestrianPose(person, time + .05);
      const a = frame.local(pose), b = frame.local(next);
      if (a.depth < 1 && b.depth >= 1) entered = true;
      if (a.depth > 1 && b.depth <= 1) { exited = true; departures.push(time); }
      if (a.depth > SHIBUYA_STATION_PASSAGE.rearWall + .5) hiddenSeconds += .05;
      if (!pose.walking && !pose.insideStation && time % 20 >= 12) waitingSeconds += .05;
      if (a.depth > 1) {
        assert.ok(a.u > 10.7 && a.u < 22.4, 'A commuter used a wall or the police box as an entrance.');
        assert.ok(Math.abs(pose.groundHeight - CITY_PAVEMENT_HEIGHT - roadMetres(SHIBUYA_STATION_PASSAGE.floorHeight)) < 1e-8,
          'Feet must follow the raised concourse floor.');
      }
      // Check the complete trip, including the doorway, dwell and both phase seams.
      const after = pedestrianPose(person, time + .001);
      assert.ok(Math.hypot(after.x - pose.x, after.z - pose.z) < .0002, 'A station commuter teleported.');
    }
    assert.ok(entered && exited, 'Each station journey must actually pass through the doorway in both directions.');
    assert.ok(hiddenSeconds > 5 && waitingSeconds > 1, 'Station commuters need an indoor stay and a curb wait.');
    assert.deepEqual(pedestrianPose(person, -1), pedestrianPose(person, 79));
  }
  departures.sort((a, b) => a - b);
  assert.ok(departures[8] - departures[0] > 3, 'Everyone came out of the station at once.');
  for (let time = 0; time < 40; time += .1) {
    const poses = people.map(p => pedestrianPose(p, time));
    for (const person of commuters) {
      const pose = poses[person.index];
      if (!pose.stationTrip || !pose.walking || pose.insideStation) continue;
      for (const [i, q] of poses.entries()) if (i !== person.index) {
        assert.ok(Math.hypot(pose.x - q.x, pose.z - q.z) > roadMetres(.45), 'Station traffic overlapped another pedestrian.');
      }
    }
  }
});

test('drivers brake and accelerate continuously, release in sequence, and preserve moving gaps', () => {
  const releases: number[] = [];
  for (let i = 0; i < CITY_VEHICLES.length; i++) {
    const stopped = cityVehiclePosition(i, 10).distance;
    let release = Infinity;
    for (let time = .002; time < 19.998; time += .01) {
      const before = cityVehiclePosition(i, time - .001).distance;
      const current = cityVehiclePosition(i, time).distance;
      const after = cityVehiclePosition(i, time + .001).distance;
      assert.ok(after >= current - 1e-10, 'A following vehicle reversed.');
      assert.ok(Math.abs(after - 2 * current + before) / .000001 < .6, 'A driver snapped to a new speed.');
      if (time > 12 && current - stopped > .0001 && release === Infinity) release = time;
      if (i % 6) {
        const leader = cityVehiclePosition(i - 1, time).distance;
        const bodies = (CITY_VEHICLES[i - 1].length + CITY_VEHICLES[i].length) * CITY_VEHICLE_SCALE / 2;
        assert.ok(leader - current - bodies > roadMetres(1), 'Moving vehicles lost their following gap.');
      }
    }
    releases.push(release);
    assert.ok(release > 12 && release < 14);
  }
  for (const start of [0, 6]) {
    assert.ok(releases[start + 5] - releases[start] > .8, 'The queue pulled away in lockstep.');
    for (let i = start + 1; i < start + 6; i++) assert.ok(releases[i] > releases[i - 1]);
  }
});

test('the metro resets only when every carriage is outside the station portals', () => {
  const limit = SHIBUYA_STATION.halfLength - .025;
  const halfTrain = 1.5 * SHIBUYA_STATION.carSpacing + roadMetres(20) / 2;
  assert.ok(cityTrainPosition(0) + halfTrain < -limit);
  assert.ok(cityTrainPosition(CITY_TRAIN_PERIOD - .001) - halfTrain > limit);
  assert.equal(cityTrainPosition(CITY_TRAIN_PERIOD), cityTrainPosition(0));
  assert.ok(Math.abs(cityTrainPosition(CITY_TRAIN_PERIOD / 2)) < limit);
});
