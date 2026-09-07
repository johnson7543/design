import { SHIBUYA_PALETTE as P, type ShibuyaPalette } from './palette.ts';

export interface CityVehicleSpec {
  type: 'sedan' | 'taxi' | 'van' | 'bus'; color: string;
  colorRole: keyof ShibuyaPalette;
  width: number; length: number; height: number;
}
export const CITY_VEHICLE_DIMENSIONS: Readonly<Record<CityVehicleSpec['type'], Omit<CityVehicleSpec, 'type' | 'color' | 'colorRole'>>> = {
  sedan: { width: .019, length: .039, height: .017 },
  taxi: { width: .019, length: .041, height: .018 },
  van: { width: .021, length: .045, height: .024 },
  bus: { width: .023, length: .065, height: .028 },
};
const fleet: [CityVehicleSpec['type'], keyof ShibuyaPalette][] = [
  ['sedan', 'stone'], ['taxi', 'ink'], ['bus', 'glassLight'], ['van', 'blue'], ['sedan', 'coral'], ['van', 'stone'],
  ['taxi', 'warmLight'], ['van', 'stone'], ['sedan', 'blue'], ['bus', 'stone'], ['sedan', 'ink'], ['van', 'concrete'],
];
export const CITY_VEHICLES: readonly CityVehicleSpec[] = Object.freeze(fleet.map(([type, colorRole]) => ({ type, colorRole, color: P[colorRole], ...CITY_VEHICLE_DIMENSIONS[type] })));

export function cityVehicleQueueDistance(index: number) {
  const laneStart = index < 6 ? 0 : 6;
  let distance = 0;
  for (let i = laneStart; i < index; i++) distance += (CITY_VEHICLES[i].length + CITY_VEHICLES[i + 1].length) / 2 + .014;
  return distance;
}
