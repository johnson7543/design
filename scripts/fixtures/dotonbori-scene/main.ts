import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Box3, BufferGeometry, DataTexture, FloatType, Matrix4, Mesh, OrthographicCamera, Raycaster, RGBAFormat, Scene, Vector3, WebGLRenderTarget, type Group, type InstancedMesh, type MeshBasicMaterial, type PerspectiveCamera, type WebGLRenderer } from 'three';
import { DesignQR } from '../../../packages/designqr/src/react/DesignQR';
import type { DesignQRHandle } from '../../../packages/designqr/src/react/types';
import { ThreeFallbackRenderer } from '../../../packages/designqr/src/renderer/webgl/ThreeFallbackRenderer';
import { PresentationSurface, type PresentationSurfaceState } from '../../../packages/designqr/src/renderer/PresentationSurface';
import type { DotonboriScene } from '../../../packages/designqr/src/renderer/webgl/DotonboriScene';
import { dotonboriBuildingRanges } from '../../../packages/designqr/src/designs/city/dotonbori-ownership';
import type { DotonboriSurfaceGeometry } from '../../../packages/designqr/src/designs/city/dotonbori-surface-geometry';
import { OSAKA_NIGHT_SWATCHES as S } from '../../../packages/designqr/src/designs/city/palette';
import { DOTONBORI_GLICO_SIGN_ID } from '../../../packages/designqr/src/designs/city/dotonbori-glico-animation';
import { DOTONBORI_WAKE_GROUP } from '../../../packages/designqr/src/designs/city/dotonbori-wake';
import { DOTONBORI_NOREN, DOTONBORI_PENNANT, dotonboriBreeze } from '../../../packages/designqr/src/designs/city/dotonbori-cloth';
import type { createDotonboriFacades } from '../../../packages/designqr/src/designs/city/dotonbori-facades';
import type { DotonboriActivity } from '../../../packages/designqr/src/designs/city/dotonbori-activity';
import { DOTONBORI_SHOP_ACTIONS } from '../../../packages/designqr/src/designs/city/dotonbori-shop-activity';
import { DOTONBORI_KANI_SIGN } from '../../../packages/designqr/src/designs/city/dotonbori-kani-sign';
import { DOTONBORI_VISITOR_REACTIONS, DOTONBORI_BOAT_REACTION } from '../../../packages/designqr/src/designs/city/dotonbori-reactions';
import { frontPoint, libraryDotonboriFronts } from '../../../packages/designqr/src/designs/city/dotonbori-facade-layout';
import type { DotonboriLibrary } from '../../../packages/designqr/src/designs/city/dotonbori-assets';
import { dotonboriPoint } from '../../../packages/designqr/src/designs/city/dotonbori-detail-layout';
import '../../../packages/designqr/src/style.css';
import '../city-assets-consumer/style.css';

// Observe the real public React player; production needs no debug API.
const observed = new Set<ThreeFallbackRenderer>();
const presentations = new Set<PresentationSurface>();
const originalProgress = PresentationSurface.prototype.setViewProgress;
PresentationSurface.prototype.setViewProgress = function(progress) { presentations.add(this); originalProgress.call(this, progress); };
const renderer = () => observed.values().next().value!;
const original = ThreeFallbackRenderer.prototype.setTreeData;
ThreeFallbackRenderer.prototype.setTreeData = function(data) { observed.add(this); original.call(this, data); };
const handle = React.createRef<DesignQRHandle>(), host = document.createElement('main'); document.body.append(host);
const root = createRoot(host);
flushSync(() => root.render(React.createElement(DesignQR, { ref: handle, value: 'https://example.com/dotonbori', design: 'city',
  theme: 'dotonbori', details: { border: {} }, interaction: { motionBlur: false } })));
const probe = () => {
  const raw = renderer() as unknown as { cityScene: DotonboriScene; renderer: WebGLRenderer; currentProgress: number; logoGroup?: Group; camera: PerspectiveCamera; scene: Scene };
  return { ...raw, cityScene: (raw.cityScene as unknown as { scene?: typeof raw.cityScene })?.scene ?? raw.cityScene };
};
const snapshot = () => {
  const p = probe(), city = p.cityScene;
  const buildings: { id: string; visible: boolean; geometry: string }[] = [], errors: string[] = [];
  let ownedTriangles = 0;
  city.root.getObjectByName('dotonbori-source-study')!.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const owner = o.userData.sourceBuilding;
    if (o.name.startsWith('bldg_')) buildings.push({ id: o.name, visible: o.visible, geometry: o.geometry.uuid });
    if (owner && !o.visible) errors.push(o.name);
    const ranges = dotonboriBuildingRanges(o.geometry);
    if (owner || !ranges.some(r => r.building)) return;
    const count = o.geometry.index?.count ?? o.geometry.getAttribute('position').count; let cursor = 0;
    if (!o.visible) errors.push(o.name);
    for (const range of ranges) {
      if (range.building) ownedTriangles += range.count / 3;
      if (range.start !== cursor || range.start + range.count > count) errors.push(o.name + ': building range');
      cursor += range.count;
    }
    if (cursor !== count || o.geometry.drawRange.start !== 0 || count > o.geometry.drawRange.count) errors.push(o.name + ': draw range');
  });
  return { status: city.assetStatus, buildings, errors, ownedTriangles,
    gpu: { ...p.renderer.info.memory }, draws: p.renderer.info.render.calls, progress: p.currentProgress };
};
const transitionFrames: { progress: number; visibleBuildings: number; elapsedMs: number }[] = [];
let turnStartedAt = 0;
const glicoSnapshot = () => {
  const city = probe().cityScene, sign = city.root.getObjectByName(DOTONBORI_GLICO_SIGN_ID) as Mesh;
  const material = sign.material as MeshBasicMaterial, map = material.map!;
  const river = city.root.getObjectByName('dotonbori-water-reflections') as Mesh;
  const morph = city.root.getObjectByName('dotonbori-complete-surfaces');
  const batch = morph?.children.find(o => o.userData.sourceMeshes?.includes(DOTONBORI_GLICO_SIGN_ID)) as Mesh | undefined;
  const borrowed = batch?.material as MeshBasicMaterial | undefined;
  return { blend: material.userData.dotonboriGlicoBlend.value,
    reflectedBlend: (river.material as MeshBasicMaterial).userData.dotonboriGlicoBlend.value,
    visible: sign.visible, texture: map.uuid, textureVersion: map.version, geometry: sign.geometry.uuid,
    morphTexture: borrowed?.map?.uuid, morphUniformMatches: borrowed?.userData.dotonboriGlicoBlend === material.userData.dotonboriGlicoBlend,
    morphVisible: morph?.visible, morphOpacity: borrowed?.opacity };
};
const campaignSnapshot = () => {
  const city = probe().cityScene, source = city.root.getObjectByName('dotonbori-qr-generated-signs') as Mesh;
  const material = source.material as MeshBasicMaterial, uniform = material.userData.dotonboriCampaignFrames;
  const batch = city.root.getObjectByName('dotonbori-complete-surfaces')!.children.find(o => o.userData.sourceMeshes.includes(source.name)) as Mesh;
  const borrowed = batch.material as MeshBasicMaterial;
  return { frames: uniform.value.map((v: Vector3) => v.toArray()), texture: material.map!.uuid, textureVersion: material.map!.version,
    geometry: source.geometry.uuid, morphTexture: borrowed.map!.uuid, morphUniformMatches: borrowed.userData.dotonboriCampaignFrames === uniform };
};
const waterSnapshot = () => {
  const city = probe().cityScene, river = city.root.getObjectByName('dotonbori-water-reflections') as Mesh;
  const wake = city.root.getObjectByName(DOTONBORI_WAKE_GROUP) as Mesh;
  const hash = (values: ArrayLike<number>) => {
    let value = 2166136261;
    for (let i = 0; i < values.length; i++) value = Math.imul(value ^ Math.round(values[i] * 1e8), 16777619);
    return value >>> 0;
  };
  return { time: (river.material as MeshBasicMaterial).userData.dotonboriClock.value,
    river: { geometry: river.geometry.uuid, position: hash(river.geometry.getAttribute('position').array), version: river.geometry.getAttribute('position').version },
    wake: { geometry: wake.geometry.uuid, position: hash(wake.geometry.getAttribute('position').array), color: hash(wake.geometry.getAttribute('color').array),
      version: wake.geometry.getAttribute('position').version },
    boat: hash((city.root.getObjectByName('dotonbori-doton-tour-boat') as Mesh).matrix.elements) };
};
const clothSnapshot = () => {
  const city = probe().cityScene;
  return [DOTONBORI_NOREN, DOTONBORI_PENNANT].map(name => {
    const mesh = city.root.getObjectByName(name) as Mesh, position = mesh.geometry.getAttribute('position');
    let hash = 2166136261;
    for (const value of position.array) hash = Math.imul(hash ^ Math.round(value * 1e9), 16777619);
    return { name, geometry: mesh.geometry.uuid, position: hash >>> 0, version: position.version, material: (mesh.material as MeshBasicMaterial).uuid };
  });
};
const actionSnapshot = () => [DOTONBORI_SHOP_ACTIONS, DOTONBORI_VISITOR_REACTIONS, DOTONBORI_BOAT_REACTION, DOTONBORI_KANI_SIGN].map(name => {
  const mesh = probe().cityScene.root.getObjectByName(name) as Mesh, position = mesh.geometry.getAttribute('position');
  let hash = 2166136261;
  for (const value of position.array) hash = Math.imul(hash ^ Math.round(value * 1e9), 16777619);
  return { name, geometry: mesh.geometry.uuid, position: hash >>> 0, version: position.version, material: (mesh.material as MeshBasicMaterial).uuid };
});
const crowdSnapshot = () => {
  const city = probe().cityScene, people = city.root.getObjectByName('dotonbori-pedestrians') as InstancedMesh;
  const size = (city as unknown as { layout: { tileSizeM: number } }).layout.tileSizeM, matrix = new Matrix4();
  const positions = Array.from({ length: 64 }, (_, i) => { people.getMatrixAt(i * 8, matrix); return new Vector3().setFromMatrixPosition(matrix); });
  let minimum = Infinity, northMinimum = Infinity, northPair = [30, 31];
  for (let i = 0; i < 44; i++) for (let j = i + 1; j < 64; j++) {
    const a = positions[i], b = positions[j]; if (Math.abs(a.y - b.y) * size > 1.65) continue;
    const distance = Math.hypot(a.x - b.x, a.z - b.z) * size; minimum = Math.min(minimum, distance);
    if (i >= 30 && j < 44 && distance < northMinimum) { northMinimum = distance; northPair = [i, j]; }
  }
  let hash = 2166136261; for (const value of people.instanceMatrix.array) hash = Math.imul(hash ^ Math.round(value * 1e9), 16777619);
  return { geometry: people.geometry.uuid, material: (people.material as MeshBasicMaterial).uuid,
    pose: hash >>> 0, version: people.instanceMatrix.version, minimum, northPair };
};
const fixture = {
  ready: () => observed.size > 0 && probe().cityScene?.assetStatus === 'ready',
  pause() { handle.current!.pause(); },
  snapshot,
  glowDifference(transparent = false) {
    const surface = [...presentations].at(-1)!;
    const internals = surface as unknown as { state: PresentationSurfaceState; backgroundTransitionStartedAt: number; viewProgress: number };
    const saved = { ...internals.state }, transition = internals.backgroundTransitionStartedAt;
    const canvas = document.querySelector<HTMLCanvasElement>('.designqr-presentation-canvas')!, context = canvas.getContext('2d')!;
    try {
      internals.backgroundTransitionStartedAt = 0; internals.state.transparentBackground = transparent;
      internals.state.nightGlow = undefined; surface.draw();
      const off = context.getImageData(0, 0, canvas.width, canvas.height).data;
      internals.state.nightGlow = 'waterfront'; surface.draw();
      const on = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let i = 0; i < off.length; i += 4) if ([0, 1, 2, 3].some(c => Math.abs(off[i + c] - on[i + c]) > 2)) changed++;
      return { progress: internals.viewProgress, changed };
    } finally { internals.state = saved; internals.backgroundTransitionStartedAt = transition; surface.draw(); }
  },
  sourceImage() { return probe().renderer.domElement.toDataURL(); },
  surfaceEndpoint(progress = .90) {
    const { cityScene, renderer: gl, scene, currentProgress } = probe();
    cityScene.update(progress, 0, true, false); cityScene.root.updateWorldMatrix(true, true);
    const units = cityScene.root.matrixWorld.getMaxScaleOnAxis(), aspect = gl.domElement.width / gl.domElement.height;
    const camera = new OrthographicCamera(-.6 * units * aspect, .6 * units * aspect, .6 * units, -.6 * units, .001, units * 10);
    camera.position.copy(new Vector3(0, 2, 0).applyMatrix4(cityScene.root.matrixWorld));
    camera.up.copy(new Vector3(0, 0, -1).transformDirection(cityScene.root.matrixWorld));
    camera.lookAt(new Vector3().applyMatrix4(cityScene.root.matrixWorld)); camera.updateMatrixWorld(true);
    gl.render(scene, camera); const image = gl.domElement.toDataURL();
    cityScene.update(currentProgress, 0, true, false); renderer().renderOnce();
    return image;
  },
  surfaceTiming() {
    const { cityScene, renderer: gl, currentProgress } = probe();
    const morph = cityScene.root.getObjectByName('dotonbori-complete-surfaces')!;
    const target = new WebGLRenderTarget(512, 512), previousTarget = gl.getRenderTarget();
    const camera = new OrthographicCamera(-.8, .8, .8, -.8, .01, 10);
    camera.position.set(1, 2, 1); camera.lookAt(0, .1, 0); camera.updateMatrixWorld(true);
    const changed = (a: Uint8Array, b: Uint8Array) => {
      let count = 0;
      for (let i = 0; i < a.length; i += 4) if ([0, 1, 2, 3].some(c => a[i + c] !== b[i + c])) count++;
      return count;
    };
    const results = [];
    try {
      for (const [mode, name] of ['ground', 'architecture', 'glico', 'donki'].entries()) {
        const audit = new Scene(), ordinary = new Scene(), geometries: BufferGeometry[] = [];
        const textures: DataTexture[] = [], materials: MeshBasicMaterial[] = [];
        let triangles = 0;
        for (const source of morph.children as Mesh<BufferGeometry, MeshBasicMaterial>[]) {
          const original = source.geometry as DotonboriSurfaceGeometry, patches: number[] = [];
          for (let i = 0; i < original.patchCount; i++) if (original.target.getY(i) === mode) patches.push(i);
          if (!patches.length) continue;
          const geometry = new BufferGeometry();
          for (const [name, attribute] of Object.entries(original.attributes)) geometry.setAttribute(name, attribute);
          geometry.setIndex(patches.flatMap(patch => [0, 1, 2, 0, 2, 3].map(corner => patch * 4 + corner)));
          triangles += patches.length * 2; geometries.push(geometry);
          const mesh = new Mesh(geometry, source.material); mesh.frustumCulled = false; audit.add(mesh);
          if (mode === 3) {
            // Render the same wheel vertices/destinations through architecture's
            // production path to detect drift anywhere in the turn, not just its endpoint.
            const data = original.data.array.slice(), image = original.motionTexture.image;
            for (const patch of patches) data[patch * original.data.stride + original.target.offset + 1] = 1;
            const texture = new DataTexture(data, image.width, image.height, RGBAFormat, FloatType); texture.needsUpdate = true;
            textures.push(texture);
            const material = source.material.clone(); materials.push(material);
            material.customProgramCacheKey = source.material.customProgramCacheKey;
            material.onBeforeCompile = (shader, renderer) => {
              source.material.onBeforeCompile(shader, renderer);
              shader.uniforms.surfaceMotion.value = texture;
            };
            const counterpart = new Mesh(geometry, material); counterpart.frustumCulled = false; ordinary.add(counterpart);
          }
        }
        try {
          const frames = new Map<number, Uint8Array>(); let reverseIdentical = true;
          const ordinaryMotion: { progress: number; changedPixels: number }[] = [];
          for (const progress of [0, .05, .30, .40, .60, .74, .78, .88, .90, .94, .90, .88, .78, .74, .60, .40, .30, .05, 0]) {
            cityScene.update(progress, 0, true, false); gl.setRenderTarget(target); gl.render(audit, camera);
            const pixels = new Uint8Array(512 * 512 * 4); gl.readRenderTargetPixels(target, 0, 0, 512, 512, pixels);
            if (frames.has(progress)) reverseIdentical &&= changed(pixels, frames.get(progress)!) === 0;
            else {
              frames.set(progress, pixels);
              if (mode === 3) {
                gl.render(ordinary, camera);
                const reference = new Uint8Array(pixels.length); gl.readRenderTargetPixels(target, 0, 0, 512, 512, reference);
                ordinaryMotion.push({ progress, changedPixels: changed(pixels, reference) });
              }
            }
          }
          results.push({ name, triangles, startChanged: changed(frames.get(0)!, frames.get(.05)!),
            settleChanged: changed(frames.get(.88)!, frames.get(.90)!),
            afterSettleChanged: changed(frames.get(.90)!, frames.get(.94)!), reverseIdentical, ordinaryMotion });
        } finally {
          geometries.forEach(geometry => geometry.dispose()); textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose());
        }
      }
    } finally {
      gl.setRenderTarget(previousTarget); target.dispose();
      cityScene.update(currentProgress, 0, true, false); renderer().renderOnce();
    }
    return results;
  },
  paintedPixels() {
    const source = probe().renderer.domElement, canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let count = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) count++;
    return count;
  },
  surfaceSnapshot() {
    const morph = probe().cityScene.root.getObjectByName('dotonbori-complete-surfaces')!;
    const { cells, meshes, buildings, ...stats } = morph.userData.inventory;
    return { ...stats, cellCount: cells.length, coverageError: Math.max(...cells.map((area: number) => Math.abs(area - 1))),
      buildingCount: buildings.filter((name: string) => name.startsWith('bldg_')).length,
      meshes, versions: morph.children.map(o => {
        const g = (o as Mesh<DotonboriSurfaceGeometry>).geometry;
        return { vertex: g.vertexData.version, motion: g.motionTexture.version };
      }) };
  },
  glicoSnapshot,
  campaignSnapshot,
  waterSnapshot,
  clothSnapshot,
  actionSnapshot,
  crowdSnapshot,
  ebisuFrame(time: number, angle = .24) {
    const { cityScene, renderer: gl, scene } = probe();
    const internals = cityScene as unknown as { animationTime: number; library: DotonboriLibrary };
    internals.animationTime = time; cityScene.update(0, 0, false); renderer().renderOnce();
    const wheel = cityScene.root.getObjectByName('dotonbori-ebisu-tower')!, cabins = wheel.getObjectByName('dotonbori-ebisu-cabins') as InstancedMesh;
    const front = libraryDotonboriFronts(internals.library).find(f => f.id === 'B092')!;
    const units = wheel.matrixWorld.getMaxScaleOnAxis() / internals.library.layout.tileSizeM;
    const halfHeight = 44 * units, aspect = gl.domElement.width / gl.domElement.height;
    const target = frontPoint(front, 0, 40, 0).applyMatrix4(wheel.matrixWorld);
    const normal = new Vector3(Math.sin(front.yaw + angle), 0, Math.cos(front.yaw + angle)).transformDirection(wheel.matrixWorld);
    const camera = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .001, halfHeight * 100);
    camera.position.copy(target).addScaledVector(normal, halfHeight * 4); camera.position.y += halfHeight * .45;
    camera.lookAt(target); camera.updateMatrixWorld(true);
    gl.render(scene, camera); const image = gl.domElement.toDataURL(); renderer().renderOnce();
    return { image, time, angle, count: cabins.count, geometry: cabins.geometry.uuid, material: (cabins.material as MeshBasicMaterial).uuid,
      matrices: Array.from(cabins.instanceMatrix.array), inventory: snapshot().buildings.length };
  },
  riverbankFrame(bank: 'north' | 'south', east: number) {
    const { cityScene, renderer: gl, scene } = probe();
    const library = (cityScene as unknown as { library: DotonboriLibrary }).library;
    const source = cityScene.root.getObjectByName('dotonbori-source-study')!;
    cityScene.root.updateMatrixWorld(true);
    const units = source.matrixWorld.getMaxScaleOnAxis() / library.layout.tileSizeM;
    const halfHeight = 23 * units, aspect = gl.domElement.width / gl.domElement.height;
    const camera = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .001, 150 * units);
    camera.position.copy(dotonboriPoint(east, 2, 21, library.layout).applyMatrix4(source.matrixWorld));
    camera.lookAt(dotonboriPoint(east, bank === 'north' ? 25 : -25, 21, library.layout).applyMatrix4(source.matrixWorld));
    camera.updateMatrixWorld(true);
    gl.render(scene, camera); const image = gl.domElement.toDataURL(); renderer().renderOnce();
    return { bank, east, image, inventory: snapshot().buildings.length };
  },
  bridgeFrame() {
    const { cityScene, renderer: gl, scene } = probe();
    const library = (cityScene as unknown as { library: DotonboriLibrary }).library;
    const source = cityScene.root.getObjectByName('dotonbori-source-study')!;
    const units = source.matrixWorld.getMaxScaleOnAxis() / library.layout.tileSizeM;
    const halfHeight = 6.8 * units, aspect = gl.domElement.width / gl.domElement.height;
    const camera = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .001, 150 * units);
    camera.position.copy(dotonboriPoint(31, -1, 2, library.layout).applyMatrix4(source.matrixWorld));
    camera.lookAt(dotonboriPoint(0, 0, 4.2, library.layout).applyMatrix4(source.matrixWorld)); camera.updateMatrixWorld(true);
    gl.render(scene, camera); const image = gl.domElement.toDataURL(); renderer().renderOnce(); return image;
  },
  facadeFrame(id: string, angle: number, detail?: 'crab' | 'store', time?: number) {
    const { cityScene, renderer: gl, scene } = probe();
    if (time !== undefined) {
      (cityScene as unknown as { animationTime: number }).animationTime = time;
      cityScene.update(0, 0, false); renderer().renderOnce();
    }
    const library = (cityScene as unknown as { library: DotonboriLibrary }).library;
    const front = libraryDotonboriFronts(library).find(f => f.id === id)!, size = library.layout.tileSizeM;
    const source = cityScene.root.getObjectByName(front.building) as Mesh;
    const isolated = new Scene(), copies: Mesh[] = [], geometries = [];
    cityScene.root.updateMatrixWorld(true);
    cityScene.root.getObjectByName('dotonbori-source-study')!.traverse(o => {
      if (!(o instanceof Mesh)) return;
      if (o.userData.sourceBuilding === front.building) {
        const copy = new Mesh(o.geometry, o.material); copy.matrixAutoUpdate = false; copy.matrix.copy(o.matrixWorld); isolated.add(copy); copies.push(copy);
      } else {
        const ranges = dotonboriBuildingRanges(o.geometry).filter(r => r.building === front.building);
        if (!ranges.length) return;
        const geometry = o.geometry.clone(), index = o.geometry.index;
        geometry.setIndex(ranges.flatMap(r => Array.from({ length: r.count }, (_, i) => index ? index.getX(r.start + i) : r.start + i)));
        const copy = new Mesh(geometry, o.material); copy.matrixAutoUpdate = false; copy.matrix.copy(o.matrixWorld); isolated.add(copy); copies.push(copy); geometries.push(geometry);
      }
    });
    const units = source.matrixWorld.getMaxScaleOnAxis() / size;
    const halfHeight = (detail === 'crab' ? 4.3 : detail === 'store' ? 2.2 : id === 'B046-south' ? 8 + Math.abs(Math.sin(angle)) * 4 : id.startsWith('B034') ? 25 : (front.top - front.bottom) * .6) * units;
    const targetHeight = detail ? front.bottom + (detail === 'crab' ? 5.3 : 1.5)
      : id === 'B046-south' ? front.bottom + 6.4 : id.startsWith('B034') ? 26 : (front.top + front.bottom) / 2;
    const target = frontPoint(front, 0, targetHeight, 0).applyMatrix4(source.matrixWorld);
    const normal = new Vector3(Math.sin(front.yaw + angle), 0, Math.cos(front.yaw + angle)).transformDirection(source.matrixWorld);
    const aspect = gl.domElement.width / gl.domElement.height;
    const camera = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .001, halfHeight * 100);
    camera.position.copy(target).addScaledVector(normal, halfHeight * 7); camera.position.y += halfHeight * .8;
    camera.lookAt(target); camera.updateMatrixWorld(true);
    gl.render(isolated, camera); const image = gl.domElement.toDataURL();
    gl.render(scene, camera); const contextImage = gl.domElement.toDataURL();
    for (const geometry of geometries) geometry.dispose(); isolated.clear(); renderer().renderOnce();
    return { id, angle, image, contextImage, meshes: copies.length, inventory: snapshot().buildings.length,
      ...(detail === 'crab' ? { state: actionSnapshot().find(s => s.name === DOTONBORI_KANI_SIGN) } : {}) };
  },
  crowdFrame(time: number, area: 'bridge' | 'bank') {
    const { cityScene, renderer: gl, scene } = probe();
    const internals = cityScene as unknown as { animationTime: number; layout: { tileSizeM: number; rotationYRadians: number } };
    internals.animationTime = time; cityScene.update(0, 0, false); renderer().renderOnce();
    const state = crowdSnapshot(), people = cityScene.root.getObjectByName('dotonbori-pedestrians') as InstancedMesh;
    const size = internals.layout.tileSizeM, units = people.matrixWorld.getMaxScaleOnAxis() / size;
    const target = new Vector3(0, 5.7 / size, 0), matrix = new Matrix4();
    if (area === 'bank') {
      target.set(0, 0, 0);
      for (const index of state.northPair) { people.getMatrixAt(index * 8, matrix); target.add(new Vector3().setFromMatrixPosition(matrix).multiplyScalar(.5)); }
    }
    target.applyMatrix4(people.matrixWorld);
    const halfHeight = (area === 'bridge' ? 12 : 4) * units, aspect = gl.domElement.width / gl.domElement.height;
    const camera = new OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, halfHeight * .01, halfHeight * 80);
    const yaw = internals.layout.rotationYRadians, normal = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).transformDirection(people.matrixWorld);
    const along = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).transformDirection(people.matrixWorld);
    // Keep the close-up camera over the canal. A distant camera on the opposite
    // bank can look through an unrelated source building before seeing walkers.
    camera.position.copy(target).addScaledVector(normal, halfHeight * (area === 'bridge' ? 1 : 2)).addScaledVector(along, halfHeight * .25);
    camera.position.y += halfHeight * (area === 'bridge' ? 2.5 : 1.5); camera.lookAt(target); camera.updateMatrixWorld(true);
    gl.render(scene, camera); const image = gl.domElement.toDataURL(); renderer().renderOnce();
    return { time, area, ...state, image };
  },
  actionFrame(kind: 'prep' | 'service' | 'tank' | 'phone' | 'wave' | 'passenger', time: number) {
    const { cityScene, renderer: gl, scene } = probe();
    const internals = cityScene as unknown as { animationTime: number; facades: ReturnType<typeof createDotonboriFacades>;
      activity: DotonboriActivity; layout: { tileSizeM: number } };
    // Deterministic fixture-only clock scrubbing, evaluated by the real scene.
    internals.animationTime = time; cityScene.update(0, 0, false); renderer().renderOnce();
    const shop = ['prep', 'service', 'tank'].includes(kind), boat = kind === 'passenger';
    const source = shop ? internals.facades.actions.mesh : boat ? internals.activity.reactions.boatMesh : internals.activity.reactions.mesh;
    const geometry = source.geometry.clone();
    const isolated = new Scene(), detail = new Mesh(geometry, source.material);
    detail.matrixAutoUpdate = false; detail.matrix.copy(source.matrixWorld); isolated.add(detail);
    const size = internals.layout.tileSizeM, units = source.matrixWorld.getMaxScaleOnAxis() / size;
    let target: Vector3, yaw: number, halfHeight: number, bodies: InstancedMesh | undefined;
    if (shop) {
      const anchor = internals.facades.actions.anchors.find(a => a.kind === kind)!;
      const x = anchor.x + anchor.width * (kind === 'prep' ? -.19 : kind === 'service' ? .20 : 0);
      target = frontPoint(anchor.front, x, anchor.front.bottom + (kind === 'tank' ? 1.15 : 1.2), kind === 'service' ? .90 : .55);
      yaw = anchor.front.yaw; halfHeight = (kind === 'tank' ? 1.05 : 1.5) * units;
    } else if (boat) {
      target = new Vector3(-1.96, 1.3, 1.25).divideScalar(size); yaw = 0; halfHeight = 1.25 * units;
    } else {
      const index = kind === 'phone' ? 48 : 50, matrix = new Matrix4();
      internals.activity.people.getMatrixAt(index * 8, matrix);
      target = new Vector3().setFromMatrixPosition(matrix); yaw = Math.atan2(matrix.elements[8], matrix.elements[10]); halfHeight = 1.35 * units;
      // Only this stationary visitor may contribute pixels to the isolated
      // motion check; passing walkers must not make a broken gesture pass.
      bodies = internals.activity.people.clone(); bodies.count = 8;
      for (let slot = 0; slot < 8; slot++) {
        internals.activity.people.getMatrixAt(index * 8 + slot, matrix); bodies.setMatrixAt(slot, matrix);
      }
      bodies.instanceColor!.copyArray(internals.activity.people.instanceColor!.array.slice(index * 24, index * 24 + 24));
      bodies.matrixAutoUpdate = false; bodies.matrix.copy(internals.activity.people.matrixWorld); isolated.add(bodies);
    }
    target.applyMatrix4(source.matrixWorld);
    const camera = new OrthographicCamera(-halfHeight * 1.6, halfHeight * 1.6, halfHeight, -halfHeight, halfHeight * .01, halfHeight * 80);
    const normal = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).transformDirection(source.matrixWorld);
    const along = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).transformDirection(source.matrixWorld);
    camera.position.copy(target).addScaledVector(normal, halfHeight * 8).addScaledVector(along, halfHeight * (kind === 'service' ? 5 : shop ? 1.4 : 3));
    camera.position.y += halfHeight * (kind === 'tank' ? .7 : kind === 'service' ? 3 : 1.3); camera.lookAt(target); camera.updateMatrixWorld(true);
    gl.render(isolated, camera); const image = gl.domElement.toDataURL();
    const canvas = document.createElement('canvas'); canvas.width = gl.domElement.width; canvas.height = gl.domElement.height;
    const context = canvas.getContext('2d')!; context.drawImage(gl.domElement, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) visiblePixels++;
    gl.render(scene, camera); const contextImage = gl.domElement.toDataURL();
    geometry.dispose(); bodies?.dispose(); isolated.clear(); renderer().renderOnce();
    return { kind, time, image, contextImage, visiblePixels, state: actionSnapshot() };
  },
  clothFrame(kind: 'noren' | 'pennant', phase?: number, side = 1) {
    const { cityScene, renderer: gl, scene } = probe();
    const internals = cityScene as unknown as { animationTime: number; facades: ReturnType<typeof createDotonboriFacades>; activity: DotonboriActivity };
    if (phase !== undefined) cityScene.update(0, (phase - internals.animationTime % 18 + 18) % 18, false);
    renderer().renderOnce();
    const batch = kind === 'noren' ? internals.facades.cloth : internals.activity.pennant;
    const panel = batch.panels[0], source = batch.mesh, geometry = source.geometry.clone();
    const ranges = dotonboriBuildingRanges(source.geometry), index = geometry.index;
    const end = kind === 'noren' ? ranges[3].start + ranges[3].count : index?.count ?? geometry.getAttribute('position').count;
    geometry.setDrawRange(0, end);
    // Isolate real fabric vertices with the player's actual material. This
    // close-up checks both faces without an opaque building hiding the reverse.
    const isolated = new Scene(), sheet = new Mesh(geometry, source.material);
    sheet.matrixAutoUpdate = false; sheet.matrix.copy(source.matrixWorld); isolated.add(sheet); isolated.updateMatrixWorld(true);
    const bounds = new Box3();
    for (let i = 0; i < end; i++) bounds.expandByPoint(new Vector3().fromBufferAttribute(geometry.getAttribute('position'), index ? index.getX(i) : i).applyMatrix4(sheet.matrixWorld));
    const target = bounds.getCenter(new Vector3()), extent = bounds.getSize(new Vector3());
    const halfHeight = Math.max(extent.y, Math.hypot(extent.x, extent.z) / 1.6) * .85;
    const camera = new OrthographicCamera(-halfHeight * 1.6, halfHeight * 1.6, halfHeight, -halfHeight, .001, 10000);
    const normal = new Vector3(Math.sin(panel.yaw), 0, Math.cos(panel.yaw)).transformDirection(source.matrixWorld);
    const along = new Vector3(Math.cos(panel.yaw), 0, -Math.sin(panel.yaw)).transformDirection(source.matrixWorld);
    camera.position.copy(target).addScaledVector(normal, side * halfHeight * 8).addScaledVector(along, halfHeight * 1.5);
    camera.position.y += halfHeight * 1.1; camera.lookAt(target); camera.updateMatrixWorld(true);
    gl.render(isolated, camera); const image = gl.domElement.toDataURL();
    const canvas = document.createElement('canvas'); canvas.width = gl.domElement.width; canvas.height = gl.domElement.height;
    const context = canvas.getContext('2d')!; context.drawImage(gl.domElement, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) visiblePixels++;
    camera.zoom = kind === 'noren' ? .55 : .16; camera.updateProjectionMatrix();
    gl.render(scene, camera); const contextImage = gl.domElement.toDataURL();
    geometry.dispose(); isolated.clear(); renderer().renderOnce();
    return { image, contextImage, visiblePixels, state: clothSnapshot(), breeze: dotonboriBreeze(internals.animationTime) };
  },
  waterVisibility() {
    const { cityScene, renderer: gl } = probe(), objects = cityScene.root.getObjectByName('dotonbori-source-study')!.children;
    const river = cityScene.root.getObjectByName('dotonbori-water-reflections') as Mesh;
    const wake = cityScene.root.getObjectByName(DOTONBORI_WAKE_GROUP) as Mesh;
    const water = cityScene.root.getObjectByName('dotonbori-water-plan') as Mesh;
    const visibility = objects.map(object => object.visible), order: string[] = [];
    const callbacks = [water, river, wake].map(mesh => mesh.onBeforeRender);
    [water, river, wake].forEach((mesh, i) => {
      mesh.onBeforeRender = function(...args) { order.push(mesh.name); callbacks[i].apply(this, args); };
    });
    for (const object of objects) if (![water.name, river.name, wake.name].includes(object.name)) object.visible = false;
    const canvas = document.createElement('canvas'); canvas.width = gl.domElement.width; canvas.height = gl.domElement.height;
    const context = canvas.getContext('2d')!;
    const pixels = () => {
      renderer().renderOnce(); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(gl.domElement, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const changed = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
      let count = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) count++;
      return count;
    };
    river.visible = false; wake.visible = false; const base = pixels();
    river.visible = true; const reflected = pixels();
    wake.visible = true; order.length = 0; const rippled = pixels(), image = canvas.toDataURL();
    const result = { order: [...order], reflectionPixels: changed(base, reflected), wakePixels: changed(reflected, rippled), image };
    [water, river, wake].forEach((mesh, i) => { mesh.onBeforeRender = callbacks[i]; });
    objects.forEach((object, i) => { object.visible = visibility[i]; }); renderer().renderOnce();
    return result;
  },
  waterFrame(delta: number) {
    const { cityScene, renderer: gl } = probe(), start = performance.now();
    cityScene.update(0, delta, false); const updateMs = performance.now() - start;
    renderer().setProgressImmediate(0); renderer().renderOnce();
    const objects = cityScene.root.getObjectByName('dotonbori-source-study')!.children;
    const visibility = objects.map(object => object.visible);
    for (const object of objects) if (!['dotonbori-water-plan', 'dotonbori-water-reflections', DOTONBORI_WAKE_GROUP].includes(object.name)) object.visible = false;
    renderer().renderOnce(); const image = gl.domElement.toDataURL();
    objects.forEach((object, i) => { object.visible = visibility[i]; }); renderer().renderOnce();
    return { ...waterSnapshot(), updateMs, image };
  },
  glicoFrame(phase: number) {
    const { cityScene, renderer: gl, camera } = probe();
    const time = (cityScene as unknown as { animationTime: number }).animationTime;
    cityScene.update(0, (phase - time % 16 + 16) % 16, false);
    renderer().setProgressImmediate(0); renderer().renderOnce();
    const sign = cityScene.root.getObjectByName(DOTONBORI_GLICO_SIGN_ID) as Mesh;
    const p = sign.geometry.getAttribute('position');
    const vertices = Array.from({ length: p.count }, (_, i) => new Vector3().fromBufferAttribute(p, i).applyMatrix4(sign.matrixWorld).project(camera));
    const x = Math.floor((Math.min(...vertices.map(v => v.x)) + 1) / 2 * gl.domElement.width);
    const y = Math.floor((1 - Math.max(...vertices.map(v => v.y))) / 2 * gl.domElement.height);
    const w = Math.ceil((Math.max(...vertices.map(v => v.x)) + 1) / 2 * gl.domElement.width) - x;
    const h = Math.ceil((1 - Math.min(...vertices.map(v => v.y))) / 2 * gl.domElement.height) - y;
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(gl.domElement, x, y, w, h, 0, 0, w, h);
    return { ...glicoSnapshot(), image: canvas.toDataURL() };
  },
  glicoAtlas() {
    const sign = probe().cityScene.root.getObjectByName(DOTONBORI_GLICO_SIGN_ID) as Mesh;
    return ((sign.material as MeshBasicMaterial).map!.image as HTMLCanvasElement).toDataURL();
  },
  sampleLogo(aspect = 1, ink?: 'dark' | 'light') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = Math.round(256 / aspect);
    const ctx = canvas.getContext('2d')!;
    if (!ink) { ctx.fillStyle = S.gold; ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16); }
    ctx.fillStyle = ink === 'light' ? S.ivory : S.navy;
    ctx.font = `bold ${ink ? Math.min(160, canvas.height * .7) : 64}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('QR', 128, canvas.height / 2);
    return canvas.toDataURL();
  },
  signVisibility() {
    const { cityScene, camera, scene, logoGroup } = probe(), meshes: Mesh[] = [];
    scene.updateMatrixWorld(true);
    cityScene.root.getObjectByName('dotonbori-source-study')!.traverseVisible(o => { if (o instanceof Mesh) meshes.push(o); });
    const ray = new Raycaster(), origin = camera.getWorldPosition(new Vector3());
    const sample = (a: Vector3, b: Vector3, c: Vector3) => {
      const blocked: Record<string, number> = {}; let clear = 0;
      for (let row = 0; row < 12; row++) for (let col = 0; col < 12; col++) {
        const point = a.clone().addScaledVector(b.clone().sub(a), (col + .5) / 12)
          .addScaledVector(c.clone().sub(a), (row + .5) / 12);
        ray.set(origin, point.clone().sub(origin).normalize()); ray.far = origin.distanceTo(point) - .00005;
        const hit = ray.intersectObjects(meshes, false)[0];
        if (!hit) clear++;
        else {
          const index = hit.faceIndex! * 3, mesh = hit.object as Mesh;
          const owner = mesh.userData.sourceBuilding ?? dotonboriBuildingRanges(mesh.geometry)
            .find(r => r.start <= index && r.start + r.count > index)?.building ?? mesh.name;
          blocked[owner] = (blocked[owner] ?? 0) + 1;
        }
      }
      return { clear, samples: 144, blocked };
    };
    const sign = cityScene.root.getObjectByName('dotonbori-night-signs') as Mesh, position = sign.geometry.getAttribute('position');
    const panels = (sign.userData.panels as { front: string; art: number; vertex: number }[])
      .filter(p => p.front === 'B037-east').map(panel => ({ ...panel,
        ...sample(...[0, 1, 2].map(i => new Vector3().fromBufferAttribute(position, panel.vertex + i).applyMatrix4(sign.matrixWorld)) as [Vector3, Vector3, Vector3]) }));
    const logo = logoGroup?.children[0] as Mesh | undefined;
    return { panels, logo: logo ? sample(...[[-.5, .5], [.5, .5], [-.5, -.5]].map(([x, y]) =>
      new Vector3(x, y, 0).applyMatrix4(logo.matrixWorld)) as [Vector3, Vector3, Vector3]) : undefined };
  },
  logo(src: string | false) { renderer().setLogo(src ? { src, alt: 'Custom sign', size: .18 } : false); },
  logoSnapshot() {
    const { cityScene, logoGroup, camera } = probe(), anchor = cityScene.getLogoAnchor();
    const image = logoGroup?.children[0] as Mesh | undefined;
    const uv = (cityScene.root.getObjectByName('dotonbori-night-signs') as Mesh).geometry.getAttribute('uv');
    const fit = image ? Math.min(anchor.width / image.scale.x, anchor.height / image.scale.y) : 0;
    const expected = new Vector3(anchor.x, anchor.y + (anchor.alignTop && image
      ? (anchor.height - fit * image.scale.y) / 2 : 0), anchor.z).multiplyScalar(cityScene.root.scale.x);
    const map = (cityScene.root.getObjectByName('dotonbori-night-signs') as Mesh).material as MeshBasicMaterial;
    const backing = Array.from((map.map!.image as HTMLCanvasElement).getContext('2d')!.getImageData(8, 3 * 256 + 8, 1, 1).data);
    const screen = expected.clone().project(camera), canvas = probe().renderer.domElement;
    return { anchor, uv: Array.from(uv.array), exists: !!image, visible: logoGroup?.visible, opacity: image ? (image.material as MeshBasicMaterial).opacity : 0,
      position: logoGroup?.position.toArray(), expected: expected.toArray(), scale: logoGroup?.scale.x, cityScale: cityScene.root.scale.x, backing,
      imageScale: image?.scale.toArray(), texture: image ? (image.material as MeshBasicMaterial).map?.uuid : undefined,
      screen: { x: (screen.x + 1) * canvas.clientWidth / 2, y: (1 - screen.y) * canvas.clientHeight / 2 } };
  },
  angle(yaw: number) { renderer().yaw = yaw; renderer().renderOnce(); return snapshot(); },
  cameraPose() {
    const camera = probe().camera, direction = camera.getWorldDirection(new Vector3());
    return { yaw: Math.atan2(camera.position.x, camera.position.z), elevation: Math.asin(-direction.y) };
  },
  orbit(yaw: number, pitch: number) { renderer().yaw = yaw; renderer().pitch = pitch; renderer().renderOnce(); },
  resetRotation() { handle.current!.resetRotation(); handle.current!.resume(); },
  riverView() { renderer().viewRiver(); },
  reducedMotion(enabled: boolean) { renderer().reducedMotion = enabled; },
  progress(p: number) { renderer().setProgressImmediate(p); renderer().renderOnce(); return snapshot(); },
  view(view: 'design' | 'qr') { flushSync(() => handle.current!.setView(view)); },
  watchTransitions() {
    const player = renderer(), previous = player.onProgressUpdate;
    player.onProgressUpdate = (progress, blur) => {
      previous?.(progress, blur);
      const city = probe().cityScene;
      const buildings = city.root.getObjectByName('dotonbori-source-study')!.children.filter(object => object.name.startsWith('bldg_'));
      transitionFrames.push({ progress, visibleBuildings: buildings.filter(object => object.visible).length, elapsedMs: performance.now() - turnStartedAt });
    };
  },
  startTurn(view: 'design' | 'qr') {
    transitionFrames.length = 0; turnStartedAt = performance.now();
    flushSync(() => handle.current!.setView(view)); handle.current!.resume();
  },
  transitionFrames: () => transitionFrames,
  async exported() { return Array.from(new Uint8Array(await (await handle.current!.exportImage()).arrayBuffer())); },
  dispose() { flushSync(() => root.unmount()); },
};
(window as unknown as { dotonboriSceneFixture: typeof fixture }).dotonboriSceneFixture = fixture;
