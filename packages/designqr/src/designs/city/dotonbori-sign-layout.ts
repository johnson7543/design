import type { BufferGeometry } from 'three';
import { OSAKA_NIGHT_SWATCHES as S } from './palette.ts';

export const DOTONBORI_SIGN_ATLAS = { columns: 4, rows: 6, width: 2048, height: 1536 } as const;
export const DOTONBORI_SIGN_GREEN = '#00ac7a';

export const DOTONBORI_SIGN_ARTWORK = [
  ['snow', S.blue, 6.15 / 7.98], ['estem', S.ivory, 1.40], ['kaigen', S.gold, 1.96], ['chintai', S.blue, 1.79],
  ['promise', S.gold, 1.39], ['samty', S.blue, 2.95], ['asahi', S.gold, .6163], ['aqua', S.ivory, 2],
  ['haier', S.blue, 2], ['hm', S.navy, 3.3], ['screen', S.blue, 1.82], ['milk', S.ivory, 6.15 / 6.50],
  ['logo', S.navy, 1], ['asahi', S.gold, .4723], ['kani', S.ivory, 14], ['hanalangue', S.gold, 3],
  ['pip', S.ivory, 9.1 / 9.8], ['fancl', S.ivory, 9.1 / 11.2], ['snow-message', S.blue, 6.15],
  ['pip-clock', S.ivory, 6.15 / 9.8], ['salonpas', DOTONBORI_SIGN_GREEN, 14.8 / 13.6],
] as const;

/** S6/S14 and the inspected Pip owner photographs establish the sign faces
 * and stack order. Metric positions are fitted miniature registrations. */
export const DOTONBORI_SIGN_PANELS = [
  { front: 'B037', art: 0, y: 20.12, width: 6.15, height: 7.98 },
  { front: 'B037', art: 11, y: 12.63, width: 6.15, height: 6.50 },
  { front: 'B037', art: 18, y: 8.62, width: 6.15, height: 1.0 },
  { front: 'B037', art: 19, y: 29.90, width: 6.15, height: 9.8 },
  { front: 'B037-east', art: 16, y: 29.90, width: 9.1, height: 9.8 },
  { front: 'B037-east', art: 17, y: 17.70, width: 9.1, height: 11.2 },
  { front: 'B039', art: 4, y: 25.0, width: 12.5, height: 9.0 },
  { front: 'B039', art: 5, y: 17.5, width: 12.4, height: 4.2 },
  { front: 'B039', art: 15, y: 9.65, width: 12.3, height: 4.1 },
  { front: 'B041', art: 1, y: 23.7, width: 10.2, height: 7.3 },
  { front: 'B041', art: 2, y: 17.0, width: 10.2, height: 5.2 },
  { front: 'B041', art: 3, y: 10.5, width: 10.2, height: 5.7 },
  { front: 'B046', art: 6, y: 27.8, width: 13.8, widthInset: .5, height: 18.0 },
  { front: 'B046-west', art: 13, y: 27.8, width: 12.2, widthInset: .5, height: 18.0 },
  { front: 'B034-south-upper', art: 8, y: 45.6, width: 13.2, widthInset: 1, height: 7.1 },
  { front: 'B034-east-upper', art: 7, y: 45.6, width: 14.0, widthInset: 1, height: 7.1 },
  { front: 'B034-south-lower', art: 20, y: 19.75, width: 14.8, height: 13.6 },
  { front: 'B034-south-lower', art: 9, y: 7.6, width: 12.6, height: 3.8 },
  { front: 'B034-east-lower', art: 9, y: 7.6, width: 12.6, height: 3.8 },
  { front: 'B031-west', art: 10, y: 25.7, width: 13.3, height: 7.3 },
  { front: 'B031-west', art: 10, y: 13.6, width: 13.3, height: 7.3 },
] as const;

export function mapDotonboriSignArt(geometry: BufferGeometry, art: number) {
  const uv = geometry.getAttribute('uv'), { columns, rows } = DOTONBORI_SIGN_ATLAS;
  for (let i = 0; i < uv.count; i++) uv.setXY(i,
    (uv.getX(i) + art % columns) / columns, (uv.getY(i) + rows - 1 - Math.floor(art / columns)) / rows);
}

export const DOTONBORI_RIVERBANK_SIGN_GROUPS = DOTONBORI_SIGN_PANELS
  .filter(p => p.art >= 15 || (p.front === 'B034-south-lower' && p.art === 9))
  .map(p => `dotonbori-${p.front}-sign-${p.art}`);
