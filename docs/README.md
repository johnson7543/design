# Documentation

Choose the area that owns the behavior you are changing.
Repository setup stays in the root [README](../README.md).

| Area | What belongs here | Main source |
| --- | --- | --- |
| [Global standards](global-standards/README.md) | Repository-wide color rules and documentation conventions | Shared design tokens and documentation registry |
| [Home page UI](home-page/README.md) | Catalog, site shell, loading, and not-found surfaces | `src/platform/`, `src/platform.css` |
| [DesignQR package](designqr-package/README.md) | Public player, rendering, themes, city assets, integrations, and releases | `packages/designqr/` |
| [DesignQR editor UI](designqr-editor/README.md) | Controls, theme editing, logo crop, sharing, and responsive editor layout | `src/App.tsx`, `src/components/`, `src/editor/` |
| [Demo-video workflow](demo-videos/README.md) | Recording and verifying product previews | `scripts/record-demo-video.mjs` |

The editor consumes the package. A change to artwork, QR rendering, export, or
public player behavior belongs in package docs even when it is visible in the
editor. A change to surrounding controls or editor layout belongs in editor
docs. The hosted `/qr/embed` route is a package integration surface.

Use the [design registry](design-registry.json) to resolve exact route and source
ownership. Read [documentation conventions](global-standards/documentation.md)
when adding or moving documents.
