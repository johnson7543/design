import { Matrix4, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { DotonboriActionBatch, type DotonboriActionPart } from './dotonbori-action-batch.ts';
import { frontPoint, type DotonboriFront } from './dotonbori-facade-layout.ts';
import { dotonboriContains } from './dotonbori-detail-layout.ts';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';

export const DOTONBORI_SHOP_ACTIONS = 'dotonbori-shop-activity';
export interface DotonboriShopActionAnchor { kind: 'prep' | 'service' | 'tank'; front: DotonboriFront; x: number; width: number }
export const actionEase = (start: number, end: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - start) / (end - start))); return x * x * (3 - 2 * x);
};
export const actionPulse = (t: number, start: number, end: number, ramp = 1) => actionEase(start, start + ramp, t) * (1 - actionEase(end - ramp, end, t));
const wrap = (t: number, duration: number) => ((t % duration) + duration) % duration;

/** A complete exchange and return: the tray never pops away or teleports at
 * the loop seam. Timing is miniature choreography, not observed service time. */
export function dotonboriServiceState(time: number) {
  const t = wrap(time + 4, 40);
  const customer = -.65 * (1 - actionEase(4, 8, t) + actionEase(18, 22, t) - actionEase(28, 32, t) + actionEase(36, 40, t));
  const reach = actionEase(10, 13, t) * (1 - actionEase(34, 37, t));
  const carry = actionEase(15, 18, t) * (1 - actionEase(32, 34, t));
  const lift = actionEase(10, 13, t) * (1 - actionEase(34, 36, t));
  const walking = [[4, 8], [18, 22], [28, 32], [36, 40]].reduce((value, [a, b]) => value + actionPulse(t, a, b, .6), 0);
  return { customer, reach, carry, lift, walking, trayX: customer * carry, trayDepth: .61 + .36 * reach + .14 * carry };
}

export function dotonboriCrabState(index: number, time: number) {
  const t = wrap(time + index * 5, 21 + index * 6), step = actionEase(4, 7, t) - actionEase(13, 16, t);
  return { offset: -.035 + .07 * step, walking: actionPulse(t, 4, 7, .4) + actionPulse(t, 13, 16, .4),
    claw: actionPulse(t, 8, 12, 1.4), phase: t * 7 + index * 2 };
}

function customerSupported(anchor: DotonboriShopActionAnchor, library: DotonboriLibrary) {
  const { front, x, width } = anchor;
  for (const along of [-.65, -.325, 0]) for (const dx of [-.28, .28]) for (const depth of [1.06, 1.42]) {
    const p = frontPoint(front, x + width * .20 + along + dx, 0, depth).multiplyScalar(front.size)
      .applyAxisAngle(new Vector3(0, 1, 0), -library.layout.rotationYRadians);
    if (!dotonboriContains(library.waterfront.upperWalk, p.x + library.layout.centerEastNorthM[0], -p.z + library.layout.centerEastNorthM[1])) return false;
  }
  return true;
}

/** Counter roles come from the same fitted storefront builder as the visible
 * worktops. These are the existing interpreted businesses, not new tenants. */
export function createDotonboriShopActivity(library: DotonboriLibrary, anchors: readonly DotonboriShopActionAnchor[], material?: MeshBasicMaterial) {
  const parts: DotonboriActionPart[] = [];
  const scenes = anchors.filter(a => a.kind !== 'service' || customerSupported(a, library)).map(anchor => {
    const { front, kind } = anchor, prefix = `dotonbori-${front.id}-${kind}`;
    const add = (id: string, color: string, sphere = false) => {
      parts.push({ id: `${prefix}-${id}`, color, sourceBuilding: front.building,
        ...(sphere ? { geometry: new SphereGeometry(.5, 10, 6) } : {}) }); return parts.length - 1;
    };
    const person = (id: string, shirt: string, customer = false) => ({
      body: add(`${id}-body`, shirt), head: add(`${id}-head`, P.light), cap: add(`${id}-cap`, customer ? S.charcoal : P.light),
      apron: customer ? -1 : add(`${id}-apron`, S.navy),
      arms: [-1, 1].map(side => [add(`${id}-${side}-upper-arm`, shirt), add(`${id}-${side}-forearm`, shirt), add(`${id}-${side}-hand`, P.light)]),
      legs: customer ? [-1, 1].map(side => [add(`${id}-${side}-leg`, S.navy), add(`${id}-${side}-shoe`, S.charcoal)]) : [],
    });
    const worker = kind !== 'tank' ? person('worker', kind === 'prep' ? S.blue : S.ivory) : undefined;
    const customer = kind === 'service' ? person('customer', S.coral, true) : undefined;
    const tray = kind === 'service' ? [add('tray', P.light), ...[0, 1, 2].map(i => add(`food-${i}`, S.gold, true))] : [];
    const pick = kind === 'prep' ? add('pick', P.metal) : -1;
    const crabs = kind === 'tank' ? [0, 1, 2].map(crab => ({
      body: add(`crab-${crab}-body`, S.gold, true),
      legs: [-1, 1].flatMap(side => [0, 1, 2].map(leg => [add(`crab-${crab}-${side}-${leg}-inner-leg`, P.warmWindow), add(`crab-${crab}-${side}-${leg}-outer-leg`, P.warmWindow)])),
      claws: [-1, 1].map(side => [add(`crab-${crab}-${side}-claw-arm`, S.gold), add(`crab-${crab}-${side}-claw-a`, P.warmWindow), add(`crab-${crab}-${side}-claw-b`, P.warmWindow)]),
    })) : [];
    // Source-wall U runs opposite a Three.js box's local X. Preserve that
    // fitted bay coordinate instead of mirroring the action into the next bay.
    const frame = new Matrix4().makeRotationY(front.yaw).scale(new Vector3(-1, 1, 1).divideScalar(front.size))
      .setPosition(frontPoint(front, 0, front.bottom, 0));
    return { anchor, frame, worker, customer, tray, pick, crabs };
  });
  const batch = new DotonboriActionBatch(DOTONBORI_SHOP_ACTIONS, parts, material);
  batch.mesh.userData.evidence = 'S15 interpreted food counters; S16 interpreted tank placement; authored activity';
  let previous = NaN;
  const update = (time: number) => {
    if (time === previous) return; previous = time;
    for (const { anchor, frame, worker, customer, tray, pick, crabs } of scenes) {
      const { x, width, kind, front } = anchor;
      if (worker) {
        const sx = x + width * (kind === 'prep' ? -.19 : .20), state = dotonboriServiceState(time);
        const prep = actionPulse(wrap(time + 3, 23), 2, 10, 1.5), stir = Math.sin(time * 3.4) * prep;
        batch.box(worker.body, frame, sx, 1.35, .455, .36, .48, .16);
        batch.box(worker.head, frame, sx + .012 * (kind === 'prep' ? stir : state.reach), 1.73, .46, .25, .27, .22);
        batch.box(worker.cap, frame, sx, 1.887, .46, .28, .055, .24);
        batch.box(worker.apron, frame, sx, 1.33, .543, .25, .39, .014);
        for (const [sideIndex, side] of [-1, 1].entries()) {
          const [upper, lower, hand] = worker.arms[sideIndex];
          const wrist = kind === 'prep' ? [sx + side * .14 + (side > 0 ? .065 * stir : 0), 1.255 + (side > 0 ? .018 * stir : 0), .67]
            : [sx + side * .145, 1.255, .61 + .36 * state.reach * (1 - state.carry)];
          const shoulder = [sx + side * .19, 1.53, .47], elbow = [sx + side * .25, 1.28, .56 + (wrist[2] - .61) * .48];
          batch.beam(upper, frame, shoulder, elbow, .10); batch.beam(lower, frame, elbow, wrist, .085);
          batch.box(hand, frame, ...wrist as [number, number, number], .075, .06, .065);
          if (pick >= 0 && side > 0) batch.beam(pick, frame, [wrist[0], wrist[1] - .015, .67], [wrist[0] - .025, 1.16, .59 + .026 * stir], .009);
        }
        if (customer) {
          const cx = sx + state.customer, floor = library.waterfront.levelsM.upperWalk - front.bottom;
          batch.box(customer.body, frame, cx, floor + 1.08, 1.24, .40, .55, .25);
          batch.box(customer.head, frame, cx, floor + 1.56, 1.22, .25, .28, .25);
          batch.box(customer.cap, frame, cx, floor + 1.71, 1.235, .27, .09, .27);
          for (const [sideIndex, side] of [-1, 1].entries()) {
            const stride = Math.sin(time * 7.4 + side) * .11 * state.walking;
            const [leg, shoe] = customer.legs[sideIndex];
            batch.beam(leg, frame, [cx + side * .12, floor + .82, 1.24], [cx + side * .12 + stride, floor + .10, 1.24], .14);
            batch.box(shoe, frame, cx + side * .12 + stride, floor + .055, 1.20, .16, .10, .24);
            const wrist = [cx + side * (.23 - .085 * state.lift), floor + .80 + (.455 - floor) * state.lift,
              1.24 - .13 * state.lift - .14 * state.reach * (1 - state.carry) * state.lift];
            const elbow = [cx + side * .26, floor + 1.04 + .07 * state.lift, 1.24 - .17 * state.lift];
            const [upper, lower, hand] = customer.arms[sideIndex];
            batch.beam(upper, frame, [cx + side * .22, floor + 1.29, 1.24], elbow, .11);
            batch.beam(lower, frame, elbow, wrist, .09); batch.box(hand, frame, ...wrist as [number, number, number], .075, .06, .065);
          }
          batch.box(tray[0], frame, sx + state.trayX, 1.30, state.trayDepth, .36, .032, .22);
          for (let food = 0; food < 3; food++) batch.box(tray[food + 1], frame, sx + state.trayX + (food - 1) * .085, 1.35, state.trayDepth, .065, .067, .065);
        }
      }
      for (const [index, crab] of crabs.entries()) {
        const state = dotonboriCrabState(index, time), cx = x + (index - 1) * (width - .70) / 3 + state.offset;
        batch.box(crab.body, frame, cx, 1.11, .47, .30, .17, .12);
        for (const [sideIndex, side] of [-1, 1].entries()) {
          for (let leg = 0; leg < 3; leg++) {
            const step = Math.sin(state.phase + leg * 2 + sideIndex * Math.PI) * state.walking;
            const z = .435 + leg * .04, knee = [cx + side * .24 + step * .012, 1.045 + Math.max(0, step) * .014, z];
            const tip = [cx + side * .31 + step * .016, 1.003 + Math.max(0, step) * .018, z + .01];
            const [inner, outer] = crab.legs[sideIndex * 3 + leg];
            batch.beam(inner, frame, [cx + side * .11, 1.08, z], knee, .021); batch.beam(outer, frame, knee, tip, .017);
          }
          const [arm, a, b] = crab.claws[sideIndex], spread = .012 + .022 * state.claw;
          const joint = [cx + side * .22, 1.17 + .016 * state.claw, .51];
          batch.beam(arm, frame, [cx + side * .12, 1.13, .50], joint, .03);
          batch.beam(a, frame, joint, [joint[0] + side * .045, joint[1] + spread, .527], .021);
          batch.beam(b, frame, joint, [joint[0] + side * .045, joint[1] - spread, .527], .021);
        }
      }
    }
    batch.commit();
  };
  update(0);
  return { mesh: batch.mesh, material: batch.mesh.material, anchors: scenes.map(s => s.anchor), update, snapshot: () => batch.snapshot() };
}
