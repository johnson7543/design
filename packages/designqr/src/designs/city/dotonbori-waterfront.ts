import { BufferGeometry, Float32BufferAttribute, PlaneGeometry, Vector3 } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { dotonboriBridgeHeight, dotonboriBridgePoint, dotonboriContains, dotonboriPoint } from './dotonbori-detail-layout.ts';

/** Reference-led fittings, separate from immutable PLATEAU/bridge templates.
 * Cross sections and plan establish the layout; photo-sized fittings are
 * miniature interpretations, not another surveyed source dataset. */
export function createDotonboriWaterfront(library: DotonboriLibrary) {
  const { layout, waterfront: data } = library, size = layout.tileSizeM;
  const b = new DotonboriGeometry(size, 'dotonbori-waterfront-details');
  const point = (e: number, n: number, h: number) => dotonboriPoint(e, n, h, layout);
  const bridge = (across: number, along: number, h?: number) => dotonboriBridgePoint(data, layout, across, along, h);
  for (const edge of data.bankEdges) {
    const direction = edge.side === 'north' ? 1 : -1;
    for (let i = 1; i < edge.points.length; i++) {
      const [ae, an] = edge.points[i - 1], [be, bn] = edge.points[i];
      // Partition the wall at the display waterline: a submerged skirt, dark
      // contact band and dry upper face. No coplanar overlay or floating foam.
      const wet = data.levelsM.water + .10;
      for (const [bottom, top, color] of [[.2, data.levelsM.water - .04, P.wall],
        [data.levelsM.water - .04, wet, P.road], [wet, data.levelsM.lowerWalk, P.wall]] as const) {
        const corners = [point(ae, an, bottom), point(be, bn, bottom), point(be, bn, top), point(ae, an, top)];
        const wall = new BufferGeometry();
        wall.setAttribute('position', new Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap(j => corners[j].toArray()), 3));
        b.add(wall, color);
      }
      b.beam(point(ae, an, 1.06), point(be, bn, 1.06), .12, P.stone, i % 3 === 0);
      const railNorthA = an + direction * 2.22, railNorthB = bn + direction * 2.22;
      if (!dotonboriContains(data.upperWalk, (ae + be) / 2, (railNorthA + railNorthB) / 2)) continue;
      // Three wires and a substantial top rail, as visible in the operator's
      // Ebisubashi photograph. Small lamps sit in alternate upright posts.
      for (const height of [2.20, 2.49, 2.79, 3.02]) b.beam(point(ae, railNorthA, height), point(be, railNorthB, height), height === 3.02 ? .075 : .033, P.metal);
      b.beam(point(ae, railNorthA, 1.08), point(ae, railNorthA, 3.04), .10, P.metal, i % 4 === 0);
      b.box(point(ae, railNorthA, data.levelsM.upperWalk + .025), .23, .05, .23, P.metal, layout.rotationYRadians, false);
      for (const e of [-.075, .075]) for (const n of [-.075, .075]) {
        const head = point(ae + e, railNorthA + n, data.levelsM.upperWalk + .051);
        b.add(new PlaneGeometry(.027 / size, .027 / size).rotateX(-Math.PI / 2)
          .rotateY(layout.rotationYRadians).translate(head.x, head.y, head.z), P.stone);
      }
      const stepFace = new BufferGeometry();
      const stepCorners = [point(ae, railNorthA, 1.05), point(be, railNorthB, 1.05), point(be, railNorthB, 1.95), point(ae, railNorthA, 1.95)];
      stepFace.setAttribute('position', new Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap(j => stepCorners[j].toArray()), 3));
      b.add(stepFace, P.wall);
      if (i % 4 === 0) {
        b.box(point(ae, railNorthA, 2.12), .15, .32, .18, P.warmWindow, 0, false, true);
        b.box(point(ae, railNorthA, 2.34), .23, .065, .24, P.dark, 0, false);
      }
      // Transverse joints describe the low, stone-paved strip; no random road paint.
      b.beam(point(ae, an + direction * .18, 1.065), point(ae, an + direction * 2.05, 1.065), .022, P.joints);
    }
  }

  // Joint scale follows the visible paving rhythm in S10/S14. Clip every
  // segment to its actual source street/riverwalk; no invented traffic paint.
  const east = layout.outlineEastNorthM.map(p => p[0]), north = layout.outlineEastNorthM.map(p => p[1]);
  for (const [polygons, height, pitch] of [[data.upperWalk, data.levelsM.upperWalk + .022, 1.6], [library.plan.roads, .035, 1.8]] as const) {
    for (let e = Math.min(...east); e < Math.max(...east); e += pitch) for (let n = Math.min(...north); n < Math.max(...north); n += pitch) {
      const end = e + pitch * .94, mid = (e + end) / 2;
      const a = point(e, n, height), c = point(end, n, height);
      if ([a, c].some(p => Math.abs(p.x) > .498 || Math.abs(p.z) > .498)
        || ![e, mid, end].every(x => dotonboriContains(polygons, x, n))) continue;
      b.beam(a, c, .025, P.joints);
      if (dotonboriContains(polygons, e, n + pitch / 2)) b.beam(a, point(e, n + pitch / 2, height), .024, P.joints);
    }
  }

  // Published 18 m central circle / 11.8 m straight deck. Rail rhythm and
  // fascia depth are photo interpretations; the source deck remains intact.
  const deckWidth = (along: number) => Math.max(5.9, Math.sqrt(Math.max(0, 81 - along * along)));
  // S14 shows a continuous metal soffit, panel seams and a circular light.
  // Follow the registered deck envelope; the 0.48 m depth and 2.8 m light
  // radius are miniature photo fits, not a recovered structural section.
  for (const template of library.templates.filter(t => t.kind === 'bridge')) {
    const soffit = template.geometry.clone().translate(0, -.48 / size, 0);
    const indices = soffit.index ? Array.from(soffit.index.array) : Array.from({ length: soffit.getAttribute('position').count }, (_, i) => i);
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    soffit.setIndex(indices); b.add(soffit, P.metal);
  }
  for (let along = -12; along <= 12; along += 1.5) {
    const width = deckWidth(along) - .16, height = dotonboriBridgeHeight(data, along) - .492;
    b.beam(bridge(-width, along, height), bridge(width, along, height), .022, P.joints);
  }
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, c = (i + 1) * Math.PI / 24;
    const ring = (angle: number, below: number) => bridge(2.8 * Math.cos(angle), 2.8 * Math.sin(angle), dotonboriBridgeHeight(data, 2.8 * Math.sin(angle)) - below);
    b.beam(ring(a, .505), ring(c, .505), .16, P.dark);
    b.beam(ring(a, .587), ring(c, .587), .085, P.coolWindow, false, true);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 104; i++) {
    const a = -13.005 + i * .25, c = Math.min(12.995, a + .25);
    const wa = side * deckWidth(a), wc = side * deckWidth(c);
    b.beam(bridge(wa, a, dotonboriBridgeHeight(data, a) - .24), bridge(wc, c, dotonboriBridgeHeight(data, c) - .24), .48, P.stone, i % 8 === 0);
    // Panel joints and the photographed underside light ribbon (S14).
    if (i % 4 === 0) b.beam(bridge(wa * 1.008, a, dotonboriBridgeHeight(data, a) - .43), bridge(wa * 1.008, a, dotonboriBridgeHeight(data, a) - .06), .025, P.joints);
    b.beam(bridge(wa * .98, a, dotonboriBridgeHeight(data, a) - .52), bridge(wc * .98, c, dotonboriBridgeHeight(data, c) - .52), .07, P.coolWindow, false, true);
    if (Math.abs((a + c) / 2) > 9.1 && Math.abs((a + c) / 2) < 11.7) continue;
    for (const offset of [.18, 1.03]) b.beam(bridge(wa, a).add(new Vector3(0, offset / size, 0)), bridge(wc, c).add(new Vector3(0, offset / size, 0)), .075, P.metal);
    b.beam(bridge(wa, a).add(new Vector3(0, .12 / size, 0)), bridge(wa, a).add(new Vector3(0, 1.03 / size, 0)), .045, P.metal);
  }
  // The concentric paving and radial divisions are visible in the completion plan.
  for (const radius of [1.9, 6.6, 8.4]) for (let i = 0; i < 96; i++) {
    const a = i * Math.PI / 48, c = (i + 1) * Math.PI / 48;
    const p = bridge(radius * Math.cos(a), radius * Math.sin(a)); p.y += .025 / size;
    const q = bridge(radius * Math.cos(c), radius * Math.sin(c)); q.y += .025 / size;
    b.beam(p, q, .07, P.joints);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const p = bridge(1.9 * Math.cos(a), 1.9 * Math.sin(a)); p.y += .026 / size;
    const q = bridge(8.4 * Math.cos(a), 8.4 * Math.sin(a)); q.y += .026 / size;
    b.beam(p, q, .035, P.joints);
  }
  // Four bank connections follow the completed plan. The southwest drawing
  // supplies the 5.1 m structural run; other fittings retain photo-level accuracy.
  const angle = layout.rotationYRadians + Math.atan2(data.bridge.alongNorth[0], data.bridge.alongNorth[1]);
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const along = end * 10.4, top = dotonboriBridgeHeight(data, along), bottom = data.levelsM.upperWalk;
    const run = 5.1, width = 2.35;
    for (let step = 0; step < 18; step++) {
      const height = bottom + (top - bottom) * (1 - step / 18);
      b.box(bridge(side * (5.9 + (step + .5) * run / 18), along, (height + bottom) / 2), run / 18 + .008,
        height - bottom + .06, width, P.stone, angle, step % 3 === 0);
    }
    for (const offset of [-width / 2, width / 2]) {
      const a = bridge(side * 5.9, along + offset, top + 1.03);
      const c = bridge(side * 11, along + offset, bottom + 1.03);
      b.beam(a, c, .09, P.metal, true);
      for (let step = 0; step <= 6; step++) {
        const p = a.clone().lerp(c, step / 6); b.beam(p.clone().add(new Vector3(0, -1 / size, 0)), p, .06, P.metal);
      }
    }
  }
  return { geometry: b.finish(), fragments: b.fragments };
}
