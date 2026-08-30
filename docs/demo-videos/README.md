# Product demo video workflow

**Status:** Active<br>
**Source of truth:** [`record-product-demo` skill](../../skills/record-product-demo/SKILL.md), [`record-demo-video.mjs`](../../scripts/record-demo-video.mjs), and checked-in files under [`scripts/demo-video-scenarios/`](../../scripts/demo-video-scenarios/).

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
3. Converts the requested flow into real click, tap, typing, key, hover, scroll, wait, and assertion actions.
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

## Definition of done

A demo is complete only when:

- The checked-in scenario describes the requested flow.
- The real product completes every action and final assertion.
- The MP4 has the requested duration, dimensions, fps, and square pixels.
- Continuous-motion windows pass their duplicate-frame gates.
- Overall and dense motion contact-sheet inspection shows every requested update and smoothly paced transition.
- The intended consumer references the generated MP4 and poster.
- Required lint, documentation, build, style, and smoke checks pass.

The recorder captures only the selected localhost Chrome tab. It does not record the desktop and does not synthesize WebGL frames.
