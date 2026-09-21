import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { DotonboriActionBatch, type DotonboriActionPart } from './dotonbori-action-batch.ts';
import { frontPoint, type DotonboriFront } from './dotonbori-facade-layout.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { mixCityColor, OSAKA_NIGHT_SWATCHES as S } from './palette.ts';

export const DOTONBORI_KANI_SIGN = 'dotonbori-kani-exterior-crab';
export const DOTONBORI_KANI_PERIOD = 12;
const SHELL = mixCityColor(S.coral, S.charcoal, .16);
const JOINT = mixCityColor(S.coral, S.ivory, .52);
const CENTER_Y = 5.13;
type Point = [number, number, number];

/** S23: the owner's frontal photograph and WSTV's filmed main-store sign.
 * Placement is fitted to the registered street wall; the restrained cycle is
 * authored, not a measurement of the current mechanism. */
export function dotonboriKaniPose(time: number, side: number, leg: number) {
  const phase = time / DOTONBORI_KANI_PERIOD * Math.PI * 2;
  return { sweep: Math.sin(phase + leg * .58 + (side < 0 ? Math.PI : 0)) * .065,
    pincer: .08 + .19 * (.5 + .5 * Math.sin(phase + (side < 0 ? 0 : Math.PI * .65))) };
}

/** Closed, tapered fingers follow the photographed inward curl. Elliptical
 * sections and sealed caps make the claw readable in oblique and rear views. */
function finger(points: Point[], radii: number[]) {
  const positions: number[] = [], indices: number[] = [], sides = 8;
  points.forEach(([x, y, z], i) => {
    const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(after[0] - before[0], after[1] - before[1]);
    const nx = -(after[1] - before[1]) / length, ny = (after[0] - before[0]) / length;
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2;
      positions.push(x + nx * Math.cos(angle) * radii[i], y + ny * Math.cos(angle) * radii[i], z + Math.sin(angle) * radii[i] * .68);
    }
    if (i) for (let j = 0; j < sides; j++) {
      const a = (i - 1) * sides + j, b = (i - 1) * sides + (j + 1) % sides, c = i * sides + j, d = i * sides + (j + 1) % sides;
      indices.push(a, b, c, b, d, c);
    }
  });
  for (const end of [0, points.length - 1]) {
    const center = positions.length / 3; positions.push(...points[end]);
    for (let j = 0; j < sides; j++) {
      const a = end * sides + j, b = end * sides + (j + 1) % sides;
      indices.push(center, end ? a : b, end ? b : a);
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  return geometry;
}

export function createDotonboriKaniSign(front: DotonboriFront, material?: MeshBasicMaterial) {
  const parts: DotonboriActionPart[] = [];
  const add = (id: string, color: string, geometry?: BufferGeometry) => {
    parts.push({ id: `${DOTONBORI_KANI_SIGN}-${id}`, sourceBuilding: front.building, group: DOTONBORI_KANI_SIGN, color, geometry });
    return parts.length - 1;
  };
  const sphere = (id: string, color: string, segments = 10) => add(id, color, new SphereGeometry(.5, segments, 8));
  const tube = (id: string, color: string, tip = .40) => add(id, color, new CylinderGeometry(tip, .5, 1, 8));
  const shellShape = new SphereGeometry(.5, 24, 16), shellVertices = shellShape.getAttribute('position');
  for (let i = 0; i < shellVertices.count; i++) {
    const y = shellVertices.getY(i);
    shellVertices.setX(i, shellVertices.getX(i) * (1 - .33 * Math.max(0, y * 2)));
  }
  const shell = add('carapace', SHELL, shellShape), lip = sphere('lower-shell', JOINT, 20);
  const brow = sphere('brow', SHELL), mouth = sphere('mouth', SHELL);
  const bumps = Array.from({ length: 22 }, (_, i) => sphere(`shell-nodule-${i}`, i % 3 ? S.coral : SHELL, 6));
  const sides = [-1, 1].map(side => ({ side,
    eyes: [tube(`${side}-eye-stalk`, JOINT), sphere(`${side}-eye`, S.charcoal), sphere(`${side}-eye-glint`, P.light, 6)],
    legs: [0, 1, 2, 3].map(leg => ({
      root: sphere(`${side}-${leg}-root`, JOINT), inner: tube(`${side}-${leg}-inner-leg`, SHELL),
      knee: sphere(`${side}-${leg}-knee`, JOINT), outer: tube(`${side}-${leg}-outer-leg`, S.coral, .07),
    })),
    claw: { upper: tube(`${side}-claw-arm`, SHELL), joint: sphere(`${side}-claw-joint`, JOINT),
      wrist: tube(`${side}-claw-wrist`, S.coral), palm: sphere(`${side}-claw-palm`, SHELL, 16),
      fingers: [-1, 1].map(jaw => add(`${side}-pincer-${jaw}`, JOINT,
        finger([[0, 0, 0], [.22, jaw * .07, 0], [.45, jaw * .08, 0], [.67, jaw * .035, 0]], [.115, .085, .048, .006]))) },
  }));
  const batch = new DotonboriActionBatch(DOTONBORI_KANI_SIGN, parts, material);
  const frame = new Matrix4().makeRotationY(front.yaw).scale(new Vector3(-1, 1, 1).divideScalar(front.size))
    .setPosition(frontPoint(front, 0, front.bottom + CENTER_Y, 0));
  const fingerFrame = new Matrix4(), local = new Matrix4();
  const swing = (root: Point, p: Point, angle: number): Point => {
    const x = p[0] - root[0], y = p[1] - root[1];
    return [root[0] + Math.cos(angle) * x - Math.sin(angle) * y, root[1] + Math.sin(angle) * x + Math.cos(angle) * y, p[2]];
  };
  let previous = NaN;
  const update = (time: number) => {
    if (time === previous) return; previous = time;
    batch.box(lip, frame, 0, -.05, .85, 2.05, 1.93, .59);
    batch.box(shell, frame, 0, 0, 1.01, 2.07, 2.08, .77);
    batch.box(brow, frame, 0, .66, 1.16, .85, .70, .36);
    batch.box(mouth, frame, 0, .31, 1.43, .40, .36, .075);
    for (let i = 0; i < bumps.length; i++) {
      const angle = i * 2.39996, radius = .30 + .46 * Math.sqrt((i + .5) / bumps.length);
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      const z = 1.01 + .385 * Math.sqrt(Math.max(0, 1 - (x / 1.035) ** 2 - (y / 1.04) ** 2));
      batch.box(bumps[i], frame, x, y, z, .10 + i % 3 * .018, .065, .045);
    }
    for (const { side, eyes, legs, claw } of sides) {
      const eye: Point = [side * .29, 1.16, 1.17];
      batch.beam(eyes[0], frame, [side * .21, .82, 1.16], eye, .095);
      batch.box(eyes[1], frame, ...eye, .17, .18, .15);
      batch.box(eyes[2], frame, eye[0] - .025, eye[1] + .027, eye[2] + .069, .04, .04, .018);
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i], root: Point = [side * (.78 + Math.sin(i / 3 * Math.PI) * .14), .58 - i * .49, .91];
        const knee: Point = [side * [3.03, 3.25, 2.97, 1.84][i], [1.09, .51, -.32, -1.20][i], 1.02];
        const tip: Point = [side * [1.73, 1.56, 1.92, 2.26][i], [1.00, .85, .10, -.64][i], .92];
        const state = dotonboriKaniPose(time, side, i), bend = swing(root, knee, state.sweep * side), end = swing(root, tip, state.sweep * side);
        batch.box(leg.root, frame, ...root, .24, .23, .23);
        batch.beam(leg.inner, frame, root, bend, i === 3 ? .19 : .29);
        batch.box(leg.knee, frame, ...bend, .19, .18, .19);
        batch.beam(leg.outer, frame, bend, end, i === 3 ? .12 : .18);
      }
      const elbow: Point = [side * 1.65, 1.14, 1.02], wrist: Point = [side * 1.81, 1.69, 1.03];
      batch.beam(claw.upper, frame, [side * .59, .72, .98], elbow, .32);
      batch.box(claw.joint, frame, ...elbow, .33, .30, .30);
      batch.beam(claw.wrist, frame, elbow, wrist, .33);
      batch.box(claw.palm, frame, side * 1.47, 1.88, 1.04, .96, .47, .36);
      for (const [j, jaw] of [-1, 1].entries()) {
        const angle = -side * jaw * dotonboriKaniPose(time, side, 0).pincer;
        local.makeRotationZ(angle).scale(new Vector3(-side, 1, 1)).setPosition(side * 1.10, 1.88 + jaw * .075, 1.04);
        fingerFrame.multiplyMatrices(frame, local);
        batch.box(claw.fingers[j], fingerFrame, 0, 0, 0, 1, 1, 1);
      }
    }
    batch.commit();
  };
  batch.mesh.userData.evidence = 'S23 owner frontal/street photos and WSTV 2010 footage; fitted proportions and authored 12-second cycle';
  update(0);
  return { mesh: batch.mesh, material: batch.mesh.material, update, parts: batch.parts, front };
}

/** Six visible uplights and the rear bracket sit above the eave, outside the
 * source wall. These remain still while the sign mechanism moves. */
export function addDotonboriKaniSupports(b: DotonboriGeometry, front: DotonboriFront) {
  const p = (x: number, y: number, d: number) => frontPoint(front, x, front.bottom + y, d);
  b.box(p(0, 5.15, .46), 1.38, .85, .30, P.metal, front.yaw);
  for (const side of [-1, 1]) b.beam(p(side * .50, 4.75, .46), p(side * .50, 5.10, .81), .10, P.metal);
  for (let light = 0; light < 6; light++) {
    const x = (light - 2.5) * 1.42;
    b.beam(p(x, 3.64, .43), p(x, 4.02, 1.46), .04, P.metal);
    b.box(p(x, 4.05, 1.48), .28, .13, .20, P.dark, front.yaw);
    b.box(p(x, 4.12, 1.48), .23, .014, .15, P.warmWindow, front.yaw, false, true);
  }
}
