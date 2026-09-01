# Design QR style principles

Status: Active interface contract<br>
Scope: Design QR application chrome, editor components, and hosted player<br>
Executable sources: [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css)
for application UI and
[`packages/designqr/src/style.css`](../../packages/designqr/src/style.css) for
the public player

[Back to the Design QR documentation index](README.md)

Design QR should feel warm, precise, and quiet. The tree or QR is always the
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
- The nominal `1×` transition completes in approximately 0.56 seconds. The
  editor speed control scales relative to that baseline. Under
  `prefers-reduced-motion`, view changes commit directly to the 3D or QR endpoint
  and theme backgrounds settle immediately; automatic rotation and morph blur
  remain disabled.
- Automatic rotation is time based so its speed is stable across refresh rates.
  Changing clockwise/counterclockwise direction preserves the current yaw;
  Reset Rotation stops automatic rotation and restores the initial angle without
  changing the selected direction.
- Organic canopy collapse and QR voxel reveal overlap across the full turn;
  avoid early visibility cuts or scale ramps that compress the visible morph
  into only the first portion of the transition.
- Blossom, Leaf, and Pixel use the same procedural canopy points and branch
  skeleton. Pixel changes those canopy instances to aligned cubes; it must not
  change the selected tree silhouette, crown placement, trunk, or branch
  structure. During the turn, every foliage style follows the same canopy
  collapse while the shared QR-derived voxel set resolves into the ground QR.
- A configured logo is one camera-facing WebGL group. It sits within the front
  canopy surface in 3D, follows the same eased progress as the tree, and settles
  at the exact QR center in 2D. Replacement or removal must not leave a stale
  plane, and the presentation/export path must capture the same logo pixels.
- The completed scan face retains the selected theme's multi-tone QR foliage
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
- Transparent-background changes clear or restore the seasonal stage backdrop
  immediately, including while the player is paused or offscreen. During a
  tree-to-QR turn, the package-owned local 2D plate fades in only near the
  endpoint; reduced motion commits both the endpoint and plate directly.

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
| Header | Same width, height, edge inset, and divider geometry as Design home. The product title is a non-interactive heading and must not navigate away; capability badge and credits stay left, while view mode stays right. |
| 3D/2D stage | Occupies the available canvas and remains centered within the space left by header and bottom controls. UI effects must not create visible viewport edges. When tap-to-toggle is enabled, the public player uses button semantics, enters the tab order, and accepts Enter or Space; otherwise those semantics and keys are absent. Focus is visible but is not part of exported pixels. Cursors reflect the enabled action: grab only for 3D drag, pointer only for view toggling, and default when neither applies. |
| Stage hint/editor | Uses pill geometry and the warm floating surface. The hint is centered independently of optional edge tools. |
| Content input | Full width of the bottom rail. Focus is shown on the containing card, not only the text caret. |
| Theme drawer | Season row, optional custom-theme row, then action row. Add-theme and Share are equal squares at each breakpoint. |
| Rotation tools | Auto Spin, direction, Reset Rotation, Blur, and Transparent background use equal fixed icon-only controls before the flexible transition-speed field. Transparent sits immediately after Blur, remains visible in both 3D and 2D, and uses toggle-button semantics with the accessible name `Transparent background`. Switching direction changes only the icon and rotation sign; it must not reflow the rail. |
| 2D detail editor | Uses two stable rows: Title first, then Border and Show Content. Opening Edit or expanding Border must not shift the stage or centered mode hint. The compact mobile version may reduce gaps and labels but must keep controls separated, focusable, and inside the rail. |
| Theme editor | Desktop side panel, mobile bottom sheet. Theme Name is the first form section directly beneath the header; the editor relies on the live stage and does not add a separate preview card. Form sections use shared option grids, field surfaces, sliders, and footer buttons. Add Theme clones the selected preset's complete resolved setup; previewing or saving it without edits must remain visually identical to that preset in 3D, during the turn, and in 2D. Seasonal palette shortcuts source their visible and renderer-distribution roles from the same preset objects. Individual color edits release only the dependent hidden roles so the edited values remain effective. The Weather & Particles picker is exclusive: changing the selection or its amount updates falling, ambient, rain, snow, and ground-leaf roles together, so the slider always controls the selected effect instead of a hidden role retained from the cloned preset. |
| Foliage style | Blossom, Leaf, and Pixel share one equal three-option grid and one tree silhouette. Selecting a style changes leaf geometry only; the preview crown, stage, selected tree shape, trunk, branches, and canopy bounds remain fixed. |
| Ground surface decor | Grass, Pixel, and None share one equal three-option grid. Grass keeps upright blades and wind motion. Pixel uses sparse, axis-aligned cubic clusters over the same four finder-corner footprint and does not sway. Grass and Pixel collapse during the 3D→2D turn, then retain the distinct finder palette on the scan face. None omits the 3D decor and routes the required 2D finder modules through the QR foliage roles, so no ground treatment remains without removing scannable finder geometry. Switching options preserves every `groundFeature*` and `qrFinder*` palette role. Winter defaults to Pixel with its all-white frost ramp and falling snow, so switching away and back to Pixel must restore the same all-white result. |
| Logo artwork | Optional PNG, JPEG, or WebP artwork remains part of the WebGL stage, including motion blur and export. It renders directly as a frame-free image plane without a theme-derived backplate; transparent pixels reveal the stage beneath. The compact editor thumbnail is likewise borderless while retaining its solid preview surface. An always-visible Logo disclosure stays on the floating row's right edge in both 3D and 2D; in 2D it sits immediately after the scan-only Edit disclosure. Logo opens a dedicated, mutually exclusive editor for Add/Replace, preview, bounded size, Remove, loading, and canonical-link errors. Every local Add/Replace selection opens a fixed square crop dialog before compression: the centered crop is the default, pointer/touch drag and arrow keys reposition it, and bounded Zoom selects a smaller square without exposing empty pixels. Apply rasterizes exactly the visible square and only then replaces the configured logo; Cancel, backdrop close, or Escape releases the pending source without changing the current logo. Editor originals may be up to 100 MiB (shown as 100 MB in the interface); preparation downsamples and re-encodes them below 1 MiB while retaining the stricter 8,192-character source limit required by editable links. Opening the Logo editor or crop dialog, applying a crop, or canceling it must not shift the stage or centered mode hint. Compact mobile renders Edit and Logo as equal icon-only controls with accessible names so the right-side group cannot collide with the centered mode hint. |
| Share modal | Starts with a three-option `Share` / `Embed` / `React` switch. The outer modal keeps one fixed responsive footprint across all three modes; only the active panel scrolls when needed. Share keeps one clearly primary WYSIWYG download, optional system share, and direct-link copy. Embed exposes the canonical configuration. React derives every example from one normalized snapshot of the current editor and presents a copyable npm command plus `Simple` (only the required `value` prop, intentionally using component defaults), `Advanced` (a runnable controlled-view example with the current complete component setup and host-owned interaction/error UI), and `Custom Theme` (the current theme resolved into every public role as an explicit, `ResolvedTreeTheme`-checked `createTreeTheme()` override alongside the current design, tree, initial view, details, interaction including transition speed, logo, transparency, sizing, and accessible name) examples. Each dialog opening selects and recommends the smallest example that reproduces the snapshot: `Custom Theme` for an active custom theme, otherwise `Advanced` when any non-value option differs from package defaults, otherwise `Simple`. A persistent sparkle glyph plus the existing accent border/shadow identifies that recommendation without relying on color or motion; its accessible name explains the state, its entrance effect runs once, and manual selection does not move it. Both advanced examples preserve the exact configured logo source, including an editor-uploaded inline data URL, so copied TSX runs without a placeholder asset. They import only the public package surface and do not include editor metadata, empty styling hooks, unused imperative refs, TODOs, or instructional comments in place of working code. Switching examples clears stale copy feedback and updates the code and accessible copy label together. Every copy action is aligned and accessibly labeled, and HTML, shell, and TSX use the documented syntax palette. The three compact React example controls, including the longer `Custom Theme` label and recommendation glyph, and code scroll area must remain inside the fixed modal footprint at 320 px without page-level horizontal overflow. |
| QR metadata | Belongs visually to the QR card and follows its alignment; it does not become a second floating panel. |
| Transparent background | The persistent action-row toggle beside Blur controls transparency in both editor views. It removes only the full-canvas seasonal gradient across 3D, the turn, 2D, React, iframe, links, and PNG export. Tree geometry, terrace, particles, logo, QR modules, and optional details remain artwork. At settled 2D, the square theme-light local plate cannot enlarge the normal QR/detail-border footprint: without Border it matches the QR matrix, while with Border it may use the configured padding up to the four-module target and is contained by the rounded frame. Pixels beyond that footprint remain transparent. The editor previews alpha over a tokenized checkerboard that is outside the presentation canvas and is never exported. |
| Hosted player | `/qr/embed` contains exactly one edge-to-edge DesignQR player. It has no header, editor controls, modal, minimum editor viewport, or extra integration chrome; invalid input becomes one stable centered fallback. Its document, body, and root stay transparent so a transparent player reveals the iframe element or parent-owned backdrop; no obsolete iframe transparency attribute is required. The public component defaults to a responsive 1:1 footprint when its host supplies width only. Size overrides belong directly on `<DesignQR>` through `style` or `className`; namespaced presentation-variable overrides belong on its `className`. Generated React snippets must not add a sizing wrapper. Package defaults must render correctly without application tokens. |

## Responsive rules

- `620px`: shared platform/header rail changes to 18 px page edges.
- `640px`: Design QR switches to compact controls, 8 px overlay edges, icon-only
  header mode buttons, and reduced drawer spacing.
- `768px`: the custom-theme side panel becomes a bottom sheet.
- Stage projection keeps the established narrow-phone scale, increases camera
  distance smoothly as portrait canvases approach square, then blends into the
  desktop projection as landscape space widens. It must never switch camera
  geometry at the portrait/landscape boundary. The 3D tree, 2D QR, details
  frame, logo, and export share that projection.
- Height media queries may scale and lift the stage to preserve control clearance.
  They must use the same transform for the 3D tree and 2D QR so the morph stays
  spatially continuous.
- Safe-area insets belong on fixed edge UI where relevant.
- The hosted player follows its iframe container at every size and must remain
  free of horizontal overflow; its host owns the aspect ratio and outer spacing.

Test at least 1440×900, 390×844, and 320×568. Check both 3D and 2D modes,
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
