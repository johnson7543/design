import * as THREE from 'three';
import type { ResolvedTreeTheme } from '../../config/types.ts';
import { BLOCK_SIZE } from '../../designs/tree/constants.ts';
import { OSAKA_NIGHT_SWATCHES as P } from '../../designs/city/palette.ts';
import { createCityQRTargets } from '../../designs/city/qr-colors.ts';
import { cityMorphState } from '../../designs/city/morph.ts';
import type { CityMorphTarget } from '../../designs/city/morph-sources.ts';
import { loadDotonboriLibrary, type DotonboriLibrary } from '../../designs/city/dotonbori-assets.ts';
import { dotonboriPlanGeometry, type DotonboriMorphSurface } from '../../designs/city/dotonbori-morph.ts';
import type { DotonboriLayout } from '../../designs/city/dotonbori-layout.ts';
import { createDotonboriWaterfront } from '../../designs/city/dotonbori-waterfront.ts';
import { createDotonboriLandmark } from '../../designs/city/dotonbori-landmark.ts';
import { createDotonboriFacades } from '../../designs/city/dotonbori-facades.ts';
import { createDotonboriRiver } from '../../designs/city/dotonbori-river.ts';
import { applyDotonboriNightLighting } from '../../designs/city/dotonbori-lighting.ts';
import { DotonboriActivity } from '../../designs/city/dotonbori-activity.ts';
import { DOTONBORI_PALETTE } from '../../designs/city/dotonbori-geometry.ts';
import { resolveDotonboriGroundFloors } from '../../designs/city/dotonbori-ground-floor-layout.ts';
import { createDotonboriBuildings, createDotonboriBuildingDetails } from '../../designs/city/dotonbori-buildings.ts';
import { resolveDotonboriFronts } from '../../designs/city/dotonbori-facade-layout.ts';
import { DotonboriGeneratedSigns, dotonboriReferenceCampaigns } from '../../designs/city/dotonbori-generated-signs.ts';
import { createDotonboriEbisuTower } from '../../designs/city/dotonbori-ebisu-tower.ts';
import { DotonboriSurfaceMorph } from '../../designs/city/dotonbori-surface-morph.ts';
import { DotonboriDepthShading } from '../../designs/city/dotonbori-depth-shading.ts';

/** Reviewed source study on the player's ordinary QR/export surface. */
export class DotonboriScene {
  readonly root = new THREE.Group();
  private readonly city = new THREE.Group();
  private readonly material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true });
  private readonly assetState: { status: 'loading' | 'pending' | 'ready' | 'error'; library?: DotonboriLibrary; disposed: boolean } = { status: 'loading', disposed: false };
  get assetStatus() { return this.assetState.status; }
  private readonly targets: CityMorphTarget[] = [];
  private readonly plate = new THREE.Mesh(new THREE.BoxGeometry(1, .004, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  private qr: THREE.InstancedMesh;
  private surfaceMorph: DotonboriSurfaceMorph | undefined;
  private captureDirty = true;
  private grid: number;
  private layout: DotonboriLayout | undefined;
  private activity: DotonboriActivity | undefined;
  private river: ReturnType<typeof createDotonboriRiver> | undefined;
  private landmark: ReturnType<typeof createDotonboriLandmark> | undefined;
  private ebisu: ReturnType<typeof createDotonboriEbisuTower> | undefined;
  private animationTime = 0;
  private readonly detailMaterials: THREE.MeshBasicMaterial[] = [];
  private library: DotonboriLibrary | undefined;
  private modules: boolean[][] = [];
  private readonly buildingMeshes = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  private buildingDetails: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
  private generatedSigns: DotonboriGeneratedSigns | undefined;
  private facades: ReturnType<typeof createDotonboriFacades> | undefined;
  private lastProgress = 0;
  private lastReducedMotion = false;
  private hasLogo = false;
  private lightLogoBacking = false;
  private readonly depthShading = new DotonboriDepthShading();

  constructor(modules: boolean[][], theme: ResolvedTreeTheme, assetLoader = loadDotonboriLibrary) {
    this.root.name = 'designqr-dotonbori'; this.city.name = 'dotonbori-source-study';
    this.root.add(this.city, this.plate);
    this.plate.position.y = -.003;
    this.grid = modules.length;
    this.qr = this.createQR(modules.length ** 2);
    this.root.add(this.qr);
    this.updateContent(modules, theme);
    this.update(0, 0, false);
    // Completion owns only a small state token; no GPU work, RAF, or retained
    // scene. A running frame attaches models only at a settled endpoint.
    const state = this.assetState;
    void assetLoader().then(library => {
      if (!state.disposed) { state.library = library; state.status = 'pending'; }
    }).catch(() => { if (!state.disposed) state.status = 'error'; });
  }

  private createQR(count: number) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true }), count);
    mesh.name = 'dotonbori-qr-modules'; mesh.frustumCulled = false; mesh.renderOrder = 3;
    mesh.onBeforeRender = renderer => renderer.clearDepth();
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  private addSurface(id: string, kind: DotonboriMorphSurface['kind'], geometry: THREE.BufferGeometry, color?: string) {
    if (color) {
      const ink = new THREE.Color(color), colors = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set([ink.r, ink.g, ink.b], i);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = id; mesh.userData.evidence = kind === 'plan' ? 'horizontal-reference-only' : 'source-study';
    this.city.add(mesh);
  }

  updateContent(modules: boolean[][], theme: ResolvedTreeTheme) {
    if (this.assetState.disposed) return;
    const architectureChanged = this.modules.length !== modules.length
      || modules.some((row, y) => row.some((cell, x) => cell !== this.modules[y]?.[x]));
    this.modules = modules.map(row => [...row]);
    this.grid = modules.length;
    this.root.scale.setScalar(this.grid * BLOCK_SIZE);
    this.targets.length = 0;
    if (this.qr.instanceMatrix.count < this.grid ** 2) {
      const previous = this.qr;
      this.qr = this.createQR(this.grid ** 2); this.root.add(this.qr);
      previous.removeFromParent(); previous.geometry.dispose(); (previous.material as THREE.Material).dispose(); previous.dispose();
    }
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(1.002 / this.grid, .002, 1.002 / this.grid);
    let count = 0;
    for (const target of createCityQRTargets(modules, theme)) {
      const { x, z, light, ink } = target;
      this.targets.push(target);
      if (!light) {
        matrix.makeScale(scale.x, scale.y, scale.z).setPosition(x, .001, z);
        this.qr.setMatrixAt(count, matrix); this.qr.setColorAt(count++, ink);
      }
    }
    this.qr.count = count; this.qr.instanceMatrix.needsUpdate = true;
    if (this.qr.instanceColor) this.qr.instanceColor.needsUpdate = true;
    this.plate.material.color.set(theme.groundColor);
    if (architectureChanged) this.rebuildBuildings();
    else this.surfaceMorph?.updateTargets(this.targets);
    // Like Shibuya, paused and mid-turn edits update geometry/destinations now
    // without replacing actors, ticking clocks or attaching pending assets.
    this.update(this.lastProgress, 0, this.lastReducedMotion, false);
  }

  private rebuildBuildings() {
    const library = this.library; if (!library) return;
    const buildings = createDotonboriBuildings(library, this.modules);
    for (const building of buildings) {
      const old = this.buildingMeshes.get(building.id);
      if (old) {
        // Fixed hosts keep even their GPU geometry identity through content edits.
        if (building.fixed) { building.geometry.dispose(); building.geometry = old.geometry; }
        else { const previous = old.geometry; old.geometry = building.geometry; previous.dispose(); }
      } else {
        const mesh = new THREE.Mesh(building.geometry, this.material); mesh.name = building.id;
        mesh.userData.sourceBuilding = building.id;
        mesh.userData.evidence = building.fixed ? 'source-envelope' : 'source-footprint-qr-height';
        this.buildingMeshes.set(building.id, mesh); this.city.add(mesh);
      }
    }
    const registered = resolveDotonboriFronts(buildings, library.layout);
    const groundFloors = resolveDotonboriGroundFloors(buildings, library, registered);
    const fronts = [...registered, ...groundFloors.fronts];
    this.root.userData.groundFloorCoverage = groundFloors.byBuilding;
    const details = createDotonboriBuildingDetails(buildings, library.layout.tileSizeM, fronts);
    if (this.buildingDetails) { this.buildingDetails.geometry.dispose(); this.buildingDetails.geometry = details.geometry; }
    else {
      this.buildingDetails = new THREE.Mesh(details.geometry, this.material);
      this.buildingDetails.name = 'dotonbori-qr-building-details'; this.city.add(this.buildingDetails);
    }
    this.buildingDetails.userData.buildingFeatures = details.counts;
    if (!this.generatedSigns) {
      this.generatedSigns = new DotonboriGeneratedSigns(); this.city.add(this.generatedSigns.mesh);
      this.detailMaterials.push(this.generatedSigns.mesh.material);
    }
    this.generatedSigns.update([...details.panels, ...dotonboriReferenceCampaigns(library, this.modules, fronts)]);
    this.generatedSigns.updateTime(this.animationTime);
    const oldFacades = this.facades;
    this.facades = createDotonboriFacades(library, this.modules, fronts, oldFacades?.materials);
    this.facades.cloth.update(this.animationTime);
    this.facades.actions.update(this.animationTime);
    this.facades.kani?.update(this.animationTime);
    this.facades.setLogoPresent(this.hasLogo, this.lightLogoBacking);
    if (oldFacades) {
      oldFacades.root.removeFromParent(); oldFacades.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); oldFacades.root.clear();
    } else this.detailMaterials.push(...this.facades.materials);
    this.city.add(this.facades.root);
    this.depthShading.update(buildings, library.layout.tileSizeM);
    this.city.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
      if (object.material === this.material || ['dotonbori-photo-facade-details', 'dotonbori-storefront-forecourts',
        'dotonbori-ebisu-structure', 'dotonbori-glico-frame'].includes(object.name)) this.depthShading.bake(object.geometry);
    });
    this.depthShading.finish();
    this.rebuildMorph();
  }

  private rebuildMorph() {
    if (!this.library) return;
    this.surfaceMorph?.dispose();
    this.surfaceMorph = new DotonboriSurfaceMorph(this.city, this.library, this.targets);
    this.root.add(this.surfaceMorph.root); this.captureDirty = true;
  }

  /** Custom artwork stays on the north Asahi panel throughout 3D rotation
   * and travels with the full city into the QR transformation. */
  setLogoPresent(present: boolean, lightBacking = false) {
    if ((present === this.hasLogo && lightBacking === this.lightLogoBacking) || this.assetState.disposed) return;
    this.hasLogo = present; this.lightLogoBacking = lightBacking;
    this.facades?.setLogoPresent(present, lightBacking); this.captureDirty = true;
  }
  getLogoAnchor() {
    const slot = this.facades?.logoSlot;
    return slot ? { ...slot, alignTop: true, visible: true }
      : { x: 0, y: 0, z: 0, width: 0, height: 0, angle: 0, visible: false };
  }

  prepareMorphRendering(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene) {
    if (!this.assetState.disposed) this.surfaceMorph?.prepare(renderer, camera, scene);
  }

  update(progress: number, deltaSeconds: number, reducedMotion: boolean, allowAssetAttachment = true) {
    if (this.assetState.disposed) return;
    const p = THREE.MathUtils.clamp(progress, 0, 1), state = this.assetState;
    this.lastProgress = p; this.lastReducedMotion = reducedMotion;
    if (state.library && (p === 0 || p === 1) && allowAssetAttachment) {
      this.layout = state.library.layout;
      const library = this.library = state.library;
      applyDotonboriNightLighting(this.material, this.layout, library.templates);
      this.addSurface('dotonbori-reference-datum', 'plan', dotonboriPlanGeometry([
        { type: 'Polygon', coordinates: [this.layout.outlineEastNorthM] },
      ], -.001, this.layout), P.navy);
      const levels = library.waterfront.levelsM, size = this.layout.tileSizeM;
      for (const template of library.templates) if (template.kind === 'bridge') this.addSurface(template.id, template.kind, template.geometry.clone(), DOTONBORI_PALETTE.stone);
      this.addSurface('dotonbori-road-plan', 'plan', dotonboriPlanGeometry(library.plan.roads, .0001, this.layout), DOTONBORI_PALETTE.road);
      this.addSurface('dotonbori-water-plan', 'plan', dotonboriPlanGeometry(library.plan.water, levels.water / size, this.layout), DOTONBORI_PALETTE.water);
      this.addSurface('dotonbori-lower-riverwalk', 'plan', dotonboriPlanGeometry(library.waterfront.lowerWalk, levels.lowerWalk / size, this.layout), DOTONBORI_PALETTE.paving);
      this.addSurface('dotonbori-upper-riverwalk', 'plan', dotonboriPlanGeometry(library.waterfront.upperWalk, levels.upperWalk / size, this.layout), DOTONBORI_PALETTE.stone);
      const waterfront = createDotonboriWaterfront(library), mesh = new THREE.Mesh(waterfront.geometry, this.material);
      mesh.name = 'dotonbori-waterfront-fittings'; mesh.userData.evidence = 'reference-directed-interpretation'; this.city.add(mesh);
      const landmark = this.landmark = createDotonboriLandmark(library); this.city.add(landmark.root);
      this.ebisu = createDotonboriEbisuTower(library); this.city.add(this.ebisu.root);
      this.river = createDotonboriRiver(library); this.city.add(this.river.mesh, this.river.wake.mesh);
      this.detailMaterials.push(...landmark.materials, this.river.material, this.river.wake.material, this.ebisu.material);
      this.activity = new DotonboriActivity(library); this.city.add(this.activity.root);
      this.rebuildBuildings();
      state.library = undefined; state.status = 'ready'; this.captureDirty = true;
    }
    if (p === 0) {
      if (!reducedMotion && allowAssetAttachment) this.animationTime += Math.max(0, deltaSeconds);
      this.activity?.update(this.animationTime);
      this.river?.update(this.animationTime);
      this.landmark?.update(this.animationTime);
      this.ebisu?.update(this.animationTime);
      this.facades?.cloth.update(this.animationTime);
      this.facades?.actions.update(this.animationTime);
      this.facades?.kani?.update(this.animationTime);
      this.generatedSigns?.updateTime(this.animationTime);
      this.captureDirty = true;
    }
    const morph = cityMorphState(p);
    this.city.visible = p === 0;
    this.material.opacity = 1;
    this.detailMaterials.forEach(material => { material.opacity = 1; });
    this.city.updateWorldMatrix(true, false);
    this.activity?.setPresentation(1, this.city.matrixWorld);
    this.qr.visible = morph.qrOpacity > 0; (this.qr.material as THREE.MeshBasicMaterial).opacity = morph.qrOpacity;
    this.plate.visible = morph.plateOpacity > 0; this.plate.material.opacity = morph.plateOpacity;
    if (p > 0 && p < 1 && this.captureDirty) {
      this.surfaceMorph?.capture(); this.captureDirty = false;
    }
    this.surfaceMorph?.update(p);
  }

  dispose() {
    if (this.assetState.disposed) return;
    this.assetState.disposed = true; this.assetState.library = undefined;
    this.surfaceMorph?.dispose(); this.surfaceMorph = undefined;
    const materials = new Set<THREE.Material>();
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
        if (object instanceof THREE.InstancedMesh) object.dispose();
      }
    });
    const textures = new Set<THREE.Texture>();
    materials.forEach(material => {
      if (material instanceof THREE.MeshBasicMaterial && material.map) textures.add(material.map);
      material.dispose();
    });
    textures.forEach(texture => texture.dispose());
    this.root.clear(); this.root.removeFromParent();
    this.activity = undefined; this.river = undefined; this.landmark = undefined; this.ebisu = undefined; this.detailMaterials.length = 0;
    this.library = undefined; this.facades = undefined; this.generatedSigns = undefined; this.buildingDetails = undefined;
    this.buildingMeshes.clear(); this.modules.length = 0;
  }
}
