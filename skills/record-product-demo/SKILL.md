---
name: record-product-demo
description: Record, regenerate, and apply reproducible real-UI demo videos for products or designs in this repository using scenario-driven Chrome tab capture. Use when asked to create or change a product preview video or its recorded actions; do not use for synthetic animation or unrelated video editing.
---

# Record Product Demo

Turn the user's product and action description into a checked-in recording scenario, run it against the real application, and apply the generated assets to the requested preview.

## Choose the workflow

- For a product's first demo, read [references/new-product-workflow.md](references/new-product-workflow.md) and [references/scenario-schema.md](references/scenario-schema.md).
- For an existing scenario, read [references/scenario-schema.md](references/scenario-schema.md), update only the requested behavior, and re-record to the same applied paths unless the user requests otherwise.

## Workflow

1. Locate the product route, stable interaction selectors, and the component that consumes its preview. Preserve the requested content, order, framing, duration, and output location.
2. Create or update `scripts/demo-video-scenarios/<product-slug>.json`. For a first demo, initialize it with `npm run init:demo -- --product "<name>" --route <route> --consumer <file>`, then replace the starter action with the requested sequence. Keep product-specific behavior in the scenario rather than hard-coding it in the recorder.
3. Use real browser actions. Add deliberate waits when the viewer must see a debounced update, completed animation, or intermediate state. Keep the total action time below the recording duration; unused time becomes the final hold. For continuous animation, budget its full run plus readable holds and add a `quality.motionChecks` window.
4. Put generated media under `public/previews/` unless the existing product uses another public asset location. Set `application.consumerFiles` and public paths so the runner verifies that the assets are applied. Patch the consumer first when adding a new preview; overwriting an already-referenced output counts as applying an update.
5. Run:

   ```bash
   npm run record:demo -- --scenario scripts/demo-video-scenarios/<product-slug>.json
   ```

6. Verify the result, not just the command exit:

   - The recorder runs `verify:demo` and must pass exact duration, dimensions, square pixels, average frame rate, frame count, H.264 encoding, and configured continuous-motion checks.
   - Open every printed overall and motion contact sheet with `view_image`. Confirm typed values, intermediate product changes, evenly distributed motion, both ends of transitions, and the final state.
   - Run `npm run lint`; run the checks required by `AGENTS.md` for any application UI changes made while applying the preview.

## Smooth-motion contract

- Prefer genuine 60 fps for animation demos. Respect the source capture's reported frame-rate ceiling; never advertise smoother output by duplicating frames or interpolating WebGL motion.
- Give a major transition enough scenario time to read clearly. Use the product's intended duration; when none exists and smoothness is central, start around 2–3 seconds per direction and extend the overall video instead of rushing later actions.
- Mark each interval that should move continuously in `quality.motionChecks`. The default gate allows no consecutive exact duplicate frames. Loosen it only when the product intentionally holds within that interval, and document why in the scenario description.
- Judge pacing visually from the dense motion contact sheet. A valid frame count cannot detect a front-loaded or abrupt easing curve.
- If the real product animation is itself jumpy and the user asked to improve smoothness, fix its frame pacing or easing and run the relevant UI checks before recording again. Otherwise preserve product behavior and explain the limitation rather than masking it in post-production.

## Capture invariants

- Record the real Vite application through Chrome's native tab-compositor stream. Puppeteer may provide the keyboard, pointer, and timing, but the product must perform its own state updates and rendering.
- Do not replace native tab capture with DevTools screenshot sampling for WebGL motion; it can omit intermediate frames and produce a false-looking transition.
- Do not encode above the real capture rate or use motion interpolation to pass a smoothness request.
- Never capture the user's full desktop or an existing display. The local extension may capture only the selected localhost product tab.
- Use `recordingCss` only to frame the demo. Do not change the real product UI merely to make the recording easier unless the user also requested that UI change.
- Do not add arbitrary JavaScript-evaluation actions to scenarios. Add a narrowly named, real-input action to the runner when an interaction is genuinely unsupported.
- If native tab capture cannot run, report the concrete prerequisite instead of silently generating a simulated video.

## Interpreting requests

Infer routes, selectors, and existing asset consumers from the repository. Ask only when multiple products or materially different output placements remain plausible after inspection.

When the user says “create/init and apply a demo for `<product>`” without technical details, infer the implemented route, catalog consumer, selectors, and existing preview conventions. Default to 8 seconds, 60 fps, and portrait framing only when the repository and request provide no better convention. A demo request does not authorize implementing a missing product.

A suitable request can be as simple as:

> Use `$record-product-demo` for Design QR: type the URL in two parts, pause for the tree update, transform 3D to 2D and back, then apply it to the catalog card.

User-facing initialization and prompt examples are documented in [the demo-video workflow](../../docs/demo-videos/README.md).
