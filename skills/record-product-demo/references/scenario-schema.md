# Demo video scenario schema

Scenarios are JSON files consumed by `scripts/record-demo-video.mjs`. Use `scripts/demo-video-scenarios/design-qr.json` as the maintained example.

## Top-level fields

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | yes | Schema version; currently `1`. |
| `id` | yes | Lowercase letters, digits, and hyphens. Used for temporary filenames. |
| `product` | yes | Human-readable product/design name used in output and errors. |
| `description` | no | Short intent summary for reviewers. |
| `route` | no | Local Vite route; defaults to `/`. |
| `windowTitle` | no | Unique substring used to activate the recording tab; defaults to `product`. |
| `readySelector` | no | Element proving the product has mounted; defaults to `body`. |
| `settleMs` | no | Pre-capture render/font settling delay; defaults to `1000`. |
| `viewport` | no | Puppeteer viewport: `width`, `height`, `deviceScaleFactor`, `isMobile`, `hasTouch`. |
| `userAgent` | no | Override only when the product needs a specific responsive user agent. |
| `recordingCss` | no | Capture-only CSS for framing or hiding unrelated controls. |
| `recording` | yes | Output and encoding configuration described below. |
| `quality` | no | Overall contact-sheet sampling and continuous-motion checks. |
| `actions` | yes | Ordered real-browser interaction sequence. |
| `assertions` | no | Final DOM checks run after the remaining final hold. |
| `application` | no | Consumer files and public paths used to verify asset application. |

All filesystem paths must remain inside the repository.

## Recording fields

```json
{
  "recording": {
    "fps": 60,
    "durationSeconds": 8,
    "output": "public/previews/product-demo.mp4",
    "poster": "public/previews/product-demo.webp",
    "posterAtSeconds": 0.4,
    "posterQuality": 82,
    "size": { "width": 720, "height": 1280 },
    "crop": { "width": "iw", "height": 732, "x": 0, "y": 94 },
    "crf": 22
  }
}
```

- `fps`, `durationSeconds`, and output dimensions must be positive.
- The native capture rate must be at least `fps`; the recorder fails instead of upsampling a lower-rate source.
- `crop` accepts non-negative integers plus `iw`/`ih` for source width or height. Omit it to use the complete tab.
- Keep the crop aspect ratio aligned with the output aspect ratio and verify `sample_aspect_ratio=1:1`.
- `poster` is optional. WebP posters use `posterQuality`; the default is `82`.
- `crf` controls H.264 quality. The initializer uses `22`; lower values increase quality and file size.

The recorder automatically rejects a result whose codec, duration, output size, square-pixel aspect ratio, average fps, or frame count does not exactly match the scenario contract.

## Quality and smooth motion

Use motion checks only for intervals that should change continuously, not intentional holds:

```json
{
  "quality": {
    "contactSheetFps": 2,
    "motionChecks": [
      {
        "label": "open to closed",
        "startSeconds": 3.2,
        "durationSeconds": 2.4,
        "maxConsecutiveDuplicateFrames": 0,
        "contactSheetFps": 5
      }
    ]
  }
}
```

- `contactSheetFps` at the quality level controls the overall review sheet and defaults to `2`.
- `startSeconds` and `durationSeconds` locate a motion interval relative to capture start and must stay inside the video.
- `maxConsecutiveDuplicateFrames` defaults to `0`. Increase it only for an intentional pause inside an otherwise continuous interval.
- A motion check's `contactSheetFps` defaults to `5` and creates a dense sheet under `/tmp` for visual pacing review.
- Exact-frame checks catch capture stalls; they do not prove good easing. The agent must inspect all contact sheets printed by `record:demo` or `verify:demo`.

## Supported actions

| Action | Fields | Behavior |
| --- | --- | --- |
| `wait` | `ms` | Hold the current real UI state. |
| `waitFor` | `selector`, optional `state`, `timeoutMs` | Wait for `visible` (default), `hidden`, or `attached`. |
| `click` | `selector`, optional `clickCount`, `delayMs` | Dispatch a real pointer click. |
| `tap` | `selector` | Tap the center of an element using the mobile touchscreen. |
| `focus` | `selector` | Focus an element. |
| `selectAll` | optional `selector` | Optionally click an input, then send Control+A. |
| `type` | `text`, optional `delayMs` | Send literal keyboard input. Split into multiple actions with waits to expose intermediate updates. |
| `press` | `key`, optional `delayMs` | Press one Puppeteer key such as `Tab`, `Enter`, or `Escape`. |
| `hover` | `selector` | Move the real pointer over an element. |
| `scroll` | optional `deltaX`, `deltaY` | Send a mouse-wheel scroll. |
| `assert` | assertion fields | Check state immediately at that point in the sequence. |

Use stable product classes or accessible controls. Avoid selectors tied to generated DOM order.

## Assertions

Each assertion requires `selector` and at least one expected property:

```json
{
  "selector": ".url-input",
  "value": "https://design.johnson7543.com"
}
```

Supported expectations are exact `value`, trimmed `text`, `hasClass`, and `attribute` as `{ "name": "aria-pressed", "value": "true" }`.

Place assertions in the top-level `assertions` array when they should run after the final hold. Use an `assert` action only when the state must be checked before later actions continue.

## Applying the assets

```json
{
  "application": {
    "consumerFiles": ["src/platform/DesignHomePage.tsx"],
    "videoPublicPath": "/previews/product-demo.mp4",
    "posterPublicPath": "/previews/product-demo.webp"
  }
}
```

The recorder reads all listed consumer files and fails if either configured public path is absent. This is a verification guard, not a source-code rewriter: when adding a new product, patch its consumer deliberately before recording.

## Timing

Capture starts immediately before the first action. The runner measures real elapsed time. If actions finish early, it holds the final state until `durationSeconds`; if they run long, it fails instead of silently trimming a requested action.

For debounced updates, wait longer than the debounce plus enough time for the visual result to be understood. For bidirectional animations, budget the complete first transition, a readable hold, the return transition, and a settled final frame. Prefer extending the video over compressing a transition merely to preserve an arbitrary duration.
