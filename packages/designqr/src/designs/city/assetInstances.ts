import { Color, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, Plane, Vector3 } from 'three';
import { CITY_ASSET_MATERIAL_ROLES, type CityAssetLibrary, type CityAssetMetadata, type CityAssetTemplate } from './assetLoader.ts';
import { SHIBUYA_PALETTE, CITY_ASSET_PALETTE_ROLES, type ShibuyaPalette } from './palette.ts';
import { cityNoise, type CityBuilding } from './layout.ts';
import { createCityRooftopGeometry } from './architecture.ts';
import { CITY_VEHICLES } from './vehicles.ts';
import { cityTrainPosition, cityVehiclePosition } from './motion.ts';
import { cityMorphActor } from './morph-sources.ts';
import type { CityMorphVoxel } from './morph.ts';
import { CITY_PAVEMENT_HEIGHT, CITY_ROAD_HEIGHT, CITY_VEHICLE_SCALE, SHIBUYA_STATION,
  cityStationPoint, cityVehiclePoint } from './road-network.ts';

/** Resolve semantic materials on a clone, so concurrent players never recolor the cache. */
export function createCityAssetGeometry(template: CityAssetTemplate, palette: ShibuyaPalette = SHIBUYA_PALETTE) {
  const geometry = template.geometry.clone();
  const roles = geometry.getAttribute('cityMaterialRole'), shades = geometry.getAttribute('cityShade');
  const paint = geometry.getAttribute('cityPaintMask');
  const bases = CITY_ASSET_MATERIAL_ROLES.map(role => new Color(palette[CITY_ASSET_PALETTE_ROLES[role]]));
  const colors = new Float32Array(roles.count * 3);
  for (let i = 0; i < roles.count; i++) {
    const shade = shades.getX(i), base = bases[roles.getX(i)];
    colors.set(paint.getX(i) ? [shade, shade, shade]
      : [base.r * shade, base.g * shade, base.b * shade], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.deleteAttribute('cityMaterialRole'); geometry.deleteAttribute('cityShade');
  return geometry;
}

/** Per-player GPU resources; only immutable CPU templates are shared by the loader. */
export class CityAssetInstances {
  readonly root = new Group();
  readonly materials: MeshBasicMaterial[] = [];
  private readonly vehicles: { mesh: InstancedMesh; indices: number[]; metadata: CityAssetMetadata }[] = [];
  private readonly landmarks: { mesh: Mesh; template: CityAssetTemplate }[] = [];
  private readonly dummy = new Object3D();
  private readonly localPlanes = [new Plane(new Vector3(1, 0, 0), .49), new Plane(new Vector3(-1, 0, 0), .49),
    new Plane(new Vector3(0, 0, 1), .49), new Plane(new Vector3(0, 0, -1), .49)];
  private readonly planes = this.localPlanes.map(plane => plane.clone());
  private readonly localStationPlanes = [-1, 1].map(direction => {
    const n = new Vector3(Math.cos(SHIBUYA_STATION.angle) * direction, 0, -Math.sin(SHIBUYA_STATION.angle) * direction);
    const center = new Vector3(SHIBUYA_STATION.center.x, 0, SHIBUYA_STATION.center.z);
    return new Plane(n, SHIBUYA_STATION.halfLength - .025 - n.dot(center));
  });
  private readonly stationPlanes = this.localStationPlanes.map(plane => plane.clone());
  private readonly wheels: InstancedMesh;
  private readonly train: InstancedMesh;
  private readonly cabs: InstancedMesh;
  private readonly palette: ShibuyaPalette;
  private readonly rooftops: Mesh;

  constructor(library: CityAssetLibrary, buildings: readonly CityBuilding[], palette: ShibuyaPalette = SHIBUYA_PALETTE) {
    this.palette = palette;
    this.root.name = 'shibuya-assets';
    const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, clippingPlanes: this.planes });
    // Instance paint affects only the semantically tagged body panels, never glass or lamps.
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute vec3 cityPaint;
attribute float cityPaintMask;
varying vec3 vCityPaint;
varying float vCityPaintMask;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vCityPaint = cityPaint;
vCityPaintMask = cityPaintMask;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCityPaint;
varying float vCityPaintMask;`).replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= mix(vec3(1.0), vCityPaint, vCityPaintMask);`);
    };
    material.customProgramCacheKey = () => 'designqr-city-paint-v1';
    this.materials.push(material);
    for (const type of ['sedan', 'taxi', 'van', 'bus']) {
      const template = library.assets.get(`vehicle-${type}`);
      if (!template) continue;
      const indices = CITY_VEHICLES.flatMap((spec, index) => spec.type === type ? [index] : []);
      const geometry = createCityAssetGeometry(template, palette);
      const colors = new Float32Array(indices.length * 3);
      indices.forEach((index, i) => new Color(palette[CITY_VEHICLES[index].colorRole]).toArray(colors, i * 3));
      geometry.setAttribute('cityPaint', new InstancedBufferAttribute(colors, 3));
      const mesh = new InstancedMesh(geometry, material, indices.length);
      mesh.name = `shibuya-${type}-fleet`;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      this.root.add(mesh);
      this.vehicles.push({ mesh, indices, metadata: template.metadata });
    }
    const plain = new MeshBasicMaterial({ vertexColors: true, transparent: true, clippingPlanes: this.planes });
    this.materials.push(plain);
    const batch = (id: string, count: number, material = plain) => {
      const mesh = new InstancedMesh(createCityAssetGeometry(library.assets.get(id)!, palette), material, count);
      mesh.name = `shibuya-${id}`; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.root.add(mesh);
      return mesh;
    };
    this.wheels = batch('wheel', CITY_VEHICLES.length * 4);
    const metroMaterial = plain.clone();
    metroMaterial.clippingPlanes = [...this.planes, ...this.stationPlanes];
    this.materials.push(metroMaterial);
    this.train = batch('metro-carriage', 4, metroMaterial);
    this.cabs = batch('metro-cab', 2, metroMaterial);
    // Landmarks follow the surveyed contours and measured massing.
    for (const [index, id] of ['building-qfront', 'building-magnet'].entries()) {
      const building = buildings[index];
      const mesh = new Mesh(createCityAssetGeometry(library.assets.get(id)!, palette), plain);
      mesh.name = `shibuya-${id}`;
      mesh.position.set(building.x, CITY_PAVEMENT_HEIGHT, building.z);
      mesh.scale.set(building.width, building.height, building.depth);
      // Keep the imported slab/facade, replacing only complete above-roof faces.
      const positions = mesh.geometry.getAttribute('position'), indices: number[] = [];
      for (let i = 0; i < positions.count; i += 3) {
        const ys = [positions.getY(i), positions.getY(i + 1), positions.getY(i + 2)];
        if (Math.min(...ys) >= 1 - 1e-6 && Math.max(...ys) > 1 + 1e-6) continue;
        indices.push(i, i + 1, i + 2);
      }
      mesh.geometry.setIndex(indices);
      this.root.add(mesh);
      this.landmarks.push({ mesh, template: library.assets.get(id)! });
    }
    this.rooftops = new Mesh(createCityRooftopGeometry(buildings.slice(0, 2), palette), plain);
    this.rooftops.name = 'shibuya-landmark-rooftops';
    this.root.add(this.rooftops);
    this.updateBuildings(buildings);
  }

  /** Update finishes and regenerate rooftop arrangements without replacing landmarks. */
  updateBuildings(buildings: readonly CityBuilding[]) {
    const previous = this.rooftops.geometry;
    this.rooftops.geometry = createCityRooftopGeometry(buildings.slice(0, 2), this.palette);
    previous.dispose();
    const choices = [this.palette.glass, this.palette.glassLight, this.palette.coolLight, this.palette.windowLight]
      .map(color => new Color(color));
    for (const [index, { mesh, template }] of this.landmarks.entries()) {
      const roles = template.geometry.getAttribute('cityMaterialRole');
      const shades = template.geometry.getAttribute('cityShade');
      const positions = template.geometry.getAttribute('position');
      const colors = mesh.geometry.getAttribute('color');
      // Floor-sized reflection bands keep each pane coherent, including its two triangles.
      for (let i = 0; i < roles.count; i++) {
        if (CITY_ASSET_MATERIAL_ROLES[roles.getX(i)] !== 'glass') continue;
        const floor = Math.round(positions.getY(i) * buildings[index].floors);
        const choice = Math.floor(cityNoise(index * 173 + floor * 37, buildings[index].detailSeed) * choices.length);
        const base = choices[choice], shade = shades.getX(i);
        colors.setXYZ(i, base.r * shade, base.g * shade, base.b * shade);
      }
      colors.needsUpdate = true;
    }
  }

  /** Snapshot the real visible body transforms once per turn. Clipped/hidden
   * cars and train segments must not suddenly appear as morph fragments. */
  captureMorphSources(): CityMorphVoxel[] {
    const sources: CityMorphVoxel[] = [], matrix = new Matrix4(), center = new Vector3(), size = new Vector3();
    const capture = (mesh: InstancedMesh, index: number, kind: 'vehicle' | 'train', color: string, id: string) => {
      mesh.getMatrixAt(index, matrix);
      if (matrix.elements[0] === 0 && matrix.elements[2] === 0) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox!;
      bounds.getSize(size); size.z /= 3;
      for (let part = 0; part < 3; part++) {
        bounds.getCenter(center); center.z += (part - 1) * size.z;
        const source = cityMorphActor(matrix, color, kind, `${id}-${part}`, center, size);
        source.group = kind === 'train' ? 'metro' : id;
        const point = new Vector3(source.x, source.y, source.z);
        const planes = kind === 'train' ? [...this.localPlanes, ...this.localStationPlanes] : this.localPlanes;
        if (planes.every(plane => plane.distanceToPoint(point) >= 0)) sources.push(source);
      }
    };
    for (const { mesh, indices } of this.vehicles) indices.forEach((index, instance) =>
      capture(mesh, instance, 'vehicle', CITY_VEHICLES[index].color, `vehicle-${index}`));
    for (let i = 0; i < this.train.count; i++) capture(this.train, i, 'train', SHIBUYA_PALETTE.stone, `train-${i}`);
    return sources;
  }

  update(time: number, worldMatrix: Matrix4) {
    for (const [index, plane] of this.planes.entries()) plane.copy(this.localPlanes[index]).applyMatrix4(worldMatrix);
    for (const [index, plane] of this.stationPlanes.entries()) plane.copy(this.localStationPlanes[index]).applyMatrix4(worldMatrix);
    for (const { mesh, indices, metadata } of this.vehicles) {
      indices.forEach((index, instance) => {
        const pose = cityVehiclePosition(index, time);
        this.dummy.position.set(pose.x, CITY_ROAD_HEIGHT, pose.z);
        this.dummy.rotation.set(0, pose.heading, 0);
        // Clip in world space; never shorten or squash the imported model.
        const visible = Math.max(Math.abs(pose.x), Math.abs(pose.z)) < .49 + CITY_VEHICLES[index].length * CITY_VEHICLE_SCALE;
        this.dummy.scale.setScalar(visible ? CITY_VEHICLE_SCALE : 0);
        this.dummy.updateMatrix(); mesh.setMatrixAt(instance, this.dummy.matrix);
        for (let wheel = 0; wheel < 4; wheel++) {
          const radius = metadata.wheelRadius!;
          const p = cityVehiclePoint(pose, (wheel % 2 ? 1 : -1) * metadata.track! / 2, (wheel < 2 ? -1 : 1) * metadata.wheelbase! / 2);
          this.dummy.position.set(p.x, CITY_ROAD_HEIGHT + radius * CITY_VEHICLE_SCALE, p.z);
          this.dummy.rotation.set(pose.distance / (radius * CITY_VEHICLE_SCALE), pose.heading, 0, 'YXZ');
          this.dummy.scale.set(metadata.wheelWidth! / 1.2, radius, radius).multiplyScalar(CITY_VEHICLE_SCALE);
          if (!visible) this.dummy.scale.setScalar(0);
          this.dummy.updateMatrix(); this.wheels.setMatrixAt(index * 4 + wheel, this.dummy.matrix);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.wheels.instanceMatrix.needsUpdate = true;
    const trainX = cityTrainPosition(time);
    for (let car = 0; car < 4; car++) {
      const p = cityStationPoint(trainX + (car - 1.5) * SHIBUYA_STATION.carSpacing);
      this.dummy.position.set(p.x, SHIBUYA_STATION.trackHeight, p.z);
      this.dummy.rotation.set(0, Math.PI / 2 + SHIBUYA_STATION.angle, 0);
      this.dummy.scale.set(SHIBUYA_STATION.trainScale.x, SHIBUYA_STATION.trainScale.y, SHIBUYA_STATION.trainScale.z);
      this.dummy.updateMatrix(); this.train.setMatrixAt(car, this.dummy.matrix);
      if (car === 0 || car === 3) {
        this.dummy.rotation.y = SHIBUYA_STATION.angle + (car === 0 ? -Math.PI / 2 : Math.PI / 2);
        this.dummy.updateMatrix(); this.cabs.setMatrixAt(car === 0 ? 0 : 1, this.dummy.matrix);
      }
    }
    this.train.instanceMatrix.needsUpdate = true; this.cabs.instanceMatrix.needsUpdate = true;
  }
}
