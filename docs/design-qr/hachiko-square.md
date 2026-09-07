# Hachikō statue and square

[Back to the Design QR documentation index](README.md)

Status: Active. The city includes a seated Hachikō bronze,
pedestal and planted plaza on the station side of the Shibuya miniature.

## Research and reference setting

The five supplied images in `plan/dog/` establish the front, side, rear setting
and map location. The sculpture has a broad muzzle, asymmetric ears, an upright
chest, two separate straight forelegs, folded haunches and a long tail resting
behind it. It sits on a shallow bronze slab above a tall rectangular stone
pedestal; the station-facing plaque reads **忠犬ハチ公** vertically. The garden
references show low planted borders, metal seating rails, stone lanterns,
memorial stones and trees, including a weeping tree behind the statue.

The following sources were checked on 2026-09-06. The placement history and
garden-work report were checked again on 2026-09-07 alongside the supplied
location, front and profile photographs:

| Source | Evidence used |
| --- | --- |
| [Shibuya City Library: Hachikō](https://www.lib.city.shibuya.tokyo.jp/shibuya/about-shibuya/hachiko/) | The present bronze is Takeshi Andō's 1948 second statue. The often-repeated 162 cm sculpture and 180 cm pedestal measurements describe the first, 1934 statue; they are not measurements of the present monument. |
| [Tokyo Metropolitan Library: square layout and relocation](https://catalog.library.metro.tokyo.lg.jp/winj/reference/search-detail.do?lang=ja&qesid=0010004984) | The 1989 reorganization moved the statue toward the western side of the square and turned it east toward the station. |
| [National Diet Library reference database: facing direction](https://crd.ndl.go.jp/reference/entry/index.php?id=1000152872&page=ref_view) | Independent library research confirms that the relocated statue faces the station's ticket gates. |
| [MapFan: 忠犬ハチ公像](https://mapfan.com/spots/SC5Y4,J,Q5) | The published world-coordinate point is latitude 35.6590439, longitude 139.7005917. It agrees with the supplied map's western-plaza location. |
| [Shibuya Culture Project: garden works, 2025-03-28](https://biz.shibuyabunka.com/watch/49/) | Removal work on the small dry garden behind the statue began on 2025-03-27. The article also identifies the donated weeping cherry tree. |

This implementation follows the **planted garden setting shown in the user's
references**. Those images span different dates. It does not represent the
September 2026 construction configuration or a future redevelopment proposal.
The tree/bed/bench arrangements and monument dimensions are photo-based
interpretations, not surveyed construction drawings. No source photos,
advertisements, temporary campaign sashes, watermarks or downloaded meshes ship
with the player.

## Placement and scale

[`hachiko-layout.ts`](../../packages/designqr/src/designs/city/hachiko-layout.ts)
owns the placement, bearing, pedestal footprint, garden beds, trees, seating
and pedestrian exclusion geometry.

- The geographic reference anchor is approximately **3.8 m east, 50.6 m south**
  of the road origin. Hachikō belongs south of the scramble, at the square's
  western roadside edge, with the station to its east. The fitted miniature
  places the whole setting **5.5 m west** of that anchor, at **−1.7 m east,
  50.6 m south**, to follow the narrowed south road. This is an authored
  adjustment to the model's curb, not a claim that the real statue moved.
- The statue center sits approximately **7.7 m from the modeled carriageway**;
  the nearest borders of both planted pockets leave about **1.6 m** beside
  the curb. This restores the reference relationship: the original map anchor
  was roughly 7.6 m from the source road, and narrowing the modeled road had
  increased that gap to 13 m. The sculpture, pedestal, paving, planting,
  trees, benches and memorial details share one translation. Their pedestrian
  exclusions and morph anchors follow the same placement.
- The face has a **90° geographic bearing (east)**. `citySurveyPoint` applies
  the existing map rotation once; the statue's local `+Z` becomes runtime yaw
  `π / 4`. The dog, rectangular base and front plaque use this same orientation.
  Camera reset/orbit, and QR contents never relocate
  or turn the monument.
- All dimensions use the shared **160 m per City unit** conversion. The
  photo-interpreted stone pedestal is 1.14 × 1.78 × 1.35 m, the bronze slab
  is 0.16 m high, and the seated sculpture is approximately 1.20 m high.
  These are miniature modeling dimensions, not measurements claimed for the
  real monument. Hachikō is deliberately small in the whole-city overview.
- Two irregular planted pockets border the monument to the north and south.
  The eastern approach stays open toward the station. The three reference-based
  trees frame the roadside seating pockets.
- All rendered geometry, including canopy extents, stays on the shared land
  surface and outside building parcels. Monument and planting footprints are
  excluded from commuter waiting positions; sampled complete walking cycles
  also clear them. The road mesh and its five crossings are unchanged.

## Sculpture authoring and runtime

[`build-hachiko-sculpture.py`](../../scripts/blender/build-hachiko-sculpture.py)
authors original anatomy in a dedicated Blender scene, fuses the masses with
voxel remeshing, adds shallow cast-surface relief and decimates the body. The
editable anatomical studies remain hidden in the saved project. Nose, eyes,
mouth/toe grooves and collar remain separate editable details.

The script writes
[`hachiko-sculpture-data.ts`](../../packages/designqr/src/designs/city/hachiko-sculpture-data.ts)
and `assets/design-qr/shibuya/hachiko-sculpture.blend`. The compact indexed data
contains positions, triangles, two material-role indices and the authoring
script's SHA-256. Coordinate quantization is an export format, not a statement
of survey accuracy. Helpers convert `(x, y, z)` into Blender `(x, -z, y)`;
export restores Y-up coordinates with local `+Z` forward.

[`hachiko-square.ts`](../../packages/designqr/src/designs/city/hachiko-square.ts)
builds the pedestal, original vector inscription, paving, garden and sculpture
into **one merged, palette-derived mesh**. It adds one static draw call and requires no browser
font, image texture or network request. Ordinary builds do not require Blender.

The current sculpture has 6,372 triangles; the complete plaza has 20,504.
The generated TypeScript data is 151,204 bytes before bundler compression.
The City implementation includes this data directly.

The existing city group owns this mesh's fade and vertical collapse. No plaza
decoration remains at the 2D QR endpoint, and no QR modules or logo anchors are
changed. Each player owns its geometry; normal renderer disposal releases it.
Colors follow the maintained [City palette roles](color-palettes.md#shibuya-city--blue-morning).

Regenerate from the repository root:

```bash
blender --background --python scripts/blender/build-hachiko-sculpture.py
npm run test:designqr
npm run typecheck:designqr
npm run build
```

Connected Windows Blender can execute the same script through the repository's
UNC path, as described in the [Blender workflow](shibuya-blender-assets.md#regeneration).
The exporter only rebuilds its tagged scene, saves a project copy and restores
the previously active scene. Keep the script, editable project and generated
data together when editing the sculpture.

## Verification

The station-facing curb also has two trees in separate raised gardens,
following the local `Shibuya-road-tree-1.png` reference.
The smaller 6.5 m tree sits toward the police box; the larger 10 m tree sits
toward the crossing. The smaller tree occupies an L-shaped garden whose long
arm follows the curb and whose short return sits at the station end. The larger
tree occupies a separate 4 m square bed, with an open gap between the gardens.
Dark planter walls, pale coping, low shrubs and small
pale/gold blooms share the existing morning palette. These photo-fitted heights
are miniature proportions, not surveyed measurements. Both garden footprints join
the crowd exclusion geometry, while the canopies stay clear of roads and
buildings. Both trees share the existing static batch and QR morph anchors.
The combined garden, sculpture and station planting stay below 26,000 triangles.

[`city-hachiko.test.ts`](../../packages/designqr/test/city-hachiko.test.ts)
covers the map anchor, modeled curb setback and geographic bearing, source freshness, sculpture scale
and key silhouette features, geometry/triangle bounds, street/building
clearance, open station approach, commuter cycles, failed loading,
independent geometry and the QR endpoint.

`npm run smoke:shibuya-station` captures the front, profile, rear and whole
plaza alongside the station and road, then checks the QR return. Inspect these
views with the actual renderer.
Check the editor at 1440×900, 390×844 and 320×568 in 3D and 2D, including actual
QR decoding. Run `npm run smoke:designqr-city-assets`, the City smoke gate,
`npm run smoke:production`, lint, style/color checks, `docs:check` and
`design-docs:check` after changes.
