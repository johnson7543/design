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

## Design QR interface work

Before changing Design QR components, layout, responsive behavior, or interface
CSS, read and follow [`docs/design-qr/style-principles.md`](docs/design-qr/style-principles.md).
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

## Global color contract

Before adding or changing any repository-authored color, read and follow
[`docs/design-system/colors.md`](docs/design-system/colors.md). Only base RGB
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
  [`docs/design-qr/color-palettes.md`](docs/design-qr/color-palettes.md)
  synchronized.
- Run `npm run color:check` after color-related changes.

## Product demo video work

When asked to create, regenerate, change, or apply a product/design demo video,
read and use [`skills/record-product-demo/SKILL.md`](skills/record-product-demo/SKILL.md).

## Documentation organization

- Keep repository entry points (`README.md` and `AGENTS.md`) at the root.
- Keep product documentation under `docs/<product>/`; reserve `.agents/rules/`
  for substantial agent-only workflows that do not belong in this file.
- Register every implemented visual product in `docs/design-registry.json`.
- Use lowercase kebab-case filenames and add maintained documents to the nearest
  documentation index.
- Update inbound links whenever a document moves, then run `npm run docs:check`.
