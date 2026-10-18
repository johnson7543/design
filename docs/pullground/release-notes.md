# Pullground release notes

Status: Stable `0.1.0` published on `latest`; `0.1.0-rc.1` remains on `next`

[Documentation index](README.md) · [Release plan](release-plan.md)

## 0.1.0 — 2026-10-19

The first stable release is available on
[npm](https://www.npmjs.com/package/@johnson7543/pullground/v/0.1.0).

```sh
npm install @johnson7543/pullground
```

It preserves the prerelease API, runtime, four games, and four themes. Import
`Pullground` from the package root and provide `onPull`; styles are automatic.
The [consumer README](../../packages/pullground/README.md) covers complete React
examples, sizing, actions, errors, accessibility, and supported integration.

This release adds the completed desktop-browser acceptance record and uses
GitHub Actions trusted publishing with signed provenance. The
[stable release record](releases/0-1-0.md) retains the qualification, registry,
and live-site evidence. Try the [demo](https://design.johnson7543.com/pullground)
or open it from the [design home page](https://design.johnson7543.com/).

## 0.1.0-rc.1 — 2026-10-19

The first public prerelease is available on
[npm](https://www.npmjs.com/package/@johnson7543/pullground/v/0.1.0-rc.1).

```sh
npm install @johnson7543/pullground@next
```

Pullground adds a small playable interaction to any React pull action. Wrap your
content with `Pullground` and provide `onPull`; styles are included automatically.

- Four games: Basketball, Dart, Bowling, and Stone skipping, with directional
  aiming and artwork that scales with its container.
- Four component palettes: Classic, Simple, Ocean, and Midnight.
- Sync and async actions, cancellation on unmount, error feedback, and an
  optional imperative handle. The action controls completion without an extra
  animation delay.
- Keyboard play, localized announcements, and reduced-motion support.
- A matching demo with shared DesignQR controls and copyable React examples
  in Export, plus a recorded homepage preview.

The package targets React 19 web applications, owns its scrolling viewport, and
ships ESM, CommonJS, and TypeScript declarations. See the
[consumer README](../../packages/pullground/README.md) for installation and examples.
The demo's surrounding controls and animated Pull guide belong to the website,
not the reusable component.

The [release record](releases/0-1-0-rc-1.md) identifies the source commit,
published archive, exact UTC timestamp, and completed verification.
