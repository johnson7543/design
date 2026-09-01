# Interactive tree feature implementation plan

Status: Complete<br>
Created: 2026-08-31<br>
Scope: Public `designqr` API, Design QR editor, 3D/2D renderer, sharing, and export

[Back to the Design QR documentation index](README.md)

## Purpose

Extend the interactive tree without splitting the editor, public React package,
hosted player, or downloaded image into different rendering paths. This plan
covers four related capabilities:

1. Clockwise and counterclockwise automatic tree rotation.
2. An optional logo that remains one continuous visual object while the tree
   transforms into the QR code.
3. A QR-derived Pixel foliage style implemented in the existing Three.js
   renderer.
4. A complete public theme contract that can reproduce every built-in preset or
   define the same visual roles exposed by the editor.

Implementation proceeds in the phases below. Each phase has a review gate and
must pass its focused tests before the next phase starts.

## Implementation progress

- [x] Plan registered and documentation harness verified.
- [x] Phase 1 — complete public theme architecture and resolved renderer roles.
- [x] Phase 2 — time-based clockwise/counterclockwise automatic rotation.
- [x] Phase 3 — clean-room Pixel foliage.
- [x] Phase 4 — animated logo.
- [x] Phase 5 — editor and integration completion.
- [x] Phase 6 — release verification.
- [x] Follow-up — restore pre-refactor seasonal distributions inside the new
  theme architecture.
- [x] Follow-up — keep Pixel on the same canopy silhouette and branch structure
  as Blossom and Leaf.

## Product and API decisions

- Rotation direction applies to automatic rotation. Dragging remains directly
  controlled by the pointer, and the 3D-to-2D turn direction is unchanged.
- Omitted current optional properties use the documented default appearance and
  behavior.
- The default automatic rotation direction is `clockwise`.
- `pixel` joins `blossom` and `leaf` as a foliage geometry. All three styles use
  the same procedural canopy points, tree shape, trunk, and branches; selecting
  a foliage style must not change the tree silhouette. The existing QR-derived
  voxel set remains the shared transition layer for every foliage style.
- A logo is rendered inside the WebGL scene, not as an HTML overlay. The same
  object sits within the 3D canopy, follows the turn, and settles at the center
  of the 2D QR.
- QR generation uses high error correction while a logo is present, and logo
  size is capped to preserve a useful quiet area and scanning reliability.
- The canonical configuration uses schema version 1. These additions are current
  optional inputs, and normalization supplies their defaults.
- Preset theme strings remain supported. Complete preset objects and a merge
  helper are exported so consumers can start with a preset and customize only
  selected roles.
- Runtime custom colors remain user input. Repository-authored defaults must use
  only colors in the global approved-color registry.

## Clean-room Pixel implementation boundary

The requested visual reference is Enzo Mangano's
[`cherry-blossom-qrcode`](https://github.com/enzomanuelmangano/demos/tree/main/src/animations/cherry-blossom-qrcode).
Its repository uses a custom license that restricts extraction, redistribution,
and use in a competing component or animation library. Because `designqr` is an
MIT-distributed package, this implementation will reproduce only the observable
QR-driven pixel-tree idea using the repository's existing Three.js renderer,
geometry, animation system, and authored assets. No source, shader, asset, or
framework port from the reference repository may be copied. An exact code port
would require separate written permission from its author.

## Target public API

```tsx
import {
  DesignQR,
  createTreeTheme,
} from 'designqr';
import 'designqr/style.css';

export function BrandedCode() {
  return (
    <DesignQR
      value="https://example.com"
      design="tree"
      theme={createTreeTheme('spring', {
        foliageShape: 'pixel',
      })}
      logo={{
        src: '/logo.png',
        alt: 'Logo',
        size: 0.16,
      }}
      interaction={{
        autoRotate: true,
        autoRotateDirection: 'counterclockwise',
      }}
    />
  );
}
```

The additions use these public shapes:

```ts
export type AutoRotateDirection = 'clockwise' | 'counterclockwise';
export type FoliageShape = 'blossom' | 'leaf' | 'pixel';

export interface DesignQRLogoOptions {
  src: string;
  alt?: string;
  size?: number;
}
```

`interaction.autoRotateDirection` uses `AutoRotateDirection`, and
`DesignQRProps.logo` / `DesignQRConfigV1.logo` use `DesignQRLogoOptions`.
Normalization clamps `size` to the package's documented safe range.

## Phase 1 — Complete theme architecture

### Work

- Define a complete normalized tree-theme model for every renderer-owned visual
  role: foliage, bark, ground, pedestal, sky, atmosphere, particles, title, and
  QR modules.
- Export immutable `TREE_THEME_PRESETS` and `createTreeTheme(preset, overrides)`
  from the package root.
- Keep the compact editor persistence fields (`id`, `label`, `isCustom`) outside
  the public visual theme model.
- Replace renderer decisions inferred from a season index or a particular hex
  value with explicit resolved theme roles.
- Keep deterministic fallen-ground placement in the resolved theme so preset,
  Add Theme, and public-component rendering do not depend on setter history.
- Preserve the current visual output of Spring, Summer, Autumn, and Winter.
- Keep partial `TreeTheme` objects as a current public input and derive omitted
  roles from their source colors and documented renderer defaults.

### Review gate

- Snapshot normalized preset objects and verify no preset mutates at runtime.
- Verify every custom-theme editor control maps to a public property.
- Verify current schema-v1 links and partial custom themes normalize without a
  visual-role error; unsupported payload shapes must fail validation.
- Run package config/theme tests, TypeScript, lint, color, and documentation
  checks before Phase 2.

## Phase 2 — Automatic rotation direction

### Work

- Add `autoRotateDirection` to public types, defaults, normalization, snippets,
  canonical links, iframe messages, and examples.
- Make renderer rotation time based so speed is stable across refresh rates.
- Add an icon-only direction control beside Auto Spin. Its fixed footprint must
  not move the shared bottom rail when direction changes.
- Reversing direction takes effect continuously without resetting yaw. Reset
  Rotation returns to the initial angle but preserves the selected direction.
- Disable automatic motion under `prefers-reduced-motion` as before.

### Review gate

- Unit-test both normalized directions and invalid input.
- Browser-test direction reversal, reset behavior, and unchanged stage geometry.
- Review default, hover, active, focus-visible, selected, and disabled states.
- Run focused package and editor checks before Phase 3.

## Phase 3 — Pixel foliage

### Work

- Add `pixel` to the public foliage-style union and editor option set.
- Build Pixel foliage from aligned cube instances at the exact same filtered
  canopy points used by Blossom and Leaf, and retain the same branch skeleton.
- Keep foliage geometry independent from `treeShape`: changing Blossom, Leaf,
  or Pixel must preserve crown bounds, trunk placement, and branch structure.
- Use the shared QR-derived voxel set for the responsive 3D-to-2D transition in
  every foliage style so the settled QR position and module geometry stay
  unchanged.
- Apply the resolved theme's foliage and QR colors without identifying presets by
  hard-coded color comparisons.
- Retain instancing and the fixed renderer pixel-ratio cap to avoid a per-module
  draw-call regression.

### Review gate

- Inspect 3D, mid-turn, and 2D states for all presets and a custom theme.
- Compare Blossom, Leaf, and Pixel at the same `treeShape` and verify their
  canopy bounds, crown placement, trunk, and branches remain aligned.
- Verify the 2D QR position and size match organic foliage modes exactly.
- Verify repeated turns do not duplicate meshes or leak WebGL resources.
- Run renderer tests and production smoke checks before Phase 4.

## Phase 4 — Animated logo

### Work

- Add optional logo configuration, validation, loading, disposal, typed errors,
  canonical serialization, and editor state.
- Accept PNG, JPEG, and WebP raster sources. Hosted sources must be HTTPS and
  CORS-readable; the editor may produce a bounded raster data URL after
  downscaling and compression.
- Render one camera-facing, frame-free image plane. At the 3D state it is
  visually seated within the front canopy surface; through the morph it follows
  the same eased progress and settles over the QR center. Transparent image
  pixels reveal the stage beneath instead of a renderer-authored backplate.
- Keep the logo in the live presentation canvas so blur, screenshots, downloads,
  React instances, and iframe instances show identical pixels.
- Switch QR generation from medium to high error correction when a logo is
  configured and enforce a conservative normalized logo-size range.
- A failed logo load reports `LOGO_LOAD_FAILED` and leaves a usable tree/QR
  without a broken-image placeholder.

### Review gate

- Test successful load, replacement, removal, failure, CORS rejection, resource
  disposal, and rapid config changes.
- Verify logo position at 3D, intermediate progress, 2D, and the reverse turn.
- Decode exported QR images at minimum, default, and maximum logo sizes.
- Verify the visible presentation canvas and exported PNG remain pixel-identical.
- Run focused tests before Phase 5.

Review result (2026-08-31): passed. Package tests and declarations cover the
normalized contract and canonical round trip. The React consumer smoke verifies
3D, mid-turn, 2D-center, reverse-turn, replacement, removal, rapid changes,
typed CORS failure, exact export pixels, and successful decoding at `0.08`,
`0.16`, and `0.20`. The hosted iframe smoke verifies the CSP/data-URL path and
canonical WYSIWYG export. Full desktop, 390 px, and 320 px production smoke also
passed before Phase 5 began.

## Phase 5 — Editor and integration completion

### Work

- Add logo controls to the existing Edit panel, the direction button beside Auto
  Spin, and Pixel as the third foliage-style option.
- Keep the stage transform and control rails fixed while panels expand.
- Serialize every new option into direct links, hosted-player URLs, iframe
  markup, and React snippets.
- Update the `Simple` example only when a new setting differs from defaults;
  keep `Advanced` as the complete current component customization surface and add
  a second advanced `Custom Theme` example that lists every resolved theme
  parameter through the public `createTreeTheme()` helper while carrying the
  current details and interaction settings.
- Prevent generation of a canonical link that exceeds the codec's decoding
  limit. Show a clear editor error rather than silently omitting or truncating a
  logo.
- Add public API comments and README reference tables for themes, logo source
  requirements, direction, Pixel style, error handling, and safe export usage.

### Review gate

- Compare editor, public React consumer, hosted iframe, and downloaded PNG for
  the same canonical config.
- Check 1440×900, 390×844, and 320×568 in both views, with Edit collapsed and
  expanded.
- Verify keyboard controls, accessible names, focus-visible states, reduced
  motion, and no horizontal overflow.

Review result (2026-08-31): passed. The editor production smoke verifies the
three-row Edit panel at 1440×900, 390×844, and 320×568; fixed stage geometry;
bounded WebP preparation for originals up to 100 MiB, with output below 1 MiB
and within the canonical source limit; minimum/default/maximum size behavior;
canonical direct/share/embed equivalence; editable-link restoration; accessible
native/control semantics; and an exact visible/downloaded PNG match. The React
consumer and hosted iframe smokes verify the same canonical logo, direction,
theme, view, and export paths. Lint, package tests/types, style, color,
documentation, builds, and `git diff --check` also passed before Phase 6 began.

## Phase 6 — Release verification

Run the repository's complete release-proportional gate:

```bash
npm run style:check
npm run lint
npm run design-docs:check
npm run docs:check
npm run color:check
npm run build
npm run check
npm run smoke:production
```

Also run package consumer and iframe smoke suites, QR decoding coverage, and the
packed-package audit when those are not already included by `npm run check`.
Review both the code diff and actual rendered states before declaring the feature
complete.

Review result (2026-08-31): passed. `npm run check` completed the full ordered
repository gate, including all 24 package tests, declarations, documentation,
color/style contracts, production builds, React and iframe consumer smokes,
logo QR decoding, responsive editor geometry, editable-link restoration, and
WYSIWYG export. The release contract passed for the expected
`designqr-v0.1.0` tag, and the dry-run package audit passed with 76 files,
237.5 kB packed, and 994.7 kB unpacked. Final documentation and diff checks were
run after recording completion.

### Follow-up palette contract correction

Follow-up visual review found that Phase 1 had preserved the main named color
roles but not every procedural distribution. A shared four-band canopy sampler,
new season-specific bark/paver choices, and a single dark settled-QR role had
changed how the four presets actually appeared.

The correction keeps the resolved-theme architecture and removes no public
feature. Instead, the resolved model now carries explicit canopy, QR foliage,
finder, ground-decoration, paver-variation, branch, pedestal, and presentation
distribution data. Spring, Summer, Autumn, and Winter populate those fields
with their pre-refactor values, and the renderer consumes only resolved theme
data—there are still no season-index or magic-color branches. Ordinary settled
QRs use the restored multi-tone distributions with or without a logo. Logo mode
retains high error correction and the bounded image size without adding a
logo-only color adjustment. The shared settled-QR grade supplies the scan
contrast in both states, so enabling or removing a logo leaves sampled module
colors unchanged.

Regression tests lock the preset tuples, nested preset immutability, merged-role
palette regeneration, custom palette normalization, and malformed stop
rejection. The owning color documentation records the exact renderer tuples and
thresholds so later architecture work cannot silently recolor the presets.

A subsequent side-by-side review exposed one additional color-space issue:
pre-refactor paver, pedestal, and bark numbers were linear RGB coefficients, but
the first data migration stored those numbers directly as sRGB hex values.
Three.js then decoded them a second time, making the new render too dark. Presets
now store the equivalent display-sRGB values for fields consumed as colors,
while procedural ground-decoration tuples retain the established linear sampler
path. This keeps public theme resolution and renderer ownership unchanged while
restoring the displayed output rather than merely matching source numbers.

Follow-up verification (2026-08-31): passed. The rebuilt Spring render was
compared directly with the supplied pre-refactor reference, and all four presets
were reviewed at 390×844 in both 3D and settled 2D. `npm run check` then passed
the complete lint, package-test, declaration, documentation, color/style,
production-build, consumer, iframe, responsive-layout, and WYSIWYG-export gate.

The settled 2D face also retains its shared depth treatment after palette
resolution: dark foliage and finder modules receive one hue-preserving
saturation/lightness grade in both logo states. Enabling or removing the logo
does not add another grade or change any sampled module color. The shared grade
blends in through the existing transition and leaves 3D colors and
consumer-authored theme source values untouched. Light modules use a separate
shared sRGB lift derived from each theme's `groundColor`. The logo renders
directly without a frame or backplate. This keeps preset and custom hues
distinct while restoring the brighter reference negative space instead of
fixing one light color.

Depth-filter verification (2026-08-31): passed. All four presets were reviewed
at 390×844 in both modes, and the complete gate passed on isolated local ports,
including QR decoding with and without a logo, hosted-player headers,
responsive geometry, and exact visible/downloaded PNG agreement.

Light-filter verification (2026-08-31): passed. All four preset 2D faces were
reviewed at 390×844 beside the unchanged Spring 3D frame. Their negative space
retained distinct Spring, Summer, Autumn, and Winter hues, while Spring matched
the supplied pre-refactor light-module reference and dark modules retained the
shared depth grade.

### Follow-up foliage-silhouette correction

Visual comparison found that the first Pixel implementation changed more than
leaf geometry: it replaced the procedural crown and branches with the stacked
QR-derived dome. Pixel now instantiates aligned cubes at the same filtered
canopy points used by Blossom and Leaf and keeps the same trunk and branch
skeleton. The shared QR voxel set appears on the same transition schedule for
all foliage styles, so switching style no longer changes `treeShape`, crown
bounds, or the settled QR.

Follow-up verification (2026-08-31): passed. Blossom and Pixel were compared in
the real editor at 1440×900 with the same URL, seed, density, and Dome shape;
Pixel was also exercised through 3D→2D→3D. `npm run check` passed all 24 package
tests, declarations, documentation/style/color contracts, builds, React and
iframe consumers, desktop/mobile production layouts, and WYSIWYG export.

## Completion criteria

This plan is complete only when:

- All four requested features use one normalized public configuration.
- Blossom, Leaf, and Pixel change foliage geometry without changing the selected
  tree silhouette, canopy placement, trunk, or branch structure.
- The 3D and 2D artwork transforms in place with no duplicate QR, layout jump,
  or logo discontinuity.
- Every current editor-created theme can be represented by package parameters,
  and all presets can be reproduced from exported preset data.
- Visible editor/player pixels and downloaded pixels agree.
- Current schema-v1 links and default component usage follow the documented API.
- Documentation, declarations, examples, browser checks, and release checks all
  describe and verify the implemented contract.
