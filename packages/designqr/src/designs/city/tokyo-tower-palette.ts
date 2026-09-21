import { BLUE_MORNING_SWATCHES, OSAKA_NIGHT_SWATCHES as S, mixCityColor } from './palette.ts';

export const TOKYO_TOWER_PALETTE = Object.freeze({
  orange: '#e77433', white: BLUE_MORNING_SWATCHES.white,
  light: S.gold, sodium: mixCityColor('#e8a800', '#e77433', .25),
  window: mixCityColor(S.navy, S.gold, .08), sky: mixCityColor('#0f172a', '#000000', .72),
  horizon: mixCityColor(S.navy, '#000000', .70),
  metal: mixCityColor(S.navy, S.charcoal, .38),
  ground: mixCityColor(S.navy, S.charcoal, .12),
  paving: mixCityColor(S.navy, S.highRise, .22),
  glass: mixCityColor(S.navy, S.blue, .45),
  foliage: mixCityColor(S.navy, S.bay, .20),
});
