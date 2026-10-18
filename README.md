# Design

[![Verify](https://github.com/johnson7543/design/actions/workflows/verify.yml/badge.svg)](https://github.com/johnson7543/design/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![X](https://badgen.net/badge/X/@johnson7543_/black)](https://x.com/johnson7543_)

Open-source home of [Design](https://design.johnson7543.com), an app for
interactive visual tools and reusable React components.

Try [Design QR](https://design.johnson7543.com/qr) to turn a URL into a seasonal
3D tree that transitions into a scannable, customizable QR code.

## Run the app locally

```bash
npm install
npm run dev
```

To build and serve the production version:

```bash
npm run build
npm run preview
```

## Packages

### DesignQR

[![npm](https://img.shields.io/npm/v/designqr?logo=npm)](https://www.npmjs.com/package/designqr)
[![npm downloads](https://img.shields.io/npm/dm/designqr?logo=npm)](https://www.npmjs.com/package/designqr)

Reusable React component for turning URLs into interactive 3D tree designs that transition into scannable QR codes.
[`packages/designqr`](packages/designqr). See its
[`README`](packages/designqr/README.md) for installation, examples, props, and
custom themes.

### Pullground

Playful pull gestures for React, with tiny basketball, dart, bowling, and stone skipping interactions.
Use `onPull` for any synchronous or async action.
Try the [live demo](https://design.johnson7543.com/pullground). The package is
[`packages/pullground`](packages/pullground); see its
[`README`](packages/pullground/README.md) for usage, props, sizing, and
accessibility. Stable `0.1.0` is available on
[npm](https://www.npmjs.com/package/@johnson7543/pullground):

```bash
npm install @johnson7543/pullground
```

See the [stable release record](docs/pullground/releases/0-1-0.md) for package,
provenance, browser, and live-demo verification.
