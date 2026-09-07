import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as THREE from 'three';
import { DesignQR } from '../../../packages/designqr/src/react/DesignQR';
import type { DesignQRHandle, DesignQRProps } from '../../../packages/designqr/src/react/types';
import { ThreeFallbackRenderer } from '../../../packages/designqr/src/renderer/webgl/ThreeFallbackRenderer';
import type { ShibuyaScene } from '../../../packages/designqr/src/renderer/webgl/ShibuyaScene';
import type { CityMorphTile } from '../../../packages/designqr/src/designs/city/morph-sources';
import { cityMorphPose, cityMorphState } from '../../../packages/designqr/src/designs/city/morph';
import { cityMorphSignPose, cityMorphSignState } from '../../../packages/designqr/src/designs/city/morph-signs';
import { SHIBUYA_PALETTE } from '../../../packages/designqr/src/designs/city/palette';
import '../../../packages/designqr/src/style.css';
import '../city-assets-consumer/style.css';

// Instrument the real React -> renderer update path without a production debug API.
const observed = new Set<ThreeFallbackRenderer>();
const renderer = () => observed.values().next().value!;
const original = ThreeFallbackRenderer.prototype.setTreeData;
ThreeFallbackRenderer.prototype.setTreeData = function(data) {
  observed.add(this);
  original.call(this, data);
};
interface Probe {
  scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer;
  cityScene: ShibuyaScene | null; currentProgress: number; isRunning: boolean;
}
const probe = () => renderer() as unknown as Probe;
const identities = new WeakMap<object, number>(); let nextIdentity = 0;
const identity = (value?: object) => {
  if (!value) return 0;
  if (!identities.has(value)) identities.set(value, ++nextIdentity);
  return identities.get(value)!;
};
const actors = ['walking-commuters', 'sedan-fleet', 'taxi-fleet', 'van-fleet', 'bus-fleet', 'wheel', 'metro-carriage', 'metro-cab'];
const fixed = ['surveyed-road-foundation', 'station-and-subway-entrances', 'shared-street-furniture',
  'oriented-signal-lights', 'subway-glazing', 'police-balcony-glazing', 'hachiko-square', 'building-qfront', 'building-magnet'];
function hash(array: ArrayBufferView) {
  let result = 2166136261;
  for (const byte of new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) result = Math.imul(result ^ byte, 16777619);
  return result >>> 0;
}
function resources() {
  const found = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.InstancedMesh>();
  probe().scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    found.add(object.geometry);
    if (object instanceof THREE.InstancedMesh) found.add(object);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      found.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) found.add(value);
    }
  });
  return found;
}
const watched = new Map<{ uuid: string }, { name: string; count: number }>();
function track() {
  for (const resource of resources()) if (!watched.has(resource)) {
    const record = { name: resource.type + ':' + resource.uuid, count: 0 };
    watched.set(resource, record);
    const disposed = () => { record.count++; };
    if (resource instanceof THREE.InstancedMesh) resource.addEventListener('dispose', disposed);
    else if (resource instanceof THREE.BufferGeometry) resource.addEventListener('dispose', disposed);
    else if (resource instanceof THREE.Texture) resource.addEventListener('dispose', disposed);
    else resource.addEventListener('dispose', disposed);
  }
}
function snapshot() {
  const p = probe(), city = p.cityScene!;
  const object = (name: string) => city.root.getObjectByName('shibuya-' + name) as THREE.Mesh;
  const geometry = object('source-aligned-streetscape').geometry;
  const people = object(actors[0]) as THREE.InstancedMesh;
  const matrix = new THREE.Matrix4(); people.getMatrixAt(0, matrix);
  const point = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(people.matrixWorld).project(p.camera);
  return {
    root: city.root.uuid, status: city.assetStatus, progress: p.currentProgress,
    time: (city as unknown as { animationTime: number }).animationTime,
    buildings: [hash(geometry.getAttribute('position').array), hash(geometry.getAttribute('color').array)],
    actors: actors.map(name => {
      const mesh = object(name) as THREE.InstancedMesh;
      return { name, id: mesh.uuid, geometry: mesh.geometry.uuid, matrix: hash(mesh.instanceMatrix.array), count: mesh.count };
    }),
    fixed: fixed.map(name => ({ name, id: object(name).uuid, geometry: object(name).geometry.uuid })),
    signals: hash(object('oriented-signal-lights').geometry.getAttribute('color').array),
    projectedPerson: point.toArray(),
    qrCount: (object('qr-modules') as THREE.InstancedMesh).count,
    gpu: { ...p.renderer.info.memory },
    buffer: [p.renderer.domElement.width, p.renderer.domElement.height],
    cityVisible: people.parent!.visible,
  };
}

let patch: (changes: Partial<DesignQRProps>) => void;
const handle = React.createRef<DesignQRHandle>();
const host = document.createElement('div'); document.body.append(host);
const reactRoot = createRoot(host);
function App() {
  const [state, setState] = useState<DesignQRProps>({ value: 'https://example.com/shibuya', design: 'city',
    theme: 'shibuya', zoom: true, interaction: { motionBlur: false },
    details: { border: {} }, className: 'first' });
  useLayoutEffect(() => {
    patch = changes => flushSync(() => setState(s => ({ ...s, ...changes })));
  }, []);
  return React.createElement('main', null, React.createElement(DesignQR, { ...state, ref: handle }));
}
flushSync(() => reactRoot.render(React.createElement(App)));
const fixture = {
  snapshot, track,
  edit(value: string) {
    const before = snapshot(); track();
    patch({ value });
    const after = snapshot(); track();
    return { before, after };
  },
  pause() { handle.current!.pause(); },
  resume() { handle.current!.resume(); },
  step(delta: number) { probe().cityScene!.update(0, delta, false); renderer().renderOnce(); },
  progress(value: number) { renderer().setProgressImmediate(value); renderer().renderOnce(); },
  measureProgress(value: number) {
    const city = probe().cityScene! as unknown as { prepareMorph(): void };
    const gl = probe().renderer, prepare = city.prepareMorph, render = gl.render, compile = gl.compile;
    let prepareMs = 0, renderSubmitMs = 0, compileMs = 0;
    city.prepareMorph = function() { const t = performance.now(); try { prepare.call(this); } finally { prepareMs += performance.now() - t; } };
    gl.render = function(...args) { const t = performance.now(); try { render.apply(this, args); } finally { renderSubmitMs += performance.now() - t; } };
    gl.compile = function(...args) { const t = performance.now(); try { return compile.apply(this, args); } finally { compileMs += performance.now() - t; } };
    const start = performance.now();
    try {
      fixture.progress(value);
      return { progress: value, totalMs: performance.now() - start, prepareMs, renderSubmitMs, compileMs,
        parallelCompile: gl.extensions.has('KHR_parallel_shader_compile'),
        programs: gl.info.programs?.length, draws: gl.info.render.calls, gpu: { ...gl.info.memory } };
    } finally { city.prepareMorph = prepare; gl.render = render; gl.compile = compile; }
  },
  time(value: number) {
    const city = probe().cityScene!;
    city.update(0, value - (city as unknown as { animationTime: number }).animationTime, false);
    renderer().renderOnce();
  },
  view(view: 'design' | 'qr') { handle.current!.setView(view); },
  presentation(changes: Partial<DesignQRProps>) { patch(changes); renderer().renderOnce(); },
  morph() {
    const city = probe().cityScene! as unknown as { morphPlan: CityMorphTile[]; grid: number; morphBase?: object };
    const mesh = probe().cityScene!.root.getObjectByName('shibuya-whole-city-tiles') as THREE.InstancedMesh | undefined;
    return {
      count: mesh?.count ?? 0, visible: mesh?.visible ?? false,
      baseIdentity: identity(city.morphBase),
      sources: city.morphPlan.map(({ source, target }) => ({ ...source, target: { x: target.x, z: target.z, light: target.light } })),
      handoff: cityMorphState(probe().currentProgress),
      groups: city.morphPlan.map(tile => ({ id: tile.source.id, kind: tile.source.kind, group: tile.source.group,
        motion: tile.motion, pose: cityMorphPose(tile.source, tile.target, city.grid, probe().currentProgress, tile.motion) })),
      attributes: mesh ? Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, value]) =>
        [name, { hash: hash(value.array), version: (value as THREE.BufferAttribute).version }])) : {},
      gpu: { ...probe().renderer.info.memory }, draws: probe().renderer.info.render.calls,
      triangles: probe().renderer.info.render.triangles,
      buffer: [probe().renderer.domElement.width, probe().renderer.domElement.height],
    };
  },
  signDetails() {
    const root = probe().cityScene!.root;
    const mesh = root.getObjectByName('shibuya-morph-sign-detail') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial[]> | undefined;
    const city = probe().cityScene! as unknown as { morphPlan: CityMorphTile[]; grid: number };
    const parts = city.morphPlan.filter(t => mesh?.material.some(m => m.name === t.source.group));
    const program = (material: THREE.Material) => (probe().renderer.properties.get(material) as { currentProgram?: unknown }).currentProgram;
    return {
      visible: mesh?.visible ?? false, vertices: mesh?.geometry.drawRange.count ?? 0,
      state: cityMorphSignState(probe().currentProgress),
      maps: mesh?.material.map(m => {
        const original = root.getObjectByName('shibuya-sign-' + m.name) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        return { id: m.name, texture: m.map!.uuid, version: m.map!.version, borrowed: m.map === original.material.map,
          sameProgram: !!program(m) && program(m) === program(original.material) };
      }) ?? [],
      poses: parts.map(t => cityMorphSignPose(t, city.grid, probe().currentProgress)),
      attributes: mesh ? Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name, value]) =>
        [name, { hash: hash(value.array), bytes: value.array.byteLength, version: (value as THREE.BufferAttribute).version }])) : {},
    };
  },
  reduced(enabled: boolean) { renderer().reducedMotion = enabled; renderer().renderOnce(); },
  zoom(scale: number) { handle.current!.setZoom(scale); },
  hero() {
    const sign = probe().cityScene!.root.getObjectByName('shibuya-sign-qfront-vision') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    return { id: sign.uuid, texture: sign.material.map!.uuid, pixels: (sign.material.map!.image as HTMLCanvasElement).toDataURL() };
  },
  logoVisual() {
    const group = probe().scene.getObjectByName('designqr-logo');
    const mesh = group?.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
    return mesh ? { id: mesh.uuid, texture: mesh.material.map!.uuid, version: mesh.material.map!.version,
      aspect: mesh.scale.x / mesh.scale.y, position: group!.position.toArray(), quaternion: group!.quaternion.toArray(),
      scale: group!.scale.toArray(), copies: probe().scene.getObjectsByProperty('name', 'designqr-logo-image').length } : null;
  },
  logo(enabled: boolean, variant = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = variant === 2 ? 96 : variant === 3 ? 32 : 64;
    canvas.height = variant === 2 ? 32 : variant === 3 ? 96 : 64;
    const context = canvas.getContext('2d')!;
    if (variant < 2) { context.fillStyle = SHIBUYA_PALETTE.blue; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.fillStyle = variant ? SHIBUYA_PALETTE.coral : SHIBUYA_PALETTE.paper;
    context.fillRect(canvas.width * .18, canvas.height * .18, canvas.width * .64, canvas.height * .64);
    patch({ logo: enabled ? { src: canvas.toDataURL() } : false });
  },
  design(design: 'tree' | 'city') {
    patch({ design, theme: design === 'city' ? 'shibuya' : 'spring' }); renderer().renderOnce();
  },
  async exported() {
    const blob = await handle.current!.exportImage();
    const data = await blob.arrayBuffer();
    return { bytes: Array.from(new Uint8Array(data)), type: blob.type };
  },
  disposals(final = false) {
    const live = resources();
    return [...watched].flatMap(([resource, record]) => record.count === (final || !live.has(resource as THREE.BufferGeometry) ? 1 : 0)
      ? [] : [record]);
  },
  unmount() { track(); flushSync(() => reactRoot.unmount()); return fixture.disposals(true); },
};
(window as unknown as { contentFixture: typeof fixture }).contentFixture = fixture;
