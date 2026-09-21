import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { paintDotonboriLabel } from './dotonbori-lettering.ts';
import { DOTONBORI_SIGN_ARTWORK, DOTONBORI_SIGN_ATLAS, DOTONBORI_SIGN_GREEN } from './dotonbori-sign-layout.ts';

/** Original drawings directed by S6/S14, with each design painted at its real
 * panel aspect before packing the atlas. These are reference studies, not a
 * claim that the photographed campaigns are the current advertising inventory. */
export function paintDotonboriNightSigns(ctx: CanvasRenderingContext2D) {
  const { width, height } = DOTONBORI_SIGN_ATLAS;
  ctx.save(); ctx.scale(ctx.canvas.width / width, ctx.canvas.height / height);
  // Cell 12 is the private uploaded-logo backing; no Asahi artwork shows
  // through transparent pixels. Remaining cells are padded with the same ink.
  ctx.fillStyle = S.navy; ctx.fillRect(0, 0, width, height);
  for (const [i, [kind, background, aspect]] of DOTONBORI_SIGN_ARTWORK.entries()) {
    if (kind === 'logo') continue;
    const h = 512 / aspect;
    ctx.save(); ctx.translate((i % 4) * 512 + 2, Math.floor(i / 4) * 256 + 2); ctx.scale(508 / 512, 252 / h);
    ctx.beginPath(); ctx.rect(0, 0, 512, h); ctx.clip();
    ctx.fillStyle = background; ctx.fillRect(0, 0, 512, h);
    const label = (text: string, y: number, width = 458, height = 85, ink: string = S.ivory, x = 256) => {
      ctx.fillStyle = ink; paintDotonboriLabel(ctx, text, x, y, width, height);
    };
    if (kind === 'kani') {
      label('かに道楽 本店', h * .5, 450, h * .78, S.charcoal);
    } else if (kind === 'snow') {
      ctx.strokeStyle = S.ivory; ctx.lineWidth = 14; ctx.lineJoin = 'round';
      for (let arm = 0; arm < 6; arm++) {
        ctx.save(); ctx.translate(256, h * .40); ctx.rotate(arm * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -151);
        for (const y of [-70, -116]) { ctx.moveTo(-35, y - 26); ctx.lineTo(0, y); ctx.lineTo(35, y - 26); }
        ctx.stroke(); ctx.restore();
      }
      label('雪印メグミルク', h * .83, 465, 49);
    } else if (kind === 'estem') {
      ctx.fillStyle = S.blue; ctx.fillRect(115, 20, 282, h * .68);
      // The photographed E has a curved leading stroke and a separate cap.
      ctx.fillStyle = S.bay; ctx.strokeStyle = S.ivory; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(224, 56); ctx.quadraticCurveTo(195, 112, 190, 210);
      ctx.lineTo(313, 210); ctx.lineTo(310, 173); ctx.lineTo(241, 168); ctx.lineTo(244, 137);
      ctx.lineTo(301, 137); ctx.lineTo(296, 105); ctx.lineTo(249, 108); ctx.lineTo(263, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.coral; ctx.beginPath(); ctx.moveTo(224, 56); ctx.quadraticCurveTo(264, 23, 292, 39); ctx.lineTo(297, 65); ctx.closePath(); ctx.fill(); ctx.stroke();
      label('日商エステム', h * .87, 475, 57, S.blue);
    } else if (kind === 'kaigen') {
      ctx.fillStyle = S.ivory; ctx.fillRect(0, h * .44, 512, h * .56);
      label('かぜに', h * .15, 210, 39, S.blue, 137); label('改源', h * .36, 248, 81, S.coral, 140);
      // Wind ribbons and a compact original interpretation of the pictured
      // medicine sign character. Fine illustration remains approximate.
      ctx.strokeStyle = S.navy; ctx.lineWidth = 4;
      for (let wind = 0; wind < 3; wind++) {
        ctx.beginPath(); ctx.moveTo(0, 145 + wind * 30); ctx.bezierCurveTo(120, 206, 225, 133 + wind * 29, 355, 155); ctx.stroke();
      }
      ctx.fillStyle = S.bay; ctx.beginPath(); ctx.ellipse(407, 158, 64, 75, -.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.gold; ctx.beginPath();
      for (let k = 0; k < 14; k++) { const a = k * Math.PI / 7, r = k % 2 ? 39 : 57; const x = 407 + Math.cos(a) * r, y = 80 + Math.sin(a) * r; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.bay; ctx.beginPath(); ctx.ellipse(399, 102, 35, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = S.ivory; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(374, 87); ctx.lineTo(388, 90); ctx.moveTo(404, 90); ctx.lineTo(416, 85); ctx.stroke();
      ctx.fillStyle = S.coral; ctx.beginPath(); ctx.ellipse(396, 112, 18, 10, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = S.ivory; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(390, 106); ctx.quadraticCurveTo(377, 110, 365, 101); ctx.moveTo(400, 106); ctx.quadraticCurveTo(415, 111, 428, 99); ctx.stroke();
      ctx.strokeStyle = S.navy; ctx.lineWidth = 3; ctx.fillStyle = S.ivory;
      for (const x of [378, 427]) { ctx.beginPath(); ctx.moveTo(x - 5, 63); ctx.lineTo(x, 45); ctx.lineTo(x + 8, 66); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = S.bay; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(447, 128); ctx.bezierCurveTo(482, 49, 491, 117, 470, 142); ctx.stroke();
      for (const [x, y] of [[376, 216], [435, 219]]) { ctx.beginPath(); ctx.moveTo(x, 193); ctx.lineTo(x - 12, y); ctx.lineTo(x + 10, y); ctx.stroke(); }
      ctx.strokeStyle = S.coral; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(367, 164); ctx.quadraticCurveTo(411, 190, 449, 159); ctx.stroke();
    } else if (kind === 'chintai') {
      label('CHINTAI', h * .53, 473, 114);
      ctx.fillStyle = S.ivory;
      for (const x of [92, 178, 268, 435]) { ctx.beginPath(); ctx.moveTo(x - 15, 58); ctx.lineTo(x, 39); ctx.lineTo(x + 15, 58); ctx.closePath(); ctx.fill(); }
      ctx.fillRect(0, h - 30, 512, 30);
      ctx.fillStyle = S.blue; for (let x = 24; x < 490; x += 50) ctx.fillRect(x, h - 19, 28, 6);
    } else if (kind === 'promise') {
      label('プロミス', h * .50, 465, 103, S.blue);
    } else if (kind === 'samty') {
      ctx.fillStyle = S.ivory;
      for (let y = 0; y < 3; y++) { ctx.beginPath(); ctx.roundRect(28, 43 + y * 29, 57, 21, [14, 1, 14, 1]); ctx.fill(); }
      label('SAMTY', h * .52, 371, 70, S.ivory, 305);
    } else if (kind === 'asahi') {
      // Corrugated gold backing and the tall silver can visible in S6.
      ctx.save(); ctx.globalAlpha = .14; ctx.fillStyle = S.ivory;
      for (let x = 10; x < 512; x += 20) ctx.fillRect(x, 0, 5, h); ctx.restore();
      label('SUPER DRY', h * .10, 458, 65, S.coral);
      ctx.save(); ctx.translate(255, h * .56); ctx.rotate(.10);
      ctx.fillStyle = S.highRise; ctx.strokeStyle = S.navy; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(-137, -h * .30, 274, h * .66, 32); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.ivory; ctx.fillRect(-116, -h * .25, 221, h * .50);
      ctx.fillStyle = S.highRise; ctx.beginPath(); ctx.ellipse(0, -h * .27, 127, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -h * .27, 34, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.save(); ctx.transform(1, 0, -.15, 1, 0, 0); label('Asahi', -h * .02, 245, 90, S.navy, 0); ctx.restore();
      label('SUPER DRY', h * .12, 235, 37, S.coral, 0);
      ctx.strokeStyle = S.navy; ctx.lineWidth = 2;
      for (const y of [h * .20, h * .22, h * .25]) { ctx.beginPath(); ctx.moveTo(-98, y); ctx.lineTo(98, y); ctx.stroke(); }
      ctx.restore();
    } else if (kind === 'milk') {
      ctx.fillStyle = S.bay; ctx.fillRect(0, h * .27, 512, h * .66);
      ctx.fillStyle = S.ivory; ctx.beginPath(); ctx.ellipse(256, h * .25, 238, 147, 0, 0, Math.PI * 2); ctx.fill();
      label('牧場の朝', h * .23, 450, 100, S.blue);
      // S14's dairy campaign, drawn here from simple paths, not a photo crop.
      ctx.fillStyle = S.ivory; ctx.strokeStyle = S.navy; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(277, h * .65, 148, h * .206, -.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (const x of [148, 405]) { ctx.beginPath(); ctx.ellipse(x, h * .47, 60, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(279, h * .49, 136, h * .110, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.navy; ctx.beginPath(); ctx.ellipse(292, h * .41, 76, 36, .2, 0, Math.PI * 2); ctx.fill();
      for (const x of [220, 330]) { ctx.beginPath(); ctx.arc(x, h * .49, 13, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = S.coral; ctx.globalAlpha = .65; ctx.beginPath(); ctx.ellipse(278, h * .56, 96, 37, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = S.navy; ctx.beginPath(); ctx.ellipse(203, h * .72, 56, h * .066, -.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = S.blue; ctx.fillRect(0, h * .93, 512, h * .07); label('雪印メグミルク', h * .963, 467, 40);
    } else if (kind === 'snow-message') {
      label('明日を、元気に！', h * .50, 466, h * .66);
    } else if (kind === 'hanalangue') {
      // S14: the yellow flower-shaped biscuit advert below SAMTY, above
      // the lower service windows. It does not identify a ground-floor tenant.
      ctx.fillStyle = S.ivory; ctx.strokeStyle = S.charcoal; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let step = 0; step <= 100; step++) {
        const a = step * Math.PI / 50, r = 67 + 16 * Math.cos(a * 5);
        const x = 112 + Math.cos(a) * r, y = h * .51 + Math.sin(a) * r * .78;
        if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = S.gold; ctx.beginPath(); ctx.ellipse(112, h * .51, 47, 39, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = S.ivory; ctx.beginPath(); ctx.ellipse(108, h * .52, 33, 27, 0, 0, Math.PI * 2); ctx.fill();
      for (const [x, y, ink] of [[103, .46, S.coral], [122, .54, S.charcoal], [97, .59, S.coral]] as const) {
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, h * y, 8, 0, Math.PI * 2); ctx.fill();
      }
      label('大阪土産', h * .32, 230, 26, S.coral, 346);
      label('大阪 花ラング', h * .60, 282, 40, S.charcoal, 346);
    } else if (kind === 'fancl') {
      label('なにげない感動をずっと。', h * .37, 464, 35, S.navy);
      label('FANCL', h * .53, 456, 110, S.blue);
    } else if (kind === 'pip' || kind === 'pip-clock') {
      const clock = kind === 'pip-clock', cy = clock ? h * .41 : h * .38;
      if (clock) {
        ctx.strokeStyle = DOTONBORI_SIGN_GREEN; ctx.lineWidth = 3;
        for (const side of [-1, 1]) for (let k = 0; k < 10; k++) {
          const y = 35 + k * h * .065;
          ctx.beginPath(); ctx.ellipse(256 + side * 225, y, 16, 28, side * .55, 0, Math.PI * 2); ctx.stroke();
        }
        const radius = 182;
        for (let hour = 1; hour <= 12; hour++) {
          const a = hour * Math.PI / 6;
          label(String(hour), cy - Math.cos(a) * radius, 46, 44, S.navy, 256 + Math.sin(a) * radius);
        }
        ctx.strokeStyle = S.navy; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(256, cy); ctx.lineTo(406, cy + 5); ctx.moveTo(256, cy); ctx.lineTo(195, cy + 84); ctx.stroke();
        ctx.fillStyle = S.navy; ctx.beginPath(); ctx.arc(256, cy, 14, 0, Math.PI * 2); ctx.fill();
      }
      const markY = clock ? h * .81 : cy, markX = clock ? 154 : 256, r = clock ? 54 : 147;
      ctx.fillStyle = DOTONBORI_SIGN_GREEN; ctx.beginPath(); ctx.ellipse(markX, markY, r, r * .58, -.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(markX - r * .45, markY); ctx.lineTo(markX - r * .55, markY + r * 1.18); ctx.lineTo(markX + r * .22, markY + r * .22); ctx.closePath(); ctx.fill();
      label('P!', markY, r * 1.2, r * .90, S.ivory, markX);
      label('ピップ', clock ? h * .825 : h * .73, clock ? 170 : 323, clock ? 59 : 77, S.navy, clock ? 332 : 256);
    } else if (kind === 'salonpas') {
      ctx.fillStyle = S.ivory; ctx.fillRect(0, 0, 235, h);
      // The inspected south-face campaign has a portrait at left and the
      // product name at right. The miniature uses original simplified paths.
      ctx.fillStyle = S.highRise; ctx.beginPath(); ctx.moveTo(14, h); ctx.lineTo(41, h * .70); ctx.lineTo(169, h * .64); ctx.lineTo(236, h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.ivory; ctx.beginPath(); ctx.ellipse(111, h * .48, 76, h * .23, .12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = S.charcoal; ctx.beginPath(); ctx.ellipse(109, h * .33, 79, h * .14, .18, Math.PI, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = S.navy; ctx.lineWidth = 4;
      for (const x of [77, 145]) { ctx.beginPath(); ctx.ellipse(x, h * .45, 30, 20, -.07, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(107, h * .45); ctx.lineTo(115, h * .45); ctx.moveTo(92, h * .60); ctx.quadraticCurveTo(117, h * .63, 137, h * .59); ctx.stroke();
      label('サロンパス', h * .35, 249, 67, S.ivory, 373);
      ctx.fillStyle = S.ivory; ctx.fillRect(287, h * .60, 178, h * .20);
      ctx.fillStyle = DOTONBORI_SIGN_GREEN; ctx.fillRect(297, h * .62, 158, h * .08);
      label('サロンパス', h * .745, 152, 25, DOTONBORI_SIGN_GREEN, 376);
    } else if (kind === 'hm') {
      for (let poster = 0; poster < 3; poster++) {
        const x = 8 + poster * 168, cx = x + 81;
        ctx.fillStyle = poster === 1 ? S.blue : S.bay; ctx.fillRect(x, 5, 160, h - 10);
        ctx.fillStyle = S.ivory; ctx.beginPath(); ctx.ellipse(cx, h * .22, 11, 14, poster === 1 ? -.15 : .1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = poster === 1 ? S.ivory : S.navy;
        ctx.beginPath(); ctx.moveTo(cx - 13, h * .32); ctx.lineTo(cx + 14, h * .32); ctx.lineTo(cx + 27, h * .77); ctx.lineTo(cx - 25, h * .77); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = S.navy; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(cx - 9, h * .71); ctx.lineTo(cx - 13, h * .92); ctx.moveTo(cx + 9, h * .71); ctx.lineTo(cx + 19, h * .92); ctx.stroke();
        label('H&M', h * .88, 43, 24, S.coral, x + 128);
      }
    } else if (kind === 'screen') {
      ctx.fillStyle = S.navy; ctx.fillRect(12, 12, 488, h - 24);
      ctx.fillStyle = S.blue; ctx.fillRect(27, 30, 458, h - 60);
    } else label(kind === 'aqua' ? 'AQUA' : 'Haier', h * .51, 459, 148, kind === 'aqua' ? S.blue : S.ivory);
    // Subtle LED row structure, separated from lettering and never animated.
    ctx.globalAlpha = .06; ctx.fillStyle = S.navy;
    for (let y = 2; y < h; y += h / 100) ctx.fillRect(0, y, 512, h / 900);
    ctx.restore();
  }
  ctx.restore();
}
