import { contentVariation } from '../../designs/content-variation.ts';
import * as THREE from 'three';
import type { ResolvedTreeTheme } from '../../config/types.ts';
import { BLOCK_SIZE } from '../../designs/tree/constants.ts';
import { SHIBUYA_PALETTE as P } from '../../designs/city/palette.ts';
import { cityQRModuleColor } from '../../designs/city/qr-colors.ts';
import { cityNoise, createCityBuildings, SHIBUYA_STREET_TREES, type CityBuilding } from '../../designs/city/layout.ts';
import { createHachikoSquareGeometry } from '../../designs/city/hachiko-square.ts';
import { createShibuyaConstructionGeometry } from '../../designs/city/construction-geometry.ts';
import { CITY_PEDESTRIAN_COUNT, createCityPedestrians, pedestrianPose } from '../../designs/city/motion.ts';
import { cityBuildingPanels, cityFacadePanelGeometry, cityPanelAnchor, createCityArchitectureGeometry, createCityArchitectureGlassGeometry, type CityFacadePanel } from '../../designs/city/architecture.ts';
import { CITY_SIGN_DESIGNS, paintCitySign } from '../../designs/city/sign-artwork.ts';
import { citySignTextureSize } from '../../designs/city/sign-rendering.ts';
import { cityMorphState, type CityMorphVoxel } from '../../designs/city/morph.ts';
import { buildCityMorphBase, buildCityMorphPlan, cityMorphActor, createCityMorphCrosswalks, createCityMorphGround, sampleCityMorphMesh,
  type CityMorphGround, type CityMorphPair, type CityMorphTarget, type CityMorphTile } from '../../designs/city/morph-sources.ts';
import { CityMorphMesh } from '../../designs/city/morph-mesh.ts';
import { CityMorphSigns, cityMorphSignSources } from '../../designs/city/morph-signs.ts';
import { loadCityAssetLibrary, type CityAssetLibrary } from '../../designs/city/assetLoader.ts';
import { CityAssetInstances } from '../../designs/city/assetInstances.ts';
import { createShibuyaPlinthGeometry, createShibuyaRoadGeometry, createShibuyaRoadMaterial } from '../../designs/city/road-mesh.ts';
import { createShibuyaStationGeometry } from '../../designs/city/station-geometry.ts';
import { paintCityTransitSign } from '../../designs/city/transit-signs.ts';
import { createShibuyaStreetFurniture } from '../../designs/city/street-furniture.ts';
import { CITY_PERSON_SCALE, CITY_PAVEMENT_HEIGHT, cityPointInPolygon, roadMetres } from '../../designs/city/road-network.ts';
import { HACHIKO_MONUMENT } from '../../designs/city/hachiko-layout.ts';

const PERSON_PARTS = 7;

interface Box {
  x: number; y: number; z: number; w: number; h: number; d: number;
  color: string; angle?: number;
}
interface Module {
  x: number; z: number; ink: THREE.Color;
}

/** Shibuya artwork and the module morph share the player's camera and export surface. */
export class ShibuyaScene {
  readonly root = new THREE.Group();
  private readonly assetState: { status: 'loading' | 'pending' | 'ready' | 'error'; library?: CityAssetLibrary; disposed: boolean } = { status: 'loading', disposed: false };
  get assetStatus() { return this.assetState.status; }
  private assets: CityAssetInstances | undefined;
  private disposed = false;
  private readonly city = new THREE.Group();
  private readonly boxes: Box[] = [];
  private staticMesh!: THREE.InstancedMesh;
  private readonly signMaterials = new Set<THREE.MeshBasicMaterial>();
  private readonly signTextures = new Map<string, THREE.CanvasTexture>();
  private readonly buildingSigns = new Map<string, { panel: CityFacadePanel; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> }>();
  private streetscape!: THREE.Mesh;
  private readonly dummy = new THREE.Object3D();
  private readonly modules: Module[] = [];
  private readonly morphTargets: CityMorphTarget[] = [];
  private morphGround: CityMorphGround[] = [];
  private morphMesh: CityMorphMesh | undefined;
  private readonly morphRoot = new THREE.Group();
  private morphSigns: CityMorphSigns | undefined;
  private morphBase: CityMorphPair[] | undefined;
  private morphProgramsPrepared = false;
  private morphPlan: CityMorphTile[] = [];
  private actorMorphSources: CityMorphVoxel[] | undefined;
  private staticMorphSources: CityMorphVoxel[] | undefined;
  private readonly transitPanels: CityFacadePanel[] = [];
  private morphDirty = true;
  private qr: THREE.InstancedMesh;
  private readonly plate: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private readonly people: THREE.InstancedMesh;
  private readonly pedestrians: ReturnType<typeof createCityPedestrians>;
  private buildings: readonly CityBuilding[];
  private heroSignPainter: ((hasLogo: boolean) => void) | undefined;
  private hasLogo = false;
  private streetFurniture!: ReturnType<typeof createShibuyaStreetFurniture>;
  private readonly staticMaterial: THREE.MeshBasicMaterial;
  private readonly peopleMaterial: THREE.MeshBasicMaterial;
  private lastProgress = -1;
  private lastReducedMotion = false;
  private grid: number;
  private readonly variation: number;
  // Start amid the first walk phase so the default view is immediately alive.
  private animationTime = 3;
  private lastMotionTime = -1;

  constructor(modules: boolean[][], theme: ResolvedTreeTheme, assetLoader = loadCityAssetLibrary) {
    this.grid = modules.length;
    this.variation = contentVariation(modules);
    this.buildings = createCityBuildings(modules);
    this.assets?.updateBuildings(this.buildings);
    this.pedestrians = createCityPedestrians(this.variation, this.buildings);
    this.root.name = 'designqr-shibuya';
    this.root.scale.setScalar(this.grid * BLOCK_SIZE);
    this.root.add(this.city);
    this.staticMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.peopleMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.buildStreets();
    this.buildArchitecture();
    this.buildStation();
    this.buildStreetLife();
    this.staticMesh = this.instanceBoxes(this.boxes, this.staticMaterial);
    this.city.add(this.staticMesh);

    this.people = new THREE.InstancedMesh(this.shadedBox(), this.peopleMaterial, CITY_PEDESTRIAN_COUNT * PERSON_PARTS);
    this.people.name = 'shibuya-walking-commuters';
    this.people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < CITY_PEDESTRIAN_COUNT; i++) {
      const coat = [P.stone, P.blue, P.glassLight, P.ink, P.sky, P.concrete, P.blue, P.stone, P.warmLight, P.coral][i % 10];
      for (const [part, color] of [coat, P.paper, P.ink, P.ink, coat, coat, P.ink].entries()) {
        this.people.setColorAt(i * PERSON_PARTS + part, new THREE.Color(color));
      }
    }
    this.people.frustumCulled = false;
    this.city.add(this.people);
    this.setQRModules(modules, theme);
    this.qr = this.createQRMesh(this.modules.length);
    this.updateQRMesh();
    this.root.add(this.qr);
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(1, .004, 1), new THREE.MeshBasicMaterial({ color: theme.groundColor }));
    this.plate.position.y = -.003;
    this.root.add(this.plate);
    for (const material of [this.staticMaterial, this.peopleMaterial, ...this.signMaterials]) material.transparent = true;
    this.update(0, 0, false);
    const state = this.assetState;
    // Pending work retains only this token after disposal; content edits reuse it.
    void assetLoader().then(library => {
      if (state.disposed) return;
      state.library = library; state.status = 'pending';
    }).catch(() => { if (!state.disposed) state.status = 'error'; });
  }

  private setQRModules(modules: boolean[][], theme: ResolvedTreeTheme) {
    this.grid = modules.length;
    this.modules.length = 0;
    this.morphTargets.length = 0;
    this.morphDirty = true;
    this.morphBase = undefined;
    if (this.morphGround.length !== this.grid * this.grid) this.morphGround = [];
    for (let row = 0; row < this.grid; row++) {
      for (let col = 0; col < this.grid; col++) {
        const x = (col + .5) / this.grid - .5;
        const z = (row + .5) / this.grid - .5;
        const light = !modules[row][col];
        const ink = new THREE.Color(light ? theme.groundColor : cityQRModuleColor(row, col, this.grid, theme));
        this.morphTargets.push({ x, z, ink, light });
        if (!light) this.modules.push({ x, z, ink });
      }
    }
  }

  private updateQRMesh() {
    this.modules.forEach((module, i) => {
      this.dummy.position.set(module.x, .001, module.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1.002 / this.grid, .002, 1.002 / this.grid);
      this.dummy.updateMatrix(); this.qr.setMatrixAt(i, this.dummy.matrix); this.qr.setColorAt(i, module.ink);
    });
    this.qr.instanceMatrix.needsUpdate = true;
    if (this.qr.instanceColor) this.qr.instanceColor.needsUpdate = true;
  }

  private createQRMesh(capacity: number, previous?: THREE.InstancedMesh) {
    const qr = new THREE.InstancedMesh(previous?.geometry ?? this.shadedBox(),
      previous?.material ?? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true }), capacity);
    // Crossfade the architectural layer into the voxel layer. A fresh depth
    // buffer lets voxels occlude one another without the fading facades hiding them.
    qr.name = 'shibuya-qr-modules';
    qr.renderOrder = 3;
    qr.onBeforeRender = renderer => renderer.clearDepth();
    qr.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    qr.frustumCulled = false;
    return qr;
  }

  /** Value/QR-version edits change architecture, not the street-life simulation.
   * Geographic envelopes and landmark dimensions are independent of QR content,
   * so existing crowd plans, vehicles, metro, signals and async assets stay valid. */
  updateContent(modules: boolean[][], theme: ResolvedTreeTheme) {
    if (this.disposed) return;
    this.buildings = createCityBuildings(modules);
    this.assets?.updateBuildings(this.buildings);
    const geometry = this.streetscape.geometry;
    this.streetscape.geometry = createCityArchitectureGeometry(this.buildings.slice(2));
    geometry.dispose();
    this.updateBuildingSigns();
    this.setQRModules(modules, theme);
    if (this.modules.length > this.qr.instanceMatrix.count) {
      const previous = this.qr;
      this.qr = this.createQRMesh(this.modules.length, previous);
      previous.removeFromParent(); previous.dispose();
      this.root.add(this.qr);
    }
    this.qr.count = this.modules.length;
    this.updateQRMesh();
    this.root.scale.setScalar(this.grid * BLOCK_SIZE);
    this.plate.material.color.set(theme.groundColor);
    const progress = this.lastProgress;
    this.lastProgress = -1;
    // Refresh destinations/fades synchronously, without ticking time or attaching
    // pending GPU assets in a paused, hidden or mid-turn player.
    this.update(progress, 0, this.lastReducedMotion, false);
  }

  /** Async completion only stores CPU data; a running, settled frame owns attachment. */
  dispose() {
    this.disposed = true; this.assetState.disposed = true; this.assetState.library = undefined;
    // The owning renderer disposes the mesh textures once, including shared maps.
    this.signTextures.clear(); this.buildingSigns.clear(); this.heroSignPainter = undefined;
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, angle = 0) {
    this.boxes.push({ x, y, z, w, h, d, color, angle });
  }

  /** Baked face illumination keeps thousands of details to a handful of draw calls. */
  private shadedBox() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const normal = geometry.getAttribute('normal');
    const colors = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) {
      const shade = normal.getY(i) > .5 ? 1 : normal.getX(i) > .5 ? .65 : normal.getZ(i) > .5 ? .84 : .52;
      colors.set([shade, shade, shade], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  private instanceBoxes(boxes: Box[], material: THREE.MeshBasicMaterial) {
    const mesh = new THREE.InstancedMesh(this.shadedBox(), material, boxes.length);
    boxes.forEach((box, i) => {
      this.dummy.position.set(box.x, box.y, box.z);
      this.dummy.rotation.set(0, box.angle ?? 0, 0);
      this.dummy.scale.set(box.w, box.h, box.d);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(box.color));
    });
    mesh.computeBoundingSphere();
    return mesh;
  }

  private buildStreets() {
    const plinth = new THREE.Mesh(createShibuyaPlinthGeometry(), this.staticMaterial);
    plinth.name = 'shibuya-stair-cut-plinth'; this.city.add(plinth);
    const roadMaterial = createShibuyaRoadMaterial();
    this.signMaterials.add(roadMaterial);
    const road = new THREE.Mesh(createShibuyaRoadGeometry(), [roadMaterial, this.staticMaterial]);
    road.name = 'shibuya-surveyed-road-foundation';
    this.city.add(road);
    // Reflected morning light traces the miniature's dark plinth.
    this.box(0, -.016, .501, .86, .003, .001, P.glassLight);
    this.box(.501, -.016, 0, .001, .003, .86, P.coolLight);
  }

  private buildArchitecture() {
    const context = new THREE.Mesh(createCityArchitectureGeometry(this.buildings.slice(2)), this.staticMaterial);
    context.name = 'shibuya-source-aligned-streetscape'; this.city.add(context);
    this.streetscape = context;
    const glazing = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .38, depthWrite: false });
    glazing.userData.cityBaseOpacity = .38; this.signMaterials.add(glazing);
    const balcony = new THREE.Mesh(createCityArchitectureGlassGeometry(this.buildings.filter(b => b.kind === 'station-front')), glazing);
    balcony.name = 'shibuya-police-balcony-glazing'; this.city.add(balcony);
    this.updateBuildingSigns();
  }

  private updateBuildingSigns() {
    const retired = new Set<THREE.Texture>();
    const panels = this.buildings.flatMap(cityBuildingPanels);
    const next = new Set(panels.map(panel => panel.id));
    const remove = (id: string) => {
      const old = this.buildingSigns.get(id);
      if (!old) return;
      old.mesh.removeFromParent(); old.mesh.geometry.dispose();
      this.signMaterials.delete(old.mesh.material);
      if (old.mesh.material.map) retired.add(old.mesh.material.map);
      old.mesh.material.dispose(); this.buildingSigns.delete(id);
    };
    for (const panel of panels) {
      const old = this.buildingSigns.get(panel.id);
      if (old && JSON.stringify(old.panel) === JSON.stringify(panel)) continue;
      remove(panel.id);
      const mesh = this.sign(panel);
      if (mesh) this.buildingSigns.set(panel.id, { panel, mesh });
    }
    for (const id of this.buildingSigns.keys()) if (!next.has(id)) remove(id);
    this.morphSigns?.updateMaps(this.buildingSigns.values());
    // Reuse identical artwork during replacement, then release maps no longer
    // referenced by any building or station sign. Typing must not grow the cache.
    const used = new Set([...this.signMaterials].map(material => material.map));
    for (const [key, texture] of this.signTextures) if (!used.has(texture)) {
      this.signTextures.delete(key); retired.add(texture);
    }
    for (const texture of retired) if (!used.has(texture)) texture.dispose();
  }

  private sign(panel: CityFacadePanel) {
    const design = { ...CITY_SIGN_DESIGNS[panel.design],
      ...(panel.label ? { label: panel.label } : {}), ...(panel.caption ? { caption: panel.caption } : {}),
      ...(panel.layout ? { layout: panel.layout } : {}) };
    const size = citySignTextureSize(panel);
    const key = JSON.stringify([size.width, size.height, panel.transit, panel.exit, design]);
    // Identical front/rear exit signs and repeated artwork share a static map
    // within this player. The mutable configured-logo panel must stay private.
    let texture = panel.hero ? undefined : this.signTextures.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = size.width; canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (panel.transit) paintCityTransitSign(ctx, panel.transit, panel.exit);
      else paintCitySign(ctx, design, panel.hero && this.hasLogo);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 2;
      const paintedTexture = texture;
      if (panel.hero) this.heroSignPainter = hasLogo => {
        paintCitySign(ctx, design, hasLogo); paintedTexture.needsUpdate = true;
      };
      else this.signTextures.set(key, texture);
    }
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
      ...(panel.transparent ? { alphaTest: .025 } : {}) });
    this.signMaterials.add(material);
    const screen = new THREE.Mesh(cityFacadePanelGeometry(panel), material);
    screen.name = `shibuya-sign-${panel.id}`;
    this.city.add(screen);
    return screen;
  }

  setLogoPresent(hasLogo: boolean) {
    if (hasLogo === this.hasLogo) return;
    this.hasLogo = hasLogo;
    this.heroSignPainter?.(hasLogo);
    this.morphDirty = true;
    this.lastProgress = -1;
  }

  getLogoAnchor() {
    return cityPanelAnchor(cityBuildingPanels(this.buildings[0]).find(panel => panel.hero)!);
  }

  private buildStation() {
    const station = createShibuyaStationGeometry();
    const structure = new THREE.Mesh(station.geometry, this.staticMaterial);
    structure.name = 'shibuya-station-and-subway-entrances'; this.city.add(structure);
    const glassMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .28, depthWrite: false });
    glassMaterial.userData.cityBaseOpacity = .28; this.signMaterials.add(glassMaterial);
    const glass = new THREE.Mesh(station.glassGeometry, glassMaterial);
    glass.name = 'shibuya-subway-glazing'; this.city.add(glass);
    this.transitPanels.push(...station.panels);
    for (const panel of station.panels) this.sign(panel);

  }

  private buildStreetLife() {
    const worksite = createShibuyaConstructionGeometry();
    const construction = new THREE.Mesh(worksite.geometry, this.staticMaterial);
    construction.name = 'shibuya-construction-site';
    this.city.add(construction);
    this.transitPanels.push(...worksite.panels);
    for (const panel of worksite.panels) this.sign(panel);
    const square = new THREE.Mesh(createHachikoSquareGeometry(), this.staticMaterial);
    square.name = 'shibuya-hachiko-square';
    this.city.add(square);
    this.streetFurniture = createShibuyaStreetFurniture();
    const fixtures = new THREE.Mesh(this.streetFurniture.geometry, this.staticMaterial);
    fixtures.name = 'shibuya-shared-street-furniture';
    const lights = new THREE.Mesh(this.streetFurniture.lightGeometry, this.staticMaterial);
    lights.name = 'shibuya-oriented-signal-lights';
    this.city.add(fixtures, lights);
  }

  private updatePeople(time: number) {
    for (let i = 0; i < CITY_PEDESTRIAN_COUNT; i++) {
      const pose = pedestrianPose(this.pedestrians[i], time);
      const size = (.92 + cityNoise(i + 540, this.variation) * .20) * CITY_PERSON_SCALE;
      const sin = Math.sin(pose.heading), cos = Math.cos(pose.heading);
      const part = (index: number, x: number, y: number, z: number, w: number, h: number, d: number, pitch = 0) => {
        this.dummy.position.set(pose.x + (x * cos + z * sin) * size,
          pose.groundHeight + (y - .001 + pose.bob) * size, pose.z + (-x * sin + z * cos) * size);
        this.dummy.rotation.set(pitch, pose.heading, 0, 'YXZ');
        this.dummy.scale.set(w * size, h * size, d * size);
        this.dummy.updateMatrix();
        this.people.setMatrixAt(i * PERSON_PARTS + index, this.dummy.matrix);
      };
      part(0, 0, .0105, 0, .0043, .0075, .003);
      part(1, 0, .016, 0, .0036, .0038, .0033);
      part(6, 0, .018, -.0003, .0038, .0011, .0035);
      for (const side of [-1, 1]) {
        const swing = pose.swing * side;
        part(side === -1 ? 2 : 3, side * .0013, .007 - Math.cos(swing) * .003,
          -Math.sin(swing) * .003, .0016, .006, .0018, swing);
        const arm = -swing + (side === 1 ? pose.restingArm : -.08 * (1 - Number(pose.walking)));
        part(side === -1 ? 4 : 5, side * .003, .013 - Math.cos(arm) * .0025,
          -Math.sin(arm) * .0025, .0015, .005, .0016, arm);
      }
    }
    this.people.instanceMatrix.needsUpdate = true;
  }

  private prepareMorph() {
    if (!this.morphGround.length) this.morphGround = createCityMorphGround(this.grid, this.buildings);
    this.morphBase ??= buildCityMorphBase(this.morphTargets, this.buildings, this.morphGround);
    if (!this.staticMorphSources) {
      this.staticMorphSources = [
        ...createCityMorphCrosswalks(),
        ...sampleCityMorphMesh(this.city.getObjectByName('shibuya-station-and-subway-entrances') as THREE.Mesh, 'station', 24),
        ...sampleCityMorphMesh(this.city.getObjectByName('shibuya-shared-street-furniture') as THREE.Mesh, 'furniture', 32),
        ...sampleCityMorphMesh(this.city.getObjectByName('shibuya-hachiko-square') as THREE.Mesh, 'garden', 24),
        ...sampleCityMorphMesh(this.city.getObjectByName('shibuya-construction-site') as THREE.Mesh, 'furniture', 24),
        // Explicit anchors keep small landmarks from being lost in area sampling.
        { ...HACHIKO_MONUMENT.position, y: CITY_PAVEMENT_HEIGHT + roadMetres(2), width: roadMetres(1.1),
          height: roadMetres(1.3), depth: roadMetres(1.4), color: P.roof, kind: 'garden', id: 'hachiko' },
        ...SHIBUYA_STREET_TREES.map((tree, i): CityMorphVoxel => ({ x: tree.x, z: tree.z,
          y: CITY_PAVEMENT_HEIGHT + roadMetres(tree.height * .78), width: roadMetres(tree.radius),
          height: roadMetres(tree.radius), depth: roadMetres(tree.radius), color: P.foliage, kind: 'garden', id: `tree-${i}` })),
      ];
    }
    if (!this.actorMorphSources) {
      const matrix = new THREE.Matrix4(), color = new THREE.Color();
      const center = new THREE.Vector3(0, -.12, 0), size = new THREE.Vector3(1, 2.3, 1);
      this.actorMorphSources = [];
      for (let i = 0; i < CITY_PEDESTRIAN_COUNT; i++) {
        this.people.getMatrixAt(i * PERSON_PARTS, matrix);
        this.people.getColorAt(i * PERSON_PARTS, color);
        const source = cityMorphActor(matrix, '#' + color.getHexString(), 'people', `person-${i}`, center, size);
        // Indoor commuters are hidden by the concourse; don't reveal them as
        // floating particles. Their live transforms and clock remain untouched.
        if (!this.buildings.some(b => cityPointInPolygon(source, b.footprint))) this.actorMorphSources.push(source);
      }
      this.actorMorphSources.push(...this.assets?.captureMorphSources() ?? []);
    }
    const signs = [...this.buildingSigns.values()].map(({ panel }) => panel).concat(this.transitPanels);
    const details = [...this.staticMorphSources, ...this.actorMorphSources];
    for (const panel of signs) details.push(...cityMorphSignSources(panel, this.hasLogo));
    this.morphPlan = buildCityMorphPlan(this.morphTargets, this.buildings, this.morphGround, details, this.morphBase);
    if (this.morphMesh) this.morphMesh.setTiles(this.morphPlan, this.grid);
    else {
      this.morphMesh = new CityMorphMesh(this.morphPlan, this.grid);
      this.morphSigns = new CityMorphSigns();
      this.morphRoot.add(this.morphMesh.mesh, this.morphSigns.mesh); this.root.add(this.morphRoot);
    }
    this.morphSigns!.setTiles(this.morphPlan, this.buildingSigns.values(), this.grid);
    this.morphDirty = false;
  }

  /** Start only the transient tile shader on the FIRST requested turn.
   * The driver can compile while the solid city is still shown; sign fragments
   * use the already compiled static-sign variant.
   * Use compile's kick-off without compileAsync's uncancellable polling: a player
   * can be disposed or switch design before compilation finishes. No mount work,
   * hidden render, texture upload, timer, or promise retaining a disposed scene. */
  prepareMorphRendering(renderer: THREE.WebGLRenderer, camera: THREE.Camera, scene: THREE.Scene) {
    if (this.disposed || !this.morphMesh || this.morphProgramsPrepared) return;
    this.morphProgramsPrepared = true;
    renderer.compile(this.morphRoot, camera, scene);
    // Submit the compilation commands now; do not wait for completion or draw
    // a hidden frame. Deferred command buffers would otherwise defer the work
    // until the first visible tile draw as well.
    renderer.getContext().flush();
  }

  update(progress: number, deltaSeconds: number, reducedMotion: boolean, allowAssetAttachment = true) {
    this.lastReducedMotion = reducedMotion;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    let attached = false;
    if (this.assetState.library && (p === 0 || p === 1) && allowAssetAttachment && !this.disposed) {
      this.assets = new CityAssetInstances(this.assetState.library, this.buildings);
      this.city.add(this.assets.root);
      for (const material of this.assets.materials) this.signMaterials.add(material);
      this.assetState.library = undefined; this.assetState.status = 'ready'; this.lastMotionTime = -1;
      attached = true;
    }
    if (!reducedMotion && p === 0) this.animationTime += deltaSeconds;
    const time = reducedMotion ? 4 : this.animationTime;
    const morph = cityMorphState(p);
    this.city.visible = morph.cityOpacity > 0;
    this.qr.visible = morph.qrOpacity > 0;
    this.plate.visible = morph.plateOpacity > 0;
    // Keep the detailed city recognizable while all layers hand over to tiles.
    this.city.scale.y = 1 - morph.vertical;
    for (const material of [this.staticMaterial, this.peopleMaterial, ...this.signMaterials]) {
      material.opacity = morph.cityOpacity * (material.userData.cityBaseOpacity ?? 1);
    }
    if (this.city.visible || attached) {
      this.city.updateWorldMatrix(true, false);
      this.assets?.update(time, this.city.matrixWorld);
    }
    if (time !== this.lastMotionTime && (this.city.visible || attached)) {
      this.lastMotionTime = time;
      this.updatePeople(time);
      this.streetFurniture.setTime(time);
      this.actorMorphSources = undefined;
    }
    if (p === 0) {
      this.actorMorphSources = undefined;
      this.morphDirty = true;
    } else if (p < 1 && (this.morphDirty || !this.actorMorphSources)) this.prepareMorph();
    if (p !== this.lastProgress) {
      this.plate.material.transparent = true;
      this.plate.material.depthWrite = false;
      this.plate.material.opacity = morph.plateOpacity;
      (this.qr.material as THREE.MeshBasicMaterial).opacity = morph.qrOpacity;
      this.morphMesh?.update(p);
      this.morphSigns?.update(p);
    }
    this.lastProgress = p;
  }
}
