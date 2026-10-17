# DesignQR editor interface principles

Status: Active interface contract<br>
Scope: DesignQR editor at /qr, its controls, panels, and responsive layout<br>
Executable sources: [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css)
and [`src/index.css`](../../src/index.css)

[Back to the editor documentation index](README.md)

Design QR should feel warm, precise, and quiet. The artwork or QR is always the
hero; interface chrome supports the creation task without competing with the
rendered result. These rules are the default for every new component and every
style adjustment.

The [shared demo UI standard](../global-standards/demo-ui.md) carries this
interface to every product demo. DesignQR consumes the same `DemoHeader`,
`DemoControls`, `DemoPanel`, `DemoChoice`, `DemoExportButton`, `DemoDialog`, and
`DemoCodeAction` as Pullground. Export keeps the reference accent square
and upward tray icon. Share uses the common native dialog: inert background,
focus containment, Escape/backdrop dismissal, and focus return. Its existing
copy effects render inside that dialog's overlay. Product themes never
redefine the shared controls or code palette.

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
- City display names use Japanese: 渋谷, 道頓堀, and 東京タワー. Labels use
  `--qr-city-font-family`: a bundled ten-character Noto Sans CJK JP subset,
  followed by the shared sans stack.
  Keep labels as real, accessible text with `lang="ja"`; they must render
  without an installed Japanese font or an external font service. The subset
  retains the existing control size, weight and semantic color roles.
- UI labels use 600 weight; headings and selected/value labels use 700.
- Use sentence case for actions and title case only for product or preset names.
- Numeric outputs use tabular numerals when their width can change.

### Motion

Use the [package motion contract](../designqr-package/style-principles.md#motion)
for artwork transitions, rotation, reduced motion, and logo behavior. Editor
controls must preserve those behaviors when updating player configuration.
The speed control defaults to `1×` and scales the selected design's package
transition baseline: approximately 0.99 seconds for 道頓堀 and 0.74 seconds
for the other designs, in either direction. 道頓堀's `1×` uses its former
`0.75×` pace; the control value remains `1`.

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
[global color registry](../global-standards/colors.md), while Design QR roles and
component assignments follow the [Design QR color mappings](../designqr-package/color-palettes.md).

## Component contracts

| Component | Contract |
| --- | --- |
| Header | Same width, height, edge inset, and divider geometry as Design home. The product title is a non-interactive heading and must not navigate away; capability badge and credits stay left. A compact repository promotion links directly to the DesignQR GitHub project immediately before the right-aligned view switcher. It uses the official GitHub mark and live star count on a light tokenized control surface, without label text; an accessible name retains the full action and count, and a last-verified fallback keeps the control stable when GitHub is unavailable. |
| 3D/2D stage | Occupies the available canvas and remains centered within the space left by header and bottom controls. The public package keeps its default 1× artwork endpoints. The editor alone opts into a `0.88` settled-QR artwork scale through the package canvas parameter so the QR matrix, logo, optional details card, title, and value form one less-crowded group on desktop and mobile; that scale blends with view progress, preserves the established 3D endpoint, and is reflected in the editor's WYSIWYG export. UI effects must not create visible viewport edges. When tap-to-toggle is enabled, the public player uses button semantics, enters the tab order, and accepts Enter or Space; otherwise those semantics and keys are absent. Focus is visible but is not part of exported pixels. Cursors reflect the enabled action: grab only for 3D drag, pointer only for view toggling, and default when neither applies. |
| Stage hint/editor | Uses pill geometry and the warm floating surface. The hint is centered independently of optional edge tools. |
| Content input | Full width of the bottom rail. Focus is shown on the containing card, not only the text caret. If the value cannot produce a supported interactive matrix, the stage replaces every canvas with a centered alert while the editor controls remain available; Share and Download are disabled until the content is valid, and no stale QR remains visible. |
| Theme drawer | Tree / City selector first, followed by the selected design's preset row, optional saved custom themes for Tree, then the shared action row. Tree defaults to Spring; City shows compact, left-aligned 渋谷, 道頓堀, and 東京タワー buttons, with 渋谷 selected by default. The City row can wrap at narrow widths. Presets share the standard chip height, selected surface, keyboard focus, and `aria-pressed` semantics. City omits Add Theme and saved custom themes. Reselecting any City preset preserves the artwork and shared settings; switching designs remembers each design’s selected theme. Add-theme and Share are equal squares at each breakpoint. |
| Rotation tools | Auto Spin, direction, Reset view, Blur, and Transparent background use equal fixed icon-only controls before the flexible transition-speed field. Reset view clears angle, zoom and pan together in either mode and stops Auto Spin. Transparent sits immediately after Blur, remains visible in both 3D and 2D, and uses toggle-button semantics with the accessible name `Transparent background`. Switching direction changes only the icon and rotation sign; it must not reflow the rail. |
| 2D detail editor | Uses two stable rows: Title first, then Border and Show Content. Border is the explicit scan-safe card treatment: its theme-light fill reserves four QR modules on every side before the configured decorative padding and rounded stroke, while metadata begins immediately after the protected margin without an additional decorative gap. Metadata uses that same four-module anchor when Border is disabled, leaving its virtual clearance unfilled so toggling Border only paints or removes the card—it must not move, resize, or change truncation for the QR, title, or value. Opening Edit or expanding Border must not shift the stage or centered mode hint. The compact mobile version may reduce gaps and labels but must keep controls separated, focusable, and inside the rail. |
| Theme editor | Desktop side panel, mobile bottom sheet. Theme Name is the first form section directly beneath the header; the editor relies on the live stage and does not add a separate preview card. Form sections use shared option grids, field surfaces, sliders, and footer buttons. Add Theme clones the selected preset's complete resolved setup; previewing or saving it without edits must remain visually identical to that preset in 3D, during the turn, and in 2D. Seasonal palette shortcuts source their visible and renderer-distribution roles from the same preset objects. Individual color edits release only the dependent hidden roles so the edited values remain effective. The Weather & Particles picker is exclusive: changing the selection or its amount updates falling, ambient, rain, snow, and ground-leaf roles together, so the slider always controls the selected effect instead of a hidden role retained from the cloned preset. |
| Foliage style | Blossom, Leaf, and Pixel share one equal three-option grid and one tree silhouette. Selecting a style changes leaf geometry only; the preview crown, stage, selected tree shape, trunk, branches, and canopy bounds remain fixed. |
| Ground surface decor | Grass, Pixel, and None share one equal three-option grid. Grass keeps upright blades and wind motion. Pixel uses sparse, axis-aligned cubic clusters over the same four finder-corner footprint and does not sway. Grass and Pixel collapse during the 3D→2D turn, then retain the distinct finder palette on the scan face. None omits the 3D decor and routes the required 2D finder modules through the QR foliage roles, so no ground treatment remains without removing scannable finder geometry. Switching options preserves every `groundFeature*` and `qrFinder*` palette role. Winter defaults to Pixel with its all-white frost ramp and falling snow, so switching away and back to Pixel must restore the same all-white result. |
| Logo artwork | Optional PNG, JPEG, or WebP artwork remains part of the WebGL stage, including motion blur and export. It renders directly as a frame-free image plane without a theme-derived backplate; transparent pixels reveal the stage beneath. The compact editor thumbnail is likewise borderless while retaining its solid preview surface. An always-visible Logo disclosure stays on the floating row's right edge in both 3D and 2D; in 2D it sits immediately after the scan-only Edit disclosure. Logo opens a dedicated, mutually exclusive editor for Add/Replace, preview, bounded size, Remove, loading, and canonical-link errors. Every local Add/Replace selection opens a fixed square crop dialog before compression: the centered crop is the default, pointer/touch drag and arrow keys reposition it, and bounded Zoom selects a smaller square without exposing empty pixels. Apply rasterizes exactly the visible square and only then replaces the configured logo; Cancel, backdrop close, or Escape releases the pending source without changing the current logo. Editor originals may be up to 100 MiB (shown as 100 MB in the interface); preparation downsamples and re-encodes them below 1 MiB while retaining the stricter 8,192-character source limit required by editable links. Opening the Logo editor or crop dialog, applying a crop, or canceling it must not shift the stage or centered mode hint. Compact mobile renders Edit and Logo as equal icon-only controls with accessible names so the right-side group cannot collide with the centered mode hint. |
| Share modal | Starts with a three-option `Share` / `Embed` / `React` switch. The outer modal keeps one fixed responsive footprint across all three modes; only the active panel scrolls when needed. Share keeps one clearly primary WYSIWYG download, optional system share, and direct-link copy. Embed exposes the canonical configuration. React derives every example from one normalized snapshot of the current editor and presents a copyable npm command plus `Simple` (the required `value` only for Tree; for City, `value`, `design="city"`, and the selected built-in `theme`, with every other setting supplied by package defaults), `Advanced` (one runnable package-only `<DesignQR />` component with the complete current setup and an uncontrolled `defaultView`), and `Custom Theme` (Tree only; the same package-only shape with the current theme resolved into every public role through an explicit, `ResolvedTreeTheme`-checked `createTreeTheme()` override) examples. Generated React snippets size `<DesignQR>` directly and must not add a sizing wrapper. Generated examples must not inject surrounding buttons, application state, callbacks, or rendered error UI. Each dialog opening selects and recommends the smallest example that reproduces the snapshot: `Custom Theme` for an active custom theme; otherwise `Advanced` when a setting differs from the selected design's defaults, excluding `value` and, for City only, the selected preset; otherwise `Simple`. Selecting 渋谷, 道頓堀, or 東京タワー and editing content alone recommends `Simple`. A logo, transparent background, or nondefault initial view, details, or interaction recommends `Advanced`; resetting those settings restores the `Simple` recommendation on reopening. Tree preset recommendations remain unchanged. A persistent sparkle glyph plus the existing accent border/shadow identifies that recommendation without relying on color or motion; its accessible name explains the state, its entrance effect runs once, and manual selection does not move it. Both advanced examples preserve the exact configured design, its tree or city options, initial view, details, interaction including transition speed, logo source, transparency, sizing, and accessible name. An editor-uploaded inline logo remains inline so copied TSX runs without a placeholder asset. They import only the public package surface and do not include editor metadata, empty styling hooks, unused imperative refs, TODOs, or instructional comments in place of working code. Switching examples clears stale copy feedback and updates the code and accessible copy label together. Every copy action is aligned and accessibly labeled, and HTML, shell, and TSX use the documented syntax palette. The three compact React example controls, including the longer `Custom Theme` label and recommendation glyph, and code scroll area must remain inside the fixed modal footprint at 320 px without page-level horizontal overflow. |
| QR metadata | Title/content controls edit package presentation settings. Preserve the [package metadata contract](../designqr-package/style-principles.md#presentation-and-hosted-layout); do not add a second editor text layer. |
| Transparent background | The persistent toggle beside Blur controls transparency in both views. Preview alpha over the tokenized checkerboard outside the presentation canvas; it must never appear in exports. Artwork and quiet-zone behavior follow the [package presentation contract](../designqr-package/style-principles.md#presentation-and-hosted-layout). |

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

Gesture arbitration, camera projection, and export behavior follow the
[package zoom contract](../designqr-package/style-principles.md#view-only-zoom).

In 道頓堀's 3D view, this popover also contains **River view**. It raises the
camera to 50° on the existing northeast bearing, stops Auto Spin, resets
viewing zoom/pan and closes the popover with focus returned to its disclosure.
Reset view restores the original 30° opening. The preset survives 3D↔2D turns
but is absent from QR mode and the other designs. It changes transient viewing
state, not the canonical configuration or embed default. WYSIWYG exports use
the current 3D angle; the popover distinguishes that from zoom, which never
changes exports. The button uses the
existing zoom-action states and standard control height; no persistent rail
item is added. Reduced motion commits the camera change directly.

### Breakpoints and stage framing

- `620px`: shared platform/header rail changes to 18 px page edges.
- `640px`: Design QR switches to compact controls, 8 px overlay edges, icon-only
  header mode buttons, and reduced drawer spacing.
- `768px`: the custom-theme side panel becomes a bottom sheet.
- Artwork framing follows the [package projection contract](../designqr-package/style-principles.md#responsive-projection).
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
  [global color registry](../global-standards/colors.md); run
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

## City preset controls

- The drawer begins with a shared Tree / City selector. Both designs keep a
  preset-selection row beneath it: seasonal choices for Tree, 渋谷 and
  道頓堀 for City. City names use Japanese text and `lang="ja"` on their buttons;
  the stable configuration identifiers remain `shibuya` and `dotonbori`.
  City has no Custom Theme controls. Reselecting
  either preset with a click, Enter or Space preserves editor state.
  Selecting City closes any open Tree theme editor and cancels its unsaved
  preview; returning to Tree restores the previously selected theme.
- The City preset row contains both City chips and may wrap. It uses the standard
  control height, visible keyboard focus, and existing hover/pressed/disabled
  states, within the shared bottom-control rail at every viewport size.

Artwork geometry and behavior follow the
[package City contract](../designqr-package/style-principles.md#city-design).

The Dōtonbori night backdrop uses light semantic ink for the exposed product
title, capability badge and floating Edit/Logo/Zoom disclosures in 3D, plus a light
header divider. Hover/open disclosures return to their warm light surface and
dark ink; their keyboard outline remains visible. The GitHub pill uses the more
opaque shared control surface and a light keyboard outline. Panels retain the standard
light-surface hierarchy. Preset changes restore the appropriate stage treatment
without changing control dimensions, rails or reduced-motion behavior.
QR view uses the light City scan backdrop and normal dark interface ink.
