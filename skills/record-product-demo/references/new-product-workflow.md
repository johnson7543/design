# First demo for a new product

Read this reference when a product/design has no checked-in demo scenario or applied preview yet.

## Initialize

1. Confirm the product is already implemented and find its route. If it does not exist, report that prerequisite unless the user also asked to build the product.
2. Find the catalog or page component that should consume the preview. Reuse its existing video conventions instead of inventing a separate playback pattern.
3. Initialize a non-overwriting scenario:

   ```bash
   npm run init:demo -- \
     --product "<Product Name>" \
     --route /product-route \
     --consumer src/path/to/PreviewConsumer.tsx
   ```

   Optional arguments are `--id`, `--ready-selector`, `--orientation portrait|landscape`, `--duration`, and `--fps`.

4. Inspect the running product and replace the generated starter `wait` with the requested actions. Add stable final assertions. Adjust viewport, crop, and capture-only CSS to show the requested product area.
5. For every transition or animation expected to move continuously, allocate its complete duration plus a hold and add a `quality.motionChecks` entry. Keep the initialized 60 fps unless the real capture source reports another ceiling; never upsample to simulate smoothness.

## Apply

Wire the scenario's `videoPublicPath` and `posterPublicPath` into the consumer listed by `application.consumerFiles`. Follow existing behavior for looping, muted playback, `playsInline`, reduced motion, and visibility-based pause/play.

“Applied” means all of the following are true:

- The MP4 and optional poster exist at the scenario output paths.
- The intended product/catalog consumer references their public paths.
- The scenario's application guard passes.
- Visual inspection confirms the requested actions, not merely that a video element loads.

## Record and verify

Run the scenario with `npm run record:demo -- --scenario scripts/demo-video-scenarios/<id>.json`. The command automatically runs the encoding and motion verifier. Open every printed contact sheet and follow the visual and repository checks in `SKILL.md`.

Initialization refuses to overwrite an existing scenario. For later changes, edit that scenario directly and record again to replace the already-applied assets.

## Prompt interpretation

A short request containing the product name and what the video should demonstrate is sufficient when the product already exists. Infer technical selectors and file paths from the repository. Honor explicit duration, fps, orientation, text, action order, and final state; otherwise use the initialized defaults and local preview conventions.
