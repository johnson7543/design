# Dōtonbori City preset

Status: Active source-study preset; detailed reconstruction remains incomplete<br>
Scope: `/qr`, `/qr/embed`, and the `designqr` React package<br>
Updated: 2026-09-20

[Design QR index](README.md) · [Source ledger](sources.md) ·
[Blender master and regeneration](blender-study.md) · [Reconstruction requirements](build-plan.md)

## Current behavior

The editor exposes **道頓堀**, presented as a night miniature.
Preset selection, remembered themes,
and control states follow the [editor contract](../../../designqr-editor/style-principles.md#city-preset-controls).

The public configuration uses `design: 'city', theme: 'dotonbori'`:

```tsx
<DesignQR value="https://example.com/osaka" design="city" theme="dotonbori" />
```

Direct links, hosted embeds, advanced React examples and downloaded
`designqr-dotonbori.png` files preserve this selection. The default accessible
3D label calls the artwork 道頓堀. Reconstruction status and source
limitations stay in the documentation rather than the public preset name.

## Geometry and evidence

The runtime loads a **58-building source crop** (52 LOD2, six LOD1) and the
complete 860-triangle Ebisubashi deck envelope from
[the asset pack](../../../../assets/design-qr/dotonbori/README.md). The focused
buildings have 3,732 triangles; the two GLBs total 332,044 bytes within the
768 KiB runtime budget. The original 73-building metric master and 160 m study
export remain separate research assets. Build validation checks the extended
source inventory, layout, closed topology and export hashes.

The product frame is a **144 m square**, centered exactly on 戎橋 at local
east 4.196907 m / north 2.163932 m, with the existing 45° rotation. All eight
reference hosts fit without boundary cuts. To condense the landmark composition,
Donki B092 and its entire attached assembly translate 80 m west, retaining their
source shape, height and south-facing orientation. It remains on the north bank,
east of the bridge and B031. This explicitly authored spacing is not geographic
survey data. The other seven landmark positions and the bridge remain unchanged.

Source buildings and streets come from the same Osaka PLATEAU GML tile. The
river keeps the recorded GSI outline; neither the road nor river is shifted to
accommodate Donki. Road/bank surfaces exclude its translated footprint, and its
frontage, wheel, storefront, reflected light and QR sources share the same
placement. Original geographic geometry remains in the source masters.

All 58 selected buildings and their details remain present at every 3D rotation.
Drag, Auto Spin and Reset retain the complete inventory and use ordinary depth
occlusion. Geometry, textures and complete detail indices are reused during
rotation. Every body and its attached details participate in both QR directions,
reversals, paused edits and delayed loading. See the
[composition record](references/qr-composition.json).

The extended source inventory contains 132 buildings in original coordinates.
Seventy-two footprints intersect the compact frame by at least 1 m² after the
recorded placement. Eight small edge remnants totaling 82.255 m² fail the
40 m² **or** half-footprint retention rule. Six context buildings
(B026/B027/B029/B030/B032/B033) are omitted to clear Donki and its one-metre
buffer. The remaining 58 include all eight complete landmarks. Selection
precedes detail and QR generation; variation indices retain stable audit labels.
The complete square ground and every QR target remain.

Cuts occur only at the outer square boundary and identify model sections, not
real façades. Authoring GLBs retain gold caps and coral LOD1 markers; the player
uses mineral `building`/`stone` section faces, restrained edges and muted LOD1
massing. No windows, doors or advertisements are placed through cut interiors.
The [focus layout](../../../../assets/design-qr/dotonbori/focus-layout.json)
records boundaries, source IDs and retained measurements. Uniform scaling maps
144 metres to one tile; glTF axes are east, up and south before rotation.

The opening camera looks from the **northeast, 65° north of east and 30° above
ground**, showing the central Glico running man across the canal. Reset restores that view; Auto Spin retains
the chosen elevation. Distance and QR fitting follow shared City rules.
The editor's zoom popover adds an optional **River view** at 50° on the same
bearing. It stops Auto Spin and centers zoom/pan. The chosen angle survives
QR turns but is not saved into links; Reset view restores the low opening.
Generated context retains its static southeastern height envelope, with normal-height
1F fittings. The opening-angle change preserves the existing building heights. Source footprints,
bridge registration and all eight reference-host dimensions remain fixed.

Don Quijote's **えびすタワー** retains its identified source host B092, placed
closer to the bridge on the north bank for the compact composition. The [wheel reconstruction](ebisu-tower.md) records operator dimensions,
manufacturer photographs, source registration and interpreted proportions.
Thirty-two upright cabins follow the fixed oval track on a 15-minute circuit.
Its solid frame, relief, storefront and cabins join the reversible QR transform.
Glico and Asahi retain their actual north-facing signs, visible in the opening view.
Orbiting reveals Donki's south-facing relief.

PLATEAU road footprints remain diagrammatic overlays. Generated waterfront,
shop detail and activity do not turn this miniature into a surveyed reconstruction.

## Runtime detail and evidence limits

The [waterfront compiler](../../../../scripts/blender/prepare-dotonbori-waterfront.py)
writes [waterfront-layout.json](../../../../assets/design-qr/dotonbori/waterfront-layout.json).
It derives bank strips from the water polygon, clips them to the frame, and
excludes source building footprints. The lower strip is an authored 2.2 m
interpretation; the upper strip extends within an 8 m envelope where space
permits. Its water/lower/upper display levels are 0.60/1.05/1.95 m. These are
encoded presentation assumptions and standard-section interpretations, not
observed local water or ground levels. Runtime fittings add paving divisions,
bank walls, bridge rails, steps, and related detail.
The September 21 finishing pass adds a source-envelope metal bridge underside,
panel seams and the circular light visible in S14, plus base plates at existing
riverwalk rail posts. A narrow wet-contact band partitions the bank wall around
the display water level, without overlapping skins. The 0.48 m underside depth,
2.8 m light radius, hardware sizes and waterline treatment are miniature
interpretations; [the reference record](references/waterfront-reference.json)
separates these choices from surveyed geometry.

The [landmark generator](../../../../packages/designqr/src/designs/city/dotonbori-landmark.ts)
retains a Glico sign interpretation and limited host-building glazing. Its sign
uses the owner's 10.38 × 20 m dimensions. Its B040 association follows the
frontal photograph's neighboring façade order and the source's 11 m north wall.
The 5.4 m T.P. bottom, face offsets and glazing are manual photo fits, not a
calibrated camera registration. The sign is painted procedurally,
not loaded from a redistributed photograph. B040 and its Glico sign, frame,
host glazing and light spill remain present at every rotation.
An uploaded logo occupies the north Asahi panel on B046; Glico remains intact.

The [night frontage layer](../../../../packages/designqr/src/designs/city/dotonbori-facades.ts)
retains the B046 Asahi corner, B031's two screen openings and glazing,
and B034's commercial glazing, vertical
ribs and upper AQUA/Haier panels. Its upper and lower fronts follow the PLATEAU
setbacks; the east upper wall starts at 37.11 m T.P., above the lower 30.83 m
envelope. Closed ribs and recessed glazing follow the actual sloped east
surface between those elevations, with aligned upper/lower strips. The
B037/B039/B041 sign sequence is also present; all
original seven photographed hosts retain their source dimensions and attached detail.
Panel sizes, floor
rhythms, lit-window occupancy and ribs are manual photo fits, not surveyed
construction. Original Canvas artwork
uses reference-directed lettering, panel proportions and original illustrations
without bundling reference photographs or claiming exact campaign graphics.
The sign cabinets have shallow reveals, edge caps and projecting lamps on the
photographed reflective panels. Glazing has transoms and seeded partial blinds;
the band under SAMTY includes window divisions and louvered service units.
Cabinet depths, lamp spacing, blinds and unit dimensions are miniature fits.
The Glico header also uses fixed original script strokes rather than a system-font fallback.
The runner's tapered limbs, asymmetric fists, facial contours, garment seams
and shoes follow the owner's frontal still. Its raised calf remains tucked
behind the thigh, and the same figure is retained in both LED backgrounds.
The compact illustrations interpret S14's dairy/Kaigen graphics and S6's Asahi
can and Glico runner. The riverbank review adds seven missing panels: the north
Pip clock and Snow Brand slogan, east Pip/FANCL pair, Hana Langue advertisement
below SAMTY, and the south Salonpas/H&M pair. The existing east H&M panel uses
the same photographed fashion-panel treatment. B037's dairy stack is refitted
below the clock; B037-east's upper registration preserves its existing ground
floor. Hana Langue identifies an advertisement, not a shop at that address.
The [sign inventory](../../../../packages/designqr/src/designs/city/dotonbori-sign-layout.ts)
and [fitted audit](references/facade-audit.json) record all 21 regular sign quads;
Glico and the Kani street fascia retain their separate owners.

The 2048×1536 reference atlas has twenty original art cells and a private navy
logo cell. Each drawing clips to its cell to prevent artwork bleeding into a
neighbor; north/west Asahi fits and the uploaded-logo backing remain separate.
The original Osaka roles and an already-approved green map the photographed
sign colors. Typeface, illustration and metric registrations remain miniature
interpretations. The Pip clock shows a fixed reference pose, not live local time.
All seven added panels retain their complete textured surfaces in the turn;
the atlas remains private and cached through content changes. QR-generated
campaign artwork keeps its separate atlas.
Its fourteen original campaigns now use Japanese headlines such as 大阪,
道頓堀, 川辺の夜 and 珈琲, painted from the same bundled outlines as the
reference signs. Small English captions and shared City layouts remain;
generic campaigns do not assign real tenants or invented floor directories.

Japanese labels and the bridge name use bundled Noto Sans CJK JP Medium outlines,
so missing system CJK fonts cannot turn them into empty boxes. The
[lettering builder](../../../../scripts/build-dotonbori-lettering.py) pins the same
font hash used by Shibuya. Its source is
[Noto CJK](https://github.com/notofonts/noto-cjk/blob/main/Sans/OTF/Japanese/NotoSansCJKjp-Medium.otf),
under the [existing SIL OFL notice](../../../../packages/designqr/third-party-licenses/noto-cjk.txt).
Run `python3 scripts/build-dotonbori-lettering.py --sans /path/to/NotoSansCJKjp-Medium.otf`
to regenerate the checked-in paths with Python FontTools. Ordinary builds need
neither FontTools nor a font download.

[S14 in the source ledger](sources.md#s14--osaka-tourism-bureau-night-photographs)
and the [night reference record](references/night-reference.json) identify the
inspected photographs, exact downloads, frontages and uncertainty. Capture dates
are unknown; the result is a composite visual reference state, not a dated
reconstruction. Out-of-crop attractions remain omitted. Unobserved façades use
explicitly generative artwork under the following contract, not claimed real finishes.

Each reference wall has one façade owner. The
[wall fitter](../../../../packages/designqr/src/designs/city/dotonbori-walls.ts)
groups nearly coplanar source triangles into one window rhythm, with a maximum
14.4 cm fitting tolerance in this crop. Approximate joins require a shared
source edge, so nearby parallel setback walls stay separate. The fitted plane
sits outside the source vertices to prevent the skin cutting through a warped
wall. Original building solids stay unchanged.
The [frontage registration](../../../../packages/designqr/src/designs/city/dotonbori-facade-layout.ts)
aligns twelve photo-directed façade sections to those walls. Reference walls receive no
second QR skin, including corner margins and spaces between signs. A structural
base fills every registered contour, and the complement of all reserved
rectangles is finished once per wall. The current audit records about 391 m²
of those margins. Glazing and trim use separated depths; patches clip to source
triangles and discard faces that collapse after Float32 conversion. B034's ribs
have closed side/end surfaces. Non-Glico sign rectangles fit wholly
on their support wall; Glico retains its verified dimensions and small frame overhang.

The [ground-floor detail layer](../../../../packages/designqr/src/designs/city/dotonbori-storefronts.ts)
retains **42 bays across eleven individually directed fronts**, with eight double-door entrances.
B037 has a compact dining frontage and B041 a takeaway/display frontage, guided
by S14's visibly different ground floors. B039 below SAMTY stays a neutral
commercial base; the previous unverified confectionery assignment is removed.
B040 retains a glazed lobby; B034's retail fronts mix mannequins, garment rails,
folded displays and quiet windows. B031 remains an unspecified commercial base.

The [frontage design rules](../../../../packages/designqr/src/designs/city/dotonbori-storefront-design.ts)
coordinate each full frontage instead of cloning a complete shop into every bay.
Uneven bay widths, off-center entrances, fascia lengths, frame finishes and
complementary counter/seating/shelf/glazing roles give fronts different compositions.
Known corner hosts share one finish and artwork treatment. A wall section is
not a surveyed tenant unit, and a display bay is not a separate shop.
Headers and menus use original artwork and portable Japanese outlines. Four
coordinated treatments occupy 48 cells in the same retained 2048×1536 atlas;
menus and awnings are localized to service areas. Unverified fronts stay unbranded.

The left side of the opening view now includes B046's three north-facing and
two west-facing restaurant windows, with tables, tableware, framed pendants,
frosted lower glazing and seafood menus. A small crab-tank vignette occupies
one west window. [S16's owner photographs](sources.md#s16--kani-doraku-main-store-ground-floor)
establish these first-floor feature types; their miniature arrangement and the
tank's window-facing placement are interpretations. The interior-depth pass
adds closed reveals, pitched pendant roofs, timber ceiling beams, upholstered
chair frames, paper settings, ceramic pots and chopstick holders from those
owner photos. Table and lamp offsets vary within the existing bays. Other
central fronts receive closed jambs/soffits and narrow glazing-edge highlights
while keeping their distinct uses and counter arrangements. Neither frontage invents
a public entrance. The adjacent B049 north front has seven contextual café bays,
including one entrance, two service/display counters, seating, shelves, quieter
glazing and one lantern. Its tenancy is unverified;
the upper building retains QR-generated architecture. These ten riverwalk fronts
have five food/display counters, three lanterns and five menu cases.

The [owner's street photograph](sources.md#s19--facade-completion-references)
directs B046-south's distinct entrance reveal, tiled eave, pale vertical panels,
inset window bands and dark corner framing. It replaces that wall's generated
restaurant frontage while retaining the host's identity. The registration uses
the actual south wall's east/north outward normal `(-0.19226348, -0.98134334)`
and source floor at 1.26 m. Relief is at most 0.81 m; the entrance/eave occupies
3.65 m above the source floor. The photographed lower elevation directs features
through an interpreted 12.6 m band; the unphotographed upper area stays structural.
Ten small warm lamps sit below the canopy. The entrance is represented visually;
unresolved street paving levels do not create a functional door, invented steps
or a pedestrian route. The exterior crab is now fitted above that eave on the
street wall, with closed shell/limbs, eight folded legs, two opening pincers and
six uplights. The [Kani source record](references/kani-sign-reference.json)
registers its reservation, owner photographs and inspected historical footage.
Its 12-second cycle is authored; all surfaces and the current pose join QR turns.
Projection is bounded to 1.6 m, independently of the 0.81 m entrance detail.
Orbiting to the street side reveals it; the river-side opening view retains
normal building occlusion. The [completion record](facade-enhancement-plan.md) distinguishes
observed features from interpreted proportions and unresolved rear elevations.

S14 establishes the commercial-base placement. [S15's local references](sources.md#s15--ground-floor-shop-and-food-service-context)
guide food-service character; generic uses and fixtures are miniature
interpretations, not verified tenants, surveyed floor plans, prices or menus.
These riverwalk food counters meet the modeled upper walk at 1.95–2.00 m T.P.; their
relief stays within 0.79 m of the support wall. There is no detached furniture
in the walking lanes. Two source-clipped forecourts fill the gap between the
B046/B049 north walls and the existing upper walk: 101.4 m² at the display level
of 1.95 m, excluding water, existing walks and building footprints. Their extent
and level are modeling interpretations, not surveyed paving or a resolved local
datum. B046's west side remains window-only. Existing B031/B034 display-floor
fits remain approximate.

Standard shops reserve the lower 3.1 m of their frontage, excluding generic glazing
and upper-window grids. B046-south owns its complete source-fitted wall. B049's
ground-floor-only section and B092's Donki wall bring the registration count to fifteen.
All opaque fittings, forecourts, menus and transported surfaces belong to
their source host and remain present at every rotation. Every host and its
details participate in both QR transition directions.
See the [food-counter close-up](../../../../assets/design-qr/dotonbori/reviews/storefront-south.png),
[neutral commercial frontage](../../../../assets/design-qr/dotonbori/reviews/storefront-commercial.png)
and [retail frontage](../../../../assets/design-qr/dotonbori/reviews/storefront-central.png),
plus the [left block](../../../../assets/design-qr/dotonbori/reviews/storefront-left.png)
and [restaurant window](../../../../assets/design-qr/dotonbori/reviews/storefront-crab-display.png).

The [context ground-floor resolver](../../../../packages/designqr/src/designs/city/dotonbori-ground-floor-layout.ts)
fills every remaining eligible exposed source-ground wall, including side and
rear faces. For `https://example.com/dotonbori`, this adds **239 sections and
561 bays**. With the eleven bridge-area fronts and Donki storefront, the scene
has **251 sections, 609 bays, 24 entrances, 90 food/display counters and
75 menus**. The [coverage record](references/ground-floor-coverage.json) audits
all 58 buildings, fitted sections, exclusions and source/code hashes.
56 buildings have exposed detailed fronts; B005 and B054 are enclosed at ground
level and retain structural finishes.

Context uses and interior details follow QR content: cafés, dining windows,
confectionery displays, garment rails, lobby information panels and mailboxes,
closed shutters, meters and vents. Existing host uses remain coherent: H&M
faces stay retail, Glico's base stays a lobby, and Asahi's restaurant keeps
dining character. These unobserved faces are interpretations guided by S15,
not newly verified tenants. Lobby information graphics do not label unsupported
display windows as entrances. The context layer shares the private storefront
atlas and source-building ownership used by the individually directed fronts. The
coverage record includes bay roles, widths, finish/artwork choices and layout keys
for auditing variation; these are design identifiers, not business identities.

The resolver samples source-wall intervals at no more than 0.45 m spacing,
reserves a 3.1 m band, checks rectangular support and neighboring-body/crop
clearance, and limits relief to 42% of that clearance, capped at 0.62 m.
Partial walls receive only triangle-clipped panel/rib details, with no unsupported
boxes or menus. Source floor elevations remain intact; new doors require modeled
ground within 0.16 m of their floor across their full width and projection. Other fronts use display windows or service
finishes. Terrain datum gaps are not silently converted into measured entrances.
Shared/blocked walls, crop caps and strips under 0.65 m stay structural.

See the [north-bank fronts](../../../../assets/design-qr/dotonbori/reviews/ground-floor-north.png),
[west-bank retail](../../../../assets/design-qr/dotonbori/reviews/ground-floor-west.png)
and isolated [south-side](../../../../assets/design-qr/dotonbori/reviews/ground-floor-south.png)
and [rear-front](../../../../assets/design-qr/dotonbori/reviews/ground-floor-rear.png) inspections.

### QR-generated buildings

All 58 selected buildings receive supported surface detail: source-contour
windows, sills, floor bands, corner returns, cornices and shop glazing where
there is exposed wall clearance. Enclosed party walls retain structural finishes. Map-cut caps stay plain.
Roof equipment and ventilation fins require complete flat support from the
actual roof triangles; they cannot bridge a setback or hang over a cut edge.
All 58 hosts also receive source-fitted panel joints and edge flashing on flat
and sloping roofs, including Donki's broad rear slope. Courses align across
source triangles and avoid artificial diagonal seams; the B034 east setback
retains its photographed glazing/ribs. The existing source roof remains the
backing surface. These QR-derived finishes retain building ownership during
the full-surface transform and do not claim surveyed roof construction.
Window and band polygons are clipped to their source wall triangles. Generated
upper windows leave the ground-floor glazing clear; reference walls use the
exclusive frontage layer described above.

The [shared building rules](../../../../packages/designqr/src/designs/city/building-variation.ts)
are the same functions used by Shibuya: every QR bit and the matrix size feed a
stable hash, while local dark-cell density contributes to contextual height.
The 50 context buildings use the shared 0.73–1.20 height multiplier, quantized
to 0.005 tile units (0.72 m here), with an 8 m minimum. Their source heights are
limited by a static envelope: the maximum body top eases from 48 m to 12 m over
−0.18 to +0.37 tile units along the fixed southeast composition axis. Apply QR variation within that
envelope and clamp to its top. At the review value, nearby B050/B047/B048/B077
finish around 10–12 m. Floors, campaign cabinets and roof equipment are rebuilt
against the shorter bodies, with normal 3.1 m 1F fittings. Horizontal vertices,
ground datums and stepped-roof topology remain source-derived.
B038, the narrow LOD1 block beside B037's Pip/FANCL side advertisements, has
a separate 12 m body-top limit. This static miniature adjustment keeps the
sign stack clear while retaining the complete footprint, closed body and 1F;
QR edits rebuild its fittings within the lower envelope. It is not a revised
survey height and does not depend on the current camera.
B031/B034/B037/B039/B040/B041/B046/B092 retain source dimensions. QR content varies glazing, lit windows,
bay widths, sill proportions, floor spacing, roof equipment and original campaigns.
Equal-size different values change the architecture; restoring a value restores
the same model. These details and context heights are artistic choices, not a
survey or a reconstructed inventory of real businesses.

Suitable context fronts carry original signs using Shibuya's sign layouts and
lettering painter with the Osaka palette. A private 2048×1024 atlas is painted
once; panels select its 14 designs through UVs. B031's two documented screen
openings also select original campaigns and cycle through three designs on
independent 30/39-second loops. Slow 2/2.2-second crossfades use the existing
atlas and the private activity clock. The current blend freezes through QR
turns, pause, reduced motion and content edits; the campaigns are original,
not a verified advertising playlist. Their 2:1 artwork is letterboxed into
the fixed 13.3×7.3 m frames to preserve glyph proportions. Photographed Asahi,
AQUA, Haier and H&M identities retain their reference placement.

The river has source-contained ripples and broken light reflections below the
retained photographed frontages. Their positions and width/depth drift independently;
nearby wake crests add a mild disturbance. Motion envelopes stay inside the
mapped shoreline and rotated tile. Slow glimmer uses the existing activity clock.
A single material pass adds restrained light spill to water,
stone and nearby walls, without a bloom render target. Source road polygons
and upper riverwalks gain clipped paving joints, bank lamps gain luminous cores,
and the bridge gains fascia divisions and its photographed underside light
ring and ribbon. Paving scale, light reach and reflection intensity are illustrative.

The [activity layer](../../../../packages/designqr/src/designs/city/dotonbori-activity.ts)
contains a modeled DOTON boat and 64 articulated pedestrians, including walking
and standing groups on the bridge and riverwalk. Their dimensions, routes,
poses, and timing are encoded modeling choices, not an observed traffic record.
DOTON follows the operator's general arrangement: 16.4 m overall, 15.4 m between
perpendiculars, 3.6 m beam, 0.9 m moulded depth and 0.5 m draft. It has an open
deck, paired benches, center aisle, forward helm, rails, stern equipment, DOTON
lettering, 26 seated passengers, one crew member and a restrained wake. Its
fittings and seating are simplified photo interpretations. The current gallery
lists 60 passengers; the older drawing lists 80. These are separate from the
representative crowd in the model. [S13 in the ledger](sources.md#s13--ipponmatsu-dotons-operator)
and [the retained reference record](references/waterfront-reference.json) preserve
the original links, hashes, dimensions and interpretation limits.

The boat travels east at a representative 1.35 m/s, following the mapped
channel center. Material clipping trims the boat at the tile boundary;
the route resets only outside the visible square. The wake uses twelve retained
emissions, each with six curved ridge segments. Crests start at historical stern
positions every 0.72 seconds, spread, drift slowly and fade over 8.64 seconds.
They remain in the water after the boat moves. Shoreline and tile clearance fade
each segment before it crosses a boundary; old emissions finish independently
when the boat wraps outside the crop. One additional draw reuses fixed position
and RGBA buffers, with no added texture. Every active wake segment and the river's
complete reflection surfaces retain current positions, colors and frozen shader
uniforms in the QR surface transport. The
[water motion reference](references/water-motion-reference.json) separates the
inspected operator photographs from these authored parameters.

The [cloth layer](../../../../packages/designqr/src/designs/city/dotonbori-cloth.ts)
replaces the three existing solid noren and mast pennant with thin fabric.
Twelve curtain flaps have fixed top seams, separate gaps and painted light marks
that bend with the cloth. A shared 18-second breeze envelope includes four
seconds of stillness across its boundary; stable flap phases vary the free-edge
motion. Curtains stay in front of their doorways, within the existing facade
relief. The flag's hoist remains on the pole and shares boat motion and clipping.
Both fabric faces render with depth testing. Two retained position buffers and
private materials add no texture or per-frame geometry allocation. Every fabric triangle and fixed curtain rod carries its actual geometry
and paint into the QR turn. Noren follow host
ownership and remain present with every building throughout the transformation.
The [cloth motion reference](references/cloth-motion-reference.json) records
authored wind, clearance and the pre-existing fitting assumptions. It does not
establish exact real shop curtains, an identified operator flag or measured wind.
The [noren close-up](../../../../assets/design-qr/dotonbori/reviews/noren-motion.png),
[pennant close-up](../../../../assets/design-qr/dotonbori/reviews/pennant-motion.png)
and [QR-turn capture](../../../../assets/design-qr/dotonbori/reviews/cloth-motion-morph.png)
show the implemented geometry and transformation.

The [shop activity](../../../../packages/designqr/src/designs/city/dotonbori-shop-activity.ts)
adds two distinct scenes to existing fitted counters. A blue-shirted worker at
B041 uses a preparation pick over the food surface, then rests. At B037 an
ivory-shirted server passes a tray with three food pieces to one customer, who
steps aside, holds it, returns it and steps aside again. The 23-second preparation
and 40-second service cycles have separate timing. Hands continuously support
the tray; the loop never removes or teleports it. Staff fit above the worktops
in the shallow relief, and the customer's entire path stays on supported upper
promenade pavement within its counter bay. These are two added staff and one
customer, separate from the existing 64 pedestrians.

The [reaction layer](../../../../packages/designqr/src/designs/city/dotonbori-reactions.ts)
animates two existing bridge visitors' phones on independent 26/33-second cycles.
Phones remain in their hands throughout raising, holding and lowering. Another
visitor turns toward and greets the nearby boat. One of the existing 26 seated
passengers replaces its rigid body with an articulated pose and a staggered
wave. Boat/bridge greetings ease in over 28–12 m proximity and stop when distant.
The three crabs in the existing B046-west display replace their old rigid shapes
with short sideways steps, leg lifts and claw movements on 21/27/33-second cycles.
All their vertices remain clear of the tank's pedestal, frame and backing.

These actions use three retained vertex batches and no additional textures.
Source-wall ownership controls shop actors, while boat activity shares the
vessel's transform and crop. Every modeled body part, utensil, tray item,
phone and crab limb contributes its complete surface in its current pose.
Transforms, reversals and content edits preserve that frozen geometry. The [activity reference](references/activity-motion-reference.json)
distinguishes supported local food/tank/cruise character from authored movement
and interpreted shop placement; it does not establish actual tenants or choreography.
The [counter](../../../../assets/design-qr/dotonbori/reviews/shop-service-motion.png),
[phone](../../../../assets/design-qr/dotonbori/reviews/bridge-phone-motion.png),
[passenger](../../../../assets/design-qr/dotonbori/reviews/boat-greeting-motion.png)
and [tank](../../../../assets/design-qr/dotonbori/reviews/crab-tank-motion.png)
captures show the current poses. The [QR turn](../../../../assets/design-qr/dotonbori/reviews/activity-motion-morph.png)
includes these parts in the complete city transformation.

The bridge's sixteen mobile visitors have open journeys between destinations.
Eight cross the span between the approaches; four make shorter visits toward
the river, and four wait and shift position near the approaches. They slow to
a complete stop, linger and look around, then turn in place before departing.
Crossers wait 8–32 seconds at their destinations, while local visitors wait
19–44 seconds. Outward and return speeds differ, and seeded phases keep the
trips independent. Slightly curved paths retain passing space and clear the
existing eight bridge viewers; there are no oval laps or position resets.
Full strides stay on the source deck. The existing viewing pairs, phones and
boat greeting remain, and head orientation joins the current body position
in the QR morph.

Each lower bank retains its two-way walking path with irregular gaps, independent
stops and smooth following. Circular constraints ease a walker down to a leader's
speed before contact. Each bank path shares a mean travel rate, so faster walkers
cannot accumulate laps through slower ones; following distance is 1.45 m.
The opposing streams have 1.16 m of lateral separation before the channel bend
and turn before the sharp eastern narrowing so complete strides remain over
the modeled promenade. Stopped walkers keep their arms down in the through
lanes; stationary photo visitors retain their gestures. These are authored
visitor behaviors, not observed traffic. All movement is evaluated analytically
at the retained scene time, including seeking, pauses, content edits and QR
turns. There is no frame-dependent crowd simulation, and the boat mast clears
the bridge.

The bridge GLB remains an incomplete dimensional envelope with the unresolved
31 mm profile/section discrepancy. Runtime rails, steps, bank connections, and
sign fitting do not resolve finished-surface, support, or local registration
gaps. See the [remaining reconstruction gates](build-plan.md). Color assignments
belong to the [package color mappings](../../color-palettes.md#dotonbori-source-study-roles).

## Motion and logo

The complete source study, bridge, waterfront, illuminated fronts, reflections,
activity and datum board participate in Dōtonbori's approximately 0.99 s turn
at `1×`, rebased from its former `0.75×` pace. The speed setting remains `1`
by default across editor, shared links and public players; other designs keep
their existing baseline. [Complete surface transport](../../../../packages/designqr/src/designs/city/dotonbori-surface-morph.ts)
retains every drawn triangle, its original UVs, paint and frozen live shader.
Matching planar triangles become panels; other triangles retain their shape.
Area-conserving correspondence divides these surfaces into positive-area patches
that cover every canonical QR cell exactly once. Buildings/details supply dark
cells; ground, bridge, waterfront fittings and water effects supply paper.
The transport borrows the existing atlases and uses material batches, with no
sampled-detail cap. Original meshes remain instanced and efficient in settled 3D.

[Shared surface timing](../../../../packages/designqr/src/designs/city/dotonbori-transition.ts)
starts at 0% and ends at 90% for architecture, ground, Glico and Donki,
independently of camera angle and QR density.
Ordinary architecture moves as groups before oversized panels contract to at
most one cell in diameter, converge on cell centers and expand into assigned
cell strips. Smaller surfaces retain their scale in flight. Expansion follows
arrival; all groups use the same 72–90% settle. Ground shares the architecture's
0–40% contraction and 40–74% travel. A canal-weighted warm pulse
and bounded 0.018-tile above-ground lift coordinate the sequence. Ground has no
lift. Original positions/colors are captured once per turn; a progress uniform
alone drives playback and reversal. Content edits rebuild at the retained phase
and preserve the activity clock, reference dimensions and source footprints.

The wheel's complete rails and 32 cabins gather into the top-right finder's
24 outer dark cells, with interior relief filling its nine dark center cells.
Its lower storefront follows its host. Every wheel patch uses the same
contraction, travel and expansion as ordinary architecture, reaching its cell
center during the 40–74% travel interval. Landmark targets avoid the central logo
footprint. Glico retains a textured folding panel with a 0.12-tile lift.
Its fold runs over 0–74%, followed by the same settle as the city.
All surfaces reach exact cell positions and canonical
inks by 90%; the shared QR layers complete their endpoint handoff at 100%.
The [enhancement record](spectacle-proposal.md) documents phases, resource costs
and verification. Shibuya keeps its existing correspondence and timing.

The night palette darkens the roofs and walls against illuminated signs and
warm 1F openings. Stronger low-level sign spill and reflected color emphasize
the canal. A tighter, lower-strength version of the presentation canvas's
bright-pixel glow sits behind the sharp source image, adds no WebGL pass, and
fades out by 65% of the turn. Transparent exports bypass that glow. Donki keeps
its muted mineral paint and narrow warm rail/cabin rims. These are authored
night presentation effects, not measured lighting installations.
Continuous, site-fixed diffuse shading gives roof slopes and rounded relief
consistent volume. A 192×192 CPU height field built from current source roofs
adds nearby sky obstruction to static vertex paint. Explicitly luminous
windows/fittings retain their brightness. Original colors are saved per geometry,
so content edits recalculate obstruction without cumulative darkening. The bake
adds no GPU textures, passes or geometry and follows every surface into the QR.
Generated upper windows also have narrow dark reveals behind inset glazing.

B031's campaigns, the Glico panel and all other textured fronts carry their full
surfaces and source atlas coordinates. Glico borrows its frozen track/rainbow
uniform during the fold; B031 borrows both current campaign frames.
All surface paint blends into scan inks over 54–90% of shared progress.
No textures are repainted or uploaded during a
turn. At the QR endpoint the source and transport groups are hidden. Border
owns the quiet zone; transparent output, module colors and PNG capture retain
the shared City presentation path.
The whole night atmosphere fades to Shibuya's light scan backdrop in QR view,
then returns to night in 3D. This preserves borderless scanning without adding
a local card or changing QR inks. The existing background transition supports
reversals and commits immediately under reduced motion.

The Glico sign alternates between original track and rainbow/road illustrations
derived from inspected owner/manufacturer photographs. Its 16-second loop uses
readable holds and two-second eased crossfades. The runner and current header
remain fixed. One 1024×987 atlas is painted once per player; a shader blends its
two cells without runtime canvas painting or texture uploads. Existing Glico
reflection strips use the same phase to blend blue toward bay and coral toward
gold while participating in the river's gentle drift. The [animation reference](references/glico-animation-reference.json)
records the inspected stills and distinguishes the authored sequence and light
response from a verified current advertising program. Static Blender reviews
retain the original track appearance at time zero.
The generated [atlas review](../../../../assets/design-qr/dotonbori/reviews/glico-led-atlas.png)
and [folding capture](../../../../assets/design-qr/dotonbori/reviews/glico-led-morph.png)
show the implemented artwork and its QR transition.

The shared boat/crowd/water/Glico/cloth/shop-action clock advances only during running, settled 3D playback. It freezes
while paused, during the QR turn, in QR view, and under reduced motion. The
turn captures complete action poses and props, Glico artwork phase, moving water/wake and cloth geometry, and reflected colors for the morph
and reuses them through reversals;
content changes preserve footprints, landmark dimensions and the activity clock. The camera
turntable is independent. An uploaded logo fits inside the north-facing Asahi
panel on B046, with a 0.20 m inset on each side and its plane 0.18 m beyond the
sign. Its original aspect ratio is bounded by the shared logo limits. Fit the
image against the top of this area, keeping square and wide artwork above more
of the nearby Donki silhouette at the low opening angle. It remains fully
inside the existing panel. The private atlas changes only this panel's backing:
dark uploads use Osaka ivory, while light uploads retain navy. A one-time,
alpha-weighted 32×32 brightness sample chooses the backing; uploaded pixels
and transparency are unchanged. The west Asahi panel remains original. Replacing/removing the upload
updates immediately, including while paused; removal restores the original
north artwork. QR content edits retain the logo state without changing another
player's atlas.

The logo stays attached to the Asahi host at every 3D rotation, with ordinary
depth occlusion. It uses the shared Shibuya sign-to-QR travel in both directions,
ending at the exact QR center. The uploaded north panel never emits old
Asahi artwork; transported surfaces read the current backing UVs. Reduced motion commits directly. This uploaded artwork is explicit
user customization, not a claim of real advertising.

## Asset lifecycle and verification

[`dotonbori-asset-plugin.mjs`](../../../../scripts/dotonbori-asset-plugin.mjs) packages
the reviewed GLBs, layout, and waterfront data into a separate lazy chunk. Tree and Shibuya do not request
it. No asset copy, source URL fetch or Blender installation is required by a
package consumer. Geometry parsing is deduplicated into CPU templates; each
player owns its cloned GPU geometry and materials. A late load attaches only
on a running frame at a settled endpoint. Paused, transitioning and disposed
players do not attach it. Load failure leaves QR view available.

Content edits rebuild only contextual envelopes, façade details, campaign UVs
and QR/morph correspondence. Fixed-host geometry, water, bridge, crowd, boat,
private sign materials and atlas textures remain attached. Geometry that was
replaced is disposed. The scene updates synchronously without advancing time,
including while paused, during a turn and in settled QR. Restoring content is
deterministic; no additional animation loop, buffer or source download is created.

[`dotonbori.test.ts`](../../../../packages/designqr/test/dotonbori.test.ts) covers
crop counts, retained metric vertices, bridge dimensions, diagonal
water coverage, complete ground coverage, outer-boundary caps, complete
visibility of all 58 selected buildings, fixed footprints/landmarks, deterministic content variation, roof support,
independent disposal, full QR correspondence, late/failed loading, complete
activity loops, varied crowd spacing and stops, channel/bridge clearance,
source-contained water reflections, shared Shibuya QR targets and pose/clock
preservation through paused edits, reduced motion and reversals. Glico coverage
includes independent player phases, synchronized reflected light, retained
textured halves/frame/reflection groups and unchanged resources through QR edits.
Water tests cover shoreline/tile containment throughout a complete boat loop,
continuous emission recycling, frame-rate independence, spreading crests and
every active wake segment's frozen correspondence through dense content edits.
Cloth tests cover fixed seams, flap separation, facade/mast clearance,
nondegenerate fabric, quiet intervals, independent players and every strip's
frozen QR correspondence through dense edits and the return to settled 3D.
Local-action tests cover fitted bay coordinates, tank and boat clearance,
continuous tray support, handheld phone contact, distinct quiet periods and all
146 parts through dense content edits, independent players, complete hosts,
pauses, reduced motion, reversals and disposal. Close-up browser checks require
changing rendered pixels for each action while retaining geometry/material
identities and freezing their buffers throughout the QR turn.
Crowd regression checks sample an hour of movement, including the previously
intersecting bridge and bank pairs. Bridge journey checks cover complete
crossings in both directions, destination holds, smooth turns, look-around
pauses and facing the direction of travel. A separate ten-minute sweep checks
the actual oriented boxes of all walking limbs and bags against other people,
checks bridge strides against the source deck triangles and verifies full bank
strides stay over the source-clipped promenade. Browser captures cover
both areas at the former collision times and after an hour, with frozen corrected
positions throughout both QR directions. The
[bridge](../../../../assets/design-qr/dotonbori/reviews/crowd-bridge-clearance.png)
and [bank](../../../../assets/design-qr/dotonbori/reviews/crowd-bank-clearance.png)
close-ups retain examples of this spacing review.
`npm run smoke:dotonbori` checks the
1440×900, 390×844 and 320×568 editor, QR decoding, reverse motion, content
edits, PNG export, theme restoration, React examples and hosted embeds. It
writes review captures to `/tmp/designqr-dotonbori-review` by default.
`npm run smoke:dotonbori-scene` checks 48 views across both orbit directions,
all 58 selected visible hosts and their complete detail, stable GPU storage, Asahi logo
presence, both QR transition directions and decoded PNG output.
The [sign visibility review](../../../../assets/design-qr/dotonbori/reviews/sign-visibility-audit.json)
checks both Pip/FANCL side panels against actual scene triangles and verifies
the raised Asahi logo with square, wide and tall uploads. At the opening angle,
the square sample improves from about 74% to 90% unoccluded area; the wide
sample reaches about 97%. Tall artwork still follows the full panel's ordinary
occlusion. The [dark-logo capture](../../../../assets/design-qr/dotonbori/reviews/asahi-logo-visibility.png)
shows the contrasting backing. The smoke checks also cover light uploads,
panel bounds, atlas restoration and the unchanged QR endpoint.
It compares actual rendered Glico pixels at track/blend/rainbow phases and checks
the borrowed frozen shader/atlas through both transition directions.
It also isolates the water layer to verify changing rendered pixels and checks
that river/wake buffers remain frozen throughout QR turns and paused restoration.
Fabric close-ups compare moving pixels, both viewing sides and retained buffers,
then verify frozen fabric during QR turns and paused restoration.
Geometry tests cover all 58 selected source bodies, nondegenerate detail faces,
exclusive reference-wall ownership, duplicate façade triangles, supported sign
rectangles, the individually directed ground-floor fronts, and complete context
coverage, including alley clearance, partial-wall fitting, supported entrances,
preserved retail use and owned menu artwork. Close-up review renders the complete
city with all hosts visible, matching the normal runtime behavior.
`DESIGNQR_DOTONBORI_CONSUMER` points it at a built installed-package fixture
for non-root delivery and independent-player verification.

Implementation: [asset loader](../../../../packages/designqr/src/designs/city/dotonbori-assets.ts),
[metric layout transform](../../../../packages/designqr/src/designs/city/dotonbori-layout.ts),
[surface correspondence](../../../../packages/designqr/src/designs/city/dotonbori-surface-morph.ts),
[scene](../../../../packages/designqr/src/renderer/webgl/DotonboriScene.ts).

The [editable waterfront review](../../../../assets/design-qr/dotonbori/dotonbori-waterfront.blend)
and its [opening river view](../../../../assets/design-qr/dotonbori/reviews/waterfront-axonometric.png)
and [east](../../../../assets/design-qr/dotonbori/reviews/waterfront-night-east.png) renders
capture the complete runtime geometry in metric coordinates for
`https://example.com/dotonbori`, including all 58 selected building bodies, attached
detail, and a time-zero activity pose. Counts and hashes are recorded in the
[review manifest](../../../../assets/design-qr/dotonbori/waterfront-review-manifest.json);
it does not replace the original source masters.
