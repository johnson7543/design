import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Mesh, Vector3, type WebGLRenderer, type PerspectiveCamera } from 'three';
import { DesignQR } from '../../../packages/designqr/src/react/DesignQR';
import type { DesignQRHandle, DesignQRProps } from '../../../packages/designqr/src/react/types';
import { ThreeFallbackRenderer } from '../../../packages/designqr/src/renderer/webgl/ThreeFallbackRenderer';
import { PresentationSurface, type PresentationSurfaceState } from '../../../packages/designqr/src/renderer/PresentationSurface';
import type { TokyoTowerScene } from '../../../packages/designqr/src/renderer/webgl/TokyoTowerScene';
import { towerCollapsePoint } from '../../../packages/designqr/src/designs/city/tokyo-tower-morph';
import '../../../packages/designqr/src/style.css';
import '../city-assets-consumer/style.css';

const observed = new Set<ThreeFallbackRenderer>();
const presentations = new Set<PresentationSurface>();
const originalProgress = PresentationSurface.prototype.setViewProgress;
PresentationSurface.prototype.setViewProgress = function(progress) { presentations.add(this); originalProgress.call(this, progress); };
const original = ThreeFallbackRenderer.prototype.setTreeData;
ThreeFallbackRenderer.prototype.setTreeData = function(data) { observed.add(this); original.call(this, data); };
const player = () => observed.values().next().value!;
const handle = React.createRef<DesignQRHandle>(), host = document.createElement('main'); document.body.append(host);
const root = createRoot(host);
let props: DesignQRProps = { value: 'https://example.com/tokyo-tower', design: 'city', theme: 'tokyo-tower', details: { border: {} }, interaction: { motionBlur: false } };
const render = () => flushSync(() => root.render(React.createElement(DesignQR, { ...props, ref: handle })));
render();
const probe = () => {
  const raw = player() as unknown as { cityScene: TokyoTowerScene; renderer: WebGLRenderer; camera: PerspectiveCamera; currentProgress: number };
  return { ...raw, cityScene: (raw.cityScene as unknown as { scene?: typeof raw.cityScene })?.scene ?? raw.cityScene };
};
const fixture = {
  ready: () => observed.size > 0 && probe().cityScene?.assetStatus === 'ready',
  pause() { handle.current!.pause(); },
  snapshot() {
    const { cityScene, renderer, camera, currentProgress } = probe();
    const mesh = cityScene.root.children[0] as Mesh, geometry = mesh.geometry;
    const start = geometry.getAttribute('position'), centers = geometry.getAttribute('towerCenter'), targets = geometry.getAttribute('towerEnd');
    const grounds = geometry.getAttribute('towerGround');
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    const groundBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, maxY: -Infinity };
    for (let i = 0; i < start.count; i++) {
      const source = [start.getX(i), start.getY(i), start.getZ(i)] as const;
      const center = [centers.getX(i), centers.getY(i), centers.getZ(i)] as const;
      const end = [targets.getX(i), targets.getY(i), targets.getZ(i)] as const;
      const ground = grounds.getX(i) > .5;
      const point = towerCollapsePoint(source, center, end, currentProgress, ground);
      if (ground) {
        groundBounds.minX = Math.min(groundBounds.minX, point[0]); groundBounds.maxX = Math.max(groundBounds.maxX, point[0]);
        groundBounds.minZ = Math.min(groundBounds.minZ, point[2]); groundBounds.maxZ = Math.max(groundBounds.maxZ, point[2]);
        groundBounds.maxY = Math.max(groundBounds.maxY, point[1]);
      }
      const p = new Vector3(...point).applyMatrix4(cityScene.root.matrixWorld).project(camera);
      bounds.minX = Math.min(bounds.minX, p.x); bounds.maxX = Math.max(bounds.maxX, p.x);
      bounds.minY = Math.min(bounds.minY, p.y); bounds.maxY = Math.max(bounds.maxY, p.y);
    }
    return { ...cityScene.root.userData.inventory, progress: currentProgress, mesh: mesh.uuid, geometry: geometry.uuid,
      memory: { ...renderer.info.memory }, calls: renderer.info.render.calls, bounds, groundBounds };
  },
  progress(p: number) { player().setProgressImmediate(p); player().renderOnce(); return this.snapshot(); },
  angle(yaw: number) { player().yaw = yaw; player().renderOnce(); return this.snapshot(); },
  glowDifference() {
    const surface = [...presentations].at(-1)!;
    const internals = surface as unknown as { state: PresentationSurfaceState; backgroundTransitionStartedAt: number; viewProgress: number };
    if (Math.abs(internals.viewProgress - probe().currentProgress) > 1e-9) throw new Error(`Glow progress ${internals.viewProgress} differs from model ${probe().currentProgress}`);
    const enabled = internals.state.nightGlow, transition = internals.backgroundTransitionStartedAt;
    const canvas = document.querySelector<HTMLCanvasElement>('.designqr-presentation-canvas')!;
    const context = canvas.getContext('2d')!;
    try {
      // Freeze the backdrop so this compares only the source-light glow.
      internals.backgroundTransitionStartedAt = 0;
      internals.state.nightGlow = undefined; surface.draw();
      const off = context.getImageData(0, 0, canvas.width, canvas.height).data;
      internals.state.nightGlow = 'landmark'; surface.draw();
      const on = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0, maxDelta = 0;
      for (let i = 0; i < off.length; i += 4) {
        const delta = Math.max(...[0, 1, 2, 3].map(c => Math.abs(off[i + c] - on[i + c])));
        // Canvas readback and alpha composition can quantize gradients two levels apart.
        // QR module colors are checked independently against exact palette RGB.
        if (delta > 2) changed++;
        maxDelta = Math.max(maxDelta, delta);
      }
      console.log('Glow comparison', JSON.stringify({ progress: internals.viewProgress, changed, maxDelta, transparent: internals.state.transparentBackground }));
      return changed;
    } finally {
      internals.state.nightGlow = enabled; internals.backgroundTransitionStartedAt = transition; surface.draw();
    }
  },
  async exported() { return Array.from(new Uint8Array(await (await handle.current!.exportImage()).arrayBuffer())); },
  set(next: Partial<DesignQRProps>) { props = { ...props, ...next }; render(); },
  dispose() { flushSync(() => root.unmount()); },
};
(window as unknown as { towerFixture: typeof fixture }).towerFixture = fixture;
