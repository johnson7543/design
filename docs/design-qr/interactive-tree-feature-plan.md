# Interactive tree feature implementation plan

Status: In progress<br>
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

## Product and compatibility decisions

- Rotation direction applies to automatic rotation. Dragging remains directly
  controlled by the pointer, and the 3D-to-2D turn direction is unchanged.
- Existing configurations remain valid. Omitted new properties use the current
  appearance and behavior.
- The default automatic rotation direction is `clockwise`.
- `pixel` joins `blossom` and `leaf` as a foliage style. It reuses the QR-derived
  voxel geometry that already participates in the morph; it must not introduce
  a second QR layer.
- A logo is rendered inside the WebGL scene, not as an HTML overlay. The same
  object sits within the 3D canopy, follows the turn, and settles at the center
  of the 2D QR.
- QR generation uses high error correction while a logo is present, and logo
  size is capped to preserve a useful quiet area and scanning reliability.
- The canonical configuration remains schema version 1 while these additions
  are optional and backward compatible. Normalization supplies all defaults.
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
        src: '/brand-logo.png',
        alt: 'Brand logo',
        size: 0.16,
      }}
      interaction={{
        autoRotate: true,
        autoRotateDirection: 'counterclockwise',
      }}
      quality="high"
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
- Preserve the current visual output of Spring, Summer, Autumn, and Winter.
- Keep normalization accepting the current partial `TreeTheme` object and fill
  newly introduced roles from the Spring base preset for backward compatibility.

### Review gate

- Snapshot normalized preset objects and verify no preset mutates at runtime.
- Verify every custom-theme editor control maps to a public property.
- Verify old schema-v1 and legacy links normalize without a visual-role error.
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
- In Pixel mode, display the existing QR-derived instanced voxel stack at 3D
  progress zero and suppress the organic leaf/blossom and branch canopy meshes.
- Use the same voxel instances throughout the smoothstep 3D-to-2D transition so
  no second QR appears, overlaps, flashes, or changes position.
- Apply the resolved theme's foliage and QR colors without identifying presets by
  hard-coded color comparisons.
- Retain instancing and current quality scaling to avoid a per-module draw-call
  regression.

### Review gate

- Inspect 3D, mid-turn, and 2D states for all presets and a custom theme.
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
- Render one camera-facing plane with a theme-derived backplate. At the 3D state
  it is visually seated within the front canopy surface; through the morph it
  follows the same eased progress and settles over the QR center.
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

## Phase 5 — Editor and integration completion

### Work

- Add logo controls to the existing Edit panel, the direction button beside Auto
  Spin, and Pixel as the third foliage-style option.
- Keep the stage transform and control rails fixed while panels expand.
- Serialize every new option into direct links, hosted-player URLs, iframe
  markup, and React snippets.
- Update the `Simple` example only when a new setting differs from defaults; make
  the `Advance` example demonstrate the complete current customization surface.
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

## Completion criteria

This plan is complete only when:

- All four requested features use one normalized public configuration.
- The 3D and 2D artwork transforms in place with no duplicate QR, layout jump,
  or logo discontinuity.
- Every current editor-created theme can be represented by package parameters,
  and all presets can be reproduced from exported preset data.
- Visible editor/player pixels and downloaded pixels agree.
- Existing links and default component usage remain compatible.
- Documentation, declarations, examples, browser checks, and release checks all
  describe and verify the implemented contract.
