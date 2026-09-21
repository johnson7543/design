# DesignQR package documentation

Owns the reusable `designqr` package: React player, QR rendering, Tree and City
artwork, themes, export, iframe integration, generated assets, and release work.
For installation and public API examples, start with the
[package README](../../packages/designqr/README.md).
For controls and page layout, use [editor UI docs](../designqr-editor/README.md).

| Area | Start here |
| --- | --- |
| Rendering contract | [Rendering principles](style-principles.md): motion, gestures, projection, and shared artwork behavior |
| Color contract | [Color palettes](color-palettes.md): seasonal and City material roles |
| City designs | [City documentation](cities/README.md): Shibuya, Dōtonbori, Tokyo Tower, sources, geometry, and asset generation |
| Architecture | [Package architecture](architecture.md): configuration, lifecycle, export, and iframe boundaries |
| Maintenance | [Maintenance guide](maintenance.md): extension points, regression risks, validation, and enhancement considerations |
| Releases | [Release documentation](releases/README.md): validation, publishing, and release notes |

## Ownership and sources

| Concern | Source |
| --- | --- |
| Public API, renderers, gestures, and themes | [`packages/designqr/src/`](../../packages/designqr/src) |
| Package stylesheet | [`packages/designqr/src/style.css`](../../packages/designqr/src/style.css) |
| Hosted player integration | [`src/routes/DesignQREmbedRoute.tsx`](../../src/routes/DesignQREmbedRoute.tsx) |
| City authoring and generated inputs | [`scripts/blender/`](../../scripts/blender), [`assets/design-qr/`](../../assets/design-qr) |
| Global color rules | [Approved colors](../global-standards/colors.md) |

Required reference material belongs alongside its package documentation or in
`assets/design-qr/<city>/`, with origin, redistribution terms, and intended use
recorded in the owning document.
