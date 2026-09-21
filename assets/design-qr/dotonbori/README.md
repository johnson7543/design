# Dōtonbori source study assets

These editable research assets now power the
[Dōtonbori City study preset](../../../docs/designqr-package/cities/dotonbori/overview.md).
The detailed reconstruction remains incomplete. See the maintained [Blender study documentation](../../../docs/designqr-package/cities/dotonbori/blender-study.md)
for regeneration, evidence classes, palette roles and review limits, and the
[source ledger](../../../docs/designqr-package/cities/dotonbori/sources.md) for attribution.

Open `dotonbori-source.blend` for the complete authoring scene.
`dotonbori-study.glb` contains the clipped source buildings;
`dotonbori-focus.blend` and `dotonbori-focus.glb` contain the separate
58-building square crop used by the player. `focus-layout.json` records its
complete 144 m frame centered exactly on 戎橋, diagonal rotation, selected IDs,
eight omitted edge remnants, six displaced context blocks, retained footprint
measurements, variation indices and clipped plan overlays. The complete Donki
assembly translates 80 m west, with its shape, height and river-facing direction
preserved; original source coordinates remain in the research assets. This
spacing is an authored compact composition. `focus-manifest.json` records provenance and
geometric validation.
The selector keeps at least 40 m² or half the original footprint after clipping.
Complete small buildings stay; small fragments of mostly out-of-frame buildings
are removed from the focused asset and all generated detail. The original
73-building source master is preserved.
`dotonbori-bridge-deck-study.glb` contains the separately labeled incomplete
bridge envelope. The JSON files retain geometry inputs, provenance,
processing, omissions and validation results. `reviews/` contains the saved
diagnostic views. The player builds its flat reference board and map guides
from the focused plan coordinates; these are excluded from the GLBs.

The [night lighting and synchronized transition review](../../../docs/designqr-package/cities/dotonbori/spectacle-proposal.md#review-evidence)
links the current opening, intermediate poses and decoded QR export. The native
review captures static night material roles and sign spill; presentation glow
and the reversible activation wave run in the player.

Open [dotonbori-waterfront.blend](dotonbori-waterfront.blend) for the separate
editable detail review: all 58 selected buildings with their complete detail,
QR-generated façades/roofs/campaigns, stepped riverwalk, bridge fittings,
eight retained reference hosts and the 32-cabin えびすタワー, central 1F entrances/display bays, night reflections, 64 dispersed
pedestrians and populated DOTON tour boat.
Its geometry uses metres and original packed sign artwork. Object and triangle
counts are recorded in the review manifest. [waterfront-review-manifest.json](waterfront-review-manifest.json)
and [waterfront-review-meshes.json](waterfront-review-meshes.json) retain its
snapshot/build hashes and the encoded review value `https://example.com/dotonbori`.
Bodies and detail are linked by `source_building` for editing. The saved
northeast camera faces the Glico running man from 65° north of east at 30° elevation;
the east oblique provides another view of the riverfront. Both cameras render the complete scene.
Generated foreground heights follow a fixed low-rise envelope; upper floors,
signs and roof equipment are rebuilt to fit, with normal-height 1F storefronts.
Flat and sloping roofs receive source-fitted panel joints and edge flashing,
including the previously plain Donki rear slope. The existing B034 east
glazing/ribs retain exclusive ownership. These QR-derived structural finishes
join the complete surface transform and are not surveyed construction details.
The [before](reviews/roof-detail-before.png) and [after](reviews/roof-detail-after.png)
captures show the same low opening before and after adding the roof finish.
All eight reference hosts retain their dimensions. These context heights are
presentation choices, recorded in the [composition record](../../../docs/designqr-package/cities/dotonbori/references/qr-composition.json).
Reference façades fit their source walls and own those surfaces exclusively;
QR windows do not overlap them. Ground-floor shop fittings follow the same host.
The complete 1F layer covers eligible exposed side/rear walls as well as the
central row, with clipped surface finishes on partial walls and reduced relief
inside alleys. The [coverage record](../../../docs/designqr-package/cities/dotonbori/references/ground-floor-coverage.json)
audits every source building for the saved QR value.
Context heights and details vary in the player with QR content; the source master
and GLBs remain unchanged. The boat and crowd are a static time-zero pose in this
file; the player supplies their motion and water glimmer. Light spill is sampled
at mesh vertices in this review; the player evaluates it per pixel. See the
[opening river review](reviews/waterfront-axonometric.png),
[east review](reviews/waterfront-night-east.png),
[opposite edge view](reviews/edge-cleanup-opposite.png),
[waterfront reference record](../../../docs/designqr-package/cities/dotonbori/references/waterfront-reference.json)
and [night references](../../../docs/designqr-package/cities/dotonbori/references/night-reference.json).

The [façade completion record](../../../docs/designqr-package/cities/dotonbori/facade-enhancement-plan.md)
documents all 23 finished perimeter sections, exclusive reference-wall margins,
the source-registered [Kani Doraku street elevation](reviews/kani-street-facade.png)
and [Ebisubashi ribbed corner](reviews/ebisubashi-corner-facade.png). The latter's
closed ribs and glazing follow the actual sloped east setback. These isolated
host close-ups use the real runtime meshes for inspection; the public scene
retains all 58 selected buildings. Street entrance framing/eave proportions are
interpreted from the owner's photo, and its unresolved floor-to-street datum
does not add a functional entrance or invented stairs. The north Asahi upload
slot remains intact. The larger exterior crab now occupies its registered
street-side reservation; owner stills and historical footage are recorded in
[the Kani reference](../../../docs/designqr-package/cities/dotonbori/references/kani-sign-reference.json).

The riverbank review restores seven photographed sign bays, including the
[Pip clock/Snow Brand stack](reviews/pip-snow-river-facade.png),
[bridge-facing Pip/FANCL pair](reviews/pip-fancl-bridge-facade.png),
[Hana Langue advert below SAMTY](reviews/samty-river-facade.png), and
[Salonpas/H&M river façade](reviews/salonpas-river-facade.png).
All 21 regular panels are fitted to source walls; Glico and the Kani fascia keep
separate owners. The private sign atlas is 2048×1536 with per-cell clipping and
the existing north Asahi logo backing. The seven restored panels have reserved
QR fragments; the clock shows a fixed reference pose. Exact reference hashes
and miniature interpretation limits are recorded under
[S20](../../../docs/designqr-package/cities/dotonbori/sources.md#s20--riverbank-sign-completion).

| Full-scene riverbank review | West | Center | East |
| --- | --- | --- | --- |
| South bank, viewed from the canal | [West signs](reviews/riverbank-south-west.png) | [Pip/Snow/Glico](reviews/riverbank-south-center.png) | [Asahi/context](reviews/riverbank-south-east.png) |
| North bank, viewed from the canal | [West context](reviews/riverbank-north-west.png) | [Salonpas/bridge](reviews/riverbank-north-center.png) | [East context](reviews/riverbank-north-east.png) |

The runtime close-ups show all source hosts, at time zero, with 40° vertical
field of view and 1400×1050 renders. These inspection views are separate from
the default camera:

| View | Camera ENU → target (metres) |
| --- | --- |
| [Food counter](reviews/storefront-south.png) | `(-25, -1, 8)` → `(-27, -14, 3.5)` |
| [Neutral commercial frontage](reviews/storefront-commercial.png) | `(-43, -2, 7)` → `(-41, -14, 3.5)` |
| [Retail frontage](reviews/storefront-central.png) | `(5, 4, 8)` → `(-16, 19, 4)` |
| [Context café](reviews/storefront-cafe.png) | `(39, 1, 9)` → `(43, -15, 4)` |
| [Left block](reviews/storefront-left.png) | `(17, 5, 12)` → `(36, -17, 5)` |
| [Asahi restaurant windows](reviews/storefront-asahi.png) | `(9, -1, 8)` → `(25, -17, 3.8)` |
| [Restaurant and crab display](reviews/storefront-crab-display.png) | `(6, -14, 7)` → `(17, -22, 3.8)` |

Eleven directed fronts contain 42 detailed bays, eight functional entrances,
five food/display counters and thirteen lamps/lanterns. B046 has five restaurant windows with table settings, framed
lamps and one crab-tank vignette. Its owner photographs are recorded in
[S16](../../../docs/designqr-package/cities/dotonbori/sources.md#s16--kani-doraku-main-store-ground-floor);
the exact arrangement is interpreted. B049's café remains contextual, with QR
generation preserved above 1F. Two source-clipped north forecourts connect these
fronts to the modeled upper walk; their level and width are display assumptions.
[S15](../../../docs/designqr-package/cities/dotonbori/sources.md#s15--ground-floor-shop-and-food-service-context)
records the other food-service context and its limits. Fittings and generic uses
do not establish a real tenant inventory. Full fronts now use uneven bays and
complementary roles; counters, menus and awnings are not cloned into every
window. Known corner hosts share finishes. Four artwork treatments use the
same retained atlas. The [context café close-up](reviews/storefront-cafe.png)
shows the seven-bay mix of service/display counters, seating, shelves and glazing.

The context layer contains 239 sections / 561 bays for the saved value.
Including Donki’s six-bay storefront, the complete review has 251 sections /
609 bays, 24 entrances, 90 food/display counters and 75 menus. All eligible exposed ground-floor sections are finished.
B005 and B054 are enclosed at ground level and have no eligible public frontage. Source levels are retained; display windows replace unsupported
doors. These are QR-generated uses and fittings, not newly verified tenancies.

| Complete-ground-floor inspection | Camera ENU → target (metres) | Host visibility |
| --- | --- | --- |
| [North-bank fronts](reviews/ground-floor-north.png) | `(34, 3, 12)` → `(33, 19, 3.8)` | All hosts |
| [West-bank retail](reviews/ground-floor-west.png) | `(-51, 2, 12)` → `(-30, 25, 3.8)` | All hosts |
| [South-side dining](reviews/ground-floor-south.png) | `(22, -44, 8)` → `(22, -29, 3.3)` | B046/B049 isolated for inspection |
| [Rear shutters](reviews/ground-floor-rear.png) | `(15, 35, 11)` → `(16, 48, 5)` | `bldg_992fac86-aa37-4398-a10e-6850c9cac9f9` isolated for inspection |

The runtime uses [waterfront-layout.json](waterfront-layout.json) and procedural
detail geometry; it does not load this review snapshot or its PNGs. Source GLBs
keep diagnostic colors. The player uses muted night massing and mineral section
faces with restrained dark edges, with separate approved-palette roles for the bridge, banks, signs and boat.

The [opening river view](reviews/sign-row-opening.png) shows the public
player in its 480 px host at the default angle. The
[Asahi logo view](reviews/asahi-logo.png) shows the same player with a sample
square upload on the north panel. The opening is the canvas from a 1440×900
browser at 2× device pixel ratio; the logo capture includes the host page.
The upload is a customization preview, not reference
evidence. The editable snapshot keeps the original Asahi artwork.

The earlier 106 m foreground comparison uses the same east-northeast camera:
[original generated heights](reviews/foreground-height-before.png) and
[lower foreground](reviews/foreground-height-after.png). These historical
27-building captures document the first height pass. The current bridge-centered 144 m model
retains 58 buildings; nearby B050/B047/B048/B077 finish around 10–12 m, and
all eight reference hosts keep their dimensions.

The [wheel front](reviews/ebisu-front.png) and [rear](reviews/ebisu-rear.png)
show the closed fixed track and 32 upright moving cabins. The
[wheel contract](../../../docs/designqr-package/cities/dotonbori/ebisu-tower.md)
records operator dimensions, manufacturer photos, registration, motion and
interpretation limits. [east-source-meshes.json](east-source-meshes.json) stores
the 132 extended source candidates in geographic coordinates. The editable snapshot has 32 named cabins
at time zero. Complete runtime rail/cabin surfaces gather into the QR finder
ring, while interior relief supplies its center.

The [Glico LED atlas](reviews/glico-led-atlas.png) shows the two original canvas
illustrations used by the runtime loop. The [QR folding capture](reviews/glico-led-morph.png)
shows its frozen artwork on the full folding panel during the turn. These are generated browser reviews, not site photographs.
The [animation reference](../../../docs/designqr-package/cities/dotonbori/references/glico-animation-reference.json)
records the inspected source stills and authored timing. The Blender snapshot
keeps the initial track appearance and records the current source hashes.

The [moving-water review](reviews/water-motion.png) and
[water QR-turn capture](reviews/water-motion-morph.png) show the runtime's drifting
reflections and spreading stern crests. The
[water motion reference](../../../docs/designqr-package/cities/dotonbori/references/water-motion-reference.json)
records operator photograph hashes, interpretation limits and transform coverage.
The Blender snapshot captures the initial water and wake geometry; these browser
captures document the animated effect.

The [noren close-up](reviews/noren-motion.png), [mast pennant](reviews/pennant-motion.png)
and [cloth QR turn](reviews/cloth-motion-morph.png) show the next runtime motion
step. Curtains keep their top seams and separate gaps; the flag stays on its
pole. Both fabric faces render, and their frozen strips join the QR morph.
These are browser captures of interpreted fittings with authored wind; the
[cloth motion record](../../../docs/designqr-package/cities/dotonbori/references/cloth-motion-reference.json)
states the source limits. The Blender snapshot retains the initial cloth pose.

The [preparation worker](reviews/shop-preparation-motion.png),
[counter exchange](reviews/shop-service-motion.png),
[bridge phone](reviews/bridge-phone-motion.png),
[bridge greeting](reviews/bridge-greeting-motion.png),
[boat passenger](reviews/boat-greeting-motion.png) and
[crab tank](reviews/crab-tank-motion.png) are runtime close-ups of the next
three completed activity steps. The [QR turn](reviews/activity-motion-morph.png)
captures their participation in the whole-city transformation. These are real
WebGL captures; the test camera uses a close depth range to preserve the shallow
fitting separation at enlarged scale. The
[activity reference](../../../docs/designqr-package/cities/dotonbori/references/activity-motion-reference.json)
records source limits and authored choreography. The Blender review records the
current actors at time zero; the source building/bridge GLBs retain their source geometry.

The [bridge crowd](reviews/crowd-bridge-clearance.png) and
[bank crowd](reviews/crowd-bank-clearance.png) review captures show the corrected
walking clearance. Bridge visitors cross between approaches, make short river-view
visits or wait nearby, with independent destination holds and gentle turns in
place. Bank visitors retain irregular gaps and smooth following. Geometry checks
cover an hour of movement and a ten-minute sweep of actual limbs and bags,
including stride support on the source bridge and promenade. The QR turn retains
current positions and head directions. The Blender review records the current
crowd arrangement at time zero.

The [complete surface enhancement](../../../docs/designqr-package/cities/dotonbori/spectacle-proposal.md)
records the current synchronized textured transformation and landmark assembly. Its
[measurement record](reviews/surface-transition-audit.json) retains source/cell
coverage, vertex storage and software-GPU playback measurements. The
[shared finish](reviews/landmark-finale.png) shows the wheel and city settling together.

The latest [night view before](reviews/night-depth-before.png) and
[after](reviews/night-depth-after.png) compare continuous surface shading and
building-derived ambient depth. The [sign row before](reviews/sign-artwork-before.png)
and [after](reviews/sign-artwork-after.png) show the refined Glico figure,
Japanese campaign headlines and inset window reveals. The updated
[wheel front](reviews/ebisu-front.png) includes sculpted ears, moustache, fingers,
garment folds and Donpen bill/flipper/toe details directed by the recorded
manufacturer close-up. These are original palette-constrained interpretations;
the reference photographs are not bundled. Every added surface and its shaded
paint participates in the complete QR transformation.


The [exterior crab](reviews/kani-crab-front.png), [moving pose](reviews/kani-crab-motion.png)
and [oblique view](reviews/kani-crab-oblique.png) inspect the street-mounted
assembly with eight folded legs, two opening pincers and six uplights. The
[restaurant interior](reviews/restaurant-interior.png) and
[west window](reviews/restaurant-interior-west.png) show the refined pendant
roofs, ceiling beams, chair frames and table settings. The
[takoyaki entrance](reviews/takoyaki-entrance-depth.png) and
[retail frontage](reviews/retail-interior-depth.png) inspect the closed reveals
around distinct existing compositions. These are isolated runtime review views,
not site photographs. The complete city, every addition and its current pose
remain included in the QR transformation. Evidence and interpretation limits
are recorded in the [Kani reference](../../../docs/designqr-package/cities/dotonbori/references/kani-sign-reference.json).

The [secondary screens](reviews/secondary-screens.png) and
[crossfade](reviews/secondary-screens-blend.png) show their retained campaign
atlas at different points of the independent loops. The [bridge underside](reviews/bridge-soffit.png)
shows the fitted circular light, panel seams and continuous soffit. The
[River view](reviews/river-view.png) is the editor's optional higher angle;
Reset retains the low opening view. Updated transition reviews show oversized
panels contracting before flight, followed by synchronized city and landmark
assembly. The [motion record](../../../docs/designqr-package/cities/dotonbori/motion-proposal.md)
and [waterfront references](../../../docs/designqr-package/cities/dotonbori/references/waterfront-reference.json)
record timing and photo-fit limits. Every added surface and both frozen screen
blends remain in the QR transformation.
