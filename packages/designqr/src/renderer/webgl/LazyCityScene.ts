import { Group, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Vector3,
  type Camera, type Scene, type WebGLRenderer } from 'three';
import type { DesignQRCityPreset, ResolvedTreeTheme } from '../../config/types.ts';
import { BLOCK_SIZE } from '../../designs/tree/constants.ts';
import { createCityQRTargets } from '../../designs/city/qr-colors.ts';

interface LogoAnchor {
  x: number; y: number; z: number; width: number; height: number;
  angle?: number; alignTop?: boolean; visible?: boolean; faceCamera?: boolean;
}
export interface LoadedCityScene {
  readonly root: Group;
  readonly assetStatus: string;
  updateContent(modules: boolean[][], theme: ResolvedTreeTheme): void;
  setLogoPresent(present: boolean, lightBacking?: boolean): void;
  getLogoAnchor(): LogoAnchor;
  prepareMorphRendering(renderer: WebGLRenderer, camera: Camera, scene: Scene): void;
  update(progress: number, deltaSeconds: number, reducedMotion: boolean, allowAssetAttachment: boolean): void;
  dispose(): void;
}
export type CitySceneConstructor = new (modules: boolean[][], theme: ResolvedTreeTheme) => LoadedCityScene;

const loaders = {
  shibuya: () => import('./ShibuyaScene.ts').then(module => module.ShibuyaScene),
  dotonbori: () => import('./DotonboriScene.ts').then(module => module.DotonboriScene),
  'tokyo-tower': () => import('./TokyoTowerScene.ts').then(module => module.TokyoTowerScene),
} satisfies Record<DesignQRCityPreset, () => Promise<CitySceneConstructor>>;

const constructors = new Map<DesignQRCityPreset, CitySceneConstructor>();

/** Loads code without allocating a scene until a running, settled frame can use it. */
export class LazyCityScene implements LoadedCityScene {
  readonly root = new Group();
  readonly preset: DesignQRCityPreset;
  private modules: boolean[][];
  private theme: ResolvedTreeTheme;
  private pending?: CitySceneConstructor;
  private scene?: LoadedCityScene;
  private fallback?: InstancedMesh<PlaneGeometry, MeshBasicMaterial>;
  private failed = false;
  private disposed = false;
  private hasLogo = false;
  private lightBacking = false;

  constructor(preset: DesignQRCityPreset, modules: boolean[][], theme: ResolvedTreeTheme,
    loader?: () => Promise<CitySceneConstructor>) {
    this.preset = preset; this.modules = modules; this.theme = theme;
    this.root.name = `designqr-${preset}-loader`;
    this.updateContent(modules, theme);
    const cached = loader ? undefined : constructors.get(preset);
    if (cached) { this.attach(cached); return; }
    void (loader ?? loaders[preset])().then(SceneClass => {
      if (!loader) constructors.set(preset, SceneClass);
      if (!this.disposed) this.pending = SceneClass;
    }).catch(() => { if (!this.disposed) this.failed = true; });
  }

  get assetStatus() { return this.scene?.assetStatus ?? (this.failed ? 'error' : 'loading'); }

  updateContent(modules: boolean[][], theme: ResolvedTreeTheme) {
    if (this.disposed) return;
    this.modules = modules; this.theme = theme;
    if (this.scene) { this.scene.updateContent(modules, theme); return; }
    this.disposeFallback();
    const grid = modules.length;
    const mesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ toneMapped: false }), grid * grid);
    mesh.name = 'city-loading-qr'; mesh.frustumCulled = false;
    mesh.scale.setScalar(grid * BLOCK_SIZE);
    const matrix = new Matrix4(), scale = new Vector3(1 / grid, 1 / grid, 1);
    createCityQRTargets(modules, theme).forEach((target, i) => {
      matrix.makeRotationX(-Math.PI / 2).scale(scale).setPosition(target.x, .001, target.z);
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, target.ink);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.fallback = mesh; this.root.add(mesh);
  }

  setLogoPresent(present: boolean, lightBacking = false) {
    this.hasLogo = present; this.lightBacking = lightBacking;
    this.scene?.setLogoPresent(present, lightBacking);
  }
  getLogoAnchor(): LogoAnchor {
    return this.scene?.getLogoAnchor() ?? { x: 0, y: 0, z: 0, width: 0, height: 0, visible: false };
  }
  prepareMorphRendering(renderer: WebGLRenderer, camera: Camera, scene: Scene) {
    this.scene?.prepareMorphRendering(renderer, camera, scene);
  }
  update(progress: number, deltaSeconds: number, reducedMotion: boolean, allowAssetAttachment = true) {
    if (this.disposed) return;
    if (this.pending && allowAssetAttachment && (progress === 0 || progress === 1)) {
      const SceneClass = this.pending; this.pending = undefined;
      this.attach(SceneClass);
    }
    this.scene?.update(progress, deltaSeconds, reducedMotion, allowAssetAttachment);
  }
  private attach(SceneClass: CitySceneConstructor) {
    try {
      this.scene = new SceneClass(this.modules, this.theme);
      this.scene.setLogoPresent(this.hasLogo, this.lightBacking);
      this.disposeFallback(); this.root.add(this.scene.root);
    } catch {
      this.scene?.dispose(); this.scene = undefined; this.failed = true;
    }
  }
  private disposeFallback() {
    if (!this.fallback) return;
    this.fallback.removeFromParent(); this.fallback.geometry.dispose();
    this.fallback.material.dispose(); this.fallback.dispose(); this.fallback = undefined;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.pending = undefined;
    this.disposeFallback(); this.scene?.dispose(); this.scene = undefined;
    // Shibuya leaves renderer-owned meshes attached for its deduplicated GPU
    // cleanup. Other scenes remove their own roots after disposing resources.
  }
}
