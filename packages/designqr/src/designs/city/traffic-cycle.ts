export const CITY_CYCLE_SECONDS = 20;
export const CITY_WALK_END = 10;
export const CITY_DRIVE_START = 12;
export const CITY_AMBER_START = 19;

export function cityCycleTime(time: number) {
  return ((time % CITY_CYCLE_SECONDS) + CITY_CYCLE_SECONDS) % CITY_CYCLE_SECONDS;
}

/** Compressed miniature timing; the side roads remain stopped throughout. */
export function cityStreetSignalPhase(time: number) {
  const phase = cityCycleTime(time);
  return phase < CITY_WALK_END ? 'walk' : phase < CITY_DRIVE_START ? 'clearance'
    : phase < CITY_AMBER_START ? 'drive' : 'amber';
}
