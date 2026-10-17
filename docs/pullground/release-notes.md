# Pullground 0.1.0 release notes

Status: Draft for the first stable release; not yet published

[Documentation index](README.md) · [Release plan](release-plan.md)

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

Publication links and completed device/browser qualification will be recorded
when the release gates pass. The current working candidate is `0.1.0-rc.1`.
