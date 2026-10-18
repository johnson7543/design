# Pullground release notes

Status: `0.1.0-rc.1` published on `next`; stable `0.1.0` prepared for qualification

[Documentation index](README.md) · [Release plan](release-plan.md)

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

## Prepared: 0.1.0

The stable candidate preserves the prerelease API, runtime, games, and themes.
It uses the standard installation command and records maintainer-confirmed
desktop Firefox/Safari checks alongside the earlier mobile acceptance.

Final qualification, trusted publishing, stable publication, and the matching
website deployment follow the [release plan](release-plan.md) and
[stable release record](releases/0-1-0.md).
