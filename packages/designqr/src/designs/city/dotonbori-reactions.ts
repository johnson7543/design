import { Matrix4, Vector3, type MeshBasicMaterial } from 'three';
import { DotonboriActionBatch, type DotonboriActionPart } from './dotonbori-action-batch.ts';
import { actionEase, actionPulse } from './dotonbori-shop-activity.ts';
import { DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';

export const DOTONBORI_REACTION_VISITORS = [45, 48, 50] as const;
export const DOTONBORI_VISITOR_REACTIONS = 'dotonbori-visitor-reactions';
export const DOTONBORI_BOAT_REACTION = 'dotonbori-boat-reaction';
const wrap = (n: number, period: number) => ((n % period) + period) % period;

/** Only proximity to the passing boat enables a greeting. Photographers have
 * independent readable holds; these gestures are representative activity. */
export function dotonboriVisitorReaction(index: number, time: number, boatDistanceM: number) {
  const near = 1 - actionEase(12, 28, boatDistanceM);
  return { photo: index === 45 || index === 48 ? actionPulse(wrap(time + (index === 45 ? 3 : 13), index === 45 ? 26 : 33), 2, 10, 1.3) : 0,
    wave: index === 50 ? near * actionPulse(wrap(time + 1, 9), 1.5, 6.5, 1) : 0, look: index === 50 ? near : 0 };
}

export function createDotonboriReactions(material: MeshBasicMaterial, size: number) {
  const parts: DotonboriActionPart[] = [];
  const visitors = DOTONBORI_REACTION_VISITORS.map(index => {
    const group = `dotonbori-person-${index}`, shirt = [S.navy, S.ivory, S.blue, S.coral, S.highRise, S.charcoal, S.gold][index % 7];
    const add = (name: string, color: string) => { parts.push({ id: `${group}-${name}`, group, color }); return parts.length - 1; };
    return { index, arms: [-1, 1].map(side => [add(`gesture-${side}-upper`, shirt), add(`gesture-${side}-lower`, shirt), add(`gesture-${side}-hand`, P.light)]),
      phone: index === 50 ? [] : [add('phone', S.charcoal), add('phone-screen', P.coolWindow)] };
  });
  const visitorsBatch = new DotonboriActionBatch(DOTONBORI_VISITOR_REACTIONS, parts, material);
  const boatParts: DotonboriActionPart[] = [];
  const addBoat = (id: string, color: string) => { boatParts.push({ id: `${DOTONBORI_BOAT_REACTION}-${id}`, color }); return boatParts.length - 1; };
  const guest = { body: addBoat('body', S.ivory), head: addBoat('head', P.light), hair: addBoat('hair', S.charcoal),
    legs: [-1, 1].map(side => addBoat(`leg-${side}`, P.dark)),
    arms: [-1, 1].map(side => [addBoat(`arm-${side}-upper`, S.ivory), addBoat(`arm-${side}-lower`, S.ivory), addBoat(`hand-${side}`, P.light)]) };
  const boatBatch = new DotonboriActionBatch(DOTONBORI_BOAT_REACTION, boatParts, material);
  const boatFrame = new Matrix4().makeRotationY(Math.PI / 2).scale(new Vector3(1, 1, 1).divideScalar(size))
    .setPosition(new Vector3(-1.96, 0, 1.25).divideScalar(size));
  return {
    mesh: visitorsBatch.mesh, boatMesh: boatBatch.mesh,
    updateVisitor(index: number, frame: Matrix4, hip: number, time: number, state: ReturnType<typeof dotonboriVisitorReaction>) {
      const visitor = visitors.find(v => v.index === index); if (!visitor) return;
      for (const [sideIndex, side] of [-1, 1].entries()) {
        const lift = state.photo, wave = side > 0 ? state.wave : 0;
        const shoulder = [side * .23, hip + .50, 0];
        const elbow = [side * (.28 + .16 * wave), hip + .24 + .18 * lift + .44 * wave, .03 + .19 * lift + .10 * wave];
        const restX = side > 0 && visitor.phone.length ? .13 : .23;
        const wrist = [side * (restX + (.08 - restX) * lift + .24 * wave) + .045 * wave * Math.sin(time * 4.8),
          hip + .01 + .64 * lift + wave, .03 + .35 * lift + .12 * wave];
        const [upper, lower, hand] = visitor.arms[sideIndex];
        visitorsBatch.beam(upper, frame, shoulder, elbow, .11); visitorsBatch.beam(lower, frame, elbow, wrist, .095);
        visitorsBatch.box(hand, frame, ...wrist as [number, number, number], .075, .09, .065);
      }
      if (visitor.phone.length) {
        const x = .13 * (1 - state.photo), y = hip + .05 + .62 * state.photo, z = .07 + .34 * state.photo;
        visitorsBatch.box(visitor.phone[0], frame, x, y, z, .14, .22, .027);
        visitorsBatch.box(visitor.phone[1], frame, x, y, z - .018, .10, .16, .008);
      }
    },
    updateBoat(time: number, bridgeDistanceM: number) {
      const wave = (1 - actionEase(12, 28, bridgeDistanceM)) * actionPulse(wrap(time + 2.2, 9), 1.5, 6.5, 1);
      boatBatch.box(guest.body, boatFrame, 0, 1.19, 0, .34, .53, .30);
      boatBatch.box(guest.head, boatFrame, 0, 1.61, .04, .24, .27, .23, -.35 * wave);
      boatBatch.box(guest.hair, boatFrame, 0, 1.735, .015, .25, .09, .245, -.35 * wave);
      for (const [sideIndex, side] of [-1, 1].entries()) {
        boatBatch.box(guest.legs[sideIndex], boatFrame, side * .075, .69, .29, .11, .42, .14);
        const raised = side < 0 ? wave : 0, shoulder = [side * .20, 1.39, 0];
        const elbow = [side * (.23 + .14 * raised), 1.14 + .47 * raised, .06];
        const wrist = [side * (.22 + .16 * raised) + .025 * raised * Math.sin(time * 4.8 + .8), 1.00 + .87 * raised, .14];
        const [upper, lower, hand] = guest.arms[sideIndex];
        boatBatch.beam(upper, boatFrame, shoulder, elbow, .085); boatBatch.beam(lower, boatFrame, elbow, wrist, .075);
        boatBatch.box(hand, boatFrame, ...wrist as [number, number, number], .07, .085, .06);
      }
      visitorsBatch.commit(); boatBatch.commit();
    },
    snapshot: (boatMatrix: Matrix4) => [...visitorsBatch.snapshot(), ...boatBatch.snapshot(boatMatrix)],
  };
}
