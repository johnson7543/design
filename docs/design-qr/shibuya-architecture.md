# Shibuya buildings and station

[Back to the Design QR documentation index](README.md)

Status: active. Source-aligned building footprints and landmark heights define
the station frontage, sign locations and QR morph volumes.

## Reference interpretation and research

The user's `plan/building/Shibuya-building-1.png` looks from the station toward
QFRONT, the western tenant-sign block and MAGNET. `Shibuya-station-1.png` looks
back toward the low Hachiko frontage with railway and distant towers behind it.
These perspective images guide façade character, not plan measurements. No
Google imagery, campaign advertisements or screenshots are bundled as textures.
The factual JR mark is included as fitted vector outlines for the station signs.

The later `Shibuya-building-look-back*.png` references show the long glazed
station elevation and the cream, horizontally ribbed railway fascia. The
`Shibuya-building-subway-entrance*.png` references supply the Shibuchika canopy,
signs and the three exit locations. Their photographed architectural character
is retained within the miniature's existing palette and geographic tile.

The three `Shibuya-building-police-station-*.png` images define the next
frontage revision: the two-storey silver police box, curved balcony, glass blocks,
KOBAN plaque, adjoining dark-clad JR entrance and its large advertisements.
These supplied views take precedence over the earlier uniform glazed frontage
interpretation on this parcel. They depict a reference-era appearance, not the
current construction state. The chosen dimensions below are visual estimates.

- [QFRONT's owner](https://www.tokyu-reit.co.jp/portfolio/detail?id=1) identifies
  the eight-above-ground-storey building and its large media façade. The model
  uses a glazed, chamfered contour, thin vertical mullions, lower shop bands and
  one crossing-facing vision panel; it is not a generic box with an unrelated
  billboard. The owner's land-area figure is not a building-footprint area.
- [MAGNET's official floor guide](https://magnetbyshibuya109.jp/floor/) and
  [official façade-media specifications](https://shibuya109square.com/1849/)
  distinguish the seven-floor crossing building, tall corner poster and wide
  lower screen. This is **MAGNET by SHIBUYA109**, not the cylindrical flagship
  SHIBUYA109 farther west, outside this tile. Panel artwork is original and
  uses the shared morning palette; campaign art is not reproduced.
- The western sign block has independently proportioned tenant columns and
  roof boards, informed by the supplied view and the
  [Taiseido bookstore's location](https://www.taiseido.co.jp/). The generalized
  source block is not claimed to be a precise inventory of individual tenants.
- [JR East's station information](https://www.jreast.co.jp/estation/station/info.aspx?StationCd=808)
  and [Hachiko-area construction notice](https://www.jreast.co.jp/estation/stations/pdf/202502_808_notice.pdf)
  support a low crossing-side entrance interpretation. The
  [2024 south-side station opening](https://www.jreast.co.jp/press/2024/tokyo/20240423_to03.pdf)
  is a different part of the station. Neither that six-storey building nor the
  [future station redevelopment](https://www.jreast.co.jp/info/2025/20250917_ho01.pdf)
  is substituted at Hachiko. Construction and advertisements can change after
  the reference images; this is not a live as-built station model.
- The [Hachiko façade contractor's project record](https://www.device-inc.com/work/770/)
  identifies the 2003 Kengo Kuma façade and its point-supported glass curtain
  wall with back mullions. This supports the tall, closely framed window bays
  above the dark ground concourse; the miniature does not reproduce its glass
  engineering or structural dimensions.
- [Tokyu's station map](https://www.tokyu.co.jp/railway/station_map/pdf/ty01-shibuya_2.pdf)
  and [Shibuchika's operator](https://www.tokyu-tmd.co.jp/property/shibuchika/)
  establish the underground connection beneath the scramble and Hachiko square.
  The supplied labelled aerial distinguishes A6a, A6b and A7a within that system.
  The [2021 renovation architect](https://www.tokyu-sekkei.co.jp/project/890/)
  documents the renewed underground mall and its crossing-inspired louvers and
  lighting. The model adds canopy lights and ventilation detail; it does not
  invent a complete underground mall interior.

Scramble Square and the other distant towers seen in the station photograph
fall outside the shared 160 m tile. They are deliberately not moved inward to
imitate the photograph's perspective skyline.

## Geographic source and limits

Footprints and source heights come from
[3D都市モデル（Project PLATEAU）渋谷区（2025年度）](https://www.geospatial.jp/ckan/dataset/plateau-13113-shibuya-ku-2025).
The offline compiler reads these official building files:

- [53393595_bldg_6697_op.gml](https://assets.cms.plateau.reearth.io/assets/fd/21cbf7-ee57-42bb-a445-ea9c46f8c1b3/13113_shibuya-ku_pref_2025_citygml_1_op/udx/bldg/53393595_bldg_6697_op.gml)
- [53393596_bldg_6697_op.gml](https://assets.cms.plateau.reearth.io/assets/fd/21cbf7-ee57-42bb-a445-ea9c46f8c1b3/13113_shibuya-ku_pref_2025_citygml_1_op/udx/bldg/53393596_bldg_6697_op.gml)

It chooses `lod0FootPrint`, falling back to `lod0RoofEdge`, and records which
was used. QFRONT and MAGNET use roof-edge outlines; these are not cadastral
ground-wall surveys. Measured heights, source storeys, source-quality codes,
source/retained areas, feature IDs and file SHA-256 values remain in
[`building-data.ts`](../../packages/designqr/src/designs/city/building-data.ts).
Projection, origin, 45° rigid rotation and 160 m scale are taken directly from
the [road snapshot](shibuya-road-network.md), whose SHA is also recorded.
Paint-only revisions keep that original authoring-input SHA and the building
snapshot / GLBs unchanged. Layout tests accept the original source only when
the separately pinned SHA-256 of **all non-paint road data** still matches the
verified pre-paint snapshot. Any footprint, coordinate, crossing, parcel or
traffic-route change fails this guard and requires geographic regeneration.

| Model identity | Source feature ID | Source height | Runtime interpretation |
| --- | --- | --- | --- |
| QFRONT | `bldg_5f7ff4f3-a620-4fd0-a380-3ec46435cd27` | 45.9 m | Fixed height, eight façade floors, source contour |
| MAGNET | `bldg_d47d8aa9-e4f5-4599-9d9a-bc129a12d6a8` | 34.2 m | Fixed height, seven façade floors, distinct adjoining screens |
| Western sign block | `bldg_e6e4de58-1a37-4345-8795-6b759771ade6` | 24.1 m | Source contour, QR-dependent height and façade details |
| Southwest retail block | `bldg_6abf2261-478c-437a-93f4-8ba23d7b1cad` | 35.1 m | Source contour, QR-dependent height |
| Department-store context | `bldg_46f3cd1c-4dc8-4e7e-b30f-db8c8c31f776` | 31.6 m | Source contour, clipped at tile edge, QR-dependent height |
| Hachiko frontage | `bldg_20234796-412f-494e-b712-f3f7d6e3197b` | 11.6 m | Same clipped compound; interpreted 8.2 m police portal beside a 10.8 m station body with a clear roofline |

The last source feature is labelled as the station police box and groups a
larger low compound. It is useful for reserving land, **not** a surveyed station
entrance outline. The architectural interpretation and its chosen lower height
are explicit exceptions, not additional measured facts.

The snapshot retains 15 masses including clipped context buildings. Source
coordinates are transformed in Japan Plane Rectangular Zone IX, not measured
in geographic degrees or Web Mercator. Source-scale code `1` means 1:2500;
four-decimal metre storage does not imply submillimetre real-world accuracy.
The release is not a September 2026 survey. Roof-edge approximation, tile
clipping, miniature setbacks and façade interpretation all limit fidelity.

The connecting passage immediately south of the Hachiko garden replaces the
former narrow context tower. A 2026-09-07 review of source feature
`bldg_84560e8a-53da-47bf-a0c8-93a0e6d434b5` matched its full roof outline to the
station–Mark City connecting structure in the
[GSI aerial map](https://maps.gsi.go.jp/#18/35.6588/139.7003/&base=seamlessphoto&ls=seamlessphoto&disp=1).
The [official mural location guide](https://www.asunoshinwa.or.jp/map/) identifies
the passage as the connection between JR and the Keio Inokashira Line inside
Shibuya Mark City, containing Okamoto Taro's *Myth of Tomorrow*. The long windowed
frontage is also visible on the left of
the local `Shibuya-building-look-back.png` reference.
The source ground reservation retains only 37.945 m² of a 1,154.625 m² roof
outline after tile and street exclusions. The runtime
[`mark-city-layout.ts`](../../packages/designqr/src/designs/city/mark-city-layout.ts)
instead retains the 678.1 m² roof section inside the existing 77.6 m tile cut,
including its span above the south road. The original ground reservation owns
three station-side piers and pedestrian exclusions. The concourse has a fixed
11.0 m roof and 4.6 m soffit clearance above pavement. A height lookup found
[second-floor-level access](https://www.shibuyabunka.com/blog.php?id=1120)
but no verified road-to-soffit dimension. These miniature elevations lower the
passage by 1.2 m to better meet the worksite fencing while retaining the open
underpass; they are not surveyed elevations. Repeated inset window
bays, mullions, pale fascia bands and an opaque soffit replace generic tower
floors and advertising. The plain map-cut face closes the cropped structure.
QR morph blocks occupy only its elevated volume; ground movement and ground
morph cells use the support reservation, leaving the underpass open. Source
building snapshots and imported landmark assets remain unchanged.

The station-side gap contains a continuous temporary worksite reaching both the
JR frontage and elevated Mark City passage, leaving the garden
photo approach and JR walking routes open. Its
[`construction-layout.ts`](../../packages/designqr/src/designs/city/construction-layout.ts)
enclosure is an interpretation for this reference-era miniature, not a survey of
current temporary fences. Segmented hoarding, a ribbed sliding gate and two work
notices surround foundation formwork, reinforced concrete starters, scaffold
decks and ladders, a site cabin, stacked materials and a parked compact excavator.
[`construction-geometry.ts`](../../packages/designqr/src/designs/city/construction-geometry.ts)
batches these details into one static mesh below 10,000 triangles. The cabin sits
toward the passage end, with structural work toward JR. Geometry stays
inside the reserved enclosure; waiting crowds and station commuters exclude it.
The worksite persists through QR content edits and follows the city fade, with
24 furniture samples contributing to the QR morph. The machinery remains still.

## Shared architectural behavior

- Roads, sidewalks and islands win whenever building data disagrees. The
  compiler reserves their complete polygons plus 0.45 m, excludes the east-side
  railway corridor, insets each parcel by 0.12 m, and sets the structural body
  a further 0.45 m inward. Roof equipment, mullions and signs fit the remaining
  envelope. The Mark City passage is an explicit elevated exception: only its
  overhead volume spans the road; its supports retain the ground parcel.
  Adjacent ground parcels are disjoint. No road data is rewritten to fit a
  building, and no rectangles are scattered into the Hachiko plaza.
- [`architecture.ts`](../../packages/designqr/src/designs/city/architecture.ts)
  generates contour-following walls, triangulated roofs, floor/window bands,
  original sign anchors and roof equipment. Three.js and Blender consume this
  same geometry generator. QFRONT and MAGNET have fine mullions, rails and
  roof fins. The other buildings and station use runtime geometry within their
  geographic footprints.
- Full QR-content hashing and local module density vary context heights,
  glazing, window-bay widths, sill proportions, floor spacing, roof detail and tenant selections. QFRONT/MAGNET dimensions and all
  geographic footprints stay fixed. Equal-size different values still change
  the city; restoring a value restores it. Landmark geometry stays imported; above-roof equipment and rails use the shared procedural roof generator, replacing their imported faces so equipment placement changes with the content hash above the fixed roof slab, and glazing reflection bands are recolored in place
  from the content hash. MAGNET’s three billboard campaigns also change with the
  content, retaining its name and corner/side arrangement. QFRONT’s main logo panel
  stays intact. No shared template or actor state is mutated.
- Panels follow actual crossing-facing edges with outward normals and upright
  UVs. MAGNET's side and corner posters occupy different edges. Roof boards
  have metal backs and support posts, so orbiting behind those buildings does not
  reveal unsupported one-sided ads. Advertisements use original text/art, not
  host fonts for Japanese lettering or copied campaigns.
- The default City camera starts south of the crossing, facing QFRONT and
  MAGNET; its yaw offsets the shared orbit by −90°. Reset returns to this view.
  This affects the camera only, not road orientation, 3D scale or Tree's view.
  The same smooth camera turn reaches the unchanged square QR endpoint.
- The one configured logo sits on QFRONT's actual angled vision panel. Its
  anchor carries yaw as well as position and bounds; imported metadata is
  validated against it. It remains depth-tested, then turns toward the camera
  while moving to the QR center. No duplicate logo texture enters the GLB.
- QR morph blocks pack into the same concave structural footprints, not their
  enclosing boxes. Full voxel rectangles, pedestrian clearance and rendered
  geometry use polygon containment, including holes and intervening edges.

The station frontage and smaller police box are distinct from the railway
behind them. Their recessed openings, curved balcony, signage, cladding and
advertising structures are reference-informed.
The existing four-car miniature uses one metric basis:
20 m carriage bodies, 20.8 m spacing, 2.95 m width and 4.1 m body height. These are
chosen commuter-train proportions, not a certified rolling-stock replica. The
track deck is interpreted at 7 m **above the pavement**, with an 8 m width and
approximately 5.55 m clear beneath the fascia; these are not measured railway
dimensions. Columns avoid the actual carriageway and the portal-clipped 14-second
loop stays offstage at reset. Palette, traffic phases and Tree-standard QR turn
duration are unchanged.

## Sign lettering and close-up quality

All advertising and transit panels retain their physical source dimensions and
arc-length UVs. [`sign-rendering.ts`](../../packages/designqr/src/designs/city/sign-rendering.ts)
fits Latin lettering by reducing the font size uniformly, never by passing a
maximum width to Canvas `fillText()` or stretching glyphs. Japanese stroke
glyphs remain square; the existing fitted JR/Noto station outlines and raised
letter bodies are unchanged. Thin shop lightboxes reserve a readable caption
row. Subway exit codes occupy their own column beside separate Japanese and
English rows, within the existing fascia.

Texture dimensions follow the physical panel ratio, allowing only integer-pixel
rounding. A minimum size must not be applied to just one axis. Textures have a
2,048-pixel maximum edge and an area budget: ordinary ads use 192 Ki texels
(or enough to retain a 512-pixel long edge for near-square panels), transit signs
256 Ki, subway fascias 320 Ki, and QFRONT's vision/MAGNET's two posters 512 Ki.
This puts detail into long lettering and prominent posters without allocating
square 2K textures. Two-sample anisotropic filtering, capped by Three.js to
device support, improves oblique views with a small bounded sampling cost.

Identical static artwork at identical pixel dimensions shares a texture only
within its owning player. The main configured-logo panel is never shared;
replacement/removal repaints that panel alone. Other signs paint once, with no
uploads on zoom, animation or a QR round trip. Disposal releases shared maps
once through the renderer's existing resource ownership.

During the [whole-city turn](shibuya-city.md#whole-city-morph), the QFRONT vision
and MAGNET corner/side posters lend their maps to six folding half-panels. Keep
their full physical dimensions and left/right UV ranges, with uniform shrinking
while lettering is visible. This layer uses the existing unlit sign shader,
not copied images or an atlas. The configured logo remains its own single plane;
only the private cleared/restored QFRONT background is borrowed. Repainting it
must be visible to both uses, including replacement/removal mid-turn. Borrowers
dispose their own geometry/materials, never the live sign's texture.

The 46-panel reference fixture uses 41 unique maps, approximately **50.6 MiB**
of RGBA8 texels including mipmaps, down from **56.7 MiB**. These estimates exclude
CPU canvases and driver overhead; other QR values can change the artwork and
allocation. No new font/image download, GLB, render target, WebGL context or
scene pass is introduced. Canvas size, DPR caps, zoom limits and canonical
export framing remain unchanged. Finite textures still limit extreme close-up
detail; 1000% inspection is not an unlimited-resolution guarantee.

Run `npm run smoke:shibuya-signs` for native-browser text bounds, all 14 designs
at seven aspect ratios, every generated panel's proportions, resource budgets,
independent players, logo restoration and exact QR restoration. It captures
head-on and oblique views and a magnified MAGNET detail. The sign unit tests
also cover QR-dependent panel sizes and non-overlapping subway text rows.

## Station frontage and subway entrances

The existing clipped station parcel remains authoritative. Its western
elevation faces Hachiko square. [`station-frontage-layout.ts`](../../packages/designqr/src/designs/city/station-frontage-layout.ts)
defines a frame along its longest west edge, beginning at the northern end.
The first 9.2 m belongs to the police box; the adjoining JR front extends south
and ends at the existing diagonal map cut. Neither the parcel nor the road,
sidewalk, railway, Hachiko garden or landmark assets move.

[`station-frontage.ts`](../../packages/designqr/src/designs/city/station-frontage.ts)
models the police box's 8.2 m rectangular metal portal, 7.35 m rear roof,
projecting elliptical balcony, ribbed translucent balustrade, curved LED ticker,
upper windows, glass-block strips, tall cylindrical pipe, recessed ground glazing,
door handles, blinds, map cases, flag and cones. Its signs read KOBAN,
渋谷駅前交番 and SHIBUYA-EKIMAE POLICE BOX. The maps and ticker are static
illustrative details. Glass retains 38% base opacity throughout the shared fade.

The adjoining 10.8 m station body has blue/bay tiled cladding, a real recessed
passage more than 6 m deep, interior columns and signs, a shallow canopy with
triangular suspension rods and a clear roofline. At the user's request, the
large advertisement immediately beneath **JR 渋谷駅** and both rooftop
billboards are removed, including their backs, frames, braces and floodlights.
The upper façade exposes its existing tiled cladding; the smaller street-level
advertisement beside the entrance remains. These are chosen miniature
proportions, not surveyed dimensions. The police and station have different
starting morph heights; both occupy the same clipped source polygon.

Station-bound pedestrians use this actual recessed passage. Its floor, rear
wall and walking destination share the frontage frame and passage dimensions.
Routes enter between the internal columns, continue behind the rear wall for
an indoor stay, then return through another part of the doorway. A smaller
staggered flow walks back across the square and waits for a later crossing
signal. Only the concourse admits commuters inside the station parcel; the
police box, garden and subway stair pavilions remain obstacles. See the
[city motion contract](shibuya-city.md#default-city-animation).

The large station name uses the joined **JR** mark, Mincho-style **渋谷駅** and
serif **shibuya station**. Letter bodies project 18 cm from the tiled front;
matching transparent vector faces keep the outlines crisp. The bridge uses
Gothic-style characters and the reference's wider spacing. No opaque sign
rectangle covers the bridge ribs. A muted railway green derives from blue ×
gold, blended 12% toward bay; all inputs come from the shared morning material roles.

The bridge fascia has horizontal ribs, vertical stiffeners and small fasteners,
with the factual wording **JR 渋 谷 駅** facing the crossing. Sleepers, rails,
edge railings, piers with footings and caps, catenary portals and the existing
train-concealing end roofs share one metric railway frame. The train's existing
scale, route, period and tile clipping are preserved; its elevation follows the
deck relative to the pavement.

[`station-layout.ts`](../../packages/designqr/src/designs/city/station-layout.ts)
owns the entrance placement, stair holes and pedestrian reservation.
Coordinates below are **interpreted east/south metres** from the existing road
origin, before its fixed 45° rotation:

| Exit | East / south | Doorway direction | Width × length |
| --- | --- | --- | --- |
| A6a | −31.8 / −18.3 | West, away from the Center-Gai corner | 3.8 × 7.6 m |
| A6b | −7.75 / −22.25 | East, from the QFRONT forecourt | 3.8 × 7.6 m |
| A7a | 19.7 / −9.9 | Northwest, along the MAGNET corner | 3.6 × 7.2 m |

An affine registration of four zebra-crossing centres in the supplied aerial
gave an approximately 0.5 m fit residual. This checks placement, not survey
accuracy. A7a moves 0.57 m back from that registration to leave the existing
signal clear of its landing. Dimensions and doorway bearings are interpreted
from the photographs. Every complete pavilion fits the surveyed sidewalk and
clears the building parcels; the original road snapshot is unchanged.

Each entrance has silver frames, translucent side and roof glazing, low retaining
walls, a dark stair well, 18 descending treads, sloping handrails with brackets,
under-canopy lighting, a taller rear ventilation cabinet with louvers, corner
bollards and a dotted tactile landing. Stair wells cut both the source pavement
surface and the plinth top, with closed walls and a floor below; they are not
painted dark rectangles. Front and rear fascias carry the exit code, 渋谷駅 /
Shibuya Sta., しぶちか / SHIBUCHIKA, and TY/DT/Z/F identifiers. Japanese place
names use original vector strokes, independent of host fonts. Operator colors
are interpreted through the established City palette, not added to it.

[`station-geometry.ts`](../../packages/designqr/src/designs/city/station-geometry.ts)
batches the three entrances and railway into one opaque geometry (under 16,000
triangles) and one small glass geometry. Glass keeps 28% base opacity, including
during the city fade. The city group owns this layer and its disposal.
It collapses and disappears with the city, leaving the exact QR endpoint clear.
Pedestrian placement excludes the entrances and checks the complete fan of
curved approach lanes. When a pavilion occupies former queue space, the queue
can extend farther into the same sidewalk while preserving commuter spacing.

## Regeneration and attribution

Station and bridge lettering uses fitted outlines from
[Noto CJK](https://github.com/notofonts/noto-cjk): Noto Serif CJK JP Regular
(Adobe, 2017–2024) and Noto Sans CJK JP Medium (Adobe, 2014–2021), under
SIL OFL 1.1. The
[package notice](../../packages/designqr/third-party-licenses/noto-cjk.txt) is the
single maintained copy. The site build emits it at `/licenses/noto-cjk.txt`,
and the development server serves the same source. The JR mark comes from
[JR East's vector asset](https://www.jreast.co.jp/material/img/top/loader_logo.svg),
retrieved via its [Wikimedia copy](https://commons.wikimedia.org/wiki/File:JR_East_logo.svg).
Only geometry is retained; runtime paint comes from the City palette.
[`transit-lettering-data.ts`](../../packages/designqr/src/designs/city/transit-lettering-data.ts)
contains the outlines, with no runtime font or image downloads. Rebuild them
from the referenced local inputs using the pinned font hashes in
[`build-shibuya-lettering.py`](../../scripts/build-shibuya-lettering.py):

```bash
python3 scripts/build-shibuya-lettering.py \
  --serif /path/to/NotoSerifCJKjp-Regular.otf \
  --sans /path/to/NotoSansCJKjp-Medium.otf \
  --jr-logo /path/to/jr-logo.svg
```

This authoring step needs Python FontTools. Ordinary builds use the checked-in
outlines. A station/police-only edit needs no Blender regeneration.

Download the two building files above into a temporary directory, then run:

```bash
uv run --no-project --with shapely==2.1.2 --with pyproj==3.7.1 \
  --python /usr/bin/python3 scripts/build-shibuya-buildings.py \
  --source-dir /path/to/downloaded-gml --preview /tmp/shibuya-building-plan.svg
node scripts/blender/prepare-shibuya-landmarks.mjs
blender --background --python scripts/blender/build-shibuya-assets.py --
npm run test:designqr
npm run build
```

Keep the road snapshot, building snapshot and exported landmark geometry
synchronized. A façade-only edit starts at the Node preparation step; a map
update starts with the road/building compilers. The Blender script rejects stale
building-source hashes. Ordinary product builds need none of these authoring
tools, downloaded GML files or external map services.

Attribution: modified **3D都市モデル（Project PLATEAU）渋谷区（2025年度）**,
published by MLIT's Urban Bureau via Project PLATEAU. Reuse follows the
[PLATEAU site policy](https://www.mlit.go.jp/plateau/site-policy/), PDL 1.0 /
CC BY 4.0-compatible terms. Modifications include projection, clipping, setbacks,
simplification, extrusion, façade interpretation and palette styling. Source-data
ownership remains with its providers. This notice also appears in the package
README and Blender source directory; the code license does not replace it.

## Verification

The layout tests check 40 QR values, source hashes, fixed landmark
dimensions, context variation, complete geometry containment,
disjoint parcels, and unchanged road data. Asset tests validate the version-2
inventory and source hashes, imported contour bounds, palette, anchors and
resource ownership. Morph tests contain every starting voxel rectangle inside
the source building and preserve every exact QR destination.

Run the [City validation workflow](shibuya-city.md#validation), including browser checks, installed-package loading/failure tests, logo
replacement/removal, QR decoding and exact colors. Inspect the initial view,
opposite station-facing orbit and both endpoints at 1440×900, 390×844 and
320×568. All geographic changes require review of the plan preview as well as
the perspective render; appearance alone cannot validate street clearance.

For transit changes also run `npm run smoke:shibuya-station`. It captures the
station-facing orbit, façade, police box and balcony, station passage, rear
roof, rail bridge, each entrance and a stair close-up. It checks both glass
opacities and exact QR restoration after returning from 3D.
The station unit tests raycast through both ground layers to verify actual descending
stairs, enforce the complete entrance and pier clearance, and sample both
directions of the pedestrian cycle. Rays also verify the open station passage,
recessed police doors, curved balcony and physical depth of the JR letters.

The station compound contains 10,335 opaque triangles and 80 balcony-glass
triangles. Its highest point is the 10.8 m station roof. The façade below
**JR 渋谷駅** exposes tiled cladding, and the roofline is clear. Static transit
geometry has 13,092 opaque triangles and 108 glass triangles.
