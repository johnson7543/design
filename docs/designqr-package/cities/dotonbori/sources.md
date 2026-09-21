# Dōtonbori source ledger

Status: Active research record; incomplete coverage for detailed reconstruction<br>
Scope: Reference evidence and unresolved provenance for the Ebisubashi / Dōtonbori study<br>
Retrieved and reviewed: 2026-09-08–2026-09-20

[Design QR index](README.md) · [Reconstruction requirements](build-plan.md) ·
[Implemented Blender study](blender-study.md)

This ledger separates downloaded geometry, inspected visual references,
published dimensions and missing evidence. Download and publication dates
do not establish when a scene was photographed or surveyed.

## Reference pack

| Artifact | Contents |
| --- | --- |
| [Site map](references/site-plan.svg) | North-up source coverage and draft crop, using approved repository colors |
| [Numeric audit](references/site-audit.json) | Original feature IDs, local footprints, source heights and LOD availability, road polygons and nearby GSI map geometry |
| [Source manifest](references/source-manifest.json) | Exact URLs, byte lengths, SHA-256 hashes, inspected-image flags, dates and attribution |
| [Waterfront references](references/waterfront-reference.json) | Operator vessel drawing/photos, current gallery facts, download hashes, bank/sign fits and representative activity |
| [Night and storefront references](references/night-reference.json) | Inspected night and ground-floor photographs, hashes, source-wall fits and interpretation limits |
| [Ground-floor coverage](references/ground-floor-coverage.json) | Runtime-generated record for all 58 selected buildings: selected uses, eligible exposed sections, exclusions and source/code hashes; a geometry audit, not additional photographic evidence |
| [Façade audit](references/facade-audit.json) and [façade references](references/facade-reference.json) | 2026-09-20 review of perimeter cuts, reference-wall margins, current CityGML texture availability, and five visually inspected photographs; implementation is proposed in the [façade completion plan](facade-enhancement-plan.md) |

Raw citywide data and third-party photography are not embedded in this
documentation pack. Use the recorded downloads for regeneration. The audit
contains footprints and metadata, not the full LOD2 solid surfaces needed
for a Blender import. Those surfaces are now compiled separately into the
[source meshes](../../../../assets/design-qr/dotonbori/source-meshes.json).

## Primary geometry sources

### S1 — Osaka City / MLIT PLATEAU

Discovery: [PLATEAU CityGML API documentation](https://docs.plateauview.mlit.go.jp/datasets/citygml/)
and the [Osaka City catalog endpoint](https://api.plateauview.mlit.go.jp/datacatalog/citygml/27100).

Retrieved edition: `27100_osaka-shi_city_2025_citygml_1_op`.
Local mesh: `52350400`.

| File | Direct source | Downloaded bytes |
| --- | --- | ---: |
| `52350400_bldg_6697_op.gml` | [Building CityGML](https://assets.cms.plateau.reearth.io/assets/10/a0aecb-67d1-4463-92d5-d67c99f3b8b6/27100_osaka-shi_city_2025_citygml_1_op/udx/bldg/52350400_bldg_6697_op.gml) | 67,132,784 |
| `52350400_tran_6697_op.gml` | [Road CityGML](https://assets.cms.plateau.reearth.io/assets/10/a0aecb-67d1-4463-92d5-d67c99f3b8b6/27100_osaka-shi_city_2025_citygml_1_op/udx/tran/52350400_tran_6697_op.gml) | 1,850,136 |

The following are results of inspecting those files, not promises about all
PLATEAU models:

- The building tile contains 3,385 building features; 1,332 have LOD2.
- The draft square intersects 73 building footprints: 66 have LOD2 and
  7 have LOD1 only. All selected objects record creation date 2023-03-22.
  Survey date remains unverified.
- The 15 road polygons selected by the square have Z = 0. Their horizontal
  shape is usable; their Z values do not establish street or bridge height.
- The downloaded catalog has no bridge file for mesh 52350400 and no
  water-object layer. It does not supply a detailed Ebisubashi bridge model.
- LOD2 faces may be referenced with XML links. Import the solid faces;
  footprint extrusion alone discards roof shape. Attribute heights and
  tenant-like names do not independently identify a complete host building.

### S2 — Geospatial Information Authority of Japan map geometry

[GSI optimized vector tile specification and update record](https://github.com/gsi-cyberjapan/optimal_bvmap)
and [PMTiles data](https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles).

Retrieved tile `16/57435/26032` through range requests, with coordinate
extent 4096. The provider's declared data update is 2026-04-01; this is
not confirmation that every feature depicts that date. The service is a
trial vector map, not a certified survey for this model.

The audit retains `WA` water polygons, `WL` water lines and nearby road
lines. The map displays `WA` with the PLATEAU footprints and road outlines.
The mapped water intersection at local easting zero is approximately
12.52 m along a north–south section. This is our calculation from the tile,
not a published site measurement or a claim about the full canal length.

### S3 — GSI aerial photographs

[GSI tile catalog](https://maps.gsi.go.jp/development/ichiran.html).
Downloaded a 3 × 3 neighborhood from the `seamlessphoto` layer at zoom 18:
X = 229740–229742; Y = 104127–104129. The manifest identifies the four
tiles actually inspected visually and records all nine downloads.

Useful direct views:

- [Bridge and west-bank context](https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/18/229740/104128.jpg)
- [Bridge vicinity and adjacent block](https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/18/229741/104128.jpg)
- [Eastward canal context](https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/18/229742/104128.jpg)
- [Northern block context](https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/18/229741/104127.jpg)

Capture dates have not been established. These tiles support geographic
orientation and roof comparisons, not current advertising, hidden façades,
rail dimensions or measured vertical levels. Zoom 19 downloads returned
404; zoom 18 should not be presented as finer imagery.

## Dimensions and appearance references

### S4 — Osaka City's current Ebisubashi description

[Municipal bridge page](https://www.city.osaka.lg.jp/kensetsu/page/0000021695.html),
dated 2016-12-26, and its [bridge photograph](https://www.city.osaka.lg.jp/kensetsu/cmsfiles/contents/0000021/21695/ebisu_d.jpg).

The page describes the bridge completed in November 2007: a girder bridge
with a circular-based plaza and ramps following the plaza toward the river.
Published length is **26.0 m** and width **11.0–18.0 m**. The photograph was
downloaded and inspected; its capture date is unknown. It supports visible
bridge character, not a current façade inventory or dimensioned ramp design.
The bridge length is not the water width.

### S5 — Osaka City's riverwalk standard section

[Municipal riverwalk project page](https://www.city.osaka.lg.jp/kensetsu/page/0000010881.html)
and the [standard cross-section image](https://www.city.osaka.lg.jp/kensetsu/cmsfiles/contents/0000010/10881/14-04.jpg).

The page, updated 2025-11-20, describes the Ebisubashi–Tazaemonbashi riverwalk
opened in December 2004. The diagram was downloaded and visually inspected.

| Diagram label | Value | Modeling interpretation |
| --- | --- | --- |
| Overall river width | About 30 m | Corridor including bank walks |
| Water surface width | 12.5 m | Standard open-water section |
| Walkway width | At least 8 m on each bank | Combined bank arrangement, not each individual tier |
| Upper level | +3.25 m in the section's level convention | Check local extent and datum before applying |
| Lower level | O.P. +2.35 m | Separate from the upper walk |
| Water level | O.P. +1.70 to +2.10 m | Variable range, not a single fixed observation |
| Bed level | O.P. −1.80 m | Standard section, not a local bathymetric survey |

The two walk levels differ by 0.90 m in this diagram. These are standard
project values; bridge approaches and local bank transitions need their
own evidence. Do not apply a standard cross section uniformly to the crop.

### S6 — Glico sign owner

[Glico's official sign page](https://www.glico.com/jp/health/contents/glicosign/)
publishes **20.00 m height × 10.38 m width**, address Dōtonbori 1-10-4,
and identifies the sixth-generation sign installed in October 2014.
The [dated 2022-06-24 announcement](https://www.glico.com/jp/newscenter/pressrelease/39545/)
documents the upper-logo change.

The owner's [frontal photograph](https://www.glico.com/assets/images/large/グリコサインページヘッダー画像.jpg)
was downloaded and inspected on 2026-09-09. It shows the Glico panel and
neighboring sign frontages. Its capture date and camera are unverified;
advertising visible in the image does not establish a complete scene date.

These sources establish the sign's dimensions and version history.
They do not by themselves establish the host building's full height,
sign bottom elevation, support depth or camera registration. Use 10.38 m
for the current sign, not the previous generation's 10.85 m width.

### S7 — Kani Doraku owner reference lead

[Official Dōtonbori main-store page](https://douraku.co.jp/kansai/honten/)
and [company location list](https://douraku.co.jp/company/network.html).

The owner identifies the main restaurant at Dōtonbori 1-6-18. This is a
location/identity lead for the façade inventory. Crab dimensions, mounting
position, model geometry and exact alignment within the crop have not been
established. Do not place a generic crab on a river-facing wall.
S16 adds inspected first-floor photographs and corroborates the Asahi host;
it does not establish the dimensions or placement of the exterior crab sign.

### S8 — Osaka Port vertical datum reference

[Osaka's port construction standard diagrams](https://www.city.osaka.lg.jp/port/cmsfiles/contents/0000596/596092/A52-kouwankouji-hyoujunzuhyou.pdf),
PDF page 3, printed diagram 5-2-2, was downloaded and visually inspected.
It states **O.P. = T.P. + 1.3 m**, subject to the note about benchmark
movement of 5 cm or more. Accordingly, the standard upper/lower bank levels
convert to T.P. +1.95/+1.05 m, and the stated normal-water range to
T.P. +0.40–0.80 m. These are conversions, not observations at this site/date.

The [GSI datum explanation](https://www.gsi.go.jp/sokuchikijun/datum-main.html)
also describes the national height reference and the 2025 height revision.
Retain source epochs and raw building heights. The published offset does
not by itself prove that old bridge drawings and this city model share an
identical local benchmark realization.

### S9 — Recovered municipal completion drawings and site references

The live competition page and southwest landing PDF returned 404. The
[archived municipal index](https://web.archive.org/web/20230805102646id_/https://www.city.osaka.lg.jp/kankyo/page/0000580243.html)
provided recoverable attachments. All archive URLs and downloaded hashes
are retained in the source manifest.

| Inspected record | Established evidence |
| --- | --- |
| [Overall completion drawing](https://web.archive.org/web/20230805233636id_/https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/siryou3.pdf) | Titled 戎橋全体一般図（完成図）, dated March 2008; bridge plan, side elevation, grade table and A/B/C sections |
| [Southwest landing detail](https://web.archive.org/web/20230805235458id_/https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/tuikasiryou2.pdf) | Structural stair run 17 × 300 mm, rise 18 × 150 mm plus a 120 mm base difference; level labels 6.070 and 3.250; separate finish/mortar dimensions |
| [End-post detail](https://web.archive.org/web/20230805233859id_/https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/tuikasiryou1.pdf) | Completed-detail drawing, including post and foundation dimensions; not yet modeled |
| [2022 site plan](https://web.archive.org/web/20230805232215id_/https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/siryo02.pdf) | Existing southwest site layout; proposed construction allowances are separately hatched |
| [Site photographs and view directions](https://web.archive.org/web/20230805232928id_/https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/genchi.pdf) | Pages 1, 2 and 4 inspected: camera-direction diagram, approaches and southwest stairs; exact capture date unverified |
| [Q&A Vol. 1](https://web.archive.org/web/20230805234248id_/https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/Vol1.pdf) | Dated 2022-11-04; existing-site/GL clarification and additional-detail references; text inspected |

The overall drawing gives a 26 m span, 18 m central deck diameter and
11.8 m overall straight section containing 11 m effective width. Its
profile table gives O.P. 6.310 m at chainage 35; section A gives F.H.
6.3410 m. The **31 mm difference is unresolved**. The
[bridge study input](../../../../assets/design-qr/dotonbori/bridge-deck-study.json)
records the transcribed values, registration controls and interpolation.
It omits crossfall, surfacing thickness, ramps, stairs, rails and girders.
The incomplete deck envelope must not be promoted as a finished surface.

### S10 — CTI, bridge detailed designer

[CTI's project record](https://www.ctie.co.jp/english/project/project648.html)
and its [bridge photograph](https://www.ctie.co.jp/english/project/uploads/2021/11/ebisu%20bridge.jpg)
were inspected. The photograph supports the bridge's visible relationship
to the canal, curved outer routes and adjacent stairs. Its camera has not
been calibrated; the URL's 2021 directory is not a capture date.

### S11 — Konoike, riverwalk contractor

[Konoike's ET 447 report, 2008-10-01](https://www.konoike.co.jp/et/archive/detail/000066.html)
describes the Dōtonboribashi–Ebisubashi works, 126 m of riverwalk and bridge
paving. Its text confirms upper O.P. +3.25 m and lower O.P. +2.35 m.
The location diagram, riverwalk photograph and section were downloaded and
inspected. This adds evidence west of Ebisubashi, while retaining the limit
that a standard section is not a local survey of every transition.

### S12 — Municipal project report in the road association awards

[Kansai Road Study Association, FY2007 awards](https://www.kandoken.jp/pdf/H19_1.pdf),
PDF pages 3–4, includes Osaka City's bridge project report and completed
overhead and side-view photographs. It confirms the 26 m length, 18 m circular part and
steel-deck girder structure. The winning proposal illustration is separately
captioned; use the completed photographs for appearance comparisons.

### S13 — Ipponmatsu, DOTON's operator

The [operator's fleet gallery](https://www.ipponmatsu.co.jp/gallery/?id=anker03)
identifies DOTON as an open boat used for Tombori River Cruise. The DOTON modal
lists length 15.40 m, width 3.60 m, 6.1 t and 60 passengers. The modal content
was inspected in the downloaded HTML; some text-only browser views omit it.

The operator's [advertising document](https://www.ipponmatsu.co.jp/assets/pdf/business-advertisement.pdf),
dated 2020-03-05, PDF page 5 / printed page 04, embeds DOTON's general arrangement
dated 2016-02-23. Its dimension lines distinguish **16.40 m overall** from
**15.40 m between perpendiculars**. The principal dimensions also give 3.60 m
breadth, 0.90 m depth and 0.50 m draft. The old drawing lists 80 passengers;
the current gallery's 60-person capacity is retained separately. The model
uses the drawing's hull dimensions and a representative 26 passengers plus crew.

The [stern/deck photograph](https://www.ipponmatsu.co.jp/assets/img/ship/ship07_01.jpg)
and [side photograph](https://www.ipponmatsu.co.jp/assets/img/ship/ship07_03.jpg)
were downloaded and visually inspected. They establish the open deck,
rounded transom, tapered bow, yellow hull/rails, fore helm and stern equipment.
The first also shows the stepped riverwalk and rail details beside Ebisubashi.
Capture dates are unknown. The published route starts at Tazaemonbashi;
no boarding pier is invented inside this bridge-centered crop.
The existing mast pennant remains an unbranded interpreted fitting. Its
[cloth motion record](references/cloth-motion-reference.json) documents authored
wind, not an identified operator flag or observed wind conditions.

The [waterfront reference record](references/waterfront-reference.json) retains
exact download URLs, bytes, SHA-256 hashes, retrieval on 2026-09-10 and review
on 2026-09-11. The same record documents the S5/S10/S11 bank interpretation,
the S9 bridge fittings and the S6 Glico host fit. It separates original facts
from photo-sized details and representative movement. Gold maps the photographed
boat yellow into the approved palette. The model and sign artwork are original
miniature interpretations; the downloaded owner photographs and PDF are not
redistributed as textures or bundled reference assets.

The 2026-09-21 finishing review rechecked S10's bridge photograph, S14's east
approach and the [riverwalk operator's guide](https://www.tonbori.jp/osanpo/).
S14 shows the metal underside, panel seams and circular light beneath the
bridge. Runtime detail follows the existing registered deck envelope; the
0.48 m underside depth and 2.8 m ring radius remain manual photo fits. Rail
base plates/flat bolt heads and the bank's wet-contact shading are miniature
finishes, not an as-built hardware or water-level survey. The updated
[waterfront reference](references/waterfront-reference.json) retains downloaded
image hashes and interpretation limits; source photographs are not bundled.

Runtime bank strips, display water level, Glico frontage fitting, and activity
are maintained in the [runtime overview](overview.md#runtime-detail-and-evidence-limits).
Existing source entries remain evidence records and do not automatically
certify those later modeling choices.

### S14 — Osaka Tourism Bureau night photographs

The Osaka Convention & Tourism Bureau's [night-view feature](https://discover.osaka-info.jp/jp/articles/osaka-night-view),
published **2026-01-07**, contains three photographs downloaded and visually
inspected on **2026-09-11**:

| Photograph | Observed evidence and use |
| --- | --- |
| [DOTON beside the south-bank sign row](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_01.webp) | Sign order, recessed shopfronts, glazing bands, warm bank lamps, broken colored water reflections and dispersed visitors |
| [Canal farther east](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_02.webp) | Night lighting context only; its Ferris wheel and out-of-crop signs are not inserted into this tile |
| [East approach to Ebisubashi](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_03.webp) | B034's visible commercial glazing, vertical ribs, AQUA/Haier and H&M panels; bridge fascia divisions and underside light ribbon |

The feature describes light reflecting across the canal. Its **publication date
is not a verified photograph capture date**. The older Glico header visible in
the night image does not override the owner's updated header in S6. Simplified
sign lettering and layouts follow visible evidence, while temporary campaign
graphics are not reproduced as a purported present-day state.

The [municipal riverwalk night photograph](https://www.city.osaka.lg.jp/kensetsu/cmsfiles/contents/0000010/10881/14-03.jpg)
on S5 was also inspected for the two bank levels, small lamps and elongated
broken reflections. It illustrates the historical riverwalk completion, not
current advertisements. The page's relative image link resolves incorrectly
through some clients; the working image URL is retained above.

The [night reference record](references/night-reference.json) retains download
sizes and hashes, source IDs, manual metric frontage fits and interpretation
limits. B034's frontage splits at its actual PLATEAU setback. Photo fits, floor
rhythms, curved rib profiles, illuminated-window selection and lighting remain
approximate. No night reference establishes unobserved rear façades. Original
procedural artwork is bundled; these photographs remain outside the repository.
The miniature is a composite reference state, not a surveyed or coherently
dated reconstruction.

The current [QR composition record](references/qr-composition.json) identifies
the complete building inventory and generated context layer. All 58 selected buildings,
including the Glico-side block, remain visible throughout rotation, with normal
depth occlusion. This presentation preserves source data. QR-generated
heights, rear/side window bays, roof equipment and original campaigns follow
the same artistic rules as Shibuya. These additions are not facts inferred from
the night photographs and do not expand their documented evidence coverage.

### S15 — Ground-floor shop and food-service context

Inspected on **2026-09-11**:

| Primary reference | Observed evidence and use |
| --- | --- |
| [Tonbori Riverwalk operator's walking guide](https://www.tonbori.jp/osanpo/) and [restaurant photograph](https://www.tonbori.jp/osanpo/img/sv04b.png) | River-facing restaurant entries, menus, small shop signs and terrace furniture. Context for local shop character; the pictured terrace is not registered to this crop. |
| [Osaka Prefecture's Kukuru main-store feature](https://osaka-shotengai-info.com/shop/takoyadotonbori-kukuru-honten/) | The cooking photograph shows takoyaki on a dark griddle with turning picks. Used for original, small food/tray geometry, not a measured counter layout. |
| [Kukuru's own shop directory](https://dotonbori-kukuru.com/shop) | Confirms the Dōtonbori main store at 1-10-5, Hakua Building 1F, with eat-in/takeout. This does not register a modeled bay to that tenant. |

The [night reference record](references/night-reference.json) retains the exact
download URLs, sizes, hashes and observed features. The local cooking image is
hosted in a `2023/01` directory; neither photograph has a verified capture date.
Photographs remain outside the repository and are not used as textures.

B037/B041 gain generic dining and takoyaki-style fittings;
those assignments, menus, noren, lanterns, cabinet dimensions and display foods
are explicitly **miniature interpretations**, not a dated inventory of real
restaurants. Their [cloth motion](references/cloth-motion-reference.json) adds
an illustrative breeze without extending this source evidence. S14 still controls the registered facade/sign sequence. H&M's
existing base remains retail, and the Glico base uses a lobby treatment. The
food fronts were checked against the modeled upper riverwalk floor. Re-review
of S14's south-bank photo guides the contrasting warm restaurant opening,
plain Glico-base glazing and compact takeaway character. B039's unverified
confectionery assignment is removed in favor of neutral commercial glazing.
The new frontage compositions replace repeated complete counters/menus with
coordinated service, seating, display and quieter glazing areas. Uneven widths,
finishes and original artwork variants remain interpretations, not recovered
shop plans. One real business may span multiple windows or corner faces;
source-wall section counts must never be reported as verified shop counts. No
terrace furniture is placed from the unregistered operator photograph.

The complete context layer applies these same illustrative shop types to eligible
side/rear source-ground walls. Shutters, lobby furnishings and service-panel
details are original contextual additions, not a surveyed inventory. Known host
uses stay consistent across their faces. Partial walls receive clipped surface
finishes; narrow alleys limit projection; unsupported floor/pavement relationships
receive windows rather than invented doors. The
[coverage record](references/ground-floor-coverage.json) records the review value,
all 58 selected source hosts and the two enclosed parcels with no eligible public
frontage. Counts change with QR content and do not expand S15's evidence coverage.

### S16 — Kani Doraku main-store ground floor

The [owner's main-store page](https://douraku.co.jp/kansai/honten/) and its
[public shop data](https://douraku.co.jp/lacne/api/shop/honten/) were inspected on
**2026-09-11**. The owner identifies Dōtonbori 1-6-18 and supplies a map point
at 34.668802, 135.501487. That point falls within B046 in our source-coordinate
comparison. This is a manual identity cross-check, not a façade survey.

| Inspected owner photograph | Observed evidence and use |
| --- | --- |
| [Street exterior](https://douraku.co.jp/lacne/photo/upload/OYRbCZyjstBd8H4l.jpg) | Glazing, dark framing and warm interior lamps; the large exterior crab belongs to this street facade and is not copied onto the river wall. |
| [First-floor chair seating](https://douraku.co.jp/lacne/photo/upload/NQUwFpjg6PbsmzO1.jpg) | Tables beside river-facing glazing, upholstered chairs, ceramic tableware, framed pendant lamps and frosted lower windows. |
| [First-floor elevator hall and crab tank](https://douraku.co.jp/lacne/photo/upload/d6uUCzKu1ACFkuZK.jpg) | Framed glass tank, stone base, cool illumination and nearby menu displays. |

Capture dates are unknown. The [1996-07-10 Japan Food Journal report](https://news.nissyoku.co.jp/news/nss-8065-0059)
corroborates the Asahi sign's placement on the main restaurant's north and west
walls. Its historical dimensions do not establish today's panels and are not
substituted for the existing source fits.

The miniature adds five shallow restaurant windows on B046, with original
table, pendant, menu and crab-tank geometry. The tank's placement in a west
window is an **interpretation**, not a claim that the photographed elevator hall
is visible there. No river-side or west-side public door is invented. B049's
neighboring café is a separate, unverified contextual use guided by S15. The
new north forecourts are clipped to source footprints and modeled walks, but
their widths and display elevation remain assumptions. Photographs stay outside
the repository; hashes and feature observations are in the night reference record.

### S17 — Glico LED artwork references

The [NEOS 149 sign report](https://www.sign-jp.org/98/neos149/museum.html), credited
to Glico's marketing/public-relations department with cooperation from Asahi
Denso, was inspected on **2026-09-15**. Its 2015 issue includes still photographs
of the blue track artwork by day and night and a rainbow above the runner with
a pale landscape and road. Photograph capture dates are unverified.

The [reference record](references/glico-animation-reference.json) retains the
three inspected image URLs, byte counts, hashes and observations. The runtime
uses original Osaka-palette illustrations of those backgrounds, retaining the
current S6 header. Photos are not redistributed. The 16-second loop, holds,
crossfades and coordinated reflection colors are authored presentation choices;
no footage or current playlist timing was verified. Both textured sign halves,
the cabinet and reflected-light fragments preserve their current state in the
QR transformation. Static Blender reviews keep the initial track appearance.

### S18 — Water surface and boat wake

The operator's [Tombori River Cruise page](https://www.ipponmatsu.co.jp/cruise/tombori.html)
and its [approaching-boat photograph](https://www.ipponmatsu.co.jp/assets/img/common/tombori_img01.jpg)
and [DOTON stern photograph](https://www.ipponmatsu.co.jp/assets/img/common/tombori_img04.jpg)
were inspected on **2026-09-15**. They show fine canal ripples, outward trailing
ridges, disturbed water behind the transom and broken light reflections. The
first image has text over part of the foreground. Capture dates are unknown.

The [water motion record](references/water-motion-reference.json) retains image
dimensions, hashes and observations. The runtime uses small drifting reflection
strokes and spreading stern crests on the existing source water and S13 vessel
route. Emission interval, lifetime, drift, spread and strength are authored
miniature choices. No current measurements, operating speed or wave timing were
recovered from these stills. Photos remain outside the repository. The Blender
review captures the initial water and wake geometry; browser captures document
the motion and its frozen QR transformation.

### S19 — Facade completion references

The [façade reference record](references/facade-reference.json) records the
photographs and current PLATEAU texture check inspected on **2026-09-20**.
F1 re-examines S16's [owner street/corner photograph](https://douraku.co.jp/lacne/photo/upload/OYRbCZyjstBd8H4l.jpg).
It directs B046-south's entrance framing, tiled eave, pale folded wall panels,
inset window bands and dark corner returns. Its actual source-wall normal is
east/north `(-0.19226348, -0.98134334)`. Dimensions and the 12.6 m lower-elevation
band are miniature interpretations; the source floor remains at 1.26 m.
The street walking datum is unresolved, so this entrance reveal adds no
functional access, invented stairs or relocated pavement. S23 now registers
the exterior crab and its motion separately within this street wall.

F2 is S14's [east approach photograph](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_03.webp).
It directs B034's closed rib relief and the rib/glass continuation through its
source sloped east setback. F3 corroborates the distinct sign row, F4 its corner
silhouette, F5 remains unregistered restaurant/service context, and F6 confirms
the H&M address only. None establishes a complete rear-elevation inventory or
a current campaign date. Photographs remain outside the repository.

The [runtime audit](references/facade-audit.json) records treatment on every
boundary face and source wall, including about 391 m² of completed reference
margins. Closed boundary caps receive a restrained model-section finish without
invented openings. All selected source shapes and 58 building bodies remain intact under the recorded presentation placement.
See the [implementation and evidence limits](facade-enhancement-plan.md).

### S20 — Riverbank sign completion

Both canal-facing rows and all registered sign fronts were inspected on
**2026-09-20**. S14's [south-bank photo](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_01.webp)
shows the yellow 大阪 花ラング advertisement below SAMTY's service band and the
Snow Brand slogan below the dairy campaign. Its [east-approach photo](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_03.webp)
shows Pip/FANCL on B037's bridge-facing east wall and Salonpas/H&M on B034's
south wall. Enlarging the latter reference confirms サロンパス lettering;
it is not a generic unlabelled advertising field.

The [Pip owner's clock history](https://www.pipjapan.co.jp/products/recommend/tokeidai/)
and its [2017 tower photograph](https://www.pipjapan.co.jp/products/recommend/tokeidai/img/history_ph03.jpg)
confirm that the clock face sits directly above Snow Brand on the north face,
while the neighboring face has a separate advertisement. The owner records the
clock's inauguration as 2017-10-05; the S14 capture dates remain unknown. The
[Hana Langue owner](https://osaka-hanalangue.com/) corroborates the flower-shaped
biscuit and product spelling, but does not establish a store in B039.

Seven missing sign quads are restored on supported source planes, with cabinet
clearance and explicit QR fragments. Snow Brand/dairy proportions are refitted
within the original host, with the clock above and slogan below. The clock is
a fixed authored pose. Artwork is drawn from original paths and bundled
lettering, not cropped photographs; metric placements, simplified illustrations
and approved-palette colors remain interpreted. The [night reference record](references/night-reference.json)
retains exact owner-image hashes and the [runtime audit](references/facade-audit.json)
records the fitted panels. Unverified rear surfaces, windows and structural
margins are not filled with invented campaign placements.

### S21 — Ebisu Tower location

The [Don Quijote wheel page](https://www.donki.com/kanransha/) identifies
**道頓堀大観覧車えびすタワー** as the oval wheel at its 道頓堀 store,
大阪市中央区宗右衛門町7-13. It gives a 77.4 m highest point, a 10.5 m boarding
platform and 32 cabins. These operator specifications were checked on
2026-09-20; no operating schedule is incorporated into the artwork.

The [official store map](https://www.donki.com/store/map.php?shop_id=110)
links to a store pin at longitude 135.50267960 / latitude 34.66930430. This is
131.157 m east and 27.560 m north of the source origin, beyond the earlier
bridge crop's easternmost point at local east 79.150 m. The pin locates the store; it does not
establish the wheel's exact center, mounting plane or building footprint.
The compact product includes that complete source host using a separately
recorded 80 m west presentation translation. See S22 for its footprint match,
mounting evidence and interpreted dimensions. The source pin stays geographic.

### S22 — Ebisu Tower reconstruction

The [manufacturer's project](https://www.intamin.com/project/yebisu-tower-osaka/)
and its [front photograph](https://www.intamin.com/wp-content/uploads/2019/11/cimg0109.jpg),
[oblique photograph](https://www.intamin.com/wp-content/uploads/2019/11/cimg0118-1440x1920.jpg)
and [boarding cabin](https://www.intamin.com/wp-content/uploads/2019/11/cimg0091-1920x1440.jpg)
were visually inspected on 2026-09-20. They establish the fixed open yellow
stadium-shaped truss, red circular cabins, upright seats, support masts and
lower Ebisu/fish/Donpen relief. The [tourism night photograph](https://d3ed8zo3ba2djd.cloudfront.net/tombori_river_cruise_02.webp)
establishes the south river elevation and illuminated store frontage.

The official store pin falls inside PLATEAU source
`bldg_62a12ed7-ad07-4a43-8a33-c8720026bbaa` (B092). The same verified building
and road GML files support the [east audit](references/east-site-audit.json).
The GSI water polygon already recorded in the original audit covers the new
canal segment without extrapolation. The source inventory retains geographic
coordinates. The requested compact product uses a bridge-centered 144 m square
and an 80 m west translation of the complete Donki host and attached assembly.
All eight landmark shapes and directions remain intact; six displaced context
blocks are omitted. This is illustrative spacing, not a surveyed relocation.
The river, bridge and road alignment stay fixed. Source LOD2 supplies the 44.57 m
store roof, while the attraction uses the operator's 77.4 m relative highest
point, 10.5 m boarding level, 32 cabins and 15-minute circuit.

The [reference record](references/ebisu-reference.json) retains image hashes,
dimensions, source matching and interpretation limits. Track radius, cabin
dimensions, mounting projection, truss details, original relief and store bays
are photo-derived proportions; no surveyed width or exact campaign date is
claimed. The LOD1 ground minimum is used as the attraction datum, with local
vertical agreement unresolved. Boarding pivots/doors are not animated. No
photograph is redistributed as a texture. The [implementation record](ebisu-tower.md)
documents the current geometry, motion, QR coverage and review.

### S23 — Kani exterior crab and interior refinement

On **2026-09-20**, the owner's [2025-01-28 sign-history release](https://prtimes.jp/main/html/rd/p/000000037.000093595.html)
and its frontal third-generation photograph were inspected alongside S19/F1's
street view. The visible assembly has a textured rounded shell, eight folded
legs, two raised inward-facing pincers, stalked eyes and six uplights. The
existing B046-south wall supplies the location and direction. A conservative
reservation between its eave and first window band provides clearance; the
resulting proportions are photo-directed, not surveyed measurements.

[WSTV's original filmed visit](https://www.wstv.jp/localities/interesting_signs.html)
links [the main-store sign footage](https://www.youtube.com/watch?v=NQJvmAcijck),
listed 2010-04-13. Frames at 8, 12, 16, 22, 28, 34 and 40 seconds were visually
inspected. The shell remains fixed, folded legs sweep slowly and the pincers
open/close. The model uses an authored 12-second cycle with restrained phase
offsets. This historical reference does not establish today's motor timing.
The street-facing placement means the crab is inspected by orbiting away from
the river-side opening camera, without duplicating it on another facade.

S16's [first-floor dining photograph](https://douraku.co.jp/lacne/photo/upload/NQUwFpjg6PbsmzO1.jpg)
was re-inspected for pitched pendant roofs, timber ceiling beams, upholstered
chairs, paper table settings, ceramic pots and chopstick holders. These fittings
refine the existing shallow dining windows; the miniature's furniture layout
and depth remain interpretations. Other central fronts receive architectural
reveals around their existing distinct compositions, not new tenant identities.

The [Kani reference record](references/kani-sign-reference.json) retains hashes,
inspected timestamps, geometric reservations and runtime limits. All reference
media stays outside the repository; only original geometry is distributed.

## References that must not silently become geometry

| Reference or gap | Status | Required handling |
| --- | --- | --- |
| Southwest landing and overall completion drawings | Recovered and inspected through the municipal archive on 2026-09-09; see S9 | Distinguish structural, finish and datum labels; reconcile conflicting elevations before completing the bridge |
| [Museum's historic bridge drawings](https://www.osakamushis.jp/news/2010/tenjigae/100816.html) | Drawings concern the older bridge | Do not substitute for the current 2007 structure |
| [2022 public-toilet competition Q&A](https://www.city.osaka.lg.jp/kankyo/cmsfiles/contents/0000580/580243/Vol2.pdf) | Search lead to additional site documents | A competition proposal is not evidence that its proposed structure was built |
| Local vertical registration | General O.P./T.P. offset verified; benchmark epochs and local agreement remain open | The bridge study uses the published conversion and marks local vertical registration unverified; keep raw building elevations intact |
| Complete dated street-level photo set | Not yet assembled or registered | Required for detailed façades, bridge profiles, rear/side surfaces and a defensible scene date |
| [Open Heritage 3D Dōtonbori scan](https://openheritage3d.org/project.php?id=D6688F) | Capture listed as 2025-09-02; status Upcoming / Spatial Data Coming Soon at review; CC BY-NC; curator reports tilt/alignment issues | No scan was downloaded or used; do not treat the listing as available reconstruction geometry |

## Reproducing the audit

1. Download the two GML files through their exact manifest URLs and verify
   byte lengths and hashes. Keep the original files unchanged.
2. Decode position lists as latitude, longitude, height. Project horizontal
   positions from JGD2011 to EPSG:6674 and subtract the projected anchor
   at longitude 135.50125, latitude 34.66905.
3. Select building LOD0 footprints and road LOD1 polygons intersecting the
   square from −80 to +80 m on both horizontal axes. Preserve whole source
   geometries in the audit; clip only the figure's displayed context.
4. Decode the recorded GSI MVT tile, accounting for the decoder's Y-axis
   convention, then transform into the same local metric frame. Preserve
   source feature properties and tile indices; these are not cadastral IDs.
5. Record LOD availability, source creation date, attribute height and
   solid Z range separately. The audit's `lod1MinZM`/`lod1MaxZM` describe
   source LOD1 solids, not measured finished ground or detailed roof extrema.

The audit used Python 3.10, pyproj 3.7.1, Shapely 2.1.2 and MVT decoding.
Rounded coordinates and decimal precision do not increase source accuracy.
The figure's numbered building labels map to original IDs in the JSON;
they do not assign commercial building identities.

## Attribution and retained limits

The figure and numeric audit are repository-authored processing of Osaka
City's 3D city model, accessed through MLIT PLATEAU, and GSI optimized vector
tiles (国土地理院最適化ベクトルタイル). They are not official agency renderings.

Retain source and processing notices with derivative assets under the
[PLATEAU source policy](https://www.mlit.go.jp/plateau/site-policy/) and
[GSI source policy](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html).
Keep linked owner photographs and advertising artwork distinct from the
open geometry data; a model-data attribution does not establish artwork
reuse terms.
