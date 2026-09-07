import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, Mesh, MeshBasicMaterial, Texture, Vector3, type BufferAttribute } from 'three';
import { cityBuildingPanels, cityFacadePanelGeometry } from '../src/designs/city/architecture.ts';
import { createCityBuildings } from '../src/designs/city/layout.ts';
import { CITY_MORPH_SIGN_IDS, CityMorphSigns, cityMorphSignPose, cityMorphSignSources, cityMorphSignState } from '../src/designs/city/morph-signs.ts';
import { SHIBUYA_PALETTE as P } from '../src/designs/city/palette.ts';
import type { CityMorphTile } from '../src/designs/city/morph-sources.ts';

function fixture() {
  const signs = createCityBuildings([[true]]).flatMap(cityBuildingPanels)
    .filter(panel => CITY_MORPH_SIGN_IDS.some(id => id === panel.id))
    .map(panel => ({ panel, mesh: new Mesh(cityFacadePanelGeometry(panel), new MeshBasicMaterial({ map: new Texture(), transparent: true })) }));
  const tiles: CityMorphTile[] = signs.flatMap(({ panel }) => cityMorphSignSources(panel, false)).map((source, i) => ({
    source, target: { x: (i + .5) / 29 - .5, z: .1, ink: new Color(i % 2 ? P.ink : P.qrPaper), light: i % 2 === 0 },
    motion: { x: -.02, z: .04, settle: .58 },
  }));
  return { signs, tiles };
}

test('only three landmark panels retain artwork; the uploaded logo is never baked into a fragment', () => {
  const { signs, tiles } = fixture();
  assert.equal(signs.length, 3); assert.equal(tiles.length, 6);
  for (const { panel } of signs) {
    const normal = cityMorphSignSources(panel, false), branded = cityMorphSignSources(panel, true);
    assert.equal(normal[0].width * 2, panel.width); assert.equal(normal[0].height, panel.height);
    if (panel.hero) {
      assert.equal(branded[0].color, branded[1].color);
      assert.notEqual(normal[0].color, normal[1].color);
      assert.deepEqual(branded.map(({ color: _color, ...rest }) => rest), normal.map(({ color: _color, ...rest }) => rest));
    } else assert.deepEqual(normal, branded);
  }
});

test('folding halves retain source UVs, glyph proportions and coherent motion in both directions', () => {
  const { signs, tiles } = fixture(), detail = new CityMorphSigns();
  detail.setTiles(tiles, signs, 29);
  const geometry = detail.mesh.geometry, position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv'), uvVersion = (uv as BufferAttribute).version;
  assert.equal(geometry.drawRange.count, 36); assert.equal(geometry.groups.length, 3);
  for (const p of [.31, .42, .5, .58, .65, .74, .779, .74, .5, .31]) {
    detail.update(p);
    assert.ok(detail.mesh.visible);
    assert.equal((uv as BufferAttribute).version, uvVersion);
    tiles.forEach((tile, i) => {
      const pose = cityMorphSignPose(tile, 29, p);
      assert.ok(Math.abs(pose.width / pose.height - tile.source.width / tile.source.height) < 1e-9);
      const a = new Vector3().fromBufferAttribute(position, i * 6), b = new Vector3().fromBufferAttribute(position, i * 6 + 1);
      const c = new Vector3().fromBufferAttribute(position, i * 6 + 2);
      assert.ok(Math.abs(a.distanceTo(b) / b.distanceTo(c) - pose.width / pose.height) < 1e-5);
      assert.equal(uv.getX(i * 6), i % 2 / 2);
      assert.equal(uv.getX(i * 6 + 1), (i % 2 + 1) / 2);
      assert.equal(uv.getY(i * 6), 0); assert.equal(uv.getY(i * 6 + 2), 1);
    });
    const before = (position as BufferAttribute).version;
    detail.update(p);
    assert.equal((position as BufferAttribute).version, before, 'A paused redraw uploads unchanged positions');
  }
  const before = (position as BufferAttribute).version;
  for (const p of [0, .15, .3, .78, .94, 1]) {
    detail.update(p); assert.equal(detail.mesh.visible, false);
    assert.equal((position as BufferAttribute).version, before);
  }
  assert.equal(cityMorphSignState(.78).ink, 1);
  assert.equal(position.array.byteLength, 432, 'Per-frame work exceeds six small quads');
  for (const tile of tiles) {
    const end = cityMorphSignPose(tile, 29, 1);
    assert.ok(Math.abs(end.x - tile.target.x) < 1e-9 && Math.abs(end.z - tile.target.z) < 1e-9);
    assert.equal(end.width, 1.002 / 29); assert.equal(end.height, 1.002 / 29);
  }
});

test('sign fragments borrow live per-player maps, use the existing shader, and never dispose a borrowed texture', () => {
  const { signs, tiles } = fixture(), detail = new CityMorphSigns(), another = fixture(), second = new CityMorphSigns();
  detail.setTiles(tiles, signs, 29); second.setTiles(another.tiles, another.signs, 29);
  for (let i = 0; i < signs.length; i++) {
    const map = signs[i].mesh.material.map!, material = detail.mesh.material[i];
    assert.equal(material.map, map); assert.notEqual(second.mesh.material[i].map, map);
    assert.equal(material.customProgramCacheKey(), signs[i].mesh.material.customProgramCacheKey());
    const version = map.version; detail.update(.5); detail.update(.6);
    assert.equal(map.version, version, 'Turning repaints/reuploads a sign map');
    map.needsUpdate = true;
    assert.equal(material.map!.version, version + 1, 'Logo restoration is not visible to borrowed maps');
  }
  const geometry = detail.mesh.geometry, maps = signs.map(s => s.mesh.material.map!);
  let textureDisposals = 0, materialDisposals = 0;
  for (const map of maps) map.addEventListener('dispose', () => textureDisposals++);
  for (const material of detail.mesh.material) material.addEventListener('dispose', () => materialDisposals++);
  detail.setTiles(tiles, signs, 29);
  assert.equal(detail.mesh.geometry, geometry);
  detail.updateMaps(another.signs);
  detail.mesh.material.forEach((material, i) => assert.equal(material.map, another.signs[i].mesh.material.map));
  detail.updateMaps([]);
  detail.mesh.material.forEach(material => assert.equal(material.map, null, 'Hidden fragments retained a retired map'));
  assert.equal(textureDisposals, 0);
  detail.setTiles([], [], 29);
  assert.equal(materialDisposals, 3); assert.equal(textureDisposals, 0);
  detail.update(.5); assert.equal(detail.mesh.visible, false);
  geometry.dispose(); second.mesh.geometry.dispose();
  second.mesh.material.forEach(m => m.dispose());
  [...signs, ...another.signs].forEach(s => { s.mesh.geometry.dispose(); s.mesh.material.map!.dispose(); s.mesh.material.dispose(); });
});
