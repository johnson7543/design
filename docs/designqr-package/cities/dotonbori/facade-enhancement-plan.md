# Dōtonbori façade completion

Status: Façade, edge-fragment and riverbank-sign passes implemented 2026-09-20.<br>
Scope: Focused building selection, perimeter sections, reference-wall margins, roof finishes and supported street/corner/riverbank façades

[Back to Dōtonbori](README.md) · [Geometry audit](references/facade-audit.json) ·
[Inspected references](references/facade-reference.json)

## Implemented scope

The bridge-centered 144 m square retains 58 closed source buildings, the diagonal mapped river,
registered bridge and Donki’s north-bank attraction. All 23 perimeter cut faces
have opaque mineral finishes and clipped edge shading. Reference façades have
complete structural bases and about 472 m² of finished margins. B046 retains its
registered street elevation and B034 its closed ribs across the east setback.
The original research master and bridge geometry remain unchanged.

The focused asset omits eight small remnants: B002, B013, B057, B059, B086,
B091, B105 and B115. Each retains less than 40 m² and half its source footprint;
their total is 82.255 m². The compact Donki placement also omits six displaced
context blocks: B026/B027/B029/B030/B032/B033. All eight landmark envelopes
remain complete; Donki's recorded westward translation preserves its shape. Complete small
buildings and substantial partial blocks remain. These presentation omissions
precede detail and QR generation. Audit labels determine variation indices before
selection, while the full ground, river, street outlines and QR targets remain.

| Surface | Implemented treatment | Evidence limit |
| --- | --- | --- |
| All perimeter cuts, including substantial clipped source blocks | Recolour existing cap vertices with existing building/stone roles, restrained section shading and narrow contour-clipped edges | Model sections through interiors; no invented doors, advertising or window grids |
| Registered-wall margins, including B031 and B034 | Finish the complement of all reserved rectangles once per wall; preserve corners, roof contours and setbacks | Structural surfaces, not evidence of additional tenants or openings |
| B046-south / かに道楽 本店 | Entrance reveal, tiled eave, pale folded panels, inset window bands, dark corner framing, warm soffit/lamps and named fascia | Owner photo directs features; proportions are interpreted, not measured |
| B034 / 戎橋ビル | Closed ribs on east/south fronts, a common upper/lower alignment and glass/ribs on the actual sloped east source triangles | Source geometry approximates the photographed curved façade; no new north/west rear-elevation claim |
| Remaining source walls | Retain existing illustrative QR-driven architecture and coherent host identities | No additional pipes, service cores, doors or merchant names assigned without a matched reference |
| Flat and sloping roofs across all 58 hosts | Narrow panel joints and edge flashing follow the original triangular surfaces, including Donki's broad rear roof; existing rooftop equipment remains supported | QR-derived structural finish, not measured roof construction or a new photographic claim |

The low opening exposed a gap in the detail pass: its wall fitter handled
vertical planes and its equipment fitter required flat support, leaving steep
rear roofs without articulation. Roof finishes now retain those source planes
and their existing paint. Joints share a building-aligned rhythm across source
triangles; flashing follows exposed contours and actual roof creases. The
triangulation diagonal is not a construction seam. Keep B034's photographed
east glazing/ribs under their existing owner, and leave tile-cut caps as model
sections. These roof details retain their host through both QR directions and
vary deterministically with content.

Compare the [unfinished rear roof](../../../../assets/design-qr/dotonbori/reviews/roof-detail-before.png)
with the [completed roof finish](../../../../assets/design-qr/dotonbori/reviews/roof-detail-after.png)
from the same 30° opening angle. These are runtime captures, not photographic
evidence of the real roof materials.

B046-south follows the source wall's east/north outward normal
`(-0.19226348, -0.98134334)`, about 11° from due south. The wall fit is 14.9 m
wide and retains its 1.26 m source floor. Its entrance/eave occupies a 3.65 m band
with at most 0.81 m relief. The photograph directs an interpreted 12.6 m lower
elevation; the unphotographed upper area remains structural. The street walking
datum is unresolved, so the pictured entrance reveal adds no functional access,
invented stairs or pedestrian route. The exterior crab now has a separate
registered reservation between the eave and first window band, with up to 1.6 m
projection. Owner photographs and inspected historical footage direct its
closed geometry, slow folded-leg sweeps and opening pincers; see
[the Kani record](references/kani-sign-reference.json). North/west restaurant windows
retain their identity, and logo uploads still occupy only the north Asahi sign.

The source B034 east wall steps from the lower 30.83 m envelope to the upper
37.11 m wall. Vertical rectangles alone left that interval unfinished. The new
glazing and solid rib relief follow the original sloped triangles rather than
bridging the gap with an unsupported rectangular wall.

## Geometry audit

Run `node --experimental-strip-types scripts/audit-dotonbori-facades.mjs`.
The [audit script](../../../../scripts/audit-dotonbori-facades.mjs) loads the
actual focused GLB and current runtime geometry at
`https://example.com/dotonbori` (29 × 29 modules), verifies the GLB manifest
hash, and records every building's section and source-wall treatment.

| Finding | Current result |
| --- | --- |
| Selected source buildings | 58; all closed in the matching focused manifest |
| Omitted small edge remnants | 8, retaining 82.255 m² in total; selection recorded in the focus layout |
| Selected buildings cut by the square | 21, with 23 authored cut faces |
| Total boundary surface area | About 4,241 m² at the saved QR-generated foreground heights; geometric area, not a site measurement |
| Selected parcels retaining under 10% of the original footprint | None in the compact composition |
| Reference façade registrations | 14 across eight hosts, including B037-east above its existing 1F; B049 adds one ground-floor-only registration |
| Extracted exterior wall groups | 473; no complete photographic inventory |
| Finished reference-wall margins | About 472 m², including the completed B037 bridge-side wall |
| Roof surfaces receiving panel/edge detail | All 58 hosts, about 9,788 m² of existing roof surface; no source shape or height change |

## Riverbank sign review

Six full-scene canal views span both banks, with isolated checks of the bridge-area
registered elevations and the east Donki host. The regular sign inventory now has 21 quads; Glico and
the Kani street fascia have separate owners. Seven quads were missing:

| Front | Completed sign bays | Reference |
| --- | --- | --- |
| B037 north | Pip clock above the refitted Snow Brand/dairy stack; blue slogan below | S14 south-bank photo and the Pip owner's tower/ceremony photos |
| B037 east | Upper Pip sign and lower FANCL panel; existing 1F retained | S14 east approach |
| B039 north | Yellow 大阪 花ラング advert between the service/window bands | S14 south-bank photo; product identity corroborated by its owner |
| B034 south | Salonpas campaign and lower H&M fashion panels | S14 east approach; east H&M also receives the fashion-panel treatment |
| B040/B041/B046/B031 and remaining bank context | Existing Glico, Estem/Kaigen/CHINTAI, Asahi/logo and QR screen artwork checked; windows and structural margins retained | Registered references and six full-context canal views |

Original drawings occupy a retained 2048×1536 atlas with per-cell clipping and
the private Asahi logo backing. Every fitted panel has source-building ownership;
seven restored groups retain 48 fragments inside the existing transform budget.
Cabinet edges are separated and sign faces clear glazing and ribs. Unregistered
rear details and source-cut caps remain outside photographic claims. See
[S20 and its evidence limits](sources.md#s20--riverbank-sign-completion).

Complete source envelopes can extend beyond the square. The focused model caps
those intersections; restoring every entire source building would change the
composition and QR correspondence. The original master and extended source
solids remain available for inspection. See [the compact Donki placement](ebisu-tower.md).

## Inspected references

The [reference record](references/facade-reference.json) retains exact image
URLs, byte counts, hashes, dimensions, observations and uncertainty. Photographs
were downloaded outside the repository and visually inspected; none is bundled
as a texture. Their capture dates are unknown.

| Source | Supported use | Limit |
| --- | --- | --- |
| F1: [Kani Doraku owner's street photograph](https://douraku.co.jp/lacne/photo/upload/OYRbCZyjstBd8H4l.jpg), from the [main-store gallery](https://douraku.co.jp/area/shop/photo/?shop_id=1) | Street entrance/eave, vertical panels, window bands and dark corner framing | No complete elevations, measured relief, street datum or current banner date |
| F2: [Osaka Tourism Bureau east approach](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_03.webp), in its [night-view feature](https://discover.osaka-info.jp/jp/articles/osaka-night-view) | B034's ribbed corner, recessed glazing and bent upper façade | Does not establish its north/west rear surfaces; article publication was 2026-01-07 |
| F3: [Tourism Bureau south-bank photograph](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_01.webp) | Distinct sign stacks, narrow façade strips, lower windows and localized night lighting | Undated campaign state; retain the separately verified Glico header |
| F4: [Riverwalk operator's bridge-area image](https://www.tonbori.jp/osanpo/img/sv06b.png) | Ribbed corner orientation and silhouette | Only 184 × 181 pixels; no fine fitting measurements |
| F5: [Operator's restaurant image](https://www.tonbori.jp/osanpo/img/sv04b.png) | General service ducts, vents and projecting signs | Unregistered host; no equipment assignment to a specific building |
| F6: [Shinsaibashi association's H&M listing](https://www.shinsaibashi.or.jp/stores/show/2nr3erh5u/H%26M%20EBISUBASHI) | H&M at 戎橋ビル, 心斎橋筋二丁目4番9号 | Generic image placeholder; identity/address only |

The [Osaka PLATEAU catalog](https://api.plateauview.mlit.go.jp/datacatalog/citygml/27100)
inspected on 2026-09-20 lists the 2025 edition. Mesh `52350400` has 3,385
building features, 1,332 with LOD2 and none with LOD3/4. The inspected
67,132,784-byte building CityGML contains no `imageURI`,
`ParameterizedTexture` or `textureCoordinates` elements. That file provides
geometry without ready-made façade textures; other distributions were not
exhaustively checked. See the [PLATEAU format documentation](https://docs.plateauview.mlit.go.jp/datasets/citygml/).

## Verification and review

The Dōtonbori geometry tests cover unchanged source contours and complete cap
coverage, exclusive reference-wall ownership, finite/duplicate-free façade
triangles, correctly oriented rib entry/exit surfaces from all principal directions, street-plane
registration, canopy/neighbor clearance and complete QR surface coverage. Every
detail retains source-building ownership; street details, setback strips, source
bodies and section finishes participate in the complete surface transport.
The scene tests also verify all 21 regular sign panels, correct atlas cells,
separated cabinets, unobstructed artwork samples, retained B037-east ground-floor
coverage and the seven restored groups through dense QR edits and reversals.
Foreground-height checks retain closed source topology, horizontal coordinates,
reference-host dimensions, QR variation and normal 1F proportions across content.

`npm run smoke:dotonbori-scene` checks 48 orbit views, all 58 selected buildings,
the low river opening and public Reset, stable GPU storage, existing activity, logo travel, public view actions and
exported QR decoding. It captures street and corner close-ups plus 3D,
intermediate and QR views at 1440×900, 390×844 and 320×568. Paused resizing
repaints the cleared canvas without advancing activity. Native Blender reviews
are regenerated from the runtime snapshot and original sign painters.

The saved review has 386,143 triangles across 406 objects, including all 58
bodies, the exterior crab and 32 separately named cabins. Browser review records 153 opening draw
calls. After morph preparation, 105 GPU geometries and five textures remain
stable through rotation and reversals.

The [opening view](../../../../assets/design-qr/dotonbori/reviews/sign-row-opening.png),
[opposite edge view](../../../../assets/design-qr/dotonbori/reviews/edge-cleanup-opposite.png),
[street façade](../../../../assets/design-qr/dotonbori/reviews/kani-street-facade.png),
[ribbed corner](../../../../assets/design-qr/dotonbori/reviews/ebisubashi-corner-facade.png)
and [east review](../../../../assets/design-qr/dotonbori/reviews/waterfront-night-east.png)
show the completed pass. Isolated host close-ups are inspection views, distinct
from the full 58-building product scene.

Edge-selection verification checks all eight edge omissions and six displaced context IDs against the loaded GLB,
attached-detail ownership and QR sources, and preserves complete small buildings
and all eight reference hosts. Geometry tests verify retained horizontal source
vertices, closed bodies and deterministic QR content variation.

## Remaining evidence

A complete dated photo set is still needed for unphotographed rear walls,
service cores and equipment. Obtain a north/west oblique B034 photograph and
retain the registered B046 crab envelope when extending those features. Existing
illustrative QR context remains identified as such. No quiet wall is treated as
permission to invent another shop, entrance or advertising campaign.
