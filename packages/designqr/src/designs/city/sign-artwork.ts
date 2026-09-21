import { SHIBUYA_PALETTE as P } from './palette.ts';
import { paintCitySignText } from './sign-rendering.ts';

export interface CitySignDesign {
  layout: 'screen' | 'fashion' | 'vertical' | 'tenants' | 'cafe' | 'lightbox';
  background: string;
  ink: string;
  accent: string;
  secondary: string;
  label: string;
  caption: string;
}

/** Original artwork inspired by crossing screens and Center-Gai shop signs.
 * Color pairings are curated per sign, not sampled from the building facade. */
export const CITY_SIGN_DESIGNS: readonly Readonly<CitySignDesign>[] = Object.freeze([
  { layout: 'screen', background: P.ink, ink: P.stone, accent: P.glassLight, secondary: P.blue, label: 'SHIBUYA', caption: 'SCRAMBLE CROSSING' },
  { layout: 'fashion', background: P.stone, ink: P.blue, accent: P.ink, secondary: P.coolLight, label: '109', caption: 'SHIBUYA / FASHION' },
  { layout: 'vertical', background: P.blue, ink: P.stone, accent: P.warmLight, secondary: P.ink, label: 'カラオケ', caption: 'KARAOKE' },
  { layout: 'screen', background: P.blue, ink: P.stone, accent: P.coolLight, secondary: P.ink, label: 'TOKYO', caption: 'CITY VISION' },
  { layout: 'screen', background: P.ink, ink: P.stone, accent: P.coral, secondary: P.glassLight, label: 'MUSIC', caption: 'LIVE / RECORDS' },
  { layout: 'tenants', background: P.concrete, ink: P.ink, accent: P.blue, secondary: P.stone, label: '24H', caption: 'OPEN ALL NIGHT' },
  { layout: 'cafe', background: P.roof, ink: P.stone, accent: P.warmLight, secondary: P.glassLight, label: 'COFFEE', caption: 'ROAST / BREW' },
  { layout: 'screen', background: P.sky, ink: P.ink, accent: P.stone, secondary: P.blue, label: 'SKY', caption: 'ABOVE THE CITY' },
  { layout: 'tenants', background: P.stone, ink: P.ink, accent: P.blue, secondary: P.glassLight, label: 'BOOKS', caption: 'READ / DISCOVER' },
  { layout: 'lightbox', background: P.glassLight, ink: P.ink, accent: P.stone, secondary: P.blue, label: 'MIRAI', caption: 'DESIGN / FUTURE' },
  { layout: 'lightbox', background: P.concrete, ink: P.ink, accent: P.blue, secondary: P.windowLight, label: 'STATION', caption: 'SHIBUYA' },
  { layout: 'cafe', background: P.ink, ink: P.stone, accent: P.coral, secondary: P.windowLight, label: 'NIGHT', caption: 'BAR / LOUNGE' },
  { layout: 'vertical', background: P.windowLight, ink: P.ink, accent: P.warmLight, secondary: P.blue, label: 'ラーメン', caption: 'RAMEN' },
  { layout: 'tenants', background: P.blue, ink: P.stone, accent: P.glassLight, secondary: P.ink, label: 'PLAY', caption: 'ARCADE / GAMES' },
].map(design => Object.freeze(design as CitySignDesign)));

/** Paint once per sign; only the configured-logo billboard needs repainting.
 * Flat colors stay on-palette. No external fonts, images, or per-frame uploads. */
export function paintCitySign(context: CanvasRenderingContext2D, design: Readonly<CitySignDesign>, hasLogo = false, paintText = paintCitySignText) {
  const { width: w, height: h } = context.canvas;
  const d = design;
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    context.fillStyle = color;
    context.fillRect(x * w, y * h, width * w, height * h);
  };
  const text = (label: string, x: number, y: number, size: number, width: number, color: string, font = '900') => {
    paintText(context, label, x * w, y * h, size * h, width * w, color, font);
  };
  const disk = (x: number, y: number, radius: number, color: string) => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x * w, y * h, radius * Math.min(w, h), 0, Math.PI * 2);
    context.fill();
  };

  context.save();
  context.globalAlpha = 1;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  rect(0, 0, 1, 1, d.background);

  switch (d.layout) {
    case 'screen':
      // Asymmetric campaign panels and a ticker replace the repeated box frame.
      rect(0, 0, .23, .10, d.accent);
      rect(.23, 0, .77, .035, d.secondary);
      rect(0, .86, 1, .14, d.secondary);
      if (!hasLogo) {
        disk(.76, .40, .27, d.accent);
        disk(.80, .38, .19, d.background);
        rect(.08, .30, .40, .055, d.accent);
        text(d.label, .47, .59, .30, .88, d.ink);
        text('LIVE', .13, .16, .095, .20, d.ink);
      }
      text(d.caption, .50, .93, .075, .85, d.ink);
      break;
    case 'fashion':
      // A light cylinder with blue lettering and a soft reflected-light disk.
      rect(0, 0, .035, 1, d.ink);
      rect(.965, 0, .035, 1, d.ink);
      disk(.77, .30, .24, d.secondary);
      text(d.label, .49, .50, .63, .86, d.ink);
      rect(.17, .80, .66, .018, d.accent);
      text(d.caption, .50, .91, .07, .84, d.accent);
      break;
    case 'vertical': {
      rect(0, 0, 1, .12, d.accent);
      rect(0, .89, 1, .11, d.secondary);
      text('24H', .50, .065, .075, .76, d.background === d.accent ? d.ink : d.secondary);
      // Tiny original stroke glyphs keep the Japanese shop lettering portable,
      // including hosts without a CJK font. Coordinates use a 10-unit grid.
      const glyphs: Record<string, number[][]> = {
        'カ': [[1, 3, 9, 3, 8, 9, 6, 9], [5, 1, 4, 6, 1, 9]],
        'ラ': [[2, 1, 8, 1], [1, 4, 9, 4, 7, 8, 3, 10]],
        'オ': [[1, 3, 9, 3], [7, 1, 7, 9, 5, 9], [6, 4, 1, 8]],
        'ケ': [[3, 1, 1, 5], [2, 3, 9, 3], [6, 3, 5, 7, 2, 10]],
        'ー': [[5, 1, 5, 9]],
        'メ': [[8, 1, 6, 6, 2, 10], [2, 3, 8, 8]],
        'ン': [[2, 2, 4, 4], [2, 9, 7, 7, 9, 3]],
      };
      const letters = Array.from(d.label);
      const cellHeight = h * .70 / letters.length;
      const glyphSize = Math.min(w * .66, cellHeight * .85);
      context.strokeStyle = d.ink;
      context.lineWidth = glyphSize * .10;
      context.lineCap = 'square';
      context.lineJoin = 'round';
      letters.forEach((letter, index) => {
        const x = (w - glyphSize) / 2;
        const y = h * .17 + index * cellHeight;
        for (const path of glyphs[letter] ?? []) {
          context.beginPath();
          context.moveTo(x + path[0] / 10 * glyphSize, y + path[1] / 10 * glyphSize);
          for (let i = 2; i < path.length; i += 2) {
            context.lineTo(x + path[i] / 10 * glyphSize, y + path[i + 1] / 10 * glyphSize);
          }
          context.stroke();
        }
      });
      text(d.caption, .50, .945, .060, .88, d.ink);
      break;
    }
    case 'tenants':
      // Independent tenant bands read like a stacked building directory.
      text(d.label, .50, .18, .22, .88, d.ink);
      rect(.04, .34, .92, .27, d.accent);
      text('3F / MUSIC', .50, .475, .12, .84, d.secondary);
      rect(.04, .65, .92, .23, d.secondary);
      text('2F / CAFE', .50, .765, .12, .84, d.ink);
      text(d.caption, .50, .95, .055, .88, d.ink);
      break;
    case 'cafe':
      // A quieter round emblem gives the shop signs a different visual cadence.
      disk(.50, .35, .24, d.accent);
      disk(.50, .35, .19, d.background);
      rect(.39, .28, .18, .16, d.ink);
      rect(.57, .30, .055, .09, d.ink);
      rect(.36, .47, .28, .025, d.accent);
      text(d.label, .50, .72, .21, .88, d.ink, '700');
      text(d.caption, .50, .92, .065, .88, d.ink, '600');
      break;
    case 'lightbox':
      rect(0, 0, .12, 1, d.accent);
      // Long shop fascias need a readable second row at their real proportions.
      rect(.12, .68, .88, .32, d.secondary);
      text(d.label, .55, .34, .45, .76, d.ink);
      text(d.caption, .55, .84, .20, .76, d.ink, '700');
      break;
  }
  context.restore();
}
