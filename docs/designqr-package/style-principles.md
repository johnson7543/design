# DesignQR package rendering principles

Status: Active rendering contract<br>
Scope: Reusable player, Tree and City artwork, gestures, responsive projection, and export

[Back to the package documentation index](README.md)

Executable sources are [`packages/designqr/src/`](../../packages/designqr/src)
and its [`style.css`](../../packages/designqr/src/style.css). These contracts
apply to React consumers, hosted playback, and the editor's embedded player.
Editor controls and surrounding layout belong to the
[editor interface contract](../designqr-editor/style-principles.md).

## Typography

The public player owns `--designqr-title-font-family` and
`--designqr-body-font-family`, each with a system-font fallback. It must not
require the editor's font or token stylesheets.

City preset display names and default accessible artwork names use Japanese:
渋谷, 道頓堀, and 東京タワー. Stable configuration keys remain `shibuya`,
`dotonbori`, and `tokyo-tower`.

## Presentation and hosted layout

QR metadata belongs visually to the QR card and follows its alignment; it does not
become a second floating panel. Title, visible value, line heights, and their gap scale
from the shared package renderer's projected QR size, with the value visually
subordinate to the title, compact readability minimums, and restrained large-artwork
caps. Public `details.titleScale` and `details.contentScale` multipliers (`0.75–1.5`,
default `1`) adjust the two responsive font sizes independently and are preserved by
canonical links, hosted playback, and export. Border state never changes their shared
four-module text anchor or ellipsis width. The editor, public component, hosted player,
and exported PNG therefore retain the same type treatment. The package declares the
preferred font stacks without fetching assets; the editor and maintained React fixture
load Outfit and Plus Jakarta Sans, while other consumers may supply those fonts or
accept the documented system fallbacks.

Transparent background removes the full-canvas seasonal gradient and opaque-night
atmospheric glow across 3D, the
turn, 2D, React, iframe, links, and PNG export. Tree geometry, terrace, particles, logo,
QR modules, and optional details remain artwork. At settled 2D with Border disabled,
both designs paint a square theme-light fill matching only the QR matrix footprint.
Surrounding pixels, including the virtual four-module margin, remain transparent. Only
enabling Border fills the complete rounded details card and reserves a four-module clear
margin around the matrix before decorative padding, stroke, and metadata. Borderless
hosts own any additional light margin needed for scanning.

`/qr/embed` contains exactly one edge-to-edge DesignQR player. It has no header, editor
controls, modal, minimum editor viewport, or extra integration chrome; invalid input
becomes one stable centered fallback. Its document, body, and root stay transparent so a
transparent player reveals the iframe element or parent-owned backdrop; no obsolete
iframe transparency attribute is required. The public component defaults to a responsive
1:1 footprint when its host supplies width only. Size overrides belong directly on
`<DesignQR>` through `style` or `className`; namespaced presentation-variable overrides
belong on its `className`. Package defaults must render correctly without application
tokens.

## Motion

- The 3D↔2D transformation begins moving on the first rendered frame, then
  decelerates into a smooth, zero-velocity settle without a front-loaded jump.
- Tree, Shibuya and Tokyo Tower use an approximately 0.74-second `1×`
  transition. Dōtonbori uses its former `0.75×` pace as `1×`, approximately
  0.99 seconds (`20 / 27 / 0.75`). All use responsive easing in both directions.
  The editor and public `interaction.transitionSpeed` divide the selected
  design's baseline; the default value and displayed label remain `1×`.
  Changing speed or preset during a turn preserves its current phase. Under
  `prefers-reduced-motion`, view changes commit directly to the 3D or QR endpoint
  and theme backgrounds settle immediately; automatic rotation and morph blur
  remain disabled.
- Automatic rotation is time based so its speed is stable across refresh rates.
  Changing clockwise/counterclockwise direction preserves the current yaw.
  Package `resetRotation()` and `resetZoom()` remain independent; combined
  editor actions belong to the [editor control contract](../designqr-editor/style-principles.md).
- Organic canopy collapse and QR voxel reveal overlap across the full turn;
  avoid early visibility cuts or scale ramps that compress the visible morph
  into only the first portion of the transition.
- Blossom, Leaf, and Pixel use the same procedural canopy points and branch
  skeleton. Pixel changes those canopy instances to aligned cubes; it must not
  change the selected tree silhouette, crown placement, trunk, or branch
  structure. During the turn, every foliage style follows the same canopy
  collapse while the shared QR-derived voxel set resolves into the ground QR.
- A configured tree logo is one camera-facing WebGL group. It sits within the front
  canopy surface in 3D, follows the same eased progress as the tree, and settles
  at the exact QR center in 2D. Replacement or removal must not leave a stale
  plane, and the presentation/export path must capture the same logo pixels.
  Shibuya anchors that same image to the prominent main billboard in 3D, then
  moves and rotates it continuously into the QR center. The image must fit the
  sign, be visible from the default angle, and restore the original sign when
  removed. Curved building signs must clear the facade along their full arc.
  Dōtonbori fits it inside B046's north-facing Asahi panel, replacing that
  panel's artwork with ivory backing for dark uploads or navy for light uploads,
  while preserving the west panel. Removal
  restores the original artwork. The host and logo stay present at every 3D
  rotation, with ordinary depth occlusion. The logo uses the shared sign-to-QR
  travel in both directions. User artwork keeps its original colors/alpha.
- Preserve settled-QR color and logo invariants in the
  [package color mappings](color-palettes.md). Morph colors interpolate into
  those exact scan colors; reduced motion commits directly.
- Transparent-background changes clear or restore the seasonal stage backdrop
  immediately, including while the player is paused or offscreen. During a
  tree-to-QR turn, the local matrix or enabled Border-card fill fades in near
  the endpoint; reduced motion commits both the endpoint and fill directly.
  Opaque borderless artwork does not receive an additional local surround;
  for both designs, only Border fills the four-module margin.

## View-only zoom

- Two fingers pinch around their midpoint and pan together. The package gesture
  controller cancels the player's one-finger gesture (including pending capture)
  before taking ownership, suppresses its
  tap/rotation until all pinch fingers lift, and cleans up on cancellation,
  lost capture, resize, or window blur. A normal one-finger drag still rotates
  3D when drag rotation is enabled; tap or Enter / Space switches views only
  when tap-to-toggle is enabled.
- Wheel and trackpad pinch zoom around the pointer only over the preview.
  Shift + primary drag or middle-button drag pans. When the stage has keyboard
  focus, `+` / `-` zoom and `0` resets; browser modifier-key shortcuts and form
  input elsewhere remain native. Panning is bounded to keep the enlarged stage covering
  its viewport, including after resize.
- The view is transient per-instance state, retained while switching artwork or
  view modes, but not stored in links, local storage, or canonical configuration.
  The editor opts into the package's `zoom={{ pinch: true, wheel: true }}` and
  sets the internal canvas's `previewZoomMax` to 10 for model inspection.
  The public `<DesignQR>` API retains its 1–3× limit; the editor ceiling is not
  a public prop, serialized config field, iframe option, or generated snippet.
  Importing apps default to zoom disabled. `zoom` or
  `zoom={{ pinch: true, wheel: false }}` enables touch/trackpad pinch with no
  toolbar and without consuming ordinary wheel scrolling. Keyboard zoom and
  Shift/middle-drag pan are available to enabled players. `setZoom(1–3)` and
  `resetZoom()` support host controls; `onZoomChange(scale)` reports viewing
  scale, never artwork configuration. Disabling zoom resets its transform and
  removes its listeners. Existing iframe/protocol and generated React examples
  remain unchanged and do not opt into gestures automatically.
- Sharpness comes from rerasterizing geometry with a temporary camera projection
  and repainting QR fills, border, and text at their viewed scale. The renderer
  composes zoom/pan with the existing presentation transform, then composites
  WebGL pixels 1:1; do not CSS-magnify the finished bitmap. Canonical camera
  matrices are restored after each render, including for picking and billboards.
  Even at 1000%, preserve the existing DPR cap, canvas dimensions, scene, WebGL context, and
  single scene pass per animation frame. Gesture code loads only for enabled
  instances; inactive zoom adds no per-frame matrix/style reads. Input updates
  coalesce into the existing frame; manually paused scenes can redraw without
  advancing animation. Do not add supersampling or a persistent export target.
- Downloads retain the complete
  **100% presentation**, including the established editor artwork scale,
  regardless of preview zoom/pan. This is the explicit exception to screen-crop
  WYSIWYG; artwork, colors, details, and original PNG pixels remain unchanged.
  Only when exporting a zoomed source, render the canonical projection into the
  same WebGL canvas and paint with the same 2D context, without another canvas
  allocation. Start `toBlob`'s synchronous bitmap snapshot, then restore and
  repaint the preview in `finally`, within the same JavaScript task, before the
  browser presents a frame. Do not advance animation, create another canvas, or
  flash the visible preview. The default unzoomed export keeps its original path.
- Direct manipulation has no animated settling or inertia, including under
  reduced motion. Keep the existing semantic surfaces, button/focus states,
  and responsive floating-tool sizes; introduce no artwork colors.

Gesture implementation follows the browser's
[Pointer Events pinch model](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures)
and [wheel event handling](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event).
Camera projection follows [Three.js camera matrices](https://threejs.org/docs/pages/PerspectiveCamera.html);
keeping a fixed backing store avoids the pixel-cost growth described by the
[Three.js responsive-rendering guide](https://threejs.org/manual/en/responsive.html).
Export timing follows the [HTML canvas snapshot contract](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-toblob).
Finite billboard/logo texture resolution still limits their close-up detail;
zoom does not synthesize higher-resolution assets.

Run `npm run test:editor`, `npm run smoke:editor-zoom`, and
`npm run smoke:designqr-zoom` to cover bounded focal
math, real touch cancellation and repeated pinches to 1000%, wheel/trackpad,
keyboard and reset, both designs and modes at all three minimum viewports,
byte-identical PNG export, sharper edges, fixed render-buffer/pass counts,
the public player's unchanged 300% ceiling, and hosted-player isolation.

## Responsive projection

- Stage projection keeps the established narrow-phone and 480 px package-fixture
  scale, increases camera distance smoothly as portrait canvases approach
  square, then blends into the desktop projection as either landscape space or
  usable CSS width grows. Wide portrait desktop windows must not retain
  phone-scale artwork, while very narrow, tall hosts remain protected by an
  aspect gate. It must never switch camera geometry abruptly at an orientation
  or width boundary. The 3D tree, 2D QR, details frame, logo, and export share
  that projection.
- All 3D adapters use Tree's established camera-distance baseline and the same
  QR-relative world scale. City must not apply a closer-camera multiplier.
  A bounds-based fit may only increase distance to prevent clipping (under 4%
  at the default Shibuya/Dōtonbori angle in narrow/square hosts). Equal host sizes therefore
  give comparable ground footprints, not identical silhouette heights. Density
  compensation keeps both endpoints stable as QR versions grow. Shibuya keeps
  its steeper viewing angle so roads remain readable. Dōtonbori opens at 30°
  elevation, keeping the complete Glico runner visible from a low angle.
  Tokyo Tower uses a lower pitch and a tapered full-height bounds fit with a
  raised focus to preserve the antenna and base across orbit; the shared 2D
  endpoint is unchanged. This contract applies to React, iframe, editor, and
  export without per-design host scaling.

## City design

City presets share QR encoding, presentation, transition speed, responsive
projection, logo/export behavior, and resource lifecycle. Geographic layout and
preset activity belong to the City contracts below. Changing presets disposes
the previous artwork while preserving shared player settings.

| Contract | Authoritative document |
| --- | --- |
| Shibuya composition, live content, activity, and morph | [Shibuya overview](cities/shibuya/overview.md) |
| Shibuya road geometry and markings | [Road network](cities/shibuya/road-network.md) |
| Shibuya buildings, station, and signs | [Architecture](cities/shibuya/architecture.md) |
| Hachikō placement and sculpture | [Hachikō square](cities/shibuya/hachiko-square.md) |
| Dōtonbori complete building inventory, QR-generated architecture, and activity | [Dōtonbori overview](cities/dotonbori/overview.md) |
| Tokyo Tower night, complete surface collapse, and tall framing | [Tokyo Tower overview](cities/tokyo-tower/overview.md) |
| Asset generation and evidence | [City documentation](cities/README.md) |

All presets must settle to exact QR modules with no surviving city geometry in
the scan area. Keep source geometry, authored interpretation, and diagnostic
material meaning distinct; a shared palette does not establish site accuracy.

Tokyo Tower imports the complete evaluated surfaces of its editable Blender
master, including rounded decks, antenna fittings, and concealed faces. It
retains every modeled surface in one persistent mesh that becomes
the exact flat QR face. Every member owns positive-area cell patches; no sampled
detail cap or replacement QR may discard it. The island, forecourt, walkway,
and paving joints become all light QR cells, distributed across the full square
by surface area and face position. The ground remains level and retains its
broad footprint throughout the turn; it must not shrink into a corner. Tower
and context parts become dark cells, with structural parts avoiding the largest
logo footprint. Its front Foot Town
panel hosts uploaded logos through the shared image travel. The shared pace,
reduced motion, scan colors, matrix fill, Border margin, and export apply. Its
night atmosphere settles to the light City scan backdrop.
Its warm Landmark Light treatment bakes Blender's direct/indirect diffuse light,
occlusion, and emission into complete surface corners. Lighting follows every
fragment and resolves into scan inks. Opaque night playback adds soft glow from
bright source pixels behind the sharp artwork on the existing presentation
canvas, without extra WebGL passes or render targets. It fades out over 8–65%
progress and is omitted from transparent output. Source exposure and glow must
never affect the settled QR, uploaded-image source pixels, or metadata.

Shibuya and Dōtonbori use shared full-matrix hashing, local QR density, context
height and façade-variation rules. Source footprint shapes and retained landmark
dimensions stay fixed; explicit composition offsets remain independent of QR content. Dōtonbori's focused asset omits cropped edge remnants
that retain both less than 40 m² and less than half their original footprint.
Keep complete small buildings, substantial clipped blocks and all eight
reference hosts. Apply this selection before detail/morph generation, retaining
the full square ground and every QR target. Context variation indices follow
stable audit labels before perimeter selection, preserving retained IDs across
source extensions and omissions.
Dōtonbori keeps all 58 selected source buildings visible at
every 3D rotation. Drag, Auto Spin and Reset use the complete building
inventory; foreground buildings occlude the center through normal depth
rendering. Signs, storefronts, roof equipment, shop activity, reflections and
light spill remain present. All 58 selected buildings and their details contribute
to both directions of the QR transformation, including after mid-turn content
edits and delayed asset loading. The complete QR square resolves normally.
Dōtonbori's buildings, Donki wheel, Glico panel and ground use one shared
progress clock, beginning together and settling together over 72–90%. Carry every modeled
surface, its paint, original UVs and frozen shader uniforms into the turn;
matching planar triangles may form panels, with remaining triangles preserved.
Complete area transport must cover every QR cell exactly once. Architecture and wheel panels
contract only when larger than a QR cell, gather at cell centers and expand
after arrival into their assigned strips. Donki's rails, cabins and relief use
the same contraction and travel path as its building throughout the turn.
Ground uses the same contraction, travel and settle intervals as architecture. A brief warm canal
pulse and bounded 0.018-tile lift coordinate ordinary above-ground groups.
Bridge, ground, waterfront fittings and reflections have no lift. Glico's full
textured panel folds with a 0.12-tile lift during the shared turn. The complete wheel
rails/cabins gather into the top-right finder's 24 dark outer cells; interior
relief fills its nine dark center cells. All surface paint blends to QR inks
over the same 54–90% interval. Landmark destinations avoid the central
logo area. Preserve the source atlases, private actor clocks, shared Asahi logo
journey, configured pace, shared camera path and exact QR endpoint. Capture dynamic geometry
once per turn; update only progress during playback and reversal. Content edits
rebuild correspondence at the current phase. No detail sampling cap applies.
Shibuya retains its existing correspondence and timing.
The 144 m Dōtonbori tile is centered exactly on 戎橋. All eight landmark hosts
remain complete. For the requested compact composition, Donki B092 and all
its attached detail translate 80 m west, staying on the north bank east of
B031 with the original south-facing wheel. Six displaced context buildings
are omitted with a one-metre Donki clearance; original source geometry remains
in the research assets. This spacing is an authored presentation choice. The
river and road alignment remain source-based. The opening camera looks from the northeast, 65° north of east and 30° above ground,
toward the central Glico running-man sign and the river-facing sign row. The bridge retains its original registration. Reset
returns to that framing; Auto Spin retains the chosen elevation. The editor's
River view action raises elevation to 50° on the same northeast bearing,
stops Auto Spin and centers viewing zoom. It is transient and survives QR turns;
it changes neither geometry nor serialized configuration. Reduced motion and
paused viewing actions settle immediately. A static height envelope graduates southeastern context toward low-rise buildings,
independently of the opening angle. It is evaluated during geometry generation and never follows
the live camera. Keep horizontal source shape under the recorded placement, ground datums, closed roof
topology and the eight reference-host dimensions. Apply QR variation within the
envelope, then regenerate upper floors, signs and roof fittings; preserve normal
3.1 m ground-floor frontage. These shortened context heights are an authored
miniature composition, not site measurements. Japanese sign
lettering uses bundled outlines and requires no installed font or network fetch.
All fourteen original QR-selected campaigns have Japanese headlines; their
shared City layouts retain small English captions. These describe illustrative
campaigns, not verified tenants. Generated upper windows have dark reveals
behind inset glazing, with their source-wall and frontage exclusions intact.
The wheel has 32 upright cabins on a fixed oval track, a 900-second circuit,
solid trusses, relief and bundled Japanese lettering. Follow the operator and
manufacturer evidence in [the wheel contract](cities/dotonbori/ebisu-tower.md).
Coordinate Donki's wall, steel, cabin and relief finishes with the surrounding
blue-gray miniature. Keep muted gold on the front rails and warm light on small
rims, lamps and lettering; use the same paint roles for reflections and QR fragments.
Freeze its phase with other activity; carry every rail, cabin and relief surface
through both QR directions and edits. Presentation
updates with unchanged QR modules must reuse body and detail geometry.
All 58 selected buildings receive supported generated detail,
with source wall/roof containment and the existing Osaka night roles.
Flat and sloping roofs retain their original surfaces beneath narrow panel
joints and edge flashing. Align courses across source triangles; internal
triangulation edges are not construction seams. Fit paint to each source plane,
clip offsets at the tile boundary and retain each building's ownership through
the complete QR transform. The photographed B034 east setback keeps its
exclusive glazing/rib treatment. Roof joints vary with QR content; their layout
is an authored structural finish, not a surveyed roof specification.
Context heights, windows, roof equipment and campaign selections change with content
without resetting actors or allocating replacement sign atlases. B031's two
screens cycle through three original campaigns on separate 30/39-second loops,
with 8/10.8-second holds and 2/2.2-second crossfades. QR content selects the
opening artwork; fixed offsets select two companions. Other generated signs stay fixed.
The existing atlas is painted once. The two current campaign blends and Glico panel retain their complete textured
surfaces and atlas UVs during the turn. Glico's reference-directed track/rainbow loop and reflected-light colors
share the boat/crowd activity clock. Use the inspected stills and authored timing
recorded in the [animation reference](cities/dotonbori/references/glico-animation-reference.json);
do not present this as today's verified advertising program. Paint its private
atlas once. Freeze the live shader phase and capture reflection colors for the
QR turn, preserving them through reversals and content edits. Retain Glico's complete textured panel, cabinet and reflection surfaces. Pause and reduced motion freeze ambient activity.
The waterfront keeps a continuous metal bridge soffit, panel seams, circular
underside light and edge ribbon, guided by S14's east-approach photograph.
Rail base plates and fixings follow the existing post locations. Partition the
bank wall around the display water level to describe wet contact without
coplanar overlays. Dimensions and fittings remain photo-directed miniature
interpretations under the [waterfront reference](cities/dotonbori/references/waterfront-reference.json).
Every added surface joins the ground/paper portion of the QR transform.
Water reflections drift within a conservative shoreline/tile envelope and react
slightly to nearby stern crests. The wake emits from historical boat positions,
spreads and fades before reaching the banks or crop. Use the
[water motion reference](cities/dotonbori/references/water-motion-reference.json)
for source limits and authored timing. Retain every wake and reflection surface in the QR morph, with its actual
geometry, vertex alpha and frozen shader uniforms. Reuse per-player buffers; paused frames and transitions never
advance wave state or upload changed positions.
The three existing split noren and boat pennant use the same activity clock.
Keep curtain top seams and the flag hoist fixed; bend only the free fabric,
with distinct flap phases and shared quiet intervals. Retain the doorway gaps,
wall clearance and boat clipping. Thin fabric renders on both faces, and its
painted marks bend with it. Noren remain attached to their source hosts at every
rotation; retain every current fabric surface and its fixed support rods for QR turns.
Reuse private buffers and materials, preserving phase through content edits.
The [cloth motion record](cities/dotonbori/references/cloth-motion-reference.json)
documents authored wind and the existing interpreted fittings; it does not
establish real wind conditions or surveyed shop curtains.
Two distinct counter scenes add food preparation at B041 and a continuous tray
exchange at B037. Fit staff above the existing worktops; keep the customer on
supported pavement, within the service bay. Two existing bridge visitors raise
phones independently; another greets the nearby boat, with a staggered wave
from one existing seated passenger. Keep handheld props attached and replace
the original rigid limbs rather than overlapping them. Three crabs move within
the existing B046-west tank, clear of its pedestal and frame. Their motion and
the shop roles remain authored interpretations, as recorded in the
[activity reference](cities/dotonbori/references/activity-motion-reference.json).
All participating body parts, phones, utensils, tray contents and crab limbs
retain their complete modeled surfaces and current pose in the QR turn. Three private vertex batches add no textures.
Shop actors remain present with their hosts and contribute their current pose to the turn.
Pause, reduced motion, content edits and reversals preserve the shared phase.
Bridge visitors follow open journeys between destinations rather than circling
the paving. Mix full crossings with short river-view visits and waiting near
the approaches. Ease to a stop, linger with subtle looks around, and turn in
place before departing. Vary trip speeds and destination holds independently;
retain the existing viewing groups and their phone/boat gestures. Reserve
passing space and keep complete strides on the source bridge deck. Riverwalk
followers slow before reaching another person; independent stops cannot make
them pass through a leader. Preserve irregular gaps and keep full strides on
the promenade. Evaluate all movement from scene time so pauses, QR turns and
seeking never reset the crowd or introduce a sideways correction. Capture each
visitor's current position and head direction for the QR turn.
Reference walls have a single façade owner, with no overlaid QR window grid.
Fit and clip detail to the source wall, separate surface depths, and preserve
setbacks. Finish the complement of registered rectangles once per source wall,
including roof and corner margins. Section faces at the square boundary keep
their existing closed triangles, with a mineral finish and narrow contour-clipped
edge shading; they receive no invented doors, advertisements or window grids.
The B034 ribs have closed side/end surfaces and continue over the actual sloped
east setback with recessed glazing. Their upper and lower strips share a common
alignment. The [façade audit and references](cities/dotonbori/facade-enhancement-plan.md)
record the surface treatments and remaining evidence gaps.
Keep the photographed riverbank sign stacks complete: B037 has the north Pip
clock, Snow Brand/dairy/slogan panels and separate east Pip/FANCL panels; B039
has the Hana Langue advertisement between its service/window bands; B034 has
the south Salonpas panel and H&M fashion panels on both lower faces. The clock
is a fixed reference pose. Fit cabinets to supported source walls with separate
edge rails; upper sign reservations must preserve the existing ground floor.
The private 2048×1536 sign atlas clips each drawing to its own cell and retains
the north Asahi logo backing. Keep uploaded artwork at the top of its fitted
Asahi area; use ivory backing for dark uploads and navy for light uploads,
preserving their pixels and alpha. The narrow B038 context block has a static
12 m body-top limit so it cannot grow over the adjoining Pip/FANCL signs.
Preserve the seven restored panels as complete textured surfaces in the turn. These are original interpretations of inspected
photographs, not a current campaign inventory; structural margins and unverified
rear surfaces do not receive invented advertisements.
Every eligible exposed ground-floor wall receives a fitted treatment,
including side/rear fronts and clipped service panels on partial walls. The
review value has 251 sections and 609 bays, including eleven bridge-area
fronts with 42 bays and Donki’s six-bay storefront. QR-generated context uses café/dining counters,
retail displays, lobby directories, shutters and compact service fittings.
Compose a full frontage with uneven bay widths, off-center entrances, varied
fascias/frames and complementary display, seating, shelf and glazing areas.
Localize menus and awnings to service areas rather than repeating them at every
window. Four original artwork treatments share the existing 2048×1536 atlas.
Retain a coherent finish for known hosts across their faces; a bay or source-wall
section is not a separate real shop. B039 below SAMTY remains neutral commercial
frontage because its former sweets-shop assignment was unverified.
Reserve context detail from the
upper QR skin, compress relief for narrow alleys, and keep fixtures inside
the source wall and crop. Add doors only where the modeled pavement meets
the source floor; use display windows elsewhere. The supported main riverwalk fronts add
shallow food counters, menu cases, noren, lanterns and warm lighting. The Asahi
host's five dining windows use owner-photo references for tables, framed lamps
and a miniature crab-tank display; their exact arrangement remains interpreted.
Its river and west fronts have windows rather than invented public entrances.
The owner's street photograph directs B046-south's separate entrance reveal,
tiled eave, pale folded panels, inset windows and dark corner framing. Register
to the actual oblique south plane and retain the 1.26 m source floor. Proportions
and shallow relief are interpreted; the unresolved street datum adds no
functional door, steps or walking route. Its 0.81 m maximum relief and 3.65 m
entrance/eave band have explicit ownership. The exterior crab occupies the
street wall between the eave and first window band, with at most 1.6 m projection.
Its closed shell, eight folded legs, two opening pincers, eyes and six fixed
uplights follow the owner stills and historical footage in the
[Kani reference](cities/dotonbori/references/kani-sign-reference.json).
The body stays fixed while the limbs use an authored 12-second cycle. Share the
existing activity clock, retain its phase through edits and freeze every surface
through QR turns, pause and reduced motion. The crab is visible from the street
side through ordinary orbit; do not duplicate it on the river wall.
Unphotographed upper/rear details remain evidence-dependent. Street detail and
B034 setback strips retain their complete surfaces in the QR turn.
The adjacent contextual café reserves only its ground-floor band, preserving QR
generation above. Source-clipped forecourts join these north fronts to the modeled
upper walk; their level and extent are display assumptions. Reserve each
3.1 m ground-floor band from generic glazing; keep new food-service fittings
attached to the wall and within 0.79 m relief, clear of walking lanes. H&M stays
retail. Fittings, menu artwork and QR fragments retain source-building ownership;
private storefront artwork is retained through content edits. Photo references
establish visible character, not surveyed shop plans or a complete current tenant inventory.
Central storefronts have closed jambs, soffits and display sills that give the
existing interiors depth without transparent overlay panes. The restaurant's
five windows add owner-photo-directed pitched pendant roofs, timber ceiling
beams, upholstered chairs, place settings, ceramic pots and chopstick holders.
Its single tank remains distinct. These are compressed window scenes; neither
their furniture placement nor the other stores' interior arrangements claim a
surveyed floor plan. Existing bay identities, access and walking clearance remain.

Dōtonbori's night presentation keeps the shared City QR inks, paper and metadata
roles. Darker roof/wall massing, stronger low-level sign spill and canal
reflections emphasize the illuminated frontages. Use the existing presentation
canvas for tight bright-pixel glow behind sharp source artwork, with lower
strength and a smaller radius than Tokyo Tower. It introduces no WebGL pass or
render target, fades over 8–65% progress and is bypassed for transparent output.
Keep uploaded image pixels, sign lettering and settled QR colors intact.
Surface shading uses a continuous, site-fixed broad light to describe roof
slopes, steel and the rounded Donki relief. A 192×192 CPU height field of the
current building envelopes estimates nearby sky obstruction on static surfaces.
Bake the resulting depth into vertex paint after QR content changes, retaining
unshaded source paint so repeated edits never accumulate darkening. Explicitly
luminous windows and fittings bypass the obstruction bake. This adds no GPU
texture, render pass, camera-dependent effect or geometry; all shaded paint
travels with its full surface into QR ink. Moving actors retain their existing
lighting and frozen transition poses. This is illustrative ambient depth,
not measured illumination or a complete shadow simulation.
Glico's original runner paths include tapered limbs, fists, facial contours,
shirt/short seams and shoe details directed by the owner's frontal photograph.
The bent calf remains behind the raised thigh in both LED looks. Donki's
solid relief includes inset ears, moustache, garment folds, fingers, flippers,
separate bill surfaces and toes directed by the manufacturer close-ups.
Entering QR view fades the full atmosphere to Shibuya's light scan
background; returning to 3D restores night. Use the existing interruptible
background transition, with immediate endpoints under reduced motion. This
keeps borderless QR contrast without adding a local quiet-zone card. Transparent
background still removes the atmosphere entirely. Live/export, editor, React
and iframe paths share this behavior.

## City code and asset loading

Tree must not request any City scene implementation or model. Selecting a City
loads only that preset's implementation and its required assets. Shared camera,
QR-color and transition helpers remain small and independent of detailed city
geometry. The package-owned static ESM import graph has a 64 KiB gzip budget;
external peer dependencies and deferred City chunks are measured separately.

Until the implementation is ready, a lightweight grid uses the current QR
matrix and canonical City inks. It remains scannable in 2D and exportable if a
chunk fails. Loading must not insert a city into a paused or mid-turn frame:
attach a newly downloaded implementation only on a running settled endpoint.
Content and logo edits during loading must reach the eventual scene. An already
loaded implementation may be reused for explicit updates, but scene instances,
geometry and textures remain independently owned. Late completion after a
preset change or disposal must never attach to the replaced player.

The public renderer-ready callback keeps its existing meaning; it does not
promise that optional City assets have finished downloading. Once loaded, city
artwork, motion, camera framing and QR endpoints retain their existing contracts.

## Package stylesheet loading

The public `<DesignQR>` component installs core styles before layout effects,
including when displaying an error. `src/style.css` remains the single source
for automatic styles and the optional `designqr/style.css` export. Importing
ESM or CommonJS on the server must not access the DOM.

Automatic styles are shared per document, survive component unmounts, and are
inserted before host styles so consumer overrides retain precedence. A loaded
explicit stylesheet suppresses automatic insertion through its
`--designqr-core-styles` marker. Nonce-based CSP uses the host's
`meta[property="csp-nonce"]` value. Hosts managing CSS externally must load it
before mounting the component. Core styles add no new component props.

Verify the packed consumer without an explicit CSS import, including multiple
instances, error states, theme variables, gestures, focus, reduced motion,
responsive sizing, and PNG export. Also verify explicit CSS and nonce-based CSP.
