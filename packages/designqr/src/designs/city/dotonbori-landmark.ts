import { CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import type { DotonboriLibrary } from './dotonbori-assets.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { dotonboriBridgePoint } from './dotonbori-detail-layout.ts';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { frontPoint, libraryDotonboriFronts } from './dotonbori-facade-layout.ts';
import type { DotonboriFragment } from './dotonbori-ownership.ts';
import { DOTONBORI_REFERENCE_HOSTS } from './dotonbori-composition.ts';
import { paintDotonboriLabel } from './dotonbori-lettering.ts';
import { createDotonboriGlicoProgram, DOTONBORI_GLICO_SIGN_ID, type DotonboriGlicoArtwork } from './dotonbori-glico-animation.ts';

/** An original vector interpretation of the owner's frontal reference. No
 * downloaded photograph or advertising texture is redistributed with the model. */
export function paintDotonboriGlico(ctx: CanvasRenderingContext2D, artwork: DotonboriGlicoArtwork = 'track') {
  ctx.scale(ctx.canvas.width / 1000, ctx.canvas.height / 1926);
  ctx.fillStyle = S.blue; ctx.fillRect(0, 0, 1000, 1926);
  if (artwork === 'rainbow') {
    // Owner/manufacturer photographs in NEOS 149, museum11.jpg: a rainbow
    // above a pale distant landscape and a road widening toward the viewer.
    // Retain the player's current header/figure and map the backdrop to Osaka roles.
    ctx.fillStyle = S.highRise; ctx.beginPath(); ctx.moveTo(0, 1130);
    ctx.lineTo(145, 1050); ctx.lineTo(295, 1145); ctx.lineTo(455, 1050);
    ctx.lineTo(655, 1120); ctx.lineTo(850, 1010); ctx.lineTo(1000, 1100);
    ctx.lineTo(1000, 1926); ctx.lineTo(0, 1926); ctx.closePath(); ctx.fill();
    ctx.fillStyle = S.ivory; ctx.beginPath(); ctx.moveTo(420, 1150); ctx.lineTo(580, 1150);
    ctx.lineTo(960, 1926); ctx.lineTo(40, 1926); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = S.navy; ctx.lineWidth = 8;
    for (const x of [90, 310, 690, 910]) {
      ctx.beginPath(); ctx.moveTo(500 + (x - 500) * .13, 1150); ctx.lineTo(x, 1926); ctx.stroke();
    }
    ctx.lineWidth = 23;
    for (const [i, color] of [S.coral, S.gold, S.bay, S.blue].entries()) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.ellipse(500, 830, 397 - i * 23, 397 - i * 23, 0, Math.PI, Math.PI * 2); ctx.stroke();
    }
  } else {
    ctx.strokeStyle = S.highRise; ctx.lineWidth = 5;
    for (const x of [-1200, -420, 230, 770, 1420, 2200]) {
      ctx.beginPath(); ctx.moveTo(500, 870); ctx.lineTo(x, 1926); ctx.stroke();
    }
    ctx.fillStyle = S.coral; ctx.beginPath(); ctx.arc(500, 910, 330, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = S.ivory; ctx.fillRect(0, 0, 1000, 318);
  // Original fixed strokes of the script header visible in S6. System
  // `cursive` fonts otherwise silently turn the wordmark into plain serif text.
  ctx.save(); ctx.translate(237, 93); ctx.strokeStyle = S.coral; ctx.lineWidth = 17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(134, 38); ctx.bezierCurveTo(154, -8, 67, -18, 34, 36);
  ctx.bezierCurveTo(-8, 108, 58, 155, 108, 108); ctx.bezierCurveTo(142, 77, 149, 44, 119, 65);
  ctx.bezierCurveTo(97, 81, 75, 86, 66, 73); ctx.moveTo(128, 82);
  ctx.bezierCurveTo(108, 130, 99, 193, 75, 172); ctx.bezierCurveTo(63, 152, 135, 133, 159, 106);
  ctx.bezierCurveTo(189, 77, 204, -19, 179, 0); ctx.bezierCurveTo(150, 22, 145, 131, 184, 122);
  ctx.bezierCurveTo(206, 119, 214, 91, 222, 73); ctx.bezierCurveTo(209, 120, 224, 134, 245, 116);
  ctx.bezierCurveTo(257, 107, 262, 83, 280, 77); ctx.bezierCurveTo(314, 58, 333, 79, 309, 91);
  ctx.bezierCurveTo(306, 68, 274, 68, 268, 99); ctx.bezierCurveTo(255, 137, 311, 139, 342, 102);
  ctx.bezierCurveTo(357, 61, 397, 65, 394, 102); ctx.bezierCurveTo(390, 141, 344, 139, 340, 108);
  ctx.bezierCurveTo(338, 84, 354, 82, 370, 96); ctx.bezierCurveTo(398, 120, 431, 126, 468, 104);
  ctx.bezierCurveTo(487, 88, 491, 119, 462, 124); ctx.bezierCurveTo(432, 132, 394, 128, 367, 123); ctx.stroke();
  ctx.fillStyle = S.coral; ctx.beginPath(); ctx.arc(231, 44, 10, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const limb = (points: number[][], width: number) => {
    for (const [color, stroke] of [[S.navy, width + 20], [S.ivory, width]] as const) {
      ctx.strokeStyle = color; ctx.lineWidth = stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
  };
  // S6/S17 show the bent leg's calf and narrow shoe tucked behind its knee.
  // Paint them first: a sole over the thigh reads as a kick toward the viewer.
  limb([[559, 1290], [544, 1360], [549, 1400]], 34);
  ctx.fillStyle = S.navy; ctx.beginPath(); ctx.ellipse(551, 1410, 22, 45, -.12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = S.ivory; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(541, 1394); ctx.quadraticCurveTo(537, 1425, 553, 1435); ctx.stroke();
  const shape = (trace: () => void, fill: string = S.ivory, width = 12) => {
    ctx.fillStyle = fill; ctx.strokeStyle = S.navy; ctx.lineWidth = width; ctx.lineJoin = 'round';
    ctx.beginPath(); trace(); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  // Tapered calves, separate knees and asymmetric fists follow the owner still;
  // the raised calf stays behind the forward thigh throughout both LED looks.
  shape(() => {
    ctx.moveTo(426, 1178); ctx.bezierCurveTo(420, 1280, 459, 1418, 455, 1480);
    ctx.bezierCurveTo(451, 1545, 455, 1655, 446, 1723); ctx.lineTo(489, 1723);
    ctx.bezierCurveTo(502, 1609, 510, 1524, 512, 1478);
    ctx.bezierCurveTo(520, 1380, 506, 1260, 508, 1187);
  });
  shape(() => {
    ctx.moveTo(505, 1177); ctx.bezierCurveTo(503, 1220, 522, 1327, 546, 1348);
    ctx.bezierCurveTo(564, 1363, 596, 1341, 602, 1313);
    ctx.bezierCurveTo(609, 1268, 590, 1208, 573, 1174);
  });
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(500, 0); ctx.scale(side, 1);
    shape(() => {
      ctx.moveTo(80, 735); ctx.bezierCurveTo(127, 711, 174, 655, 231, 607);
      ctx.bezierCurveTo(275, 556, 325, 468, 365, 407);
      ctx.lineTo(402, 424); ctx.bezierCurveTo(368, 506, 332, 578, 275, 646);
      ctx.bezierCurveTo(234, 699, 162, 761, 111, 792);
    });
    shape(() => {
      ctx.moveTo(365, 410); ctx.lineTo(370, 378); ctx.lineTo(376, 360);
      ctx.quadraticCurveTo(381, 347, 389, 354); ctx.lineTo(390, 376);
      ctx.lineTo(397, 350); ctx.quadraticCurveTo(403, 340, 410, 348);
      ctx.lineTo(411, 367); ctx.quadraticCurveTo(427, 362, 429, 377);
      ctx.lineTo(421, 406); ctx.lineTo(402, 426);
    }, S.ivory, 9);
    ctx.strokeStyle = S.navy; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(392, 380); ctx.lineTo(402, 401); ctx.lineTo(414, 385);
    ctx.moveTo(259, 607); ctx.quadraticCurveTo(263, 621, 251, 635);
    ctx.moveTo(117, 756); ctx.quadraticCurveTo(166, 727, 197, 689); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = S.ivory; ctx.strokeStyle = S.navy; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(405, 748); ctx.lineTo(453, 726); ctx.quadraticCurveTo(500, 782, 547, 726); ctx.lineTo(595, 748);
  ctx.bezierCurveTo(568, 866, 575, 977, 571, 1102); ctx.lineTo(586, 1190);
  ctx.quadraticCurveTo(536, 1211, 500, 1197); ctx.quadraticCurveTo(463, 1211, 414, 1190);
  ctx.lineTo(429, 1102); ctx.bezierCurveTo(425, 977, 432, 866, 405, 748); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = S.coral; ctx.beginPath(); ctx.moveTo(410, 773); ctx.lineTo(442, 1020); ctx.lineTo(461, 1160);
  ctx.lineTo(434, 1160); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(590, 773); ctx.lineTo(558, 1020); ctx.lineTo(539, 1160); ctx.lineTo(566, 1160); ctx.closePath(); ctx.fill();
  shape(() => { ctx.moveTo(474, 700); ctx.lineTo(470, 742); ctx.quadraticCurveTo(500, 769, 531, 742); ctx.lineTo(524, 700); });
  shape(() => {
    ctx.moveTo(439, 611); ctx.quadraticCurveTo(436, 565, 482, 564);
    ctx.quadraticCurveTo(552, 553, 563, 607); ctx.lineTo(558, 670);
    ctx.quadraticCurveTo(551, 708, 516, 728); ctx.lineTo(483, 731);
    ctx.quadraticCurveTo(446, 706, 440, 672); ctx.lineTo(433, 646);
  });
  shape(() => {
    ctx.moveTo(441, 627); ctx.lineTo(434, 589); ctx.quadraticCurveTo(443, 556, 482, 557);
    ctx.quadraticCurveTo(542, 544, 563, 582); ctx.lineTo(561, 626); ctx.lineTo(546, 600);
    ctx.lineTo(521, 591); ctx.lineTo(496, 603); ctx.lineTo(470, 589); ctx.lineTo(454, 609); ctx.lineTo(452, 628);
  }, S.navy, 5);
  ctx.strokeStyle = S.navy; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(457, 636); ctx.quadraticCurveTo(472, 627, 487, 635);
  ctx.moveTo(516, 635); ctx.quadraticCurveTo(531, 628, 546, 636);
  ctx.moveTo(470, 648); ctx.lineTo(482, 648); ctx.moveTo(522, 648); ctx.lineTo(535, 648);
  ctx.moveTo(501, 645); ctx.lineTo(492, 677); ctx.lineTo(505, 681);
  ctx.moveTo(482, 696); ctx.quadraticCurveTo(504, 707, 527, 691);
  ctx.moveTo(492, 713); ctx.lineTo(513, 711); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(440, 1114); ctx.quadraticCurveTo(500, 1127, 562, 1114);
  ctx.moveTo(447, 1133); ctx.quadraticCurveTo(500, 1142, 555, 1133);
  ctx.moveTo(468, 1460); ctx.quadraticCurveTo(482, 1481, 493, 1458);
  ctx.moveTo(535, 1289); ctx.quadraticCurveTo(557, 1309, 580, 1290); ctx.stroke();
  ctx.save(); ctx.globalAlpha = .13; ctx.fillStyle = S.navy;
  ctx.beginPath(); ctx.moveTo(429, 808); ctx.quadraticCurveTo(448, 899, 446, 1078);
  ctx.lineTo(459, 1120); ctx.lineTo(435, 1110); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(433, 1246); ctx.quadraticCurveTo(469, 1416, 468, 1450);
  ctx.lineTo(453, 1414); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = S.coral;
  for (const [i, label] of ['グ', 'リ', 'コ'].entries()) paintDotonboriLabel(ctx, label, 500, 839 + i * 105, 94, 94);
  shape(() => { ctx.moveTo(445, 1710); ctx.lineTo(489, 1713); ctx.lineTo(491, 1751);
    ctx.quadraticCurveTo(490, 1808, 462, 1797); ctx.quadraticCurveTo(435, 1777, 439, 1744); }, S.navy, 8);
  ctx.strokeStyle = S.ivory; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(448, 1755); ctx.quadraticCurveTo(457, 1786, 475, 1780);
  for (let y = 1721; y < 1744; y += 8) { ctx.moveTo(453, y); ctx.lineTo(479, y + 2); } ctx.stroke();
}

export function paintDotonboriBridgeName(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = P.stone; ctx.fillRect(0, 0, 512, 84);
  ctx.fillStyle = P.dark; paintDotonboriLabel(ctx, 'えびす橋', 256, 42, 350, 46);
}

export function createDotonboriLandmark(library: DotonboriLibrary) {
  const { layout } = library, size = layout.tileSizeM, root = new Group();
  root.name = 'dotonbori-reference-frontage';
  const materials: MeshBasicMaterial[] = [], fragments: DotonboriFragment[] = [];
  const b = new DotonboriGeometry(size, 'dotonbori-glico-frontage');
  const sourceBuilding = b.buildingId = DOTONBORI_REFERENCE_HOSTS.B040;
  // Preserve the owner's 10.38 × 20 m panel while registering its normal to
  // B040's source wall. Its small frame overhang is intentional; glazing is
  // owned by the common reference-facade layer, never a second skin here.
  const front = libraryDotonboriFronts(library).find(f => f.id === 'B040')!;
  const bottom = 5.4, width = 10.38, height = 20, angle = layout.rotationYRadians;
  const point = (x: number, y: number, offset = .44) => frontPoint(front, x, y, offset);
  b.box(point(0, bottom + height / 2, .30), width + .36, height + .34, .18, P.metal, front.yaw);
  for (const side of [-1, 1]) {
    b.box(point(side * (width / 2 + .06), bottom + height / 2, .47), .11, height, .10, P.dark, front.yaw, false);
    b.box(point(0, bottom + height * (side + 1) / 2 + side * .06, .47), width + .22, .11, .10, P.dark, front.yaw, false);
  }
  const detailMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true }); materials.push(detailMaterial);
  const frame = new Mesh(b.finish(), detailMaterial); frame.name = 'dotonbori-glico-frame'; root.add(frame);
  frame.userData.sourceBuilding = sourceBuilding;
  const center = point(0, bottom + height / 2);
  const signPlane = new PlaneGeometry(width / size, height / size).rotateY(front.yaw).translate(center.x, center.y, center.z);
  const texture = (w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    if (typeof document === 'undefined') return undefined;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); if (!ctx) return undefined;
    paint(ctx); const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 2; return map;
  };
  const program = createDotonboriGlicoProgram(paintDotonboriGlico), material = program.material; materials.push(material);
  const sign = new Mesh(signPlane, material); sign.name = DOTONBORI_GLICO_SIGN_ID; root.add(sign);
  sign.userData.sourceBuilding = sourceBuilding;
  for (const side of [-1, 1]) {
    const p = point(side * width / 4, bottom + height / 2);
    fragments.push({ x: p.x, y: p.y, z: p.z, width: width / 2 / size, height: height / size, depth: .001,
      color: S.blue, angle: front.yaw, kind: 'sign', group: DOTONBORI_GLICO_SIGN_ID,
      sourceBuilding, id: `${DOTONBORI_GLICO_SIGN_ID}-${side}` });
  }
  const morphSigns = [{ sourceBuilding, mesh: sign, panel: { id: DOTONBORI_GLICO_SIGN_ID,
    path: [-1, 1].map(side => { const p = point(side * width / 2, bottom + height / 2); return { x: p.x, z: p.z }; }),
    y: center.y, width: width / size, height: height / size, design: 0 } }];
  const bridgeMap = texture(512, 84, paintDotonboriBridgeName);
  const nameMaterial = new MeshBasicMaterial({ ...(bridgeMap ? { map: bridgeMap } : { color: P.stone }), transparent: true }); materials.push(nameMaterial);
  for (const side of [-1, 1]) {
    const p = dotonboriBridgePoint(library.waterfront, layout, side * 9.25, 0, 4.77);
    const mesh = new Mesh(new PlaneGeometry(3.8 / size, .46 / size), nameMaterial);
    mesh.rotation.y = angle + side * Math.PI / 2; mesh.position.copy(p); mesh.name = `dotonbori-bridge-name-${side}`; root.add(mesh);
  }
  return { root, materials, morphSigns, update: program.update,
    snapshot: () => [...b.fragments, ...fragments.map(fragment => ({ ...fragment,
      color: '#' + new Color(S.blue).lerp(new Color(S.highRise), program.blend.value).getHexString() }))] };
}
