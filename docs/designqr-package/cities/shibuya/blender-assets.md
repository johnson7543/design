# Shibuya Blender assets

[Back to the Design QR documentation index](README.md)

Status: active. Blender-authored City models use the source-aligned geometry
described in the [building and station contract](architecture.md), with
runtime color roles from the [morning palette](../../color-palettes.md#shibuya-city--blue-morning).

The runtime combines these models with the shared road, station, crowd and
sign artwork. The existing QR-driven skyline, transition, camera, logo and
flat 2D ink roles govern the complete scene.

## Asset inventory and geometry contract

Hachikō's editable project is `hachiko-sculpture.blend`, with a dedicated
authoring script and compact palette-free runtime mesh. See the
[Hachikō authoring and placement contract](hachiko-square.md).

All nine roots are stable semantic IDs, not traversal indices:

| Root ID | Runtime meaning |
| --- | --- |
| `vehicle-sedan`, `vehicle-taxi`, `vehicle-van`, `vehicle-bus` | Local +Z forward; ground-contact origin; structural width/height/length read directly from `vehicles.ts`; shaped panels, glazing, doors, mirrors, lamps, taxi roof sign and bus equipment |
| `wheel` | Centered axle along +X, unit radius; shared linked geometry in Blender previews, one 48-wheel runtime instance batch |
| `metro-carriage` | +Z-forward reusable body; authored origin `.106` and template spacing `.081`; runtime maps onto the shared track 7 m above pavement, 20 m body and 20.8 m spacing, with the existing 14-second loop |
| `metro-cab` | Separate forward-end detail, instanced only on the two outer ends with opposite rotations |
| `building-qfront` | Normalized source contour, continuous glazing, thin vertical mullions, roof rails/equipment and angled logo anchor |
| `building-magnet` | Normalized source contour, seven façade floors, roof rails and equipment; runtime owns its distinct corner, side and street screens |

Blender helpers accept runtime X/Y/Z and map to native `(x, -z, y)`. Export
performs the single native Z-up to glTF Y-up conversion. Display translations
and scales in the editable showroom are removed by root-relative extraction;
they never determine runtime footprint, scale, or QR content. Buildings are
placed at their generated centers and the shared `CITY_PAVEMENT_HEIGHT`,
scaled by their fixed source width, height and depth. Their shared polygon
footprints also define the morph proxies; roof details are not
disconnected occupied towers requiring new proxy volumes.

Wheel anchors use `<type>-wheel-l/r-front/rear`; their shared authoring meshes
are excluded from vehicle-body extraction. The standalone wheel template owns
runtime wheel geometry, so imported previews cannot duplicate the wheel batch.
`taxi-roof-sign`, `metro-cab-end`, and `metro-coupler-front/rear` identify other
separately meaningful parts. `qfront-logo-anchor` is a normalized position and
yaw derived from the crossing-facing QFRONT panel. The loader checks the full
root-relative transform against the runtime façade anchor, including rotation.
Logo sizing is bounded by that physical panel, with no new public scale API.
No uploaded logo is stored in the source, GLB, manifest, or shared cache.

Sign surfaces use per-player canvas materials, outward normals and upright
UVs. Their [lettering and texture quality contract](architecture.md#sign-lettering-and-close-up-quality)
preserves physical aspect ratios, fits words without squeezing, and shares
identical static maps within a player under bounded texel budgets. These
runtime-artwork fixes do not require Blender regeneration.
The other source-aligned buildings, roads, police box and JR frontage,
A6a/A6b/A7a stair entrances, railway structures and crowd use runtime geometry.
Full transformed geometry remains inside each reserved polygon envelope.

`shibuya-manifest.json` uses schema `designqr-shibuya-assets`, version `2`.
The loader checks the complete inventory, IDs/kinds, unique required nodes,
finite nondegenerate transforms, vehicle dimensions/wheel anchors, logo anchor,
rail metadata, geometry/UVs, polygon morph proxies, bounds, source-hash metadata
and approved material roles. Binary tests compare the source SHA to the current
building snapshot and validate both landmark contours against their envelopes.

Open quads retain their authored winding when Blender recalculates closed
solids: unconditionally recalculating disconnected sign panels can flip their
normals independently. The binary geometry tests explicitly cover this.

## Materials, packaging, and lifetime

The authoring script reads the nine Osaka swatches from `palette.ts`, converts
sRGB to linear for Blender material bases, and exports named semantic roles.
The loader verifies source colors against the manifest, retains semantic material
roles and face-light weights in theme-neutral CPU templates, and discards imported
PBR resources. Each player clones a template and applies the morning palette to
produce unlit linear vertex colors. Source assets need no color re-export; the
preparation script retains `SHIBUYA_ASSET_SOURCE_PALETTE` for reproducible authoring. The product's [color mappings](../../color-palettes.md#shibuya-city--blue-morning)
describe all assignments. Per-instance body paint uses a mask, so it cannot tint
glazing, lamps, wheels or signs. There are no external images, textures,
compression extensions/decoders, lights, or baked traffic animation in the GLB.

Both Vite builds use the same build-only virtual-module plugin. It encodes the
checked-in GLB and manifest into a separately lazy-imported JavaScript chunk.
`GLTFLoader` is another lazy chunk, bundled for ESM and CJS with its Three.js
dependency externalized to the player's existing instance. Tree does not request either payload. Consumers supply no asset base URL
and copy no public files; non-root deployments resolve normal module chunks.
SSR imports never access `window`, fetch models, or parse GLB bytes.

One deduplicated promise caches immutable CPU templates. Each player clones
geometry and owns its materials, instance buffers, clipping planes, signs and
logo. Clipping planes are transformed from the local tile limits into world
space every visible frame, including the collapse transform. The renderer's
local-clipping switch is enabled for City. Imported
vehicles/trains are never shortened or squashed at tile edges.
Models follow the [map-derived road foundation](road-network.md),
curved lane headings, metric vehicle scale, and arc-length wheel travel. The
metro adds two portal planes in the common rotated station basis. Road geometry
is generated directly from the geographic snapshot.

Asynchronous completion writes only to a small scene-specific token, not a
captured scene/DOM/resource graph. Disposal invalidates that token; failed loads
clear the shared promise for subsequent attempts. GPU attachment occurs only
in a running frame at either settled endpoint. At the QR endpoint the models
prepare behind the hidden city group, ready for the return to 3D. A paused,
mid-turn, replaced or disposed scene never attaches new GPU resources. Loading
does not add an animation loop or timer, reset traffic time, or rebuild morph
destinations. Public `onReady` reports renderer availability. The QR endpoint
remains usable while models load, and asset errors leave the QR matrix intact.

Valid content edits with the same City design retain that token and all attached
model instances, including their shared activity clock. They update contextual
architecture and QR destinations in place; they do not re-import models or
reset people, traffic or metro. Paused edits never attach pending GPU resources.
Unchanged sign maps survive, retired maps are released, and each player retains
exclusive ownership. See [live content updates](overview.md#live-content-updates).

## Asset size and measurement

The architecture GLB is **668,608 bytes**, below the enforced 1 MiB limit.
It contains nine roots and every Osaka base swatch. The lazy asset module is
about 896 kB / 119 kB gzip; model bytes stay outside the initial package entry.

Use [`measure-designqr-city.mjs`](../../../../scripts/measure-designqr-city.mjs) with
`DESIGNQR_CITY_MEASURE_DIR` set to a local output directory to record the
current scene's frame intervals, draw calls, triangles and package entry size.
Software WebGL measurements do not predict hardware frame rates.

## Current file ownership

- [`build-shibuya-assets.py`](../../../../scripts/blender/build-shibuya-assets.py):
  original Blender authoring and repeatable export; reads palette, vehicle
  dimensions and prepared landmark triangles from their shared sources.
- [`prepare-shibuya-landmarks.mjs`](../../../../scripts/blender/prepare-shibuya-landmarks.mjs):
  generates `assets/design-qr/shibuya/landmark-meshes.json` using the runtime
  architectural generator, normalized contours and source SHA. No user values
  or uploaded logo images enter this authoring input.
- `assets/design-qr/shibuya/shibuya-assets.blend`: editable project-scene copy,
  saved without replacing the user's open Blender file.
- `packages/designqr/src/designs/city/assets/shibuya.glb` and
  `shibuya-manifest.json`: checked-in exports, generated together.
- [`shibuya-asset-plugin.mjs`](../../../../scripts/shibuya-asset-plugin.mjs): build-only
  base64 encoding into a lazy asset chunk. No tracked base64 source or required
  public asset URL. Ordinary web/package builds do not need Blender.
- [`assetLoader.ts`](../../../../packages/designqr/src/designs/city/assetLoader.ts):
  validates semantic IDs, transforms, geometry and palette; caches CPU templates.
- [`assetInstances.ts`](../../../../packages/designqr/src/designs/city/assetInstances.ts):
  per-player GPU geometry/materials, body-only instance paint, traffic placement,
  and world-space clipping.

## Regeneration

From the repository root, use a locally installed Blender executable:

```bash
node scripts/blender/prepare-shibuya-landmarks.mjs
blender --background --python scripts/blender/build-shibuya-assets.py --
npm run build
```

The script rebuilds only its tagged `DesignQR Shibuya Assets` scene and
restores the previously active scene. No reference photographs, uploaded logos
or downloaded models are included. Building contours derive from modified
PLATEAU data; retain its [attribution](architecture.md#regeneration-and-attribution)
alongside the original authored façade and vehicle detail.

Keep the authoring script, prepared landmark input, editable source, GLB and
manifest synchronized after an asset edit. Re-run the building compiler first
when changing map data; the Blender exporter rejects stale source hashes.
Always regenerate the complete asset set before validating the product.

## Verification workflow and evidence

```bash
npm run test:designqr
npm run typecheck:designqr
npm run lint
npm run docs:check
npm run design-docs:check
npm run color:check
npm run style:check
npm run build
npm run check:designqr-react-snippets
npm run smoke:designqr-city-assets
npm run smoke:designqr-city
npm run smoke:shibuya-signs
npm run smoke:shibuya-content
npm run check:designqr-city-package
npm run check
```

Chrome is discovered at its standard Linux location or through `CHROME_BIN`.
The asset smoke uses local port 4210 (override `DESIGNQR_CITY_ASSET_PORT`).
The package gate packs locally, installs into a new temporary directory with
scripts disabled, verifies ESM/CJS/SSR imports, builds the installed consumer at
`/city-consumer/`, and runs its browser checks on port 4191. It uses the maintained
[`consumer fixture`](../../../../scripts/fixtures/city-assets-consumer); there are no
workspace source aliases in that consumer. It reports the retained temporary
directory for screenshots, logs and tarball inspection and never publishes.

Unit and browser checks cover semantic inventory, palette, source freshness,
model bounds, wheel motion, train clipping, delayed and failed loading,
disposal, independent players and stable resource counts. The installed
consumer exercises both morph directions, logos, dense transparent PNGs and
actual QR decoding. The editor checks the Shibuya preset and both views at
1440×900, 390×844 and 320×568.
