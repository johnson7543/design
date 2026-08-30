# Design QR style principles

Status: Active interface contract<br>
Scope: Design QR application chrome, editor components, and hosted player<br>
Source of executable values: [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css)

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
- UI labels use 600 weight; headings and selected/value labels use 700.
- Use sentence case for actions and title case only for product or preset names.
- Numeric outputs use tabular numerals when their width can change.

### Motion

- The 3D↔2D transformation uses symmetric smoothstep easing so it starts and
  settles without a velocity jump.
- The nominal `1×` transition completes in approximately 0.83 seconds. The
  editor speed control scales relative to that baseline; reduced-motion mode
  still bypasses the animated transition.
- Organic canopy collapse and QR voxel reveal overlap across the full turn;
  avoid early visibility cuts or scale ramps that compress the visible morph
  into only the first portion of the transition.

### Surface hierarchy

| Tier | Token or pattern | Use |
| --- | --- | --- |
| Stage | Seasonal background | Tree, QR, and environmental artwork |
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
| 3D/2D stage | Occupies the available canvas and remains centered within the space left by header and bottom controls. UI effects must not create visible viewport edges. |
| Stage hint/editor | Uses pill geometry and the warm floating surface. The hint is centered independently of optional edge tools. |
| Content input | Full width of the bottom rail. Focus is shown on the containing card, not only the text caret. |
| Theme drawer | Season row, optional custom-theme row, then action row. Add-theme and Share are equal squares at each breakpoint. |
| 2D detail editor | Title first, options second. Expanding Border must not shift the centered mode hint or overflow the rail. |
| Theme editor | Desktop side panel, mobile bottom sheet. Form sections use shared option grids, field surfaces, sliders, and footer buttons. |
| Share modal | Starts with a three-option `Share` / `Embed` / `React` switch. The outer modal keeps one fixed responsive footprint across all three modes; only the active panel scrolls when needed. Share keeps one clearly primary WYSIWYG download, optional system share, and direct-link copy. Embed exposes the canonical configuration. React presents a copyable npm command plus `Simple` (minimal equivalent) and `Advance` (complete customization surface, including explicit `quality="high"`) examples. The generated `Advance` example stays declarative and does not include an unused imperative ref. Every copy action is the same aligned icon-only control with an accessible label, and HTML, shell, and TSX use the documented syntax palette. Code scrolls inside its own field; the modal must fit at 320 px without page-level horizontal overflow. |
| QR metadata | Belongs visually to the QR card and follows its alignment; it does not become a second floating panel. |
| Hosted player | `/qr/embed` contains exactly one edge-to-edge DesignQR player. It has no header, editor controls, modal, minimum editor viewport, or extra integration chrome; invalid input becomes one stable centered fallback. The public component defaults to a responsive 1:1 footprint when its host supplies width only. Size and appearance overrides belong directly on `<DesignQR>` through its `style` or `className` props; generated React snippets must not add a sizing wrapper. |

## Responsive rules

- `620px`: shared platform/header rail changes to 18 px page edges.
- `640px`: Design QR switches to compact controls, 8 px overlay edges, icon-only
  header mode buttons, and reduced drawer spacing.
- `768px`: the custom-theme side panel becomes a bottom sheet.
- Height media queries may scale and lift the stage to preserve control clearance.
  They must use the same transform for the 3D tree and 2D QR so the morph stays
  spatially continuous.
- Safe-area insets belong on fixed edge UI where relevant.
- The hosted player follows its iframe container at every size and must remain
  free of horizontal overflow; its host owns the aspect ratio and outer spacing.

Test at least 1440×900, 390×844, and 320×568. Check both 3D and 2D modes, an
expanded details editor, the theme sheet, and every Share modal mode.

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
- Add selected and disabled semantics (`aria-pressed`, `aria-checked`, or native
  state) that match the visual state.
- Verify long labels, 200% zoom, and 320 px width do not cause horizontal scroll.
- Include new animated selectors in the reduced-motion contract.
- Remove styles when their owning component is removed.
- Run `npm run style:check` and `npm run check` before release.
