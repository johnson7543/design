import { DOTONBORI_LETTERING } from './dotonbori-lettering-data.ts';

/** Fit a complete, pre-outlined label into a centered box without depending on
 * installed CJK fonts. Font coordinates are y-up; canvas coordinates are y-down. */
export function paintDotonboriLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, width: number, height: number) {
  const outline = DOTONBORI_LETTERING[label];
  if (!outline) throw new Error(`Missing Dōtonbori lettering: ${label}`);
  const scale = Math.min(height, width / outline.width);
  ctx.save(); ctx.translate(x - outline.width * scale / 2, y + scale / 2); ctx.scale(scale, -scale); ctx.beginPath();
  for (const [op, ...p] of outline.commands) {
    if (op === 0) ctx.moveTo(p[0], p[1]);
    else if (op === 1) ctx.lineTo(p[0], p[1]);
    else if (op === 2) ctx.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
    else if (op === 3) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else ctx.closePath();
  }
  ctx.fill(); ctx.restore();
}
