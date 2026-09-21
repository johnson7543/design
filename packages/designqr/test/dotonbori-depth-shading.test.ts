import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, PlaneGeometry } from 'three';
import { DotonboriDepthShading } from '../src/designs/city/dotonbori-depth-shading.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE } from '../src/designs/city/dotonbori-geometry.ts';
import { dotonboriBuildingRanges } from '../src/designs/city/dotonbori-ownership.ts';
import { DOTONBORI_GENERATED_SIGN_DESIGNS } from '../src/designs/city/dotonbori-generated-signs.ts';
import { DOTONBORI_LETTERING } from '../src/designs/city/dotonbori-lettering-data.ts';

test('nearby roofs shade outward-facing low surfaces while exposed roofs retain their light', () => {
  const geometry = new BoxGeometry(.08, .2, .14).translate(.05, .1, 0), depth = new DotonboriDepthShading();
  depth.update([{ geometry }], 144);
  const sheltered = depth.visibility(0, .02, 0, 1, 0, 0);
  assert.ok(sheltered < .8, 'The adjacent building should obstruct the outward sky.');
  assert.equal(depth.visibility(0, .02, 0, -1, 0, 0), 1, 'Occluders behind a wall must not darken its front.');
  assert.equal(depth.visibility(.05, .201, 0, 0, 1, 0), 1, 'An exposed roof must not shadow itself.');
  depth.update([], 144);
  assert.equal(depth.visibility(0, .02, 0, 1, 0, 0), 1, 'Content changes must remove obsolete obstruction.');
  depth.finish(); geometry.dispose();
});

test('repeated depth bakes preserve geometry, ownership and luminous paint without cumulative darkening', () => {
  const blocker = new BoxGeometry(.08, .2, .14).translate(.05, .1, 0);
  const builder = new DotonboriGeometry(144, 'depth-test'); builder.buildingId = 'host';
  builder.add(new PlaneGeometry(.025, .025).rotateY(Math.PI / 2).translate(0, .03, -.025), DOTONBORI_PALETTE.stone);
  builder.add(new PlaneGeometry(.025, .025).rotateY(Math.PI / 2).translate(0, .03, .025), DOTONBORI_PALETTE.warmWindow, true);
  const geometry = builder.finish(), positions = geometry.getAttribute('position').array.slice();
  const colors = geometry.getAttribute('color'), original = colors.array.slice(), ownership = structuredClone(dotonboriBuildingRanges(geometry));
  const depth = new DotonboriDepthShading(); depth.update([{ geometry: blocker }], 144); depth.bake(geometry);
  const baked = colors.array.slice(); assert.notDeepEqual(baked.slice(0, 18), original.slice(0, 18));
  assert.deepEqual(baked.slice(18), original.slice(18), 'Lit windows are self-lit, even beside tall neighbors.');
  depth.bake(geometry); assert.deepEqual(colors.array, baked, 'Fixed-host geometry must remain stable through content updates.');
  assert.deepEqual(geometry.getAttribute('position').array, positions);
  assert.deepEqual(dotonboriBuildingRanges(geometry), ownership);
  depth.update([], 144); depth.bake(geometry); assert.deepEqual(colors.array, original);
  depth.finish(); geometry.dispose(); blocker.dispose();
});

test('every QR-selected Japanese campaign has bundled lettering without a host font dependency', () => {
  assert.equal(DOTONBORI_GENERATED_SIGN_DESIGNS.length, 14);
  for (const design of DOTONBORI_GENERATED_SIGN_DESIGNS) {
    assert.ok(DOTONBORI_LETTERING[design.label]?.commands.length > 0, design.label);
  }
});
