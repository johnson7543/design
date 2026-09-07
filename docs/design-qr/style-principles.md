# Design QR style principles

Status: Active interface contract<br>
Scope: Design QR application chrome, editor components, and hosted player<br>
Executable sources: [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css)
for application UI and
[`packages/designqr/src/style.css`](../../packages/designqr/src/style.css) for
the public player

[Back to the Design QR documentation index](README.md)

Design QR should feel warm, precise, and quiet. The artwork or QR is always the
hero; interface chrome supports the creation task without competing with the
rendered result. These rules are the default for every new component and every
style adjustment.

## Core principles

1. **Artwork first.** Keep the stage visually dominant. Persistent controls use
   compact typography, low-contrast borders, and translucent surfaces.
2. **Use semantic tokens.** Choose a token by role (`--qr-border-default`,
   `--qr-surface-control`), not by copying a nearby raw color or shadow.
3. **Align to shared rails.** Header content uses the same 760 px rail as the
   Design home page. Bottom controls share one centered 580 px rail. Within a
   row, sibling controls share an exact height and baseline.
4. **Show hierarchy through surface strength.** Panels use glass; ordinary
   controls use the control surface; selected controls become solid; the single
   primary action in a cluster uses the accent color.
5. **Complete every interaction state.** Interactive elements need default,
   hover, active/pressed, keyboard focus, selected, and disabled states where
   applicable. State cannot rely on color alone when an icon, label, or shape can
   reinforce it.
6. **Responsive means deliberate density.** Mobile keeps the same hierarchy and
   order as desktop, then reduces spacing and labels. It must not become a
   separate visual system.
7. **Motion explains change.** Small transitions confirm selection or reveal
   hierarchy. Large motion belongs to the 3D/2D transformation. Always honor
   `prefers-reduced-motion`.
8. **Keep layout in CSS.** Inline styles are reserved for runtime visual data,
   such as a selected color or generated gradient. Spacing, type, grids, and
   dimensions belong to named classes.

## Foundations

### Spacing and geometry

- Use the 4 px spacing scale (`--space-1` through `--space-6`). Intermediate
  values are allowed only for optical alignment, and should be local.
- Standard control height is `--qr-control-height`: 38 px on desktop and 34 px
  on compact mobile toolbars.
- Standard gaps, horizontal padding, drawer padding, and drawer gaps come from
  the `--qr-control-*` and `--qr-drawer-*` tokens.
- Use `--radius-md` for ordinary controls, `--radius-lg` for grouped cards,
  `--radius-xl` for panels/modals, and `--radius-pill` only for toggles, badges,
  and true pills.
- A 28–30 px control is a floating-stage exception, not a general mobile size.
  Modal and form actions should remain comfortably tappable.

### Typography

- `--font-sans` is for product names, controls, and concise labels.
- `--font-body` is for inputs, descriptions, metadata, and longer reading.
- The public player owns `--designqr-title-font-family` and
  `--designqr-body-font-family`, each with a system-font fallback. It must not
  require the editor's font or token stylesheets.
- UI labels use 600 weight; headings and selected/value labels use 700.
- Use sentence case for actions and title case only for product or preset names.
- Numeric outputs use tabular numerals when their width can change.

### Motion

- The 3D↔2D transformation begins moving on the first rendered frame, then
  decelerates into a smooth, zero-velocity settle without a front-loaded jump.
- Every design uses the same approximately 0.56-second `1×` transition and
  responsive easing in both directions. The editor and public
  `interaction.transitionSpeed` scale that shared baseline (`0.56 / speed`);
  switching Tree / City must not change the pace. Under
  `prefers-reduced-motion`, view changes commit directly to the 3D or QR endpoint
  and theme backgrounds settle immediately; automatic rotation and morph blur
  remain disabled.
- Automatic rotation is time based so its speed is stable across refresh rates.
  Changing clockwise/counterclockwise direction preserves the current yaw;
  The editor's Reset view stops automatic rotation and restores the initial
  angle, centered pan, and 100% zoom without changing the selected direction or
  3D / 2D mode. This combined action is editor-only: package `resetRotation()`
  and `resetZoom()` remain independent.
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
  City anchors that same image to the prominent main billboard in 3D, then
  moves and rotates it continuously into the QR center. The image must fit the
  sign, be visible from the default angle, and restore the original sign when
  removed. Curved building signs must clear the facade along their full arc.
- Tree's completed scan face retains the selected theme's multi-tone QR foliage
  and finder distributions whether or not a logo is configured. Both paths
  receive the same hue-preserving, scan-safe 2D depth grade as the face settles;
  enabling or removing a logo must not change any sampled module color. Logo
  mode switches QR generation to high error correction and remains within the
  bounded size range, but it does not add a renderer-authored frame or a second
  color adjustment. Separately, light modules derive a brighter display target
  from the selected theme's `groundColor` through one shared sRGB lift; no
  universal light color replaces the preset or custom-theme hue. Both color
  treatments blend through the turn, and 3D artwork remains unchanged. The
  color strategy must not change as a side effect of moving preset logic into
  resolved theme data.
- City's settled 2D face keeps deep-blue finders and four coordinated data-cell
  inks: deep blue, morning blue, slate blue and sparse warm gray. Light cells
  use derived mist paper. Data colors form stable facade-sized groups, with one
  flat opaque color per cell. Only an enabled Border fills the four-module
  margin and card; Border off leaves atmosphere or transparent host outside the
  matrix. No 3D shading or geometry survives in the scan area. These colors match
  in editor, React, iframe and PNG, including the existing bounded Logo mode.
  Morph colors interpolate continuously from city-surface paint to scan ink/paper; reduced
  motion commits directly. The maintained [color roles](color-palettes.md#shibuya-city--blue-morning)
  define the three morning blues, cool white and sparse warm city accents.
- Transparent-background changes clear or restore the seasonal stage backdrop
  immediately, including while the player is paused or offscreen. During a
  tree-to-QR turn, the local matrix or enabled Border-card fill fades in near
  the endpoint; reduced motion commits both the endpoint and fill directly.
  Opaque borderless artwork does not receive an additional local surround;
  for both designs, only Border fills the four-module margin.

### Surface hierarchy

| Tier | Token or pattern | Use |
| --- | --- | --- |
| Stage | Seasonal background or transparent host | Tree, QR, and environmental artwork |
| Panel | `.glass-panel` / `--qr-surface-panel` | Drawer and floating editor |
| Elevated | `--qr-surface-elevated` | Modal and editor sheet where text needs stronger separation |
| Control | `--qr-surface-control` | Buttons, chips, grouped inputs |
| Hover | `--qr-surface-control-hover` | Pointer hover and focus-within |
| Selected | `--qr-surface-solid` + strong border | Active theme, toggle, option |
| Primary | `--qr-accent` | Share, save, and the main action only |

Seasonal and custom artwork colors are a separate system. Do not change them as
part of interface cleanup. Base colors must come from the
[global color registry](../design-system/colors.md), while Design QR roles and
component assignments follow the [Design QR color mappings](color-palettes.md).

## Component contracts

| Component | Contract |
| --- | --- |
| Header | Same width, height, edge inset, and divider geometry as Design home. The product title is a non-interactive heading and must not navigate away; capability badge and credits stay left. A compact repository promotion links directly to the DesignQR GitHub project immediately before the right-aligned view switcher. It uses the official GitHub mark and live star count on a light tokenized control surface, without label text; an accessible name retains the full action and count, and a last-verified fallback keeps the control stable when GitHub is unavailable. |
| 3D/2D stage | Occupies the available canvas and remains centered within the space left by header and bottom controls. The public package keeps its default 1× artwork endpoints. The editor alone opts into a `0.88` settled-QR artwork scale through the package canvas parameter so the QR matrix, logo, optional details card, title, and value form one less-crowded group on desktop and mobile; that scale blends with view progress, preserves the established 3D endpoint, and is reflected in the editor's WYSIWYG export. UI effects must not create visible viewport edges. When tap-to-toggle is enabled, the public player uses button semantics, enters the tab order, and accepts Enter or Space; otherwise those semantics and keys are absent. Focus is visible but is not part of exported pixels. Cursors reflect the enabled action: grab only for 3D drag, pointer only for view toggling, and default when neither applies. |
| Stage hint/editor | Uses pill geometry and the warm floating surface. The hint is centered independently of optional edge tools. |
| Content input | Full width of the bottom rail. Focus is shown on the containing card, not only the text caret. If the value cannot produce a supported interactive matrix, the stage replaces every canvas with a centered alert while the editor controls remain available; Share and Download are disabled until the content is valid, and no stale QR remains visible. |
| Theme drawer | Tree / City selector first, followed by the selected design's preset row, optional saved custom themes for Tree, then the shared action row. Tree defaults to Spring; City shows one compact, left-aligned Shibuya preset button selected by default. Presets share the standard chip height, selected surface, keyboard focus, and `aria-pressed` semantics. City omits Add Theme and saved custom themes. Reselecting Shibuya keeps it selected without resetting the artwork, shared settings, or remembered Tree theme. Add-theme and Share are equal squares at each breakpoint. |
| Rotation tools | Auto Spin, direction, Reset view, Blur, and Transparent background use equal fixed icon-only controls before the flexible transition-speed field. Reset view clears angle, zoom and pan together in either mode and stops Auto Spin. Transparent sits immediately after Blur, remains visible in both 3D and 2D, and uses toggle-button semantics with the accessible name `Transparent background`. Switching direction changes only the icon and rotation sign; it must not reflow the rail. |
| 2D detail editor | Uses two stable rows: Title first, then Border and Show Content. Border is the explicit scan-safe card treatment: its theme-light fill reserves four QR modules on every side before the configured decorative padding and rounded stroke, while metadata begins immediately after the protected margin without an additional decorative gap. Metadata uses that same four-module anchor when Border is disabled, leaving its virtual clearance unfilled so toggling Border only paints or removes the card—it must not move, resize, or change truncation for the QR, title, or value. Opening Edit or expanding Border must not shift the stage or centered mode hint. The compact mobile version may reduce gaps and labels but must keep controls separated, focusable, and inside the rail. |
| Theme editor | Desktop side panel, mobile bottom sheet. Theme Name is the first form section directly beneath the header; the editor relies on the live stage and does not add a separate preview card. Form sections use shared option grids, field surfaces, sliders, and footer buttons. Add Theme clones the selected preset's complete resolved setup; previewing or saving it without edits must remain visually identical to that preset in 3D, during the turn, and in 2D. Seasonal palette shortcuts source their visible and renderer-distribution roles from the same preset objects. Individual color edits release only the dependent hidden roles so the edited values remain effective. The Weather & Particles picker is exclusive: changing the selection or its amount updates falling, ambient, rain, snow, and ground-leaf roles together, so the slider always controls the selected effect instead of a hidden role retained from the cloned preset. |
| Foliage style | Blossom, Leaf, and Pixel share one equal three-option grid and one tree silhouette. Selecting a style changes leaf geometry only; the preview crown, stage, selected tree shape, trunk, branches, and canopy bounds remain fixed. |
| Ground surface decor | Grass, Pixel, and None share one equal three-option grid. Grass keeps upright blades and wind motion. Pixel uses sparse, axis-aligned cubic clusters over the same four finder-corner footprint and does not sway. Grass and Pixel collapse during the 3D→2D turn, then retain the distinct finder palette on the scan face. None omits the 3D decor and routes the required 2D finder modules through the QR foliage roles, so no ground treatment remains without removing scannable finder geometry. Switching options preserves every `groundFeature*` and `qrFinder*` palette role. Winter defaults to Pixel with its all-white frost ramp and falling snow, so switching away and back to Pixel must restore the same all-white result. |
| Logo artwork | Optional PNG, JPEG, or WebP artwork remains part of the WebGL stage, including motion blur and export. It renders directly as a frame-free image plane without a theme-derived backplate; transparent pixels reveal the stage beneath. The compact editor thumbnail is likewise borderless while retaining its solid preview surface. An always-visible Logo disclosure stays on the floating row's right edge in both 3D and 2D; in 2D it sits immediately after the scan-only Edit disclosure. Logo opens a dedicated, mutually exclusive editor for Add/Replace, preview, bounded size, Remove, loading, and canonical-link errors. Every local Add/Replace selection opens a fixed square crop dialog before compression: the centered crop is the default, pointer/touch drag and arrow keys reposition it, and bounded Zoom selects a smaller square without exposing empty pixels. Apply rasterizes exactly the visible square and only then replaces the configured logo; Cancel, backdrop close, or Escape releases the pending source without changing the current logo. Editor originals may be up to 100 MiB (shown as 100 MB in the interface); preparation downsamples and re-encodes them below 1 MiB while retaining the stricter 8,192-character source limit required by editable links. Opening the Logo editor or crop dialog, applying a crop, or canceling it must not shift the stage or centered mode hint. Compact mobile renders Edit and Logo as equal icon-only controls with accessible names so the right-side group cannot collide with the centered mode hint. |
| Share modal | Starts with a three-option `Share` / `Embed` / `React` switch. The outer modal keeps one fixed responsive footprint across all three modes; only the active panel scrolls when needed. Share keeps one clearly primary WYSIWYG download, optional system share, and direct-link copy. Embed exposes the canonical configuration. React derives every example from one normalized snapshot of the current editor and presents a copyable npm command plus `Simple` (the required `value` and, for City, `design="city"`, using the selected design's defaults), `Advanced` (one runnable package-only `<DesignQR />` component with the complete current setup and an uncontrolled `defaultView`), and `Custom Theme` (Tree only; the same package-only shape with the current theme resolved into every public role through an explicit, `ResolvedTreeTheme`-checked `createTreeTheme()` override) examples. Generated examples must not inject surrounding buttons, application state, callbacks, or rendered error UI. Each dialog opening selects and recommends the smallest example that reproduces the snapshot: `Custom Theme` for an active custom theme, otherwise `Advanced` when any non-value option differs from the selected design's defaults, otherwise `Simple`. A persistent sparkle glyph plus the existing accent border/shadow identifies that recommendation without relying on color or motion; its accessible name explains the state, its entrance effect runs once, and manual selection does not move it. Both advanced examples preserve the exact configured design, its tree or city options, initial view, details, interaction including transition speed, logo source, transparency, sizing, and accessible name. An editor-uploaded inline logo remains inline so copied TSX runs without a placeholder asset. They import only the public package surface and do not include editor metadata, empty styling hooks, unused imperative refs, TODOs, or instructional comments in place of working code. Switching examples clears stale copy feedback and updates the code and accessible copy label together. Every copy action is aligned and accessibly labeled, and HTML, shell, and TSX use the documented syntax palette. The three compact React example controls, including the longer `Custom Theme` label and recommendation glyph, and code scroll area must remain inside the fixed modal footprint at 320 px without page-level horizontal overflow. |
| QR metadata | Belongs visually to the QR card and follows its alignment; it does not become a second floating panel. Title, visible value, line heights, and their gap scale from the shared package renderer's projected QR size, with the value visually subordinate to the title, compact readability minimums, and restrained large-artwork caps. Public `details.titleScale` and `details.contentScale` multipliers (`0.75–1.5`, default `1`) adjust the two responsive font sizes independently and are preserved by canonical links, hosted playback, and export. Border state never changes their shared four-module text anchor or ellipsis width. The editor, public component, hosted player, and exported PNG therefore retain the same type treatment. The package declares the preferred font stacks without fetching assets; the editor and maintained React fixture load Outfit and Plus Jakarta Sans, while other consumers may supply those fonts or accept the documented system fallbacks. |
| Transparent background | The persistent action-row toggle beside Blur controls transparency in both editor views. It removes only the full-canvas seasonal gradient across 3D, the turn, 2D, React, iframe, links, and PNG export. Tree geometry, terrace, particles, logo, QR modules, and optional details remain artwork. At settled 2D with Border disabled, both designs paint a square theme-light fill matching only the QR matrix footprint. Surrounding pixels, including the virtual four-module margin, remain transparent. Only enabling Border fills the complete rounded details card and reserves a four-module clear margin around the matrix before decorative padding, stroke, and metadata. Borderless hosts own any additional light margin needed for scanning. The editor previews alpha over a tokenized checkerboard that is outside the presentation canvas and is never exported. |
| Hosted player | `/qr/embed` contains exactly one edge-to-edge DesignQR player. It has no header, editor controls, modal, minimum editor viewport, or extra integration chrome; invalid input becomes one stable centered fallback. Its document, body, and root stay transparent so a transparent player reveals the iframe element or parent-owned backdrop; no obsolete iframe transparency attribute is required. The public component defaults to a responsive 1:1 footprint when its host supplies width only. Size overrides belong directly on `<DesignQR>` through `style` or `className`; namespaced presentation-variable overrides belong on its `className`. Generated React snippets must not add a sizing wrapper. Package defaults must render correctly without application tokens. |

## Responsive rules

### View-only zoom

The left floating tool opens a sharp, view-only zoom in both Tree / City and
3D / 2D. It shows the current percentage on desktop and uses an accessibly named
icon on compact mobile. The popover sits above that tool without moving the
canvas, centered mode hint, input, or bottom rail. It is mutually exclusive with
Edit and Logo; outside pointer input closes it, and Escape or Close returns
focus to its disclosure.

- Start at 100%; bound **editor** magnification to 100–1000%. The minus and plus buttons
  change it by 25 percentage points and disable at their limits. Reset returns
  both scale and pan to the centered 100% view. Button/key zoom preserves the
  responsive artwork center instead of magnifying its viewport offset. Enlarged
  artwork may extend behind fixed chrome; panning lets the user inspect it.
  The percentage reset and `0` shortcut reset zoom/pan only; the shared drawer's
  Reset view additionally restores rotation and stops Auto Spin, in both modes.
  Reserve enough label width for `1000%` so changing scale never grows the
  desktop disclosure or shifts the shared rail. Compact mobile stays icon-only.
- Two fingers pinch around their midpoint and pan together. The package gesture
  controller cancels the player's one-finger gesture (including pending capture)
  before taking ownership, suppresses its
  tap/rotation until all pinch fingers lift, and cleans up on cancellation,
  lost capture, resize, or window blur. A normal one-finger drag still rotates
  3D, and a normal tap or Enter / Space still switches views.
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

### Breakpoints and stage framing

- `620px`: shared platform/header rail changes to 18 px page edges.
- `640px`: Design QR switches to compact controls, 8 px overlay edges, icon-only
  header mode buttons, and reduced drawer spacing.
- `768px`: the custom-theme side panel becomes a bottom sheet.
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
  at the default City angle in narrow/square hosts). Equal host sizes therefore
  give comparable ground footprints, not identical silhouette heights. Density
  compensation keeps both endpoints stable as QR versions grow. City retains
  its slightly steeper viewing angle so roads remain readable; the shared 2D
  endpoint is unchanged. This contract applies to React, iframe, editor, and
  export without per-design host scaling.
- Height media queries may scale and lift the stage to preserve control clearance.
  Wide portrait editor windows receive an additional shared lift so the 2D
  details card clears the centered mode hint and Edit/Logo group by the same
  visual lane used on mobile. Both modes use the same responsive base transform;
  the editor's smaller QR endpoint is an additional package-canvas parameter
  interpolated by view progress so the morph stays spatially continuous.
- Safe-area insets belong on fixed edge UI where relevant.
- The hosted player follows its iframe container at every size and must remain
  free of horizontal overflow; its host owns the aspect ratio and outer spacing.

Test at least 1440×900, 1059×1273, 707×1157, 390×844, and 320×568. Check both 3D and 2D modes,
the Edit and Logo panels collapsed and expanded, the square crop dialog open,
a configured logo, the theme sheet, and every Share modal mode.

## Implementation checklist

- Reuse a semantic token before adding a literal value.
- Use only base colors approved by the
  [global color registry](../design-system/colors.md); run
  `npm run color:check` whenever colors change.
- Reuse the standard control height and gap for siblings in the same row.
- Keep static layout declarations out of JSX.
- Avoid `!important`; the scoped reduced-motion safeguard is the accessibility
  exception.
- Add a visible `:focus-visible` state without removing existing shadows.
- Verify Enter and Space toggle the public player only when tap-to-toggle is
  enabled, in both controlled and uncontrolled use.
- Add selected and disabled semantics (`aria-pressed`, `aria-checked`, or native
  state) that match the visual state.
- Verify long labels, 200% zoom, and 320 px width do not cause horizontal scroll.
- Include new animated selectors in the reduced-motion contract.
- Verify reduced-motion view and background updates contain no intermediate
  animation frame.
- Remove styles when their owning component is removed.
- Run `npm run style:check` and `npm run check` before release.

## City design

- The drawer begins with a shared Tree / City selector. Both designs keep a
  preset-selection row beneath it: seasonal choices for Tree, the selected
  Shibuya button for City. City has no Custom Theme controls; its sole preset
  remains selected when clicked or activated with Enter or Space.
  Selecting City closes any open Tree theme editor and cancels its unsaved
  preview; returning to Tree restores the previously selected theme.
- The City preset row contains the selected Shibuya chip. It uses the standard
  control height, visible keyboard focus, and existing hover/pressed/disabled
  states, within the shared bottom-control rail at every viewport size.
- Shibuya is a dense morning miniature using the blue, mist and shadow roles
  documented in the product color mappings, with stepped towers, lit facades,
  original typographic signs, five zebra-crossing arms, street trees, and an
  elevated railway, silver police box, adjoining Hachiko entrance and three Shibuchika stair
  entrances (A6a, A6b and A7a). A6a opens west and A7a opens northwest;
  their stairs, front signs and tactile landings share the doorway direction.
  The QR matrix
  deterministically vary contextual heights, glazing, roof and tenant details—even
  for different text of the same QR size. Geographic footprints, QFRONT/MAGNET
  heights, crossing, railway, tile footprint, and camera baseline remain stable.
  Complete building envelopes (including roof equipment and signs) stay
  within disjoint parcels outside the actual curved carriageway, sidewalks, and
  reserved railway corridor. The east underpass has smooth curbs through the
  tile edge and two straight local access roads through the widened sidewalk.
  The west and south alleys also retain consistent approach widths; the west
  driveway crosses the sidewalk to remain connected to its main road.
  The Mark City connecting passage south of Hachiko
  is an elevated exception: its fixed 11.0 m roof spans the south road, with
  4.6 m soffit clearance and station-side supports. Repeated window bays and
  pale fascia bands follow the reference; its end is cropped at the map boundary.
  Its QR morph volume remains above the road, while pedestrian clearance uses
  the ground supports. Fifteen source-aligned structures replace scattered boxes.
  A fenced station-side worksite adds formwork, scaffolding, a cabin, stored
  materials and a parked excavator to the gap beside the garden. Its continuous
  enclosure spans between the JR frontage and the elevated Mark City passage,
  with the site cabin toward the passage end. Preserve the
  public photo approach and JR walking route; pedestrians avoid the enclosure.
  These static details share the city fade and QR morph.
  Two station-curb trees frame the JR approach: the smaller tree occupies an
  L-shaped garden with its short return at the station end, while the larger
  tree occupies a separate square bed toward the crossing. Keep the gap between
  the gardens, crossing landing and station walking paths clear.
  Rendering, pedestrian clearance, logo anchoring, and
  the module morph must consume the same generated buildings.
  Signs mix deep-blue crossing screens, pale/blue MAGNET lettering, vertical Japanese
  shop signs, stacked tenant directories, café emblems, and horizontal lightboxes;
  use the shared morning palette with restrained gold/coral accents.
  Preserve glyph proportions on every panel: fit font size uniformly and match
  texture dimensions to the physical sign, never squeeze words or clamp only
  one texture axis. Bilingual subway signs keep separate text rows. Follow the
  [bounded sign-detail contract](shibuya-architecture.md#sign-lettering-and-close-up-quality)
  without increasing stage resolution or changing preview/export geometry.
  QFRONT's angled vision panel owns the configured logo; its position and yaw
  follow the source façade.
  The initial City camera looks from the south toward the crossing-facing façades;
  its −90° orbit offset does not rotate the source geometry or change Tree framing.
- The station compound's west façade has a smaller two-storey police box beside
  the taller Hachiko entrance, within the existing clipped parcel. Preserve the
  police box's silver rectangular portal, curved metal balcony with ribbed glass,
  glazed doors, KOBAN sign and bilingual name plaques. The station has dark tiled
  cladding, a recessed passage, suspended canopy and a clear roofline. The large
  advertisement beneath the station name and the two roof billboards are removed,
  including their frames and lamps; the smaller street-level panel remains.
  Its **JR 渋谷駅** and
  serif English name have raised metal bodies and matching vector faces.
  The road bridge carries widely spaced **JR 渋 谷 駅** directly on its ribbed
  fascia; its train deck is 7 m above the shared pavement. A6a/A6b flank
  Center-Gai and A7a sits beside MAGNET. Their translucent canopies, descending
  stairs, rails, tactile landings and exit signs follow the reference design. Cut the stair wells through every underlying ground layer and reserve
  the whole pavilion and approach from the commuter paths. Glass retains its
  28% base opacity during the shared fade; the police balcony glass retains 38%.
  All lettering and glass disappear at the QR endpoint. Police morph blocks
  follow its lower height instead of filling the full station-height volume.
  Reference placement, dimensions and accuracy limits belong in the
  [station contract](shibuya-architecture.md#station-frontage-and-subway-entrances).
- City animation is on by default, independently of camera rotation. Articulated
  pedestrians form an irregular scramble across the five zebra crossings and
  an unmarked diagonal between opposite corners. The 180-person crowd favors
  the two diagonals, mixes directions across each corridor, and varies departure,
  pace, curved paths and sidesteps. Steps follow distance traveled; curb approaches
  ease into walking and resting. Everyone clears the road before vehicle traffic
  starts. A smaller group continues across Hachiko square into the recessed JR
  entrance beside the police box. Staggered departures bring people out of the
  same passage; they walk to their curb positions and wait for a later walk
  signal. Plaza paths avoid waiting crowds, street furniture and the garden.
  The concourse hides their indoor stay and keeps the journey continuous.
  A four-car metro traverses the east-side viaduct
  through station portals. Loops must not teleport visible actors. Activity
  freezes during the QR turn and scan view; reduced motion uses a static pose.
- Editing valid City QR content updates contextual building proportions, landmark glazing and rooftop equipment arrangements, MAGNET campaigns, changed signs
  and QR destinations in place. Preserve the people, cars, wheels, metro and
  signal phase clock; do not restart actors, reload models or rebuild the fixed
  streets/station. This also applies when the QR version changes, in either
  view or mid-turn. A paused edit redraws without advancing activity; pending
  models still wait for a running, settled frame. Unchanged signs and the logo
  stay intact. The editor, React and hosted player share this behavior; an
  explicit City design change or remount creates a new simulation.
- Waiting pedestrians occupy spaced, unobstructed sidewalk positions with
  varied headings and resting poses. Their feet follow the pavement height.
  Sedans, taxis, vans, and buses have distinct silhouettes and visible vehicle
  details; arc-length queue spacing accommodates the longer vehicles. Traffic
  follows left-side paths with metric vehicle scale and tile clipping. Drivers
  brake smoothly, react in sequence, accelerate at individual rates and keep
  a following gap as the queue opens. Signals and actors share one phase clock.
- City includes Hachikō's seated bronze and the reference garden
  setting at the western edge of the station square. The statue and inscribed
  pedestal face geographic east toward the station, independent of camera yaw.
  Keep the whole planted setting beside the fitted south-road curb: its shared
  placement puts the statue about 7.7 m from the carriageway, with roughly
  1.6 m beside the nearest planting borders. Sculpture, paving, trees, seating,
  pedestrian exclusions and morph anchors move together.
  Keep the monument at the shared metric scale, preserve the open eastern
  approach, and reserve planted pockets and the pedestal from commuter paths.
  Its mesh follows the existing city fade/collapse and vanishes in QR view.
  Photo dates, redevelopment limits, proportions and regeneration follow the
  [Hachikō contract](hachiko-square.md).
- Retain the PLATEAU-derived asymmetric five-arm network, reference-proportioned
  approach widths, curved corners, and five image-calibrated zebra crossings. The 160 m
  square uses one uniform scale and one 45° station-facing rotation; never
  stretch individual arms to fit buildings or themes. Road height is flattened,
  with a modeled 15 cm curb. Road and building outlines are source-derived;
  reference-directed pavement extensions keep the vehicle lanes at a consistent
  scale. Jingu and Dogenzaka have roughly 14–15 m through corridors; the east
  underpass is 14 m wide. Center-Gai retains its narrow 4–4.7 m shopping street.
  Crossing endpoints, paint, curbs, waiting positions and fixtures follow the
  compiled boundaries. Paint, traffic, façades and station structures remain
  interpreted miniature details. Sources, uncertainty and regeneration belong in the
  [road contract](shibuya-road-network.md) and [architecture contract](shibuya-architecture.md).
- The same road layer owns reference-specific paint for each approach, not
  repeated generic lane strips. With Center-Gai on the right in the reference:
  the upper-right Dogenzaka curve has continuous cool-light guides and no colored
  lane, arrows or stop bar; upper-left Hachiko has two 3.5 m through lanes each way,
  a continuous median, a straight-plus-left arrow in the incoming curb lane,
  and a straight-only arrow in the inner lane. A hatched curb taper
  narrows the incoming carriageway before the projecting sidewalk. The opposite
  curb has a 3 m stopping bay with two spaces and a dashed access edge, separate
  from its two through lanes. The total corridor tapers from about 23.1 m near
  the crossing to 17.9 m beyond the hatched area. Cars follow the inner lanes.
  Guides remain smooth through the bend and retain
  their width at the map cut. The incoming divider is solid near the stop bar
  and dashed farther away; the outgoing divider is dashed.
  Lower-left station-east has a 14 m carriageway beneath the bridge, one blue
  lane and a short opposite-curb patch. Extend the opposite sidewalk into the
  broad asphalt apron, keeping both side streets open and easing into the
  existing crossing corner. Its three incoming lanes keep equal spacing, with
  continuous guides beneath and beyond the viaduct; side-street openings do
  not pull them out of alignment. The road mesh, curbs and fixture placement
  share the narrowed surface boundary. The short stopping-area fill follows
  the actual curb outside the outbound white edge line, leaving the through
  lane uncolored; its width follows the available shoulder.
  Lower-right Jingu has paired blue lanes and an outer
  tapered hatch. Jingu's outbound colored divider is dashed; its inbound lanes
  carry straight / straight-plus-left arrows. Station-east has a left-only
  colored-lane arrow. Use four lane-specific **禁止迴轉** markings: one outbound
  inner-lane marking on Jingu, two inbound and one outbound on station-east.
  Each is an open right-hand U-turn arrow with a separate × behind it, rotated
  with its traffic direction—not mirrored or substituted with `40` numerals.
  The small `8–20` label faces station-east's outbound traffic. Colored lanes
  reach the zebra; incoming-only stop bars sit behind it. Keep contained
  diagonal hatching and the Jingu taper's nose beside its inner divider.
  A single thin muted accent follows selected native curb edges and corners;
  do not double it with the former straight warning bars. Keep Center-Gai
  unmarked as the shopping entrance. Curved vehicle masts have horizontal blue/amber/coral lamp order,
  hoods and separate pedestrian figures oriented toward their crossings.
  Each of the four vehicle approaches has an opposing-curb mast pair: eight
  overhead heads in total, with arms reaching into their respective lanes and
  faces looking toward opposing traffic. The diagonal remains pedestrian-only;
  Center-Gai's entrance posts are not vehicle signals.
  All uprights and low guardrails fit the surveyed pavement; waiting positions
  avoid them. Center-Gai has paired inward-curving main poles, collars and
  original vector name plates, leaving the passage open. These details disappear
  with the city in QR mode. Batch static detail; signal colors update only when phases change.
- During the 3D/2D turn, the whole city hands over to palette-colored tiles:
  building volumes, road/paint/pavement, signs, station, garden and street fixtures,
  plus the currently visible people, vehicles and metro. Both dark and light QR
  cells have city sources; the road must not disappear under an early uniform
  paper plate. Reveal building blocks progressively in upper-to-lower sections
  over 8–42% of progress, with slight stable offsets between buildings. Each
  section has a broad 24–26 percentage-point blend; do not switch the entire
  skyline to blocks together over the short street/detail handoff. Keep the
  detailed city solid through the first 40%; street/detail tile coverage still
  arrives over 30–42% before the city retires over 40–46%.
  Do not restore the long whole-city translucent overlap. Glass keeps its own
  base opacity. Building sections, sign panels, each car, the connected metro
  and source-aligned crosswalk strips retain coherent spacing, heading and
  footprint before resolving into individual cells. Small details merge into
  nearby encoded cells with bounded occupancy, not one crowded destination.
  Keep opaque tile coverage beneath the final QR handoff. Preserve continuous
  coverage, camera motion, and logo travel in both directions. Keep a single
  actor-pose snapshot through reversals and mid-turn content edits, and resume
  the original simulation on returning to 3D. The shared 0.56-second speed remains
  unchanged. Tile correspondence is cached and movement runs in one instanced GPU
  batch; it adds no draw call or animation uploads at either settled endpoint.
  Per-section reveal windows are cached instance attributes, not per-frame
  geometry updates. Reuse the same tile draw earlier in the turn, without new
  textures or a higher scene resolution. Hidden tiles must not write depth.
  QFRONT's vision sign and MAGNET's corner/side posters additionally retain
  their live artwork on six rigidly folding half-panels. Keep glyph proportions
  and left/right UV ranges intact; dissolve artwork over 58–78% into the existing
  colored tiles. Limit this detail to three transient material groups and one
  small geometry; its 36 positions may update only during visible folding.
  Borrow the existing sign maps and shader, with no new texture, resolution or
  mount-time preparation. The uploaded logo stays a separate single image,
  never a copied fragment; replacing/removing it updates the private QFRONT
  background immediately even when paused mid-turn. Cache static correspondence
  until content changes and start the tile shader only on a requested turn.
  No sign, road, or building
  is drawn over the completed scan face; the shared four-module quiet zone,
  optional logo, details, and export surface remain authoritative.
- Changing design in either view rebuilds and disposes the previous artwork.
  Shared view state, rotation settings, transparency, and logo remain usable.

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
