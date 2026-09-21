import { Vector3 } from 'three';
import type { DotonboriPolygon } from './dotonbori-assets.ts';
import type { DotonboriLayout } from './dotonbori-layout.ts';

export interface DotonboriWaterfrontData {
  schema: string; version: number;
  levelsM: { water: number; lowerWalk: number; upperWalk: number };
  lowerWalk: DotonboriPolygon[]; upperWalk: DotonboriPolygon[];
  bankEdges: { side: 'south' | 'north'; points: number[][] }[];
  channelSectionsM: number[][];
  bridge: { centerEastNorthM: number[]; alongNorth: number[]; profile: number[][] };
  boat: { id: string; lengthOverallM: number; lengthBetweenPerpendicularsM: number; beamM: number; mouldedDepthM: number; draftM: number };
}

export function validateDotonboriWaterfront(data: DotonboriWaterfrontData) {
  if (data?.schema !== 'designqr-dotonbori-waterfront' || data.version !== 3
    || data.boat?.id !== 'doton' || data.boat.lengthOverallM !== 16.4 || data.boat.lengthBetweenPerpendicularsM !== 15.4
    || data.boat.beamM !== 3.6 || data.boat.draftM !== .5 || data.boat.mouldedDepthM !== .9
    || data.levelsM?.water !== .6 || data.levelsM.lowerWalk !== 1.05 || data.levelsM.upperWalk !== 1.95
    || data.channelSectionsM?.length !== 117 || data.bridge?.profile?.length !== 7
    || data.bridge.centerEastNorthM?.length !== 2 || data.bridge.centerEastNorthM.some(n => !Number.isFinite(n))
    || data.channelSectionsM.some((s, i) => s.length !== 3 || s.some(n => !Number.isFinite(n)) || s[0] !== -110 + i * 2 || s[1] >= s[2])
    || !data.lowerWalk?.length || !data.upperWalk?.length || !data.bankEdges?.length) {
    throw new Error('Unsupported Dōtonbori waterfront contract.');
  }
}

/** All scenery and activity share the same metre-to-tile transform. */
export function dotonboriPoint(east: number, north: number, height: number, layout: DotonboriLayout) {
  const e = east - layout.centerEastNorthM[0], s = layout.centerEastNorthM[1] - north;
  const c = Math.cos(layout.rotationYRadians), r = Math.sin(layout.rotationYRadians), size = layout.tileSizeM;
  return new Vector3((e * c + s * r) / size, height / size, (s * c - e * r) / size);
}

export function dotonboriChannel(data: DotonboriWaterfrontData, east: number) {
  const sections = data.channelSectionsM;
  const i = Math.max(0, Math.min(sections.length - 2, Math.floor((east - sections[0][0]) / 2)));
  const a = sections[i], b = sections[i + 1], t = (east - a[0]) / (b[0] - a[0]);
  // Only the hidden part of a boat trip extrapolates beyond the source crop.
  return { south: a[1] + (b[1] - a[1]) * t, north: a[2] + (b[2] - a[2]) * t };
}

export function dotonboriBridgeHeight(data: DotonboriWaterfrontData, along: number) {
  const profile = data.bridge.profile;
  const i = Math.max(0, profile.findIndex(p => p[0] >= along) - 1);
  const a = along >= profile.at(-1)![0] ? profile.at(-2)! : profile[i];
  const b = along >= profile.at(-1)![0] ? profile.at(-1)! : profile[i + 1];
  const t = Math.max(0, Math.min(1, (along - a[0]) / (b[0] - a[0])));
  return a[1] + (b[1] - a[1]) * t;
}

export function dotonboriBridgePoint(data: DotonboriWaterfrontData, layout: DotonboriLayout, across: number, along: number, height = dotonboriBridgeHeight(data, along)) {
  const [e, n] = data.bridge.alongNorth;
  return dotonboriPoint(data.bridge.centerEastNorthM[0] + across * n + along * e,
    data.bridge.centerEastNorthM[1] - across * e + along * n, height, layout);
}

export function dotonboriContains(features: readonly DotonboriPolygon[], east: number, north: number) {
  const inside = (ring: number[][]) => {
    let yes = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > north) !== (b[1] > north) && east < (b[0] - a[0]) * (north - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
    }
    return yes;
  };
  return features.some(feature => {
    const polygons = feature.type === 'Polygon' ? [feature.coordinates as number[][][]] : feature.coordinates as number[][][][];
    return polygons.some(rings => inside(rings[0]) && !rings.slice(1).some(inside));
  });
}
