# DesignQR editor UI documentation

Owns the `/qr` editing application: page chrome, controls, theme and logo
editors, sharing, preview tools, and responsive layout. It consumes the
[DesignQR package](../designqr-package/README.md), which owns rendered artwork,
QR behavior, player gestures, export, and public integration APIs.

| Document | Purpose |
| --- | --- |
| [Interface principles](style-principles.md) | Control rails, components, responsive layout, motion integration, and accessibility |
| [Color mappings](color-mappings.md) | Semantic UI surfaces, syntax highlighting, and zoom controls |

## Sources of truth

| Concern | Source |
| --- | --- |
| Editor orchestration | [`src/App.tsx`](../../src/App.tsx) |
| Controls and dialogs | [`src/components/`](../../src/components) |
| Theme and preview state | [`src/editor/`](../../src/editor) |
| Layout and styling | [`src/index.css`](../../src/index.css) |
| Semantic tokens | [`src/styles/design-tokens.css`](../../src/styles/design-tokens.css) |
| Japanese City labels | [Bundled font](../../src/editor/fonts/city-names-ja.woff), [OFL notice](../../src/editor/fonts/city-names-ja-license.txt), and [subset generator](../../scripts/build-city-label-font.py) |
| Sharing, logo preparation, and export adapters | [`src/utils/`](../../src/utils) |

Package integration boundaries are described in
[package architecture](../designqr-package/architecture.md). The public
`/qr/embed` player is documented with the package; it does not include editor UI.

Regenerate the City label font with
`python3 scripts/build-city-label-font.py --sans /path/to/NotoSansCJKjp-Medium.otf`.
The generator verifies the same source hash used by the city sign lettering,
subsets the current editor labels, and embeds the OFL license in the resulting
font. This small editor asset loads from the application bundle.
