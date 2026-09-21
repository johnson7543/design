import type { PlaneGeometry } from 'three';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';
import { paintDotonboriLabel } from './dotonbori-lettering.ts';

/** Original, unbranded food/menu illustrations. S15 establishes local food
 * and riverwalk shop character, not a tenant assignment or a price list. */
export function paintDotonboriStorefronts(ctx: CanvasRenderingContext2D) {
  const cells = [
    ['たこ焼', S.coral, 7], ['お食事', S.navy, 7], ['甘味', S.gold, 7], ['珈琲', S.blue, 7],
    ['food', S.ivory, .64], ['cafe', S.ivory, .64], ['入口', S.navy, .64], ['display', S.navy, .64],
    ['かに料理', S.navy, 7], ['seafood', S.ivory, .64], ['directory', S.navy, .64], ['sweets', S.ivory, .64],
  ] as const;
  ctx.save(); ctx.scale(ctx.canvas.width / 2048, ctx.canvas.height / 1536);
  ctx.fillStyle = S.navy; ctx.fillRect(0, 0, 2048, 1536);
  for (let variant = 0; variant < 4; variant++) for (const [i, [kind, background, aspect]] of cells.entries()) {
    const cell = i + variant * 12;
    const h = 512 / aspect;
    ctx.save(); ctx.translate(cell % 8 * 256 + 3, Math.floor(cell / 8) * 256 + 3); ctx.scale(250 / 512, 250 / h);
    const paper = variant === 1 ? S.navy : variant === 2 ? S.ivory : variant === 3 ? S.charcoal : background;
    const ink = paper === S.ivory || paper === S.gold ? S.navy : S.ivory;
    ctx.fillStyle = paper; ctx.fillRect(0, 0, 512, h);
    if (i < 4 || kind === 'かに料理') {
      ctx.strokeStyle = ink; ctx.lineWidth = 3;
      if (variant === 0) ctx.strokeRect(8, 6, 496, h - 12);
      else if (variant === 1) { ctx.fillStyle = S.gold; ctx.fillRect(8, 8, 28, h - 16); }
      else if (variant === 2) { ctx.fillStyle = S.coral; ctx.fillRect(30, h - 8, 452, 4); }
      else { ctx.fillStyle = S.gold; ctx.beginPath(); ctx.arc(51, h / 2, 17, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = ink; paintDotonboriLabel(ctx, kind, variant === 3 ? 293 : 256, h / 2, variant === 3 ? 319 : 365, h * .62);
    } else if (kind === 'food' || kind === 'cafe' || kind === 'seafood' || kind === 'sweets') {
      ctx.fillStyle = ink; paintDotonboriLabel(ctx, 'お品書', 256, 65, 362, 66);
      const rows = variant === 2 ? 2 : 3;
      for (let row = 0; row < rows; row++) {
        const y = 210 + row * (rows === 2 ? 315 : 215);
        ctx.save(); if (variant === 1) { ctx.translate(512, 0); ctx.scale(-1, 1); }
        ctx.fillStyle = S.highRise; ctx.beginPath(); ctx.ellipse(173, y + 25, 126, 61, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = row === 1 ? S.coral : S.gold;
        if (kind === 'seafood') {
          ctx.strokeStyle = S.coral; ctx.lineWidth = 11;
          for (const side of [-1, 1]) for (let leg = 0; leg < 4; leg++) {
            ctx.beginPath(); ctx.moveTo(173 + side * 34, y - 27 + leg * 14);
            ctx.lineTo(173 + side * 78, y - 46 + leg * 30); ctx.lineTo(173 + side * 116, y - 29 + leg * 25); ctx.stroke();
          }
          ctx.fillStyle = S.coral; ctx.beginPath(); ctx.ellipse(173, y, 51, 41, 0, 0, Math.PI * 2); ctx.fill();
        } else if (kind === 'sweets') {
          for (let cake = 0; cake < 3; cake++) {
            const x = 76 + cake * 77;
            ctx.fillStyle = S.gold; ctx.fillRect(x, y - 26, 58, 60);
            ctx.fillStyle = S.ivory; ctx.fillRect(x, y - 31, 58, 12);
            ctx.fillStyle = S.coral; ctx.beginPath(); ctx.arc(x + 29, y - 39, 9, 0, Math.PI * 2); ctx.fill();
          }
        } else if (kind === 'food') {
          for (let n = 0; n < (row === 1 ? 3 : 6); n++) {
            ctx.beginPath(); ctx.ellipse(94 + n % 3 * 73, y - 7 + Math.floor(n / 3) * 49, 32, 23, 0, 0, Math.PI * 2); ctx.fill();
          }
          ctx.strokeStyle = S.navy; ctx.lineWidth = 5;
          for (let n = 0; n < 3; n++) { ctx.beginPath(); ctx.moveTo(81, y - 16 + n * 28); ctx.lineTo(261, y + 4 + n * 28); ctx.stroke(); }
        } else {
          ctx.fillRect(104, y - 65, 118, 95);
          ctx.strokeStyle = S.navy; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(237, y - 21, 33, -Math.PI / 2, Math.PI / 2); ctx.stroke();
          ctx.fillStyle = S.navy; ctx.beginPath(); ctx.ellipse(163, y - 65, 59, 14, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Graphic menu rules, with no invented prices or merchant copy.
        ctx.fillStyle = ink; ctx.fillRect(336, y - 29, 95 + variant * 7, 14); ctx.fillRect(336, y + 5, 65 + variant * 8, 10);
        ctx.fillStyle = S.highRise; ctx.fillRect(40, y + 101, 432, 3); ctx.restore();
      }
    } else if (kind === '入口' || kind === 'directory') {
      ctx.fillStyle = ink;
      if (kind === '入口') paintDotonboriLabel(ctx, kind, 256, 118, 335, 105);
      else {
        // Information symbol for display-only lobbies; it does not label a
        // window as an entrance where the local pavement level is unresolved.
        ctx.beginPath(); ctx.arc(256, 110, 60, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = paper; ctx.fillRect(247, 96, 18, 48); ctx.fillRect(247, 75, 18, 12);
      }
      for (let row = 0; row < 4 + variant % 3; row++) { ctx.fillStyle = row % 2 ? S.highRise : S.gold; ctx.fillRect(60, 246 + row * 73, 52, 31); ctx.fillRect(146, 253 + row * 73, 303, 14); }
    } else {
      ctx.fillStyle = S.blue; ctx.fillRect(22, 22, 468, h - 44);
      ctx.fillStyle = S.ivory; ctx.beginPath(); ctx.arc(256, 191, 72, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = S.coral; ctx.beginPath(); ctx.moveTo(166, 284); ctx.lineTo(346, 284); ctx.lineTo(407, 558); ctx.lineTo(105, 558); ctx.closePath(); ctx.fill();
      ctx.fillStyle = S.gold; ctx.fillRect(147, 639, 218, 12); ctx.fillRect(184, 678, 144, 7);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Four coordinated artwork treatments share one retained 2048 × 1536 atlas. */
export function mapDotonboriStoreArt(plane: PlaneGeometry, art: number, variant: number) {
  const cell = art + variant * 12, uv = plane.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + cell % 8) / 8, (uv.getY(i) + 5 - Math.floor(cell / 8)) / 6);
}
