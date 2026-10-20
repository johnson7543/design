# Product demo video workflow

**Status:** Active<br>
**Source of truth:** [`record-product-demo` skill](../../skills/record-product-demo/SKILL.md), [`record-demo-video.mjs`](../../scripts/record-demo-video.mjs), and checked-in files under [`scripts/demo-video-scenarios/`](../../scripts/demo-video-scenarios).

This workflow records the real local product UI, generates its MP4/poster, and verifies that the intended catalog or product component references those assets.

## Use a simple agent prompt

For a product's first demo:

> Create and apply a demo video for `<Product Name>`. Show `<actions in order>`. Use `<duration/fps/orientation if important>`, and add it to `<catalog or page>`.

Example:

> Create and apply a demo video for Particle Garden. Change the particle preset, drag the intensity control, then reset it. Use an 8-second portrait video at 60 fps and add it to the Design catalog.

For an existing demo:

> Re-record the `<Product Name>` demo. Replace the actions with `<new sequence>` and apply the new version.

Mention `$record-product-demo` explicitly if desired, but [`AGENTS.md`](../../AGENTS.md) already routes demo-video requests to the skill.

The product and route must already exist. Creating a demo does not implicitly authorize implementing a missing product.

## What the agent does for a first demo

1. Finds the implemented route, stable UI selectors, and preview consumer.
2. Initializes `scripts/demo-video-scenarios/<product-slug>.json` without overwriting existing scenarios.
3. Converts the requested flow into real click, tap, drag, typing, key, hover, scroll, wait, and assertion actions.
4. Adds or updates the preview video component so it references the scenario's public MP4 and poster paths.
5. Records the running Vite product through Chrome's tab compositor.
6. Enforces exact metadata and configured continuous-motion windows, visually inspects the generated contact sheets, and runs repository checks.

## Smoothness standard

Animated demos default to genuine 60-fps native tab capture. The recorder rejects an encoded fps above the source capture rate, so the workflow cannot create fake 120-fps output through duplicated or interpolated frames.

For transitions, the agent gives the real product animation enough time to complete, adds a `quality.motionChecks` window, and reviews a dense 5-sample-per-second contact sheet. The automated gate rejects exact duplicate frames inside a continuous-motion window; visual review still checks that easing is gradual rather than abrupt or front-loaded.

If a smooth transition needs more time, the video should be extended instead of compressing the animation to fit an arbitrary duration.

## Manual initialization

From the repository root:

```bash
npm run init:demo -- \
  --product "Particle Garden" \
  --route /particles \
  --consumer src/platform/DesignHomePage.tsx
```

This creates `scripts/demo-video-scenarios/particle-garden.json` with standardized assets:

- `public/previews/particle-garden.mp4`
- `public/previews/particle-garden.webp`
- Public URLs `/previews/particle-garden.mp4` and `/previews/particle-garden.webp`

Initialization never overwrites an existing scenario.

Optional arguments:

| Option | Default | Purpose |
| --- | --- | --- |
| `--id <slug>` | Product-name slug | Scenario and asset basename. |
| `--ready-selector <css>` | `body` | Element proving the product has mounted. |
| `--orientation portrait\|landscape` | `portrait` | Initial viewport and output dimensions. |
| `--duration <seconds>` | `8` | Final video duration. |
| `--fps <number>` | `60` | Encoded frame rate. |

After initialization, replace the starter wait in `actions`, add final `assertions`, and adjust framing fields using the [scenario schema](../../skills/record-product-demo/references/scenario-schema.md). The initializer includes CRF 22, an overall contact sheet, and an empty `motionChecks` list ready for animated intervals.

## Record and apply

Before the first recording, the preview consumer must reference the scenario's `videoPublicPath` and `posterPublicPath`. The runner checks this and fails rather than leaving an unused asset.

Then run:

```bash
npm run record:demo -- --scenario scripts/demo-video-scenarios/particle-garden.json
```

The command builds the app, records the real interactions, writes the media, checks final DOM assertions and application paths, verifies exact encoding metadata, checks configured motion windows, and prints contact-sheet paths for inspection.

Re-run quality verification without recording:

```bash
npm run verify:demo -- --scenario scripts/demo-video-scenarios/particle-garden.json
```

For the existing Design QR scenario, the shortcut remains:

```bash
npm run record:qr-preview
```

Pullground uses [its own scenario](../../scripts/demo-video-scenarios/pullground.json):
a 16-second portrait loop of a basket, full-power backboard smash, dart throw,
bowling strike, and skipping stone, returning to Basketball. Capture-only framing centers the real game and keeps
the mode controls outside the crop. The catalog consumes its MP4 and WebP poster.

```bash
npm run record:demo -- --scenario scripts/demo-video-scenarios/pullground.json
```

## Pullground video for X

The separate [social scenario](../../scripts/demo-video-scenarios/pullground-social.json)
records the entire `/pullground` demo at a 450×800 mobile viewport and 2× pixel
density. The 22-second sequence starts with the real animated Pull guide, shows
a basket and backboard smash, then uses the visible controls to select Dart,
Bowling, and Stone skipping before returning to Basketball.

Pulls use 1.5–1.7 second real touch gestures with eased starts and stops and a
160 ms aim hold. The recorder dispatches input at the recording cadence without
waiting for each browser acknowledgement, then drains pending moves before
release. This keeps the pull responsive throughout the native capture.

Keep the actual header, GitHub control, game choices, theme row, and Export
button visible. Preserve the page's existing layout, proportions, colors, and
motion. The scenario has no `recordingCss` or crop; the recording has no added
titles, chapter labels, closing cards, or composited artwork.

```bash
npm run record:demo -- --scenario scripts/demo-video-scenarios/pullground-social.json
```

Use the standard native Chrome recording prerequisites. No separate social
exporter or font download is needed.

Outputs live under the ignored `artifacts/pullground/social/` directory:

- `pullground-x.mp4`: 22 seconds, H.264, 900×1600, 60 fps, square pixels,
  YUV 4:2:0, fast-start metadata, and no audio. This is the sharing copy.
- `pullground-x-cover.jpg`: a frame from the sharing copy at the same dimensions.

The sharing copy preserves native tab capture at 60 fps without interpolation or
retiming. It must pass the eight pull and gameplay motion checks and contact-sheet review. Verify
the real Pull cue, header displacement and return, game selection, and
net/backboard/pin/ripple effects, with the full control bar visible throughout.

This is a standalone sharing artifact, so its scenario deliberately omits
`application`. It does not replace the homepage's catalog video or publish a post.
X's [upload guide](https://help.x.com/en/using-x/x-videos) describes selecting
a local video file when composing a post.

## Definition of done

A demo is complete only when:

- The checked-in scenario describes the requested flow.
- The real product completes every action and final assertion.
- The MP4 has the requested duration, dimensions, fps, and square pixels.
- Continuous-motion windows pass their duplicate-frame gates.
- Overall and dense motion contact-sheet inspection shows every requested update and smoothly paced transition.
- For an applied preview, the intended consumer references the generated MP4 and
  poster. For an explicitly requested standalone export, deliver the local video
  and cover paths instead.
- Required lint, documentation, build, style, and smoke checks pass.

The recorder captures only the selected localhost Chrome tab. It does not record the desktop and does not synthesize WebGL frames.
