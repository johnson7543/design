# Design QR documentation

Design QR turns text or a URL into a seasonal 3D tree that transitions into a
scannable 2D QR design. This directory contains the maintained product-specific
references.

| Document | Status | Purpose |
| --- | --- | --- |
| [Interface style principles](style-principles.md) | Active | Visual language, component contracts, responsive rules, and implementation checklist |
| [Design QR color mappings](color-palettes.md) | Active | Seasonal swatches and Design QR renderer/component assignments |
| [Integration implementation plan](integration-plan.md) | In progress | Iframe, React package, Web Component, export, and public configuration architecture |
| [Interactive tree feature implementation plan](interactive-tree-feature-plan.md) | In progress | Rotation direction, Pixel foliage, animated logo, and complete public theme architecture |
| [Release pipeline](releasing.md) | Active | npm package validation, first-publish bootstrap, Trusted Publishing, and version-tag procedure |

## Sources of truth

| Concern | Source |
| --- | --- |
| Interface tokens | [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css) |
| Globally permitted colors | [Repository color registry](../design-system/colors.md) |
| Design QR color assignments | [Design QR color mappings](color-palettes.md) |
| Runtime seasonal preset values | [`packages/designqr/src/designs/tree/constants.ts`](../../packages/designqr/src/designs/tree/constants.ts) |
| Interface behavior | [`src/components/`](../../src/components) and [`src/App.tsx`](../../src/App.tsx) |
| Rendering and public React player | [`packages/designqr/`](../../packages/designqr) |
| Hosted player route | [`src/routes/DesignQREmbedRoute.tsx`](../../src/routes/DesignQREmbedRoute.tsx) |
| Iframe protocol and host helper | [`packages/designqr/src/embed/`](../../packages/designqr/src/embed) |
| Cross-origin integration fixture | [`examples/iframe-consumer/`](../../examples/iframe-consumer) |
| Package-owned scoped styles | [`packages/designqr/src/style.css`](../../packages/designqr/src/style.css) |
| Agent enforcement | [`AGENTS.md`](../../AGENTS.md) |

For repository setup, commands, and deployment, see the root
[`README.md`](../../README.md).
