// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./assets/virtual.d.ts" />
import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Group } from 'three';
import { OSAKA_NIGHT_SWATCHES } from './palette.ts';
import { DOTONBORI_PALETTE, dotonboriSurfaceShade } from './dotonbori-geometry.ts';
import { transformDotonboriGeometry, type DotonboriLayout } from './dotonbori-layout.ts';
import { validateDotonboriWaterfront, type DotonboriWaterfrontData } from './dotonbori-detail-layout.ts';

export const DOTONBORI_CROP_METRES = 160;
export interface DotonboriPolygon { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
export interface DotonboriAssetData {
  buildings: string; bridge: string;
  plan: { roads: DotonboriPolygon[]; water: DotonboriPolygon[] };
  layout: DotonboriLayout;
  waterfront: DotonboriWaterfrontData;
  focus: {
    schema: string; version: number; units: string; gltfAxes: string[];
    sourceBuildingCount: number; focusedBuildingCount: number; triangleCount: number;
    objects: { sourceId: string; lod: number; variationIndex: number }[];
    materials: Record<string, { swatch: string }>;
  };
  manifest: {
    schema: string; version: number; cropSizeM: number; units: string; gltfAxes: string[];
    sourceBuildingCount: number; studyTriangleCount: number;
    objects: { sourceId: string; lod: number }[];
    materials: Record<string, { swatch: string }>;
    bridgeStudy: { id: string; triangles: number };
  };
}
export interface DotonboriTemplate { id: string; kind: 'building' | 'bridge'; variationIndex: number; geometry: BufferGeometry }
/** CPU templates are never attached to a scene or uploaded. Players clone them. */
export interface DotonboriLibrary {
  templates: readonly DotonboriTemplate[];
  plan: DotonboriAssetData['plan'];
  layout: DotonboriLayout;
  waterfront: DotonboriWaterfrontData;
}

export function validateDotonboriData(value: unknown): asserts value is DotonboriAssetData {
  const data = value as DotonboriAssetData | null, m = data?.manifest;
  if (!m || m.schema !== 'designqr-dotonbori-study' || m.version !== 1 || m.units !== 'metres'
    || m.cropSizeM !== DOTONBORI_CROP_METRES || m.gltfAxes?.join() !== 'east,source-height,south'
    || m.sourceBuildingCount !== 73 || m.objects?.length !== 73
    || new Set(m.objects.map(object => object.sourceId)).size !== 73
    || m.objects.some(object => !/^bldg_[a-f0-9-]+$/.test(object.sourceId) || ![1, 2].includes(object.lod))
    || m.studyTriangleCount !== 4796 || m.bridgeStudy?.id !== 'ebisubashi-deck-dimension-study'
    || m.bridgeStudy.triangles !== 860 || !m.materials || typeof data?.buildings !== 'string'
    || typeof data.bridge !== 'string' || !Array.isArray(data.plan?.roads) || !Array.isArray(data.plan.water)) {
    throw new Error('Unsupported Dōtonbori study contract.');
  }
  const swatches = new Set<string>(Object.values(OSAKA_NIGHT_SWATCHES));
  const f = data.focus, layout = data.layout;
  if (!f || f.schema !== 'designqr-dotonbori-focus' || f.version !== 5 || f.units !== 'metres'
    || f.gltfAxes?.join() !== 'east,source-height,south' || f.sourceBuildingCount !== 132
    || f.focusedBuildingCount !== 58 || f.objects?.length !== 58 || f.triangleCount !== 3732
    || new Set(f.objects.map(object => object.sourceId)).size !== 58
    || new Set(f.objects.map(object => object.variationIndex)).size !== 58
    || f.objects.some(object => !Number.isInteger(object.variationIndex) || object.variationIndex < 0 || object.variationIndex >= 132
      || !/^bldg_[a-f0-9-]+$/.test(object.sourceId) || ![1, 2].includes(object.lod))
    || !f.materials || layout?.tileSizeM !== 144
    || layout.rotationYRadians !== Math.PI / 4 || layout.centerEastNorthM?.length !== 2
    || layout.centerEastNorthM[0] !== 4.196907421216137 || layout.centerEastNorthM[1] !== 2.1639323405262125
    || layout.outlineEastNorthM?.length !== 5) throw new Error('Unsupported Dōtonbori focus contract.');
  const offsets = layout.landmarkOffsetsEastNorthM;
  if (!offsets || Object.keys(offsets).length !== 1 || offsets['bldg_62a12ed7-ad07-4a43-8a33-c8720026bbaa']?.join() !== '-80,0') {
    throw new Error('Unsupported Dōtonbori landmark composition.');
  }
  if (Object.values({ ...m.materials, ...f.materials }).some(material => !swatches.has(material.swatch))) throw new Error('Off-palette Dōtonbori material.');
  validateDotonboriWaterfront(data.waterfront);
  for (const shape of [...data.plan.roads, ...data.plan.water, { type: 'Polygon', coordinates: [layout.outlineEastNorthM] }]) {
    const polygons = shape.type === 'Polygon' ? [shape.coordinates as number[][][]]
      : shape.type === 'MultiPolygon' ? shape.coordinates as number[][][][] : [];
    if (!polygons.length || polygons.some(polygon => !polygon.length || polygon.some(ring => ring.length < 4
      || ring.some(point => point.length !== 2 || point.some(n => !Number.isFinite(n) || Math.abs(n) > 110.00001))))) {
      throw new Error('Invalid Dōtonbori plan footprint.');
    }
  }
}

/** Bake the GLB world transform, rigid site rotation and one uniform scale.
 * Source vertices, roof slopes and crop cuts never depend on QR content. */
export function prepareDotonboriLibrary(buildings: Group, bridge: Group, value: unknown): DotonboriLibrary {
  validateDotonboriData(value);
  const m = value.manifest, f = value.focus, layout = value.layout, templates: DotonboriTemplate[] = [];
  const materials = { ...m.materials, ...f.materials };
  try {
    for (const [scene, kind, expectedIds, expectedTriangles] of [
      [buildings, 'building', f.objects.map(object => object.sourceId), f.triangleCount],
      [bridge, 'bridge', [m.bridgeStudy.id], m.bridgeStudy.triangles],
    ] as const) {
      scene.updateMatrixWorld(true);
      const parts = new Map(expectedIds.map(id => [id, { positions: [] as number[], colors: [] as number[] }]));
      let triangles = 0;
      scene.traverse(object => {
        if (!(object instanceof Mesh)) return;
        let owner = object;
        while (!owner.userData.id && owner.parent) owner = owner.parent as typeof owner;
        const target = parts.get(owner.userData.id);
        const material = object.material;
        if (!target || !(material instanceof MeshStandardMaterial) || material.map
          || !object.matrixWorld.elements.every(Number.isFinite)
          || Math.abs(object.matrixWorld.determinant()) < 1e-12
          || !materials[material.name]
          || material.color.getHexString() !== materials[material.name].swatch.slice(1)) throw new Error('Invalid Dōtonbori source mesh or material.');
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        try {
          transformDotonboriGeometry(geometry.applyMatrix4(object.matrixWorld), layout);
          const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
          if (!p || !n || p.count % 3) throw new Error('Dōtonbori meshes require triangles and normals.');
          const normal = new Vector3(), color = new Color();
          // Preserve diagnostic materials in the authoring GLBs. The product
          // uses night massing behind its reference-directed illuminated fronts.
          const displayColor = kind !== 'building' ? material.color : new Color(
            material.name.endsWith('authoring-cut') ? DOTONBORI_PALETTE.section
              : material.color.getHexString() === OSAKA_NIGHT_SWATCHES.highRise.slice(1) ? DOTONBORI_PALETTE.roof : DOTONBORI_PALETTE.building);
          for (let i = 0; i < p.count; i++) {
            const point = [p.getX(i), p.getY(i), p.getZ(i)];
            if (!point.every(Number.isFinite) || Math.abs(point[0]) > .500001 || Math.abs(point[2]) > .500001
              || point[1] < -.000001 || point[1] > .56) throw new Error('Dōtonbori export exceeds its reviewed bounds.');
            target.positions.push(...point);
            normal.fromBufferAttribute(n, i).normalize();
            // Directional study shading derives solely from the approved source paint.
            color.copy(displayColor).multiplyScalar(dotonboriSurfaceShade(normal.x, normal.y, normal.z));
            target.colors.push(color.r, color.g, color.b);
          }
          triangles += p.count / 3;
        } finally { geometry.dispose(); }
      });
      if (triangles !== expectedTriangles) throw new Error('Dōtonbori triangle count differs from the reviewed export.');
      for (const [id, part] of parts) {
        if (!part.positions.length) throw new Error(`Missing Dōtonbori source: ${id}`);
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(part.positions, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(part.colors, 3));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        templates.push({ id, kind, geometry, variationIndex: kind === 'building' ? f.objects.find(object => object.sourceId === id)!.variationIndex : 0 });
      }
    }
    return { templates, plan: value.plan, layout, waterfront: value.waterfront };
  } catch (error) {
    templates.forEach(template => template.geometry.dispose());
    throw error;
  }
}

let pending: Promise<DotonboriLibrary> | undefined;
export function loadDotonboriLibrary(): Promise<DotonboriLibrary> {
  pending ??= Promise.all([import('virtual:designqr-dotonbori-assets'), import('three/addons/loaders/GLTFLoader.js')])
    .then(async ([{ default: data }, { GLTFLoader }]) => {
      validateDotonboriData(data);
      const scenes: Group[] = [];
      try {
        for (const encoded of [data.buildings, data.bridge]) {
          const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
          scenes.push((await new GLTFLoader().parseAsync(bytes.buffer, '')).scene);
        }
        return prepareDotonboriLibrary(scenes[0], scenes[1], data);
      } finally {
        scenes.forEach(scene => scene.traverse(object => {
          if (object instanceof Mesh) {
            object.geometry.dispose();
            (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
          }
        }));
      }
    }).catch(error => { pending = undefined; throw error; });
  return pending;
}
