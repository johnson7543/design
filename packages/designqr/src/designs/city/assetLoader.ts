// Source-consuming hosts must see the build-only virtual module declaration.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./assets/virtual.d.ts" />
import { Box3, BufferAttribute, BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Group } from 'three';
import { OSAKA_NIGHT_SWATCHES, CITY_ASSET_PALETTE_ROLES, type CityAssetPaletteRole } from './palette.ts';
import { CITY_VEHICLE_DIMENSIONS } from './vehicles.ts';
import { createCityBuildings } from './layout.ts';
import { cityBuildingPanels, cityPanelAnchor } from './architecture.ts';
import { CITY_PAVEMENT_HEIGHT } from './road-network.ts';

export interface CityAssetMetadata {
  id: string; root: string; kind: 'vehicle' | 'building' | 'wheel' | 'metro' | 'sign';
  dimensions: [number, number, number]; nodes: string[];
  wheelRadius?: number; wheelWidth?: number; wheelbase?: number; track?: number;
  morphProxy?: 'footprint'; logoAnchor?: string;
  logoPosition?: [number, number, number]; logoYaw?: number; sourceSha256?: string;
  radius?: number; arc?: number; carSpacing?: number; trackHeight?: number;
}
export interface CityAssetManifest {
  schema: 'designqr-shibuya-assets'; version: 2; runtimeUp: '+Y'; vehicleForward: '+Z';
  assets: CityAssetMetadata[];
  materials: Record<string, { role: string; swatch: string }>;
}
export interface CityAssetTemplate {
  metadata: CityAssetMetadata;
  geometry: BufferGeometry;
  bounds: Box3;
}
export interface CityAssetLibrary { assets: ReadonlyMap<string, CityAssetTemplate> }

const swatches = new Set<string>(Object.values(OSAKA_NIGHT_SWATCHES));
export const CITY_ASSET_MATERIAL_ROLES = Object.freeze(Object.keys(CITY_ASSET_PALETTE_ROLES) as CityAssetPaletteRole[]);
const requiredAssets = ['wheel', 'vehicle-sedan', 'vehicle-taxi', 'vehicle-van', 'vehicle-bus',
  'metro-carriage', 'metro-cab', 'building-qfront', 'building-magnet'];
export function validateCityAssetManifest(value: unknown): asserts value is CityAssetManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid City asset manifest.');
  const manifest = value as CityAssetManifest;
  if (manifest.schema !== 'designqr-shibuya-assets' || manifest.version !== 2
    || manifest.runtimeUp !== '+Y' || manifest.vehicleForward !== '+Z'
    || !Array.isArray(manifest.assets) || !manifest.materials || typeof manifest.materials !== 'object') {
    throw new Error('Unsupported City asset contract.');
  }
  const ids = new Set<string>();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.id !== 'string' || !/^[a-z][a-z0-9-]+$/.test(asset.id)
      || asset.root !== asset.id || ids.has(asset.id)
      || !['vehicle', 'building', 'wheel', 'metro', 'sign'].includes(asset.kind)
      || !Array.isArray(asset.dimensions) || asset.dimensions.length !== 3
      || !asset.dimensions.every(n => Number.isFinite(n) && n > 0)
      || !Array.isArray(asset.nodes) || !asset.nodes.includes(asset.root)
      || !asset.nodes.every(name => typeof name === 'string') || new Set(asset.nodes).size !== asset.nodes.length) throw new Error('Invalid City asset metadata.');
    ids.add(asset.id);
  }
  if (requiredAssets.some(id => !ids.has(id))) throw new Error('City asset set is incomplete.');
  for (const asset of manifest.assets) {
    const kind = asset.id.split('-')[0];
    if (requiredAssets.includes(asset.id) && asset.kind !== kind) throw new Error('City asset ID and kind disagree.');
  }
  for (const [kind, dimensions] of Object.entries(CITY_VEHICLE_DIMENSIONS)) {
    const vehicle = manifest.assets.find(asset => asset.id === `vehicle-${kind}`)!;
    if (vehicle.kind !== 'vehicle' || vehicle.dimensions.some((n, i) => n !== [dimensions.width, dimensions.height, dimensions.length][i])
      || ![vehicle.wheelRadius, vehicle.wheelWidth, vehicle.wheelbase, vehicle.track].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)
      || vehicle.track !== dimensions.width || vehicle.wheelbase! > dimensions.length
      || ['l', 'r'].some(side => ['front', 'rear'].some(end => !vehicle.nodes.includes(`${kind}-wheel-${side}-${end}`)))) {
      throw new Error('Invalid City vehicle dimensions or wheel anchors.');
    }
  }
  const main = manifest.assets.find(asset => asset.id === 'building-qfront')!;
  const tower = manifest.assets.find(asset => asset.id === 'building-magnet')!;
  const metro = manifest.assets.find(asset => asset.id === 'metro-carriage')!;
  const building = createCityBuildings([[true]])[0];
  const anchor = cityPanelAnchor(cityBuildingPanels(building).find(p => p.hero)!);
  const expected = [(anchor.x - building.x) / building.width, (anchor.y - CITY_PAVEMENT_HEIGHT) / building.height, (anchor.z - building.z) / building.depth];
  if (main.morphProxy !== 'footprint' || main.logoAnchor !== 'qfront-logo-anchor' || !main.nodes.includes(main.logoAnchor)
    || tower.morphProxy !== 'footprint' || !Array.isArray(main.logoPosition) || main.logoPosition.length !== 3
    || main.logoPosition.some((n, i) => !Number.isFinite(n) || Math.abs(n - expected[i]) > 1e-6)
    || !Number.isFinite(main.logoYaw) || Math.abs(main.logoYaw! - anchor.angle) > 1e-6
    || !/^[a-f0-9]{64}$/.test(main.sourceSha256 ?? '') || tower.sourceSha256 !== main.sourceSha256
    || metro.carSpacing !== .081 || metro.trackHeight !== .106) throw new Error('Invalid City landmark or rail contract.');
  for (const material of Object.values(manifest.materials)) {
    if (!material || !Object.hasOwn(CITY_ASSET_PALETTE_ROLES, material.role) || !swatches.has(material.swatch)) throw new Error('Off-palette City asset material.');
  }
}

/** Preserve material roles and face illumination independently of runtime paint.
 * Cached templates remain theme-neutral; each player colors its own geometry. */
export function prepareCityAssetLibrary(scene: Group, manifestValue: unknown): CityAssetLibrary {
  validateCityAssetManifest(manifestValue);
  const manifest = manifestValue;
  scene.updateMatrixWorld(true);
  const assets = new Map<string, CityAssetTemplate>();
  const inverse = new Matrix4(), matrix = new Matrix4(), normal = new Vector3();
  try { for (const metadata of manifest.assets) {
    const root = scene.getObjectByName(metadata.root);
    if (!root || root.userData.asset_id !== metadata.id || metadata.nodes.some(name => !root.getObjectByName(name))) {
      throw new Error(`Missing semantic City node: ${metadata.id}`);
    }
    if (!Number.isFinite(root.matrixWorld.determinant()) || Math.abs(root.matrixWorld.determinant()) < 1e-12) throw new Error('Degenerate City asset transform.');
    inverse.copy(root.matrixWorld).invert();
    if (metadata.logoAnchor) {
      const anchor = root.getObjectByName(metadata.logoAnchor)!;
      const position = new Vector3().setFromMatrixPosition(anchor.matrixWorld).applyMatrix4(inverse);
      // Logical source-facing anchor: normalized position and explicit world yaw.
      // Reject moved/rotated exports rather than silently rendering a stale logo.
      matrix.multiplyMatrices(inverse, anchor.matrixWorld);
      const expectedPosition = new Vector3(...metadata.logoPosition!);
      const expected = new Matrix4().makeRotationY(metadata.logoYaw!).setPosition(expectedPosition);
      if (position.distanceTo(expectedPosition) > 1e-6
        || matrix.elements.some((n, i) => Math.abs(n - expected.elements[i]) > 1e-6)) throw new Error('Unsupported main billboard anchor transform.');
    }
    const positions: number[] = [], normals: number[] = [], roles: number[] = [], shades: number[] = [], paint: number[] = [], uvs: number[] = [];
    root.traverse(object => {
      if (!object.matrix.elements.every(Number.isFinite)) throw new Error('Non-finite City transform.');
      if (!(object instanceof Mesh)) return;
      // Authoring previews include linked wheels; runtime wheels are their own batch.
      for (let node: typeof object.parent = object; node && node !== root; node = node.parent) {
        if (metadata.kind === 'vehicle' && node.userData.part_id === 'wheel') return;
      }
      if ('isSkinnedMesh' in object || Array.isArray(object.material) || !(object.material instanceof MeshStandardMaterial)
        || object.material.map || Object.keys(object.geometry.morphAttributes).length) throw new Error('Unsupported City asset geometry.');
      const role = manifest.materials[object.material.name];
      if (!role || object.material.color.getHexString() !== role.swatch.slice(1)) throw new Error('City GLB material disagrees with its palette manifest.');
      matrix.multiplyMatrices(inverse, object.matrixWorld);
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      try { geometry.applyMatrix4(matrix);
      const position = geometry.getAttribute('position'), normalAttribute = geometry.getAttribute('normal');
      const uv = geometry.getAttribute('uv');
      if (!position || !normalAttribute || position.count % 3) throw new Error('City assets require triangles and normals.');
      if (metadata.kind === 'sign' && !uv) throw new Error('City signs require artwork UVs.');
      const painted = role.role === 'vehicle-body';
      // Landmark authoring deduplicated the glass/blue swatch into the blue slot.
      // Recover its architectural meaning before discarding the source material.
      const semanticRole = metadata.kind === 'building' && role.role === 'blue' ? 'glass' : role.role;
      const roleIndex = CITY_ASSET_MATERIAL_ROLES.indexOf(semanticRole as CityAssetPaletteRole);
      for (let i = 0; i < position.count; i++) {
        const point = [position.getX(i), position.getY(i), position.getZ(i)];
        if (!point.every(Number.isFinite)) throw new Error('Non-finite City vertex.');
        positions.push(...point);
        normal.fromBufferAttribute(normalAttribute, i).normalize();
        if (!normal.toArray().every(Number.isFinite)) throw new Error('Non-finite City normal.');
        normals.push(normal.x, normal.y, normal.z);
        const coords = uv ? [uv.getX(i), uv.getY(i)] : [0, 0];
        if (!coords.every(Number.isFinite)) throw new Error('Non-finite City UV.');
        // glTF uses V-down textures (flipY=false); the existing CanvasTexture
        // artwork is V-up. Preserve its texture ownership and convert the UVs.
        if (metadata.kind === 'sign') coords[1] = 1 - coords[1];
        uvs.push(...coords);
        const shade = normal.y > .5 ? 1 : normal.x > .5 ? .65 : normal.z > .5 ? .84 : .52;
        roles.push(roleIndex); shades.push(shade);
        paint.push(Number(painted));
      }
      } finally { geometry.dispose(); }
    });
    if (!positions.length) throw new Error(`Empty City asset: ${metadata.id}`);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('cityMaterialRole', new BufferAttribute(new Uint8Array(roles), 1));
    geometry.setAttribute('cityShade', new BufferAttribute(new Float32Array(shades), 1));
    geometry.setAttribute('cityPaintMask', new BufferAttribute(new Float32Array(paint), 1));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const bounds = geometry.boundingBox!.clone();
    // Vehicles may include mirrors, bumpers, and roof signs beyond structural dimensions.
    const size = bounds.getSize(new Vector3());
    assets.set(metadata.id, { metadata, geometry, bounds });
    if (size.toArray().some((n, axis) => n > metadata.dimensions[axis] * 1.4)
      || (!['wheel', 'sign'].includes(metadata.kind) && bounds.min.y < -.0001)) throw new Error(`City asset exceeds its declared envelope: ${metadata.id}`);
  } } catch (error) {
    for (const asset of assets.values()) asset.geometry.dispose();
    throw error;
  }
  return { assets };
}

let pending: Promise<CityAssetLibrary> | undefined;
export function loadCityAssetLibrary(): Promise<CityAssetLibrary> {
  pending ??= Promise.all([import('virtual:designqr-shibuya-assets'), import('three/addons/loaders/GLTFLoader.js')])
    .then(async ([data, { GLTFLoader }]) => {
      validateCityAssetManifest(data.manifest);
      const bytes = Uint8Array.from(atob(data.glb), char => char.charCodeAt(0));
      const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
      try { return prepareCityAssetLibrary(gltf.scene, data.manifest); }
      finally {
        gltf.scene.traverse(object => {
          if (object instanceof Mesh) {
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
          }
        });
      }
    }).catch(error => { pending = undefined; throw error; });
  return pending;
}
