# えびすタワー in the compact landmark composition

Status: Implemented 2026-09-20<br>
Owner: DesignQR package artwork and motion

[Back to Dōtonbori](README.md) · [Source ledger](sources.md#s22--ebisu-tower-reconstruction) ·
[Reference measurements and image hashes](references/ebisu-reference.json)

The miniature includes Don Quijote's **えびすタワー** on its identified north-bank
store, east of Ebisubashi. The user-requested compact composition moves the
complete Donki assembly 80 m west while preserving its source building shape,
height and river-facing orientation. The bridge is exactly at the tile center.
Distances between landmarks are illustrative; the source masters retain the
original geographic coordinates.

## Source registration

The [operator's map](https://www.donki.com/store/map.php?shop_id=110) places the
store pin inside PLATEAU building `bldg_62a12ed7-ad07-4a43-8a33-c8720026bbaa`,
labeled B092 in the [extended audit](references/east-site-audit.json). Its LOD2
store roof reaches 44.57 m; its taller LOD1 envelope includes the attraction.
The detailed LOD2 body is retained. Intamin's front, oblique and cabin photographs
establish the fixed yellow oval truss and south-facing mounting position.

The [operator's specifications](https://www.donki.com/kanransha/) give the
77.4 m highest point, 10.5 m boarding platform, 32 cabins and 15-minute ride.
The geometry adopts those relative heights and cabin count. Its ground reference
is the host's 1.785 m LOD1 minimum; agreement with the LOD2 zero base and local
bank datum remains unverified. Track radius, truss depth, cabin dimensions,
relief and storefront fittings are photo-derived miniature proportions, not
engineering measurements. Reference photos are inspected and hashed, not shipped
as textures. No current advertising campaign or operating schedule is claimed.

## Geometry and presentation

The square measures **144 m**, centered on the recorded bridge registration at
local east 4.196907 m / north 2.163932 m, with the existing 45° rotation.
All eight landmark hosts fit completely. The original 73-building master and
the extended 132-building source inventory retain their geographic coordinates.
The focus layout records Donki's `[-80, 0]` east/north translation separately.
Its south-wall hint moves from E135.52/N15.91 to E55.52/N15.91, east of B031.

The composition retains 58 buildings after eight small edge omissions and six
context omissions around Donki (B026/B027/B029/B030/B032/B033). The latter
clear its footprint plus a one-metre buffer. No landmark is omitted or cropped.
The closed focused solids contain 3,732 triangles. The unchanged 860-triangle
bridge and building GLBs total **332,044 bytes**, within the 768 KiB budget.

The river comes from the previously recorded, unclipped GSI water polygon.
Bridge fittings and visitors retain the bridge registration, now also the tile
center. Streets and the river keep their source alignment. Road and bank
surfaces exclude the translated Donki footprint. Muted gold/coral reflections move
with the wheel frontage; the boat follows the mapped channel.

The opening camera looks from the northeast, 65° north of east and 30° above
ground, so the central Glico runner and north-facing sign row are visible immediately.
Reset restores that view; orbiting reveals Donki's south-facing wheel relief.
Generated context tops retain the 48 m to 12 m envelope toward the southeast,
independently of the opening camera.
This envelope is fixed during geometry generation. All buildings remain present
at every camera angle; the eight reference hosts keep their source dimensions.
Normal 3.1 m ground-floor fittings are retained. Generated campaign cabinets
require space above them, and entrances require support across their full width
and projection when paving levels change.

The wheel includes four tubular rails, track and interior cross/diagonal bracing,
photo-directed oval stiffeners, support masts,
boarding frontage, a shallow solid Ebisu/fish/Donpen relief, circular coral cabins,
glazing and illuminated rims. The Donki fascia and tower lettering use bundled
Japanese outlines. Its six ground-floor bays have one entrance and five
merchandise displays. Layout and small fittings are interpreted from the references.
Closed cabin and frame geometry can be viewed from either bank.
The manufacturer's front close-up directs additional inset ears, raised
moustache lobes, garment folds, fingers, Donpen flippers, separated bill
surfaces and rounded toes. Continuous surface shading describes their volume;
the static structure also receives the building-derived ambient-depth bake.
These are original solid interpretations in the existing muted palette, not
photographic textures. All added relief surfaces retain B092 ownership.

The night finish follows the surrounding blue-gray miniature: the host wall
uses the shared building paint and most of the truss uses cool steel. Muted
gold remains on the two front rails, while the coral cabins and relief paint
blend toward the shared stone finish. Warm lettering, small lamps and cabin
rims retain the attraction's identity without a uniformly yellow frame.
The [palette contract](../../color-palettes.md#dōtonbori-source-study-roles)
also governs its reflected light and frozen QR fragments. This is a coordinated
artistic treatment; source dimensions, mounting and cabin motion stay fixed.

## Motion and QR behavior

Thirty-two upright cabins follow the fixed stadium track at uniform path speed,
completing a circuit in 900 seconds. The seating never rolls with the rail tangent.
The store and frame remain stationary. Boarding door/pivot motion is not simulated.
The wheel uses the existing scene clock, so pause and reduced motion freeze it.

Every cabin and the complete rail, support, relief and storefront geometry
retains its current pose in both QR directions, reversals and content edits.
The upper wheel forms the top-right QR finder: rails/cabins own its 24 dark
outer cells and the interior relief owns its nine dark center cells. The lower
storefront follows the host's ordinary surface transport. Full surfaces retain
source colors into the shared 54–90% paint blend. Wheel patches contract,
travel to cell centers and expand with ordinary architecture throughout the
turn. Wheel, host, storefront and the rest of the city finish their geometry
together at 90%; the finder has no overlap with the logo
footprint. All 58 source bodies and every live detail retain complete area
ownership in the QR. Unchanged modules reuse building/detail geometry.

The [implementation](../../../../packages/designqr/src/designs/city/dotonbori-ebisu-tower.ts)
uses one static merged mesh and one instanced draw for the cabins. No new runtime
texture or network dependency is added. The editable Blender review contains
32 separately named cabins at time zero.

## Verification

Geometry tests cover bridge centering, complete landmark envelopes, the recorded
Donki translation and neighbor clearance, retained horizontal shape, closed source topology,
façade ownership, ground-floor clearance, all cabin positions over a complete
ride, upright floors, spacing, loop continuity, reference-directed left/right
relief placement, freezing, full surface ownership and the legal finder cells in QR turns. Reopening both Blender files verifies 58 closed focused bodies,
405 review objects, 348,940 triangles, 32 individually editable cabins and matching
source/snapshot hashes. Browser checks exercise the actual wheel at two phases, its reverse
view, 48 city rotations, public Reset/view controls, Asahi uploads and PNG QR
decoding, plus 3D/intermediate/2D frames at 1440×900, 390×844 and 320×568.

See the [opening view](../../../../assets/design-qr/dotonbori/reviews/sign-row-opening.png),
[wheel front](../../../../assets/design-qr/dotonbori/reviews/ebisu-front.png),
[wheel rear](../../../../assets/design-qr/dotonbori/reviews/ebisu-rear.png) and
[editable scene](../../../../assets/design-qr/dotonbori/dotonbori-waterfront.blend).
