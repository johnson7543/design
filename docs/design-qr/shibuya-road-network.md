# Shibuya road network

[Back to the Design QR documentation index](README.md)

Status: active. The editor, React player and iframe
players use the same road foundation. Theme and QR content must
never select a different street layout or independently stretch an approach.

## Research and source choice

The supplied `plan/model/Shibuya-road.png`, `Shibuya-road-1.png`,
`Shibuya-road-brid-eye-view.png`, and
`Shibuya_1080p.mp4` establish the intended asymmetric five-arm junction, four
perimeter zebra crossings, long diagonal crossing, rounded corners, unequal
approaches, and station-side orientation. They are perspective reference views,
not dimensioned survey plans. No reference image, video frame, watermark, or
third-party 3D model is copied into the player.
The narrow northwest branch leads into [Center-Gai](https://www.gotokyo.org/en/spot/88/index.html);
it is not the Inokashira railway or a fifth equally sized arterial road.

The source footprint comes from **3D都市モデル（Project PLATEAU）渋谷区
（2025年度）**, available from the [official dataset](https://www.geospatial.jp/ckan/dataset/plateau-13113-shibuya-ku-2025)
and [MLIT CityGML delivery service](https://docs.plateauview.mlit.go.jp/datasets/citygml/).
The [CityGML file-list API](https://docs.plateauview.mlit.go.jp/api/rest/operations/datacatalogcitygmlconditions/)
locates the two road meshes intersecting the crossing. Use city code `13113`;
other municipalities can publish features in the same mesh identifier.

Source files:

- [53393595_tran_6697_op.gml](https://assets.cms.plateau.reearth.io/assets/fd/21cbf7-ee57-42bb-a445-ea9c46f8c1b3/13113_shibuya-ku_pref_2025_citygml_1_op/udx/tran/53393595_tran_6697_op.gml)
- [53393596_tran_6697_op.gml](https://assets.cms.plateau.reearth.io/assets/fd/21cbf7-ee57-42bb-a445-ea9c46f8c1b3/13113_shibuya-ku_pref_2025_citygml_1_op/udx/tran/53393596_tran_6697_op.gml)

For each `tran:Road`, choose its highest available detailed surface, LOD3 or
LOD2, exactly once. Interpret functions `1000`/`1020` as carriageway/intersection,
`2000` as sidewalk, and `3000` auxiliary areas separately. The main intersection,
`tran_f2a5948b-23c4-4932-83a2-a5c3591bf06c`, has LOD3 surfaces. The clipped tile
contains 26 source road records. Original IDs, selected LOD, source-scale code,
and both input SHA-256 checksums are embedded in the generated data.
The modeled approaches add pavement inside that road reservation to match
the reference proportions. The original snapshot remains the source for
building reservations; `surfaceLayout` records the compiled road, sidewalk and
land boundaries, clipped crossing endpoints and lane-centered traffic paths
consumed by rendering and occupancy queries.
Codes follow the release's [official code lists](https://assets.cms.plateau.reearth.io/assets/97/1a5000-3023-4888-81de-05cadb2e239e/13113_shibuya-ku_pref_2025_citygml_1_op_codelists.zip).

[GSI's official vector map](https://github.com/gsi-cyberjapan/optimal_bvmap)
was an independent check on road axes and station orientation. It is not the
runtime footprint source: its cartographic linework provides less useful
carriageway/sidewalk separation here. [Shibuya's road-ledger service](https://www.city.shibuya.tokyo.jp/kankyo/doro-kasen/doro-shinsei/dourodaicho_00001.html)
was also reviewed. A municipal future street proposal is not evidence of an
already-built road and is not substituted for the current released geometry.

## Coordinate and accuracy contract

- Source CityGML uses `EPSG:6697`, with triples in **latitude, longitude,
  elevation** order. Transform its JGD2011 horizontal coordinates into Japan
  Plane Rectangular Zone IX (`EPSG:6677`) before measuring; do not calculate
  lengths directly from longitude/latitude degrees or Web Mercator pixels.
- Origin: longitude `139.70055`, latitude `35.6595`. Form local east/south
  metre coordinates, then apply one rigid 45° rotation. Geographic north is
  toward positive X / negative Z in the unprojected plan; the station is on
  the geographic east side. Camera orbit does not change the survey geometry.
- The tile is 160 m × 160 m. Exactly 160 m maps to one City unit, in both axes.
  The road surface ends at ±79.2 m to leave the existing miniature plinth rim.
  The player still scales that one-unit tile by `gridSize * BLOCK_SIZE`, so
  QR density and switching Tree/City do not require host-specific corrections.
- Preserve polygon rings and holes. Close only seams under 5 cm between
  adjacent source surfaces (2.5 cm buffer out/in); do not replace curved corners
  with guessed fillets or simplify them to axis-aligned blocks. Generated
  footprint coordinates retain millimetre numeric resolution after projection.
- Numeric resolution is **not survey accuracy**. Selected source-scale code
  `1` denotes 1:2500 in the dataset code list. The released model is not a live
  September 2026 as-built survey; publication year is not a measurement date.
  This miniature must not be described as navigation, cadastral, or engineering
  data. Grading/elevation is flattened; a uniform 15 cm curb is modeled, not
  inferred as a surveyed height at every vertex.

## Crossing and marking measurements

LOD3.0 road surfaces do not constitute a lane/paint survey. Crossing paint was
interpreted from [GSI seamless aerial imagery](https://maps.gsi.go.jp/development/ichiran.html),
using z18 tiles X `232797–232799`, Y `103245–103247`. The source is a stitched
aerial reference, not a promised current paint inventory. The PLATEAU higher-
zoom ortho service did not cover the requested tiles at retrieval.

The compiler records each traced quadrilateral in georeferenced image pixels,
converts it to local metres, and intersects its axis with the carriageway
boundary. Runtime endpoints follow the resized curbs while retaining the
traced crossing orientation and painted width:

| Crossing | Source curb span | Modeled curb span | Interpreted painted width |
| --- | --- | --- | --- |
| Jingu-dori approach | ≈15.2 m | ≈14.9 m | ≈7.2 m |
| Dogenzaka approach | ≈17.4 m | ≈16.3 m | ≈7.4 m |
| Hachiko / south approach | ≈28.9 m | ≈23.0 m | ≈7.0 m |
| Station-east approach | ≈16.6 m | ≈16.6 m | ≈7.2 m |
| Diagonal scramble | ≈32.2 m | ≈32.2 m | ≈8.4 m |

These are reproducible model measurements, not independent survey-certified
crosswalk dimensions. Image interpretation and source alignment can introduce
metre-scale uncertainty. Tests retain the computed values to detect accidental
stretching; extra decimals in test fixtures do not claim extra real-world accuracy.

The four vehicle approaches share a consistent lane scale. Width includes
curb clearance and any separate bay or hatch area; rounded junction mouths and
transverse side streets can be wider than the through corridor.

| Approach | Maintained modeled carriageway |
| --- | --- |
| Jingu | Approximately 14.4–15 m along the source curve, two lanes each way |
| Dogenzaka | Approximately 14.3–15 m through the curve, two lanes each way |
| Hachiko / south | Four 3.5 m through lanes; approximately 23.1 m at the approach, tapering to a 17.9 m corridor beyond the hatched area |
| Station-east | 14 m beneath the viaduct, three incoming lanes and one outgoing lane |
| Center-Gai | Approximately 4–4.7 m, retaining the narrow unmarked shopping entrance |

Hachiko's total includes a 3 m stopping strip, up to 5.2 m of hatched taper and
0.9 m combined curb clearance. Corridor widths are fitted in parallel sections;
perpendicular measurements vary slightly through bends. The compiler extends
adjacent pavement into excess asphalt, protects other crossing mouths and side
streets, and rounds new projecting curb corners. The shared surface drives
paint clipping, curb meshes, fixture clearance and pedestrian waiting positions.

Zebras use 0.45 m paint / 0.45 m gaps, clipped to both the traced band and the
carriageway. Lane dividers, arrows, prohibition symbols, stop bars, coral edge bands, and
gold curb accents are reference-informed reconstruction. Hachiko uses the requested
two-lane approach, curb narrowing and opposite stopping bay. Their lane counts and
paint positions are not claimed to be authoritative LOD3.1 data. Ground colors
come from [the morning material roles](color-palettes.md#shibuya-city--blue-morning):
soft mist-white paint, muted blue lane surfaces and restrained curb accents.
Reference coral/gold names describe the source markings; runtime colors are
mapped separately. A soft per-pixel reflection lights the crossing without
changing the surveyed surface or markings. Carriageway and paint share a depth
offset to prevent interference from the underlying plinth. Pavement uses a
separate material group so low garden and sidewalk details retain their depth.

The approach-paint revision uses the supplied bird's-eye / street-level road
references and the [National Police Agency's marking-reference index](https://www.npa.go.jp/bureau/traffic/seibi2/kisei/mokuteki/mokuteki.html)
to distinguish elongated directional arrows, incoming-only stop bars, solid
near-junction guidance, outer broken dividers and outlined diagonal hatch
islands. The latest bird's-eye reference is matched by junction topology with
**Center-Gai on the right**, never by the widest-looking arm or by mirroring
the survey. The inspection camera alone rotates to show that reference view.

| Reference position | Runtime approach | Maintained paint treatment |
| --- | --- | --- |
| Upper left | Hachiko / south | Two incoming and two outgoing through lanes; smooth incoming curb narrowing with contained diagonal hatching before the projecting sidewalk, and an opposite stopping bay with two spaces and a dashed access edge; continuous median, one dashed outgoing divider, one incoming divider solid near the stop bar then dashed farther away; incoming curb lane has a straight-plus-left arrow, inner lane has a straight-only arrow |
| Upper right | Dogenzaka | Two lanes each way, long continuous curved guides; no coral lane, hatch, arrow, numeric legend or stop bar |
| Lower left | Station-east | Compact 14 m carriageway under the railway, with a widened north-side sidewalk and both side streets open; three equally spaced incoming lanes and one outgoing lane, with smooth guides continuing beneath and beyond the railway; left-only arrow in the long coral curb lane, two inbound no-U-turn markings in the uncolored lanes, one reversed outbound no-U-turn marking and its small `8–20` label; a separate short opposite-curb coral patch |
| Lower right | Jingu | Two lanes each way and paired coral curb lanes; straight-plus-left arrow in the incoming coral lane, two spaced straight arrows in its neighboring lane; one outbound inner-lane no-U-turn marking; continuous median / inbound guide and a broken divider beside the outbound coral lane; inner-divider nose widening into a tapered hatch at the outer end of the incoming coral lane |

These are **interpreted paint plans**. The Hachiko lane-count hint follows its
four through lanes; source axis points and legal lane permissions are not changed.
The earlier generic generator assigned
the plain curve to Hachiko and repeated broad coral strips; do not restore that
screen-orientation mistake. Each arm's axis points outward. Near-junction lane
splits can be asymmetric around that axis. Vehicles follow the inner lanes of
the fitted Jingu–Hachiko corridor. Three 0.45 m stop bars span
incoming lanes behind their zebras. The plain curve has no stop bar in the
reference. Closed hatch envelopes exclude lane guides, arrows and legends,
and every diagonal stroke is clipped inside its own island. Curbs on opposite
sides independently stop their colored surfaces at side-street openings.

Hachiko has **two 3.5 m through lanes in each direction**, with a
stable centre divider. The incoming curb edge eases inward over 32 m, reserving
up to 5.2 m beside the projecting sidewalk as a contained hatched taper. Two
clear lanes reach the shortened stop bar. The curb-side lane has a combined
straight-and-left arrow; the inner lane has a straight-only arrow. Both follow
their lane tangents. The opposite curb reserves a 3 m strip outside
the two outgoing lanes. Its stopping bay runs from 8–30 m behind the crossing
stop-line reference, with two outlined spaces, a separating stroke and a dashed
access edge. The taper and bay use the ordinary mist-white road paint.

Parallel sections measure the actual curb bounds with a 0.45 m inset, then
conservative smoothing keeps the guides flowing through the road bend. The
corridor bridges side-street mouths, and missing curb observations at the tile
cut are extrapolated before final clipping so lane widths do not collapse at
the edge. The modeled curbs follow the sidewalk projection, the crossing
endpoints meet those curbs, and traffic follows the resized inner lanes.
The source snapshot and building reservations retain their coordinates.
These dimensions describe the miniature layout rather than a
verified inventory of current road markings or stopping permissions.

The east approach beneath the JR viaduct follows the
local `Shibuya-3D-qr-east-road.png` bridge-approach reference. Its physical
carriageway is **14 m** wide through the underpass. The north-side sidewalk
extends into the excess asphalt beside the outgoing lane, reducing the source
width there from roughly 20 m. A 12 m transition behind the stop bar joins the
existing crossing corner. Both underpass curbs use a conservative smooth inward
profile that continues to the tile edge, removing the former short-end step
behind the railway. The two transverse access roads retain straight 4.8 m and
4.2 m corridors through the pavement extension, with rounded junction mouths;
their reserved paths are excluded from the sidewalk sweep. The access-road
refinement cannot intrude into the 14 m through corridor. These are authored miniature proportions, not survey
corrections. The generated pavement extensions change the actual road/land
boundary, curb mesh and fixture clearance together. The east crossing band,
building reservations and railway alignment retain their coordinates.

The west and south local alleys have their own fitted corridors, independent
of the east-underpass access roads. The west alley follows a 3.8 m axis through
its approach; its short driveway apron crosses the source sidewalk to join the
west main road. `surfaceLayout.alleyAprons` records this explicit conversion from
pavement to road. The south alley retains a 4.4 m corridor through the widened
sidewalk, with excess irregular asphalt trimmed at the approach. Both fittings
preserve source building reservations and share rendering/occupancy boundaries.

The incoming lanes occupy 64% of the measured corridor in three equal widths;
the outgoing lane occupies the remaining 36%. Parallel curb sections establish
the initial approach width, carried along the uninterrupted station-side curb
past the two side-road mouths. Inward curb changes still constrain the lanes.
The median and both incoming dividers continue through the underpass and toward
the tile boundary. A side-road opening never becomes extra width for these lanes.
Each arrow, no-U-turn symbol and hours label uses a rigid local lane tangent so
the glyph itself does not bend with the roadway. The outgoing prohibition sits
on the approach before the bridge fascia, with its × and hours label closer to
the crossing. The long curb lane and short opposite patch retain the shared
morning material roles. The 10 m stopping patch fills the shoulder between the
actual curb and the outbound white edge line, tapering with the available
space beside the sidewalk. Its color stays outside the through lane; the
smoothed lane corridor must not serve as the patch's outer boundary.

The enlarged `Shibuya-road-1.png` resolves the large symbols as **転回禁止 /
禁止迴轉**, not `40` numerals. The [MLIT/NILIM marking catalogue, page 35](https://www.nilim.go.jp/lab/bcg/siryou/tnn/tnn0848pdf/ks084812.pdf#page=35)
identifies road marking 101; the supplied model determines its placement here.
Original vector geometry uses an open right-hand hairpin with a returning
arrowhead and a separate × behind it. Both elements rotate 180° together for
outbound traffic without mirroring the turn. The four markings have 8 m-long
hairpins, 5 m-long × marks, and a 2 m clear gap; these are miniature reference
proportions, not certified paint dimensions. Jingu has only one, in its outbound
inner lane; station-east has two inbound and one outbound. There is no repeated
speed-limit text or prohibition on either colored lane. The only numeric label
is station-east's `8–20`, before its outbound ×, with unmirrored characters.
As with the other reference paint, these are **not assertions of current
restrictions or hours**. Ivory retains the supplied model's marking treatment;
the official catalogue's regulatory yellow does not introduce a new City color.
No font, texture, image, or extra render batch is loaded.

Jingu's stop bar remains 4 m behind its interpreted zebra edge; station-east's
bar is approximately 4 m behind its slanted zebra. The coral lane surfaces
extend to the zebra independently of those
stop positions. Station-east's inbound dividers start at the bar; Jingu's guides
continue toward the crossing, with long broken strokes on the outbound coral
boundary. These offsets remain paint interpretations within the compiled
carriageway.

Center-Gai
carries no vehicle arrows, stop bar or lane divider. One approximately 0.3 m
gold accent follows selected native curb corners and approach segments on the
pavement side. It replaces the old straight crossing-warning strips rather
than stacking two incompatible gold patterns; subway tactile landings remain
separate. Neither the gold paint nor the colored lane surfaces redefine a curb.
These reconstructions do **not** certify current lane permissions or dimensions.
Inferred paint drops redundant vertices within an 8 mm authoring tolerance,
then clips against the exact compiled surface; the road and crossing data are
never simplified by this paint-only step.

## Street fixtures and Center-Gai

Reference research distinguishes permanent structures from seasonal advertising:

- The [Center-Gai association's entrance camera page](https://center-gai.jp/live-camera/)
  identifies the small branch as its shopping entrance, separately from Inokashira.
  Its [official history](https://center-gai.jp/about/data/) records the entrance
  arch and street lighting. These establish identity, not surveyed pole coordinates.
- A [January 2026 entrance photograph by 交通アキ②](https://commons.wikimedia.org/wiki/File:Shibuya_Center_Street_Front.jpg)
  shows the paired curved metal main poles, ring collars and vertical name plates.
  The model reproduces those permanent forms with original geometry and vector
  渋谷センター街 lettering. It deliberately omits the temporary campaign canopy,
  flags and advertisements. The photograph is a research reference, not an app asset.
- The supplied traffic-light close-up establishes curved overhanging masts,
  horizontal vehicle heads, separate lower pedestrian heads, hooded lenses,
  regulatory plates, lanterns and low pedestrian rails. Manufacturer references
  for [vehicle heads](https://www.koito-ind.co.jp/product/traffic/signal.html) and
  [pedestrian heads](https://www.koito-ind.co.jp/product/traffic/pedestrian_signal.html)
  inform construction; they do not establish the installed Shibuya model.
- The supplied `Shibuya-road-traffic-light-pair-1.png` through
  `Shibuya-road-traffic-light-pair-4.png` show opposing-curb mast pairs on the
  three straight vehicle approaches and the broad curved approach. These
  establish the paired arrangement, not additional surveyed pole coordinates.

[`street-layout.ts`](../../packages/designqr/src/designs/city/street-layout.ts)
anchors ten crossing-facing pedestrian heads and eight overhead vehicle heads
to the existing ten valid pavement positions. Jingu, Dogenzaka, Hachiko/south
and station-east each have two vehicle masts, one on each curb. Their arms
mirror inward over their own half of the road; their faces look toward the
opposing traffic directions, with blue/go on each driver's left, amber
centrally and coral/stop on the right. The diagonal's two posts remain
pedestrian-only, and Center-Gai's shopping entrance has no vehicle signals.
Modeled vehicle lenses are 0.30 m in diameter; head centers are
5.65 m above pavement under 6.15 m masts with a 3.8 m reach. Pedestrian heads are
centered at 2.85 m. Center-Gai's 6.4 m paired posts leave approximately 5.17 m
clear between their shafts. These dimensions are proportion estimates, not
measurements extracted from the PLATEAU road survey. Uprights and guardrails
are validated against full pavement clearance; no pole base occupies asphalt.

[`street-furniture.ts`](../../packages/designqr/src/designs/city/street-furniture.ts)
constructs one merged static mesh and one small signal-aspect mesh. It uses no
textures, fonts, external requests, shadows or dynamic lights. Compared with
the former box signals this adds one static draw call, without changing DPR,
buffer dimensions, or the scene-pass count. Signal colors upload only when the
illustrative 20-second phase changes: walk 0–10 s, all-red clearance 10–12 s,
Jingu/Hachiko traffic 12–19 s, amber 19–20 s. The inactive side approaches remain
red, rather than showing conflicting greens. This is not real signal timing.
The city group/material owns street-fixture visibility, reduced motion and QR fading.

## Shared runtime behavior

- [`road-data.ts`](../../packages/designqr/src/designs/city/road-data.ts) is an
  offline-generated metric snapshot. [`road-network.ts`](../../packages/designqr/src/designs/city/road-network.ts)
  provides the sole conversion, polygon queries, crossings, traffic paths,
  station basis, and valid signal positions. There are no runtime map requests,
  geospatial dependencies or externally hosted textures.
- [`road-mesh.ts`](../../packages/designqr/src/designs/city/road-mesh.ts) batches
  carriageway, raised land, native curved curb faces, and clipped markings in
  one vertex-colored geometry. The mesh participates in the existing fade and disposal lifecycle.
- The [building compiler](shibuya-architecture.md) now fits fifteen source-aligned
  masses outside full road, sidewalk, island and railway reservations. It reads
  this road snapshot without modifying it. The thirteen prototype rectangles
  retained in `road-data.ts` are historical and no longer select runtime buildings.
  Complete envelopes include equipment, windows and signs. Polygon tests reject
  concave incursions even if all four rectangle corners lie on land. QR content
  controls context heights and details, never the source-aligned street edge.
- The 180 commuters use the five measured crossing axes plus an unmarked
  counter-diagonal across the center during the pedestrian phase. The diagonal
  joins the Dogenzaka-side and station-east-side corners without adding paint
  or changing the road snapshot. Curved paths and local sidesteps mix opposing
  flows inside their corridors, with the two diagonals carrying more people.
  Waiting positions and
  their approaches must clear actual carriageways, buildings, and trees; all
  waiting positions share one spacing check. Their feet traverse the curb ramp.
  Nominal 1.75 m people and 2.5 m bus width use the same metric conversion.
- Selected arrivals on the station side continue across Hachiko square into
  the JR concourse. Returning walkers emerge gradually and wait on the sidewalk
  for a later pedestrian phase. This longer station journey stays within the
  existing crowd and takes 80 seconds. Only its off-road plaza legs continue
  during vehicle traffic; the shared road-clearance deadline remains unchanged.
- Vehicles follow the inner 3.5 m lanes with curved left-side paths, arc-length queue gaps, heading
  and wheel travel. Braking and acceleration ease smoothly; individual reactions
  release each queue in sequence and following headways retain body clearance.
  World-space planes clip them at the tile edges. Signals and moving actors
  consume the phase boundaries in the shared traffic clock.
  The 20-second activity cycle remains illustrative/compressed time, not a
  recreation of real traffic signals or legal movement permissions.
- The station structure and four-car metro use a common east-side rotated
  basis; supporting columns cannot occupy carriageways. The station is an
  illustrative viaduct, not surveyed railway engineering. Two additional portal
  planes clip imported train details; the 14-second loop resets offstage.
  The track is 7 m above pavement. The three Shibuchika stair wells cut the
  rendered land and plinth top without changing the source road snapshot.
  Entrance reservations and the fan of commuter approach lanes follow the
  [station contract](shibuya-architecture.md#station-frontage-and-subway-entrances).
- The `5 / 9` second 1× turn, camera-scale baseline, logo behavior, QR encoder,
  exact scan colors, transparency, and exports remain unchanged. No road paint
  or street geometry survives on the completed scan face.

## Regeneration and attribution

Download the two linked GML files into a temporary directory. Do not commit the
full CityGML files or aerial tiles. From the repository root:

```bash
uv run --no-project --with shapely==2.1.2 --with pyproj==3.7.1 \
  --python /usr/bin/python3 scripts/build-shibuya-road.py \
  --source-dir /path/to/downloaded-gml \
  --preview /tmp/shibuya-road-plan.svg
npm run test:designqr
npm run typecheck:designqr
npm run build
```

The authoring script validates land reservations and regenerates the checked-in
TypeScript snapshot; ordinary web/package builds do not need Python, Blender,
raw map files, or network access. Inspect the optional plan preview after a
source update, compare checksums and measurements, then run the browser gates.

To compile the fitted pavement, crossings, traffic paths and paint from the
checked-in source snapshot without downloading the source files:

```bash
uv run --no-project --with shapely==2.1.2 --with pyproj==3.7.1 \
  --python /usr/bin/python3 scripts/build-shibuya-road.py \
  --from-snapshot --preview /tmp/shibuya-road-paint.svg
npm run smoke:shibuya-streets
```

Attribution: modified **3D都市モデル（Project PLATEAU）渋谷区（2025年度）**,
published by MLIT's Urban Bureau via Project PLATEAU; source-data ownership
remains with the respective data providers. The [PLATEAU site policy](https://www.mlit.go.jp/plateau/site-policy/)
permits reuse under PDL 1.0 / CC BY 4.0-compatible terms. Modifications include
projection, rigid rotation, clipping, seam repair, flattening, triangulation,
reference-directed pavement extensions, and palette styling. Marking interpretation additionally uses GSI aerial
imagery under [GSI's content-use terms](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html).
The package README carries the data attribution into distributed tarballs;
the application code licence does not erase these source-data notices.

## Verification

`city-road.test.ts` checks source IDs/CRS, metric isometry, unequal crossing
dimensions, concave containment, clear signal locations, palette-only vertices,
all five approach widths, the south taper, open side streets, consistent road/pavement
occupancy and the rendered road geometry. Layout, motion, and asset tests cover
QR-derived full envelopes, both fleets' sampled footprints, waiting separation,
heading, scaled wheel travel, portal clipping, and unchanged QR morph targets.
`city-streets.test.ts` additionally checks paint clipping, per-approach reference
assignments, the uncolored curve, Hachiko's two through lanes each way, the
incoming taper's widening toward the curb projection, the opposite stopping
bay's clear spaces and painted access edge, smooth divider curvature,
continuous paint through the sidewalk bend, lane width at the map
cut, equal incoming lane widths and uninterrupted paint through the east
underpass, side-road clearance, short curb patches, asymmetric guide counts,
all four no-U-turn arrows / × marks, their handedness and lane-facing rotation,
open hooks and clear inter-symbol gaps, the hours label, reference-specific
arrows / broken dividers, nonempty contained hatching and the unmarked shopping
entrance, all four opposing-curb signal pairs and their lane-facing orientation,
metric fixtures / pavement containment, palette-derived shading, phase
exclusivity, phase-only buffer updates and material-owned street batches.
`smoke:shibuya-streets` captures source-oriented and reference-aligned bird's-eye
views, each arm's paint close-up, the crossing, entrance, each signal pair and
individual heads, checking four draws for the complete isolated road/furniture/lights
assembly with fewer than 35,000 triangles, including the guardrails on the
extended sidewalk. It is not a device FPS benchmark.

Use `npm run smoke:designqr-city` for the complete player;
`npm run smoke:designqr-city-assets` checks both views at 1440×900, 390×844,
and 320×568. Motion probes cover separate crossing and east-side station regions.
`npm run smoke:shibuya-station` includes a view from the crossing toward the
bridge showing the complete approach markings, plus the QR return check.
Also run the installed-package, production, style/color, and documentation gates
listed in [the City validation workflow](shibuya-city.md#validation).

The isolated road/furniture/lights assembly uses **33,469 triangles** and
**four draw calls**: carriageway, pavement, static fixtures and signal aspects.
The morning reflection adds the separate carriageway material group; it adds
no geometry, runtime dependency or postprocessing pass.
Regeneration preserves the source snapshot, building reservations and camera
basis, then compiles the reference-directed pavement, crossings, traffic paths
and paint. Review the plan and per-arm captures after changing surfaces, paint or
street fixtures.
