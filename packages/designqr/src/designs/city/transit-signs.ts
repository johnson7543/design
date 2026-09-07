import { SHIBUYA_PALETTE as P } from './palette.ts';
import { CITY_JR_BRIDGE_INK, CITY_STATION_NAME_LAYOUT, paintCityLettering } from './transit-lettering.ts';
import { paintCitySignText } from './sign-rendering.ts';

export type CityTransitSign = 'entrance' | 'station' | 'viaduct' | 'station-facade'
  | 'police-koban' | 'police-name' | 'police-english' | 'police-ticker' | 'police-map';

// Original strokes for factual place names. No host CJK font, downloaded logo,
// advertising artwork or raster reference is needed by an embedded player.
const GLYPHS: Record<string, readonly number[][]> = {
  '渋': [[0,1,1.5,2],[0,4,1.5,5],[1,9,2,7],[5,0,5,3],[3,3,9,3],[7,0,7,2,9,2],[6,4,6,9],[3,8,3,9,9,9,9,8],[3,5,4,6],[9,5,8,6]],
  '谷': [[3,0,1,2],[6,0,8,2],[4.5,3,1,6],[4.5,3,8,6],[2,6,7,6,7,9,2,9,2,6]],
  '駅': [[0,1,4,1],[0,1,0,6,4,6,3.5,9,2.5,9],[0,3,4,3],[0,4.5,4,4.5],[2,1,2,6],[0,7,0,9],[1,7,1,8.5],[2,7,2,8.3],[3,7,3,8],[5,9,6,6,6,1,9,1,9,5,6,5],[7,5,8,8,10,9]],
  'し': [[3,1,2.6,6,3,8,4.5,9,7,8.5,9,6.5]],
  'ぶ': [[3,1,6,2,4.5,3.5],[4,4,6,6,6.5,8,5,9,3,8],[2,5,0.5,8],[8,5,9.5,8],[8,0,8.8,1.4],[9.3,0,10,1.3]],
  'ち': [[1,3,9,2.5],[5,0,3.5,6,6,5.5,8,6,9,7.5,8,9,4,9.5]],
  'か': [[1,3,6,3,6.5,4,6,8.5,4.5,9],[4,0,3.5,4,1,9],[8,2,10,5.5]],
  'ハ': [[3,2,2,6,0,9],[6,2,7,6,9,9]],
  'チ': [[2,2,8,0],[5,1,5,6,3,9],[0,4,10,4]],
  '公': [[3,0,2,3,0,5],[6,0,7,3,9,5],[4,4,2,9,8,8],[6,6,9,10]],
  '口': [[1,1,9,1,9,9,1,9,1,1]],
  '前': [[2,0,3,1.5],[7,0,6,1.5],[0,2,10,2],[1,9,1,3.5,5,3.5,5,9,4,9],[1,5.2,5,5.2],[1,7,5,7],[7,3.5,7,7.5],[9,3,9,9,7.7,9]],
  '交': [[4.5,0,5.5,1.5],[0,2,10,2],[3,3,1,5],[7,3,9,5],[3,5,5,7.5,9,9.5],[7,5,5,7.5,1,9.5]],
  '番': [[1,1,8,0],[5,.5,5,5.2],[0,3,10,3],[2,1.5,3,2.6],[8,1,7,2.6],[4,3,1,5],[6,3,9,5],[2,5.5,8,5.5,8,9.5,2,9.5,2,5.5],[2,7.5,8,7.5],[5,5.5,5,9.5]],
};

export function paintCityTransitSign(ctx: CanvasRenderingContext2D, kind: CityTransitSign, exit = '') {
  const { width: w, height: h } = ctx.canvas;
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(x * w, y * h, width * w, height * h);
  };
  const text = (label: string, x: number, y: number, size: number, width: number, color: string) => {
    paintCitySignText(ctx, label, x * w, y * h, size * h, width * w, color, '600');
  };
  const japanese = (label: string, x: number, y: number, size: number, width: number, color: string) => {
    const letters = [...label], cell = width * w / letters.length, s = Math.min(size * h, cell * .85);
    ctx.strokeStyle = color; ctx.lineWidth = s * .075; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    letters.forEach((letter, i) => {
      const left = x * w + i * cell + (cell - s) / 2, top = y * h;
      for (const path of GLYPHS[letter] ?? []) {
        ctx.beginPath(); ctx.moveTo(left + path[0] / 10 * s, top + path[1] / 10 * s);
        for (let j = 2; j < path.length; j += 2) ctx.lineTo(left + path[j] / 10 * s, top + path[j + 1] / 10 * s);
        ctx.stroke();
      }
    });
  };
  const crest = (x: number, y: number, size: number) => {
    const r = size * h; ctx.fillStyle = P.warmLight; ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2, radius = r * (i % 2 ? .55 : 1);
      const px = x * w + Math.sin(angle) * radius, py = y * h + Math.cos(angle) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.fill();
  };
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (kind === 'station-facade') {
    // Transparent lettering exposes the model's cladding and keeps its seams.
    for (const p of CITY_STATION_NAME_LAYOUT) paintCityLettering(ctx, p.key,
      p.x * w, p.y * h, p.width * w, p.height * h, P.paper);
  } else if (kind === 'police-koban') {
    rect(0, 0, 1, 1, P.concrete); rect(.045, .09, .91, .82, P.blue);
    text('KOBAN', .5, .69, .23, .77, P.paper);
    for (const x of [.35, .58]) {
      ctx.strokeStyle = P.paper; ctx.lineWidth = h * .025; ctx.beginPath();
      ctx.arc(w * x, h * .32, h * .11, .15, Math.PI * 1.9); ctx.stroke();
    }
  } else if (kind === 'police-name') {
    rect(0, 0, 1, 1, P.ink); crest(.08, .49, .20);
    text('METROPOLITAN POLICE', .31, .26, .15, .34, P.paper);
    paintCityLettering(ctx, 'policeJapanese', .17*w, .40*h, .76*w, .48*h, P.paper);
  } else if (kind === 'police-english') {
    rect(0, 0, 1, 1, P.glassLight);
    text('SHIBUYA-EKIMAE  POLICE BOX', .50, .53, .66, .96, P.paper);
  } else if (kind === 'police-ticker') {
    rect(0, 0, 1, 1, P.ink);
    text('SHIBUYA  /  KOBAN', .44, .49, .56, .80, P.warmLight); crest(.94, .48, .29);
    // Static dot matrix: no per-frame uploads or unsolicited billboard motion.
    ctx.globalAlpha = .55;
    for (let x = 0; x < w; x += 5) for (let y = 0; y < h; y += 5) {
      ctx.fillStyle = P.ink; ctx.fillRect(x, y, 1.5, 4); ctx.fillRect(x, y, 4, 1.5);
    }
  } else if (kind === 'police-map') {
    rect(0, 0, 1, 1, P.paper); text('AREA MAP', .5, .07, .065, .89, P.ink);
    for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++)
      rect(.05 + col * .24, .14 + row * .125, .18, .08, (row + col) % 3 ? P.concrete : P.glassLight);
    ctx.strokeStyle = P.blue; ctx.lineWidth = w * .028; ctx.beginPath();
    ctx.moveTo(w * .11, h * .88); ctx.lineTo(w * .48, h * .42); ctx.lineTo(w * .86, h * .2); ctx.stroke();
    ctx.fillStyle = P.coral; ctx.beginPath(); ctx.arc(w * .48, h * .42, w * .045, 0, Math.PI * 2); ctx.fill();
    text('SHIBUYA', .5, .96, .035, .84, P.ink);
  } else if (kind === 'viaduct') {
    // Letters sit directly on the ribbed fascia, as in the reference photograph.
    paintCityLettering(ctx, 'jr', .075*w, .30*h, .16*w, .47*h, CITY_JR_BRIDGE_INK);
    for (const [i, glyph] of [...'渋谷駅'].entries()) paintCityLettering(ctx, glyph,
      (.35 + i * .20)*w, .15*h, .09*w, .70*h, CITY_JR_BRIDGE_INK);
  } else if (kind === 'station') {
    rect(0, 0, 1, 1, P.paper); rect(0, .91, 1, .09, P.transitStripe);
    paintCityLettering(ctx, 'jr', .018*w, .17*h, .104*w, .61*h, P.transitStripe);
    japanese('渋谷駅', .16, .14, .53, .32, P.ink);
    text('Shibuya Station', .32, .81, .20, .34, P.ink);
    japanese('ハチ公口', .63, .19, .36, .27, P.ink);
    text('Hachiko Entrance', .77, .77, .20, .34, P.ink);
  } else {
    rect(0, 0, 1, 1, P.roof); rect(.012, .09, .976, .82, P.ink);
    rect(.35, .1, .32, .80, P.roof);
    // Exit code has its own column; place names have separate Japanese/English
    // rows. The former adjacent labels overlapped at A6a/A6b/A7a proportions.
    text(exit, .070, .50, .23, .10, P.paper);
    japanese('渋谷駅', .14, .16, .31, .18, P.paper);
    text('Shibuya Sta.', .23, .75, .18, .21, P.paper);
    japanese('しぶちか', .405, .23, .39, .23, P.paper);
    text('SHIBUCHIKA', .52, .78, .13, .24, P.paper);
    // Simple house/dog emblem evokes the entrance sign without tracing its logo.
    ctx.strokeStyle = P.paper; ctx.lineWidth = h * .025; ctx.beginPath();
    ctx.moveTo(w * .368, h * .30); ctx.lineTo(w * .386, h * .20);
    ctx.lineTo(w * .402, h * .31); ctx.lineTo(w * .402, h * .62);
    ctx.lineTo(w * .368, h * .62); ctx.lineTo(w * .368, h * .30); ctx.stroke();
    for (const [i, code, name, color] of [[0,'TY','Toyoko',P.coral],[1,'DT','Den-en-toshi',P.glassLight],
      [2,'Z','Hanzomon',P.blue],[3,'F','Fukutoshin',P.warmLight]] as const) {
      const x = .69 + Math.floor(i / 2) * .15, y = .23 + i % 2 * .36;
      rect(x, y, .034, .23, color); text(code, x + .017, y + .12, .12, .03, P.paper);
      text(name, x + .092, y + .12, .105, .105, P.paper);
    }
  }
  ctx.restore();
}
