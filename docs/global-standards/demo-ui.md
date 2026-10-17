# Product demo UI standard

Status: Active repository standard<br>
Scope: `/qr`, `/pullground`, and future product demo pages

[Back to global standards](README.md)

DesignQR is the reference interface. Every product demo uses the same header,
glass control rail, control states, Export action, dialog frame, and code
presentation. Product content and interactions may differ. The home catalog,
embedded players, and standalone package-consumer fixtures are not demo editors
and do not acquire this chrome.

## Executable sources

| Concern | Source |
| --- | --- |
| Header, control rail, panel, choice, Export, code action | [`DemoChrome.tsx`](../../src/demo-ui/DemoChrome.tsx) |
| Dialog, focus containment, Escape, backdrop dismissal, focus return | [`DemoDialog.tsx`](../../src/demo-ui/DemoDialog.tsx) |
| Shared foundations and semantic roles | [`design-tokens.css`](../../src/styles/design-tokens.css) |
| Existing DesignQR control styles | [`index.css`](../../src/index.css) |
| Shared layout variants and states | [`demo-ui.css`](../../src/demo-ui/demo-ui.css) |
| GitHub mark and star count | [`GitHubLink.tsx`](../../src/components/GitHubLink.tsx) |
| Syntax presentation | [`CodeView.tsx`](../../src/components/CodeView.tsx) |
| Registered demos | [`design-registry.json`](../design-registry.json), `demoRoutes` |
| Rendered conformance checks | [`smoke-demo-ui.mjs`](../../scripts/smoke-demo-ui.mjs) |

Keep the existing `--qr-*` names as the shared semantic API. New demos consume
these roles without duplicating or renaming the palette. Color assignments stay
in the [DesignQR UI mappings](../designqr-editor/color-mappings.md) and the
owning product's documents, under the [global color allowlist](colors.md).

## Required shared components

| Component | Contract |
| --- | --- |
| `DemoHeader` | Non-navigating title at left; official GitHub/star control at right. Product badges/credits and mode actions use the provided slots. An optional center slot is centered independently between equal columns. The default header overlays the stage; `flow` lets a pull demo move the same header with its content. |
| `DemoControls` | One centered bottom rail, outside the animated/scrolling stage. Empty outer gutters pass input to the stage. Product controls remain interactive. |
| `DemoPanel` | Shared glass surface, padding, corner radius, and vertical gap. Groups use standard rows and the shared choice classes. |
| `DemoChoice` | Native button with `selected` mapped to `aria-pressed` and the standard selected surface. Mode/game choices precede the preset row. All essential labels stay visible and fit the rail. |
| `DemoExportButton` | DesignQR's upward arrow leaving a tray, 18 px, inside an accent square. Icon only at every viewport size. Put it at the right edge of the bottom panel's action row; give it a product-specific accessible label/title and `aria-expanded`. Never add it to the header or replace it with a connected-nodes icon or text pill. |
| `DemoDialog` | Shared native modal with the sparkle title, description, and Close button. Opening focuses Close, background content is inert, Tab stays inside, Escape or a press-and-release on the backdrop closes, and focus returns to the opener. Product export modes and content occupy the body. Optional visual effects stay in the dialog overlay. |
| `DemoCodeAction` / `CodeView` | Shared icon control and syntax colors for Copy/Wrap. Copy changes to a check and announces success; native disabled state covers pending work. Failure provides an honest retry or manual-copy path. Code scrolls inside the dialog and remains selectable. |

Do not re-create these controls with product-specific markup, inline geometry,
or CSS overrides. Keep product-only artwork, hints, and content layouts in the
owning design. Extend the shared implementation when a common capability is
needed, then verify every registered demo.

## Geometry and responsive behavior

- Header: 760 px maximum rail, 82 px height, 32 px page edges. At 620 px and
  below: 72 px height and 18 px edges. All items stay on one line.
- Bottom rail: 580 px maximum on desktop with 16 px inner edges; 24 px bottom
  gap plus safe area. At 640 px and below: full width, 8 px edges and bottom
  gap plus safe area. Keep all right-edge action squares aligned.
- Controls: 38 px desktop, 34 px compact, using `--qr-control-*`. Use the same
  heights, radii, gaps, and font roles for siblings. Optional product icons in
  choices are 15 px and inherit the label color.
- Dialog: 560 px maximum width and 580 px maximum height with 24 px padding
  and radius. At 640 px and below: bottom sheet with 12 px outer edges plus
  bottom safe area, 18 px padding and 16 px radius. Preserve that footprint
  when switching export modes; scroll the body or code, keeping Close available.
- Close is the reference 32 px circle; code actions are 34 px squares. Product
  pages must not independently resize either control.
- Layout belongs in CSS. Inline styles may carry runtime artwork values only.

## Interface and product theme boundary

Product themes color their component artwork and may color the surrounding
stage. Shared headers, GitHub controls, panels, choices, Export, dialogs, copy
feedback, and syntax retain the same DesignQR roles across demos and presets.
Do not redefine `--qr-*` or shared foundation tokens in a product stylesheet.
For a dark stage, use `data-stage-tone="night"`: exposed title and stage hints
use the shared light-ink treatment, and GitHub uses the more opaque shared
control surface with a light focus outline. Panels and dialogs remain the
standard warm interface. This readability treatment is shared by all demos.

## Interaction and verification

Keep default, hover, pressed, selected, focus-visible, and disabled states.
Native buttons support Enter/Space; focus outlines must not be clipped by
choice rows. Reduced motion removes repeating motion, entrance effects, and
pressed transforms. A product-specific drag surface must ignore the control
rail and stay disabled while its dialog is open.

For a new demo, register its route/design ownership and add the route to
`demoRoutes`. Compose the shared components under `.app-root`; the application
entry point already loads the common styles. Add product-specific checks to
its owning suite, leaving common conformance in `smoke:demo-ui`.

After changes, run `npm run style:check`, `npm run lint`, `npm run build`,
`npm run smoke:demo-ui`, and the affected product suite. Run
`npm run smoke:production` for shared geometry or interaction changes; it
covers DesignQR's 3D and 2D states. Review 1440×900, 390×844, and 320×568,
including a dark stage, open export, keyboard focus, and reduced motion.
Run the documentation and color checks required by [AGENTS.md](../../AGENTS.md).
