import assert from 'node:assert/strict';
import test from 'node:test';
import { CITY_SIGN_DESIGNS, paintCitySign } from '../src/designs/city/sign-artwork.ts';
import { SHIBUYA_PALETTE } from '../src/designs/city/palette.ts';
import { cityBuildingPanels } from '../src/designs/city/architecture.ts';
import { createCityBuildings } from '../src/designs/city/layout.ts';
import { CITY_SIGN_TEXTURE_MAX_EDGE, citySignTextureSize, paintCitySignText } from '../src/designs/city/sign-rendering.ts';
import { paintCityTransitSign } from '../src/designs/city/transit-signs.ts';
import { createShibuyaStationGeometry } from '../src/designs/city/station-geometry.ts';
import { generateQRMatrix } from '../src/designs/tree/qr.ts';

function recordingCanvas(width = 512, height = 256) {
  const colors = new Set<string>(), labels: string[] = [], commands: unknown[] = [];
  const textRuns: { label: string; x: number; y: number; size: number; width: number; argumentCount: number }[] = [];
  const context = {
    canvas: { width, height }, fillStyle: '', strokeStyle: '', font: '10px sans-serif',
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
    bezierCurveTo() {}, quadraticCurveTo() {},
    measureText(label: string) {
      const width = label.length * .6 * Number(this.font.match(/([\d.]+)px/)![1]);
      return { width, actualBoundingBoxLeft: width / 2, actualBoundingBoxRight: width / 2 };
    },
    fillRect(...args: number[]) { colors.add(this.fillStyle); commands.push([this.fillStyle, ...args]); },
    fillText(label: string, x: number, y: number, ...rest: number[]) {
      colors.add(this.fillStyle); labels.push(label);
      textRuns.push({ label, x, y, size: Number(this.font.match(/([\d.]+)px/)![1]),
        width: this.measureText(label).width, argumentCount: 3 + rest.length });
    },
    fill() { colors.add(this.fillStyle); }, stroke() { colors.add(this.strokeStyle); },
  };
  return { context: context as unknown as CanvasRenderingContext2D, colors, labels, commands, textRuns };
}

test('fourteen distinct sign designs cover six layouts using semantic morning colors and sparse warm accents', () => {
  const palette = new Set<string>(Object.values(SHIBUYA_PALETTE));
  const used = new Set<string>(), patterns = new Set<string>();
  assert.equal(CITY_SIGN_DESIGNS.length, 14);
  assert.equal(new Set(CITY_SIGN_DESIGNS.map(d => d.layout)).size, 6);
  for (const design of CITY_SIGN_DESIGNS) {
    const canvas = recordingCanvas();
    paintCitySign(canvas.context, design);
    for (const color of canvas.colors) { assert.ok(palette.has(color), color); used.add(color); }
    patterns.add(JSON.stringify([canvas.commands, canvas.labels]));
  }
  assert.equal(patterns.size, CITY_SIGN_DESIGNS.length);
  assert.ok(used.has(SHIBUYA_PALETTE.coral) && used.has(SHIBUYA_PALETTE.warmLight));
  assert.ok(CITY_SIGN_DESIGNS.every(d => d.background !== SHIBUYA_PALETTE.coral && d.background !== SHIBUYA_PALETTE.warmLight));
});

test('the main sign clears central artwork for a logo and restores the original on removal', () => {
  const design = CITY_SIGN_DESIGNS[0];
  const original = recordingCanvas(), branded = recordingCanvas(), restored = recordingCanvas();
  paintCitySign(original.context, design);
  paintCitySign(branded.context, design, true);
  paintCitySign(restored.context, design, false);
  assert.ok(original.labels.includes('SHIBUYA'));
  assert.deepEqual(branded.labels, [design.caption]);
  assert.deepEqual(branded.commands[0], [design.background, 0, 0, 512, 256]);
  assert.ok(branded.commands.length < original.commands.length);
  assert.deepEqual(restored.commands, original.commands);
  assert.deepEqual(restored.labels, original.labels);
});

test('vertical and horizontal shop signs have visibly different proportions on the same facade', () => {
  const buildings = createCityBuildings([[true]]);
  const vertical = cityBuildingPanels(buildings[1]).find(p => p.id.endsWith('corner-poster'))!;
  const horizontal = cityBuildingPanels(buildings[5]).find(p => p.id.endsWith('station-name'))!;
  assert.ok(vertical.height > vertical.width * 1.5);
  assert.ok(horizontal.width > horizontal.height * 1.8);
});

test('letter fitting reduces font size uniformly and never delegates width compression to Canvas', () => {
  const canvas = recordingCanvas();
  paintCitySignText(canvas.context, 'MAGNET', 128, 64, 100, 90, SHIBUYA_PALETTE.ink);
  assert.equal(canvas.textRuns.length, 1);
  assert.ok(Math.abs(canvas.textRuns[0].size - 25) < 1e-8);
  assert.deepEqual({ ...canvas.textRuns[0], size: 25 }, { label: 'MAGNET', x: 128, y: 64, size: 25, width: 90, argumentCount: 3 });
  paintCitySignText(canvas.context, 'LIVE', 128, 64, 20, 90, SHIBUYA_PALETTE.ink);
  assert.equal(canvas.textRuns[1].size, 20, 'A fitting word must not be enlarged or distorted.');
});

test('all fourteen sign layouts fit their lettering in tall, square and wide panels without squeezing', () => {
  for (const design of CITY_SIGN_DESIGNS) for (const aspect of [.35, .6, 1, 2, 4, 10, 20]) {
    const size = citySignTextureSize({ id: 'test', width: aspect, height: 1 });
    const canvas = recordingCanvas(size.width, size.height);
    paintCitySign(canvas.context, design);
    for (const run of canvas.textRuns) {
      const message = `${design.label} (${aspect}:1): ${run.label}`;
      assert.equal(run.argumentCount, 3, message);
      assert.ok(Number.isFinite(run.size) && run.size > 0, message);
      assert.ok(run.x - run.width / 2 >= -.01 && run.x + run.width / 2 <= size.width + .01, message);
      assert.ok(run.y - run.size / 2 >= -.01 && run.y + run.size / 2 <= size.height + .01, message);
    }
  }
});

test('real facade textures preserve panel proportions with bounded pixel area across QR values', () => {
  const transit = createShibuyaStationGeometry();
  try {
    for (const value of ['https://example.com/shibuya', 'TOKYO', 'Shibuya crossing '.repeat(8)]) {
      const buildings = createCityBuildings(generateQRMatrix(value).modules);
      const panels = [...buildings.flatMap(cityBuildingPanels), ...transit.panels];
      for (const panel of panels) {
        const size = citySignTextureSize(panel);
        assert.ok(Math.max(size.width, size.height) <= CITY_SIGN_TEXTURE_MAX_EDGE, panel.id);
        assert.ok(size.width * size.height <= 512 * 1024, panel.id);
        assert.ok(Math.abs((size.width / size.height) / (panel.width / panel.height) - 1) < .01, panel.id);
      }
      const books = citySignTextureSize(panels.find(p => p.id === 'qfront-books')!);
      assert.ok(books.width > 1024 && books.height < 200, 'Wide books fascia must not reuse a 4:1 texture.');
      const magnet = citySignTextureSize(panels.find(p => p.id === 'magnet-corner-poster')!);
      assert.ok(magnet.height >= 1024 && magnet.width >= 400, 'The landmark poster needs close-up texel detail.');
    }
  } finally { transit.geometry.dispose(); transit.glassGeometry.dispose(); }
});

test('subway English row clears the Japanese glyph row and exit-code column at all entrance proportions', () => {
  for (const [exit, width] of [['A6a', 3.8], ['A6b', 3.8], ['A7a', 3.6]] as const) {
    const size = citySignTextureSize({ id: exit, width, height: .49, transit: 'entrance' });
    const canvas = recordingCanvas(size.width, size.height);
    paintCityTransitSign(canvas.context, 'entrance', exit);
    const english = canvas.textRuns.find(run => run.label === 'Shibuya Sta.')!;
    const code = canvas.textRuns.find(run => run.label === exit)!;
    // Japanese glyphs start at 16% height and occupy at most 31%, plus their stroke.
    const japaneseBottom = size.height * (.16 + .31 * 1.075);
    assert.ok(english.y - english.size / 2 > japaneseBottom);
    assert.ok(code.x + code.width / 2 < english.x - english.width / 2);
    assert.ok(english.x + english.width / 2 < size.width * .35);
    for (const run of canvas.textRuns) assert.equal(run.argumentCount, 3);
  }
});
