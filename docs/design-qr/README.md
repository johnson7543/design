# Design QR documentation

Design QR turns text or a URL into a seasonal 3D tree or Shibuya city that transitions into a
scannable 2D QR design. This directory contains the maintained product-specific
references.

| Document | Status | Purpose |
| --- | --- | --- |
| [Interface style principles](style-principles.md) | Active | Visual language, component contracts, responsive rules, and implementation checklist |
| [Design QR color mappings](color-palettes.md) | Active | Seasonal and City swatches, procedural distributions, and renderer/component assignments |
| [Integration implementation plan](integration-plan.md) | In progress | Iframe, React package, Web Component, export, and public configuration architecture |
| [Interactive tree feature implementation plan](interactive-tree-feature-plan.md) | Complete | Rotation direction, Pixel foliage, animated logo, and complete public theme architecture |
| [Shibuya city](shibuya-city.md) | Active | City design, reference interpretation, morph, and verification |
| [Shibuya road network](shibuya-road-network.md) | Active | Shared georeferenced road foundation, measured proportions, source attribution, and regeneration |
| [Shibuya buildings and station](shibuya-architecture.md) | Active | Source-aligned buildings, police box, Hachiko entrance, JR lettering, rail bridge and A6a/A6b/A7a subway entrances; accuracy and geometry contracts |
| [Hachikō statue and square](hachiko-square.md) | Active | Reference-based Blender sculpture, east-facing geographic placement, garden setting, scale and clearance |
| [Shibuya Blender assets](shibuya-blender-assets.md) | Active | City model authoring, asset delivery, and verification |
| [Release notes](release-notes.md) | Prepared | Package release features and consumer usage |
| [Release pipeline](releasing.md) | Active | npm package validation, first-publish bootstrap, Trusted Publishing, and version-tag procedure |

## Sources of truth

| Concern | Source |
| --- | --- |
| Interface tokens | [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css) |
| Globally permitted colors | [Repository color registry](../design-system/colors.md) |
| Design QR color assignments | [Design QR color mappings](color-palettes.md) |
| Runtime seasonal preset values | [`packages/designqr/src/designs/tree/themes.ts`](../../packages/designqr/src/designs/tree/themes.ts) |
| City swatches and color roles | [`packages/designqr/src/designs/city/palette.ts`](../../packages/designqr/src/designs/city/palette.ts) |
| Shared City road geometry and metric scale | [`packages/designqr/src/designs/city/road-network.ts`](../../packages/designqr/src/designs/city/road-network.ts) |
| Shared traffic fixtures and Center-Gai entrance | [`street-layout.ts`](../../packages/designqr/src/designs/city/street-layout.ts), [`street-furniture.ts`](../../packages/designqr/src/designs/city/street-furniture.ts); [reference and accuracy contract](shibuya-road-network.md#street-fixtures-and-center-gai) |
| City building source and shared façade geometry | [`building-data.ts`](../../packages/designqr/src/designs/city/building-data.ts), [`architecture.ts`](../../packages/designqr/src/designs/city/architecture.ts) |
| Police box, adjoining station and letterforms | [`station-frontage.ts`](../../packages/designqr/src/designs/city/station-frontage.ts), [`station-frontage-layout.ts`](../../packages/designqr/src/designs/city/station-frontage-layout.ts), [`transit-lettering.ts`](../../packages/designqr/src/designs/city/transit-lettering.ts) |
| Station bridge and subway entrances | [`station-layout.ts`](../../packages/designqr/src/designs/city/station-layout.ts), [`station-geometry.ts`](../../packages/designqr/src/designs/city/station-geometry.ts), [`transit-signs.ts`](../../packages/designqr/src/designs/city/transit-signs.ts) |
| Tree and City UI preset option metadata | [`src/editor/theme-presets.ts`](../../src/editor/theme-presets.ts) |
| Interface behavior | [`src/components/`](../../src/components) and [`src/App.tsx`](../../src/App.tsx) |
| View-only zoom (editor 1000%, public player 300%) and opt-in package gestures | [`PreviewZoomController.ts`](../../packages/designqr/src/interaction/PreviewZoomController.ts), [`previewProjection.ts`](../../packages/designqr/src/renderer/previewProjection.ts); [view-only contract](style-principles.md#view-only-zoom) |
| Rendering and public React player | [`packages/designqr/`](../../packages/designqr) |
| Hosted player route | [`src/routes/DesignQREmbedRoute.tsx`](../../src/routes/DesignQREmbedRoute.tsx) |
| Iframe protocol and host helper | [`packages/designqr/src/embed/`](../../packages/designqr/src/embed) |
| Cross-origin integration fixture | [`examples/iframe-consumer/`](../../examples/iframe-consumer) |
| Scoped player styles, presentation variables, and focus states | [`packages/designqr/src/style.css`](../../packages/designqr/src/style.css) |
| Agent enforcement | [`AGENTS.md`](../../AGENTS.md) |

For repository setup and local app commands, see the root
[`README.md`](../../README.md).
