# Maintenance and enhancement guide

Status: Active maintenance reference<br>
Scope: Extending package behavior, avoiding known regressions, and validating changes

[Back to package documentation](README.md)

Read [architecture](architecture.md) for ownership, the
[rendering contract](style-principles.md) for behavior, and
[color mappings](color-palettes.md) for visual roles before implementation.

## Changing configuration or public APIs

Update canonical types, defaults, normalization, codec behavior, React props,
and ref/event surfaces together where applicable. Review the editor snapshot,
share snippets, hosted URLs, iframe protocol, public README, and consumer
fixtures for each new field. A React-only prop does not automatically belong in
serialized configuration or the iframe protocol; transient viewing zoom is one
existing example.

Preserve meaningful defaults and typed failures. Check malformed and oversized
input, Unicode round trips, unsupported designs, and older supported schema-v1
payloads. Test copied snippets against the published export map, not workspace
aliases that consumers cannot import.

## Extending Tree themes and foliage

[`themes.ts`](../../packages/designqr/src/designs/tree/themes.ts) owns immutable
presets, complete resolved visual roles, and partial-theme composition. Keep
renderer decisions in explicit theme data rather than season indexes or tests
for particular colors. Saved editor metadata remains outside public themes.

Preserve these regression boundaries:

- Theme extraction must retain procedural distributions, not only named base
  colors: canopy, QR foliage, finders, ground decorations, pavers, branches,
  pedestal, and presentation all contribute to the result.
- Distinguish display-sRGB color fields from linear procedural coefficients.
  Copying linear numbers into sRGB hex fields causes a second color decode and
  changes the appearance. The [color contract](color-palettes.md) owns exact
  tuples and renderer assignments.
- Blossom, Leaf, and Pixel use the same filtered canopy points, tree shape,
  trunk, and branches. Switching foliage changes leaf geometry, not crown
  bounds or the selected silhouette. QR voxels remain the shared transition
  layer.
- Keep Pixel geometry and animation original to this repository. The external
  [pixel-tree visual reference](https://github.com/enzomanuelmangano/demos/tree/main/src/animations/cherry-blossom-qrcode)
  is not a source-code, shader, or asset dependency to copy into the package.
- Logos use the shared WebGL artwork and transition. Preserve high QR error
  correction and bounded logo size without adding logo-specific recoloring.
  Sampled settled-QR colors must remain stable when the logo is toggled.
- Automatic rotation direction changes the turntable, not pointer drag or the
  design-to-QR transition direction.

## Adding or extending a City design

Use the [City index](cities/README.md) to locate source evidence, layout,
regeneration instructions, and open accuracy gaps. Keep geographic inputs,
authored interpretations, and unknown measurements explicit. Share package
configuration, camera, presentation, export, and QR reliability contracts rather
than creating a preset-specific player.

Source and generator changes can invalidate hash-linked data, Blender inputs,
GLBs, manifests, and package exports. Rebuild the affected chain and run its
asset checks. For documentation-only metadata updates, demonstrate that
geometry and buffer contents remain unchanged.

## Verification by change

| Change | Relevant checks |
| --- | --- |
| Configuration, themes, or geometry | `npm run test:designqr`, `npm run typecheck:designqr` |
| Package output and public imports | `npm run build`, `npm run build:designqr-consumer`, `npm run audit:designqr-package` |
| React lifecycle, styling, or export | `npm run smoke:designqr-consumer`, `npm run check:designqr-styles` |
| Hosted URLs, protocol, or framing | `npm run build:designqr-iframe-consumer`, `npm run smoke:designqr-embed` |
| Editor-generated React snippets | `npm run check:designqr-react-snippets` |
| Viewing zoom or canonical export | `npm run test:editor`, `npm run smoke:editor-zoom`, `npm run smoke:designqr-zoom` |
| City assets and delivery | `npm run smoke:designqr-city-assets`, `npm run check:designqr-city-package`, and the relevant City document's regeneration checks |
| Documentation or color assignments | `npm run docs:check`, `npm run design-docs:check`, `npm run color:check` |

For lifecycle changes, exercise multiple instances, controlled and uncontrolled
views, repeated mount/unmount, pause/resume, hidden/offscreen updates, and late
asynchronous completion. For QR/export changes, independently decode final PNGs
with and without logos, compare visible and exported pixels at matching framing,
and check transparency and metadata in both views.

Review responsive behavior at 1440×900, 390×844, and 320×568 when affected,
including keyboard interaction and reduced motion. Release validation and
publication steps belong to the [release workflow](releases/releasing.md).

## Enhancement considerations

These are options to reassess when needed, not implemented APIs or committed
release scope.

| Candidate | Reason to revisit | Boundary to preserve |
| --- | --- | --- |
| Editor migration to the public wrapper | Reduce reliance on the internal workspace canvas alias | Preserve editor-only framing and 1000% inspection zoom, gestures, and export; do not expose internals solely to remove an alias |
| Framework-neutral Web Component | Demand for direct non-React integration beyond iframe embedding | Reuse the core; isolate styles, map scalar attributes and a config property, dispatch lifecycle events, and dispose on disconnect; decide CDN and React bundling from measured size |
| Stored short links | Persistent URL-length problems or requirements for stable, editable, revocable designs | Define ownership, authentication, expiration, abuse limits, deletion, privacy, and schema migration before adding storage |
| Three.js dependency strategy | Measured consumer bundle or duplication problems | Compare direct versus peer dependency using packed consumers and SSR/import checks; do not infer compatibility from workspace builds |

Open Dōtonbori reconstruction requirements remain in its
[build plan](cities/dotonbori/build-plan.md) and
[source ledger](cities/dotonbori/sources.md), alongside the evidence needed to
resolve them.
