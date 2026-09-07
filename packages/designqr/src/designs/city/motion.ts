import { cityNoise } from './layout.ts';
import { CITY_VEHICLES, cityVehicleQueueDistance } from './vehicles.ts';
import { CITY_VEHICLE_SCALE, SHIBUYA_VEHICLE_ROUTES, cityRoadPathPose } from './road-network.ts';
import { CITY_DRIVE_START, cityCycleTime } from './traffic-cycle.ts';

export { CITY_CYCLE_SECONDS, cityCycleTime } from './traffic-cycle.ts';
export { CITY_PEDESTRIAN_COUNT, CITY_PEDESTRIAN_ROUTES, createCityPedestrians, pedestrianPose } from './pedestrians.ts';
export type { CityPedestrian } from './pedestrians.ts';
export const CITY_TRAIN_PERIOD = 14;

const drivers = CITY_VEHICLES.map((vehicle, index) => {
  const rank = index % 6, bus = vehicle.type === 'bus';
  return {
    stop: SHIBUYA_VEHICLE_ROUTES[Math.floor(index / 6)].stopDistance - cityVehicleQueueDistance(index) * CITY_VEHICLE_SCALE,
    arrival: 2.75 + rank * .16 + cityNoise(index + 900, .5) * .12,
    braking: 1.2 + cityNoise(index + 901, .5) * .35,
    approachSpeed: .245 + cityNoise(index + 902, .5) * .015,
    reaction: .16 + cityNoise(index + 903, .5) * .20,
    launch: 0,
    headway: .16 + cityNoise(index + 904, .5) * .10,
    acceleration: (bus ? 1.65 : 1.1) + cityNoise(index + 905, .5) * .30,
    cruise: (bus ? .210 : .224) + cityNoise(index + 906, .5) * .006,
  };
});
for (let i = 0; i < drivers.length; i++) drivers[i].launch = drivers[i].reaction + (i % 6 ? drivers[i - 1].launch : 0);

/** Integral of a smooth velocity ramp, with zero acceleration at either end. */
function rampDistance(time: number, duration: number) {
  if (time <= 0) return 0;
  if (time >= duration) return time - duration / 2;
  const u = time / duration;
  return duration * (u ** 3 - u ** 4 / 2);
}

function freeVehicleDistance(index: number, phase: number) {
  const driver = drivers[index];
  const approach = driver.approachSpeed * rampDistance(driver.arrival - phase, driver.braking);
  const departure = driver.cruise * rampDistance(phase - CITY_DRIVE_START - driver.launch, driver.acceleration);
  return driver.stop - approach + departure;
}

/** A short blend lets a following driver ease into the leader's pace. */
function followingDistance(free: number, limit: number) {
  const blend = Math.max(0, .004 - Math.abs(free - limit));
  return Math.min(free, limit) - blend * blend / .016;
}

/** Drivers brake into a queue, react in sequence, and keep a moving headway. */
export function cityVehiclePosition(index: number, time: number) {
  const phase = cityCycleTime(time), laneStart = index - index % 6;
  let distance = freeVehicleDistance(index, phase), delay = 0;
  for (let leader = index - 1; leader >= laneStart; leader--) {
    delay += drivers[leader + 1].headway;
    const gap = drivers[leader].stop - drivers[index].stop;
    distance = followingDistance(distance, freeVehicleDistance(leader, phase - delay) - gap);
  }
  return cityRoadPathPose(Math.floor(index / 6), distance);
}

/** Reset occurs only after the last carriage has left the tile. */
export function cityTrainPosition(time: number) {
  const phase = ((time % CITY_TRAIN_PERIOD) + CITY_TRAIN_PERIOD) % CITY_TRAIN_PERIOD;
  return -.70 + phase * .10;
}
