# Repository instructions

## Design documentation harness

For any task that creates, changes, fixes, or reviews a product route, visual
interface, layout, responsive behavior, component styling, motion, or color
role, automatically read and use
[`skills/maintain-design-docs/SKILL.md`](skills/maintain-design-docs/SKILL.md).
The user does not need to request a documentation pass separately.

- Resolve the owning design through
  [`docs/design-registry.json`](docs/design-registry.json) and read its current
  style and color documents before implementation.
- After implementation, review the resulting behavior and update the owning
  documents when a maintained contract changed. Do not churn docs for internal
  changes that preserve documented behavior.
- When adding an unregistered route or visual product, create its design index,
  style principles, and color mappings from the skill templates, register its
  routes/source paths, and link it from `docs/README.md`.
- Run `npm run design-docs:check` after design or documentation work.

## Product demo UI standard

For product demo pages, read and follow
[`docs/global-standards/demo-ui.md`](docs/global-standards/demo-ui.md).
DesignQR is the reference interface. Use the shared components in `src/demo-ui/`
for headers, bottom panels, choices, Export, dialogs, and code actions.
Product themes may change artwork and stage backgrounds; keep shared control,
dialog, syntax, and feedback tokens unchanged. Use the shared night-stage
treatment when exposed header text needs light ink.

Register demo routes in `docs/design-registry.json` under `demoRoutes` and run
`npm run smoke:demo-ui` after changing shared chrome. Update the standard and
both consuming designs when a common contract changes.

## DesignQR editor interface work

Before changing DesignQR editor components, layout, responsive behavior, or interface
CSS, read and follow [`docs/designqr-editor/style-principles.md`](docs/designqr-editor/style-principles.md).
Treat [`src/styles/design-tokens.css`](src/styles/design-tokens.css) as the
executable source of truth.

- Use existing semantic `--qr-*` tokens before adding literal interface values.
- Keep the shared header rail, bottom-control rail, standard control heights,
  and Add Theme/Share right-edge alignment intact.
- Keep static spacing, typography, grids, and dimensions in CSS rather than JSX.
- Implement default, hover, active/selected, `:focus-visible`, and disabled
  states where applicable, and preserve the reduced-motion behavior.
- Check both 3D and 2D modes when changing stage or overlay geometry.
- Verify responsive UI at 1440×900, 390×844, and 320×568 when layout is affected.
- Run `npm run style:check`, `npm run lint`, and `npm run build` after interface
  changes. Run `npm run smoke:production` when layout, responsive behavior,
  routing, or interaction geometry changes.

## DesignQR package work

Before changing player rendering, gestures, artwork, or package CSS, read
[`docs/designqr-package/style-principles.md`](docs/designqr-package/style-principles.md)
and the package color mappings. Editor UI contracts are maintained separately
under `docs/designqr-editor/`.

## Global color contract

Before adding or changing any repository-authored color, read and follow
[`docs/global-standards/colors.md`](docs/global-standards/colors.md). Only base RGB
colors in its approved-color list may be used anywhere in source, styles,
renderers, assets, defaults, or documentation. Do not add a new approved color
unless the user explicitly requests a repository palette change.

- Prefer existing semantic CSS tokens or runtime palette constants over raw
  literals.
- Opacity and programmatic blends may derive from approved base colors.
- Treat user-selected Custom Theme values as runtime input, not authored
  defaults.
- Keep color roles and component mappings in the owning design's product
  documentation, never in the global registry.
- For Design QR seasonal artwork changes, keep
  [`docs/designqr-package/color-palettes.md`](docs/designqr-package/color-palettes.md)
  synchronized.
- Run `npm run color:check` after color-related changes.

## Product demo video work

When asked to create, regenerate, change, or apply a product/design demo video,
read and use [`skills/record-product-demo/SKILL.md`](skills/record-product-demo/SKILL.md).

## Documentation organization

- Keep repository entry points (`README.md` and `AGENTS.md`) at the root.
- Follow the four ownership areas in `docs/README.md`: global standards, home
  page UI, DesignQR package, and DesignQR editor UI. Reserve `.agents/rules/`
  for substantial agent-only workflows that do not belong in this file.
- Register every implemented visual product in `docs/design-registry.json`.
- Use lowercase kebab-case filenames and add maintained documents to the nearest
  documentation index.
- Update inbound links whenever a document moves, then run `npm run docs:check`.
