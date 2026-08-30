# Design

Design is a home for interactive tools and visual experiments by Johnson Wang.
The first tool, Design QR, turns a URL into a seasonal 3D tree that transitions
into a scannable, customizable QR card.

## Routes

- `/` is the Design homepage and tool collection.
- `/qr` is the interactive Design QR generator.
- `/qr/embed?config=…` is the chrome-free hosted DesignQR player for external
  websites and applications.

## Development

```bash
npm install
npm run dev
```

The local Vite server prints the development URL in the terminal.

## Product demo videos

Ask an agent with a short prompt such as:

> Create and apply a demo video for `<Product Name>`. Show `<actions in order>` and add it to the Design catalog.

For manual initialization and recording:

```bash
npm run init:demo -- --product "Product Name" --route /route --consumer src/platform/DesignHomePage.tsx
npm run record:demo -- --scenario scripts/demo-video-scenarios/product-name.json
```

See the [product demo video workflow](docs/demo-videos/README.md) for first-time setup, prompt examples, supported options, and the application checks.

## Checks

```bash
npm run check
```

This runs linting, checks documentation links and design ownership, enforces the
global color allowlist and Design QR style contract, creates the production
build in `dist/`, and opens both `/` and `/qr` in headless Chrome to verify that
the platform and QR tool mount successfully. It also builds standalone React and
iframe consumers, exercises the hosted player from a different origin, checks
its WYSIWYG PNG export, and verifies the actual Wrangler response headers.

## Cloudflare deployment

The production site is deployed with Cloudflare Workers Static Assets at
[design.johnson7543.com](https://design.johnson7543.com). After authenticating Wrangler
with the correct Cloudflare account, deploy a verified release with:

```bash
npm run deploy
```

The account and Custom Domain route are declared in `wrangler.jsonc`. The
duplicate `workers.dev` URL is disabled so the custom hostname remains canonical.
The existing site at `johnson7543.com` is not part of this Worker configuration.

## Project structure

- `docs/` contains the documentation index and product-specific references.
- `docs/design-registry.json` maps implemented routes and source paths to their
  owning design documents.
- `docs/design-system/` contains repository-wide visual contracts, including
  the approved-color registry.
- `src/platform/` contains platform routing and page components.
- `src/platform.css` contains styles isolated to the Design shell and homepage.
- `src/styles/design-tokens.css` is the executable interface token source.
- `src/components/` contains the React interface and interactive overlays.
- `src/editor/` contains editor-only persistence types and metadata.
- `src/utils/` contains share-link encoding and image export.
- `packages/designqr/` contains the canonical configuration, QR/tree generation,
  Three.js renderer, scoped player styles, public React component, iframe API,
  and library build.
- `examples/react-vite-consumer/` type-checks and bundles against the package's
  published export map as an external React application would.
- `examples/iframe-consumer/` is a framework-neutral cross-origin host for the
  `/qr/embed` player and message controller.
- `docs/design-qr/` contains Design QR interface and integration documents.

## Documentation

Start with the [`docs` index](docs/README.md), the shared
[`design-system index`](docs/design-system/README.md), the
[`Design platform documentation`](docs/design-platform/README.md), or the
[`Design QR documentation index`](docs/design-qr/README.md).
