# DesignQR

[![npm](https://img.shields.io/npm/v/designqr?logo=npm)](https://www.npmjs.com/package/designqr)
[![npm downloads](https://img.shields.io/npm/dm/designqr?logo=npm)](https://www.npmjs.com/package/designqr)

React component that turns interactive 3D Tree or Shibuya City artwork into a
scannable 2D QR code.

[Quick start](#quick-start) · [Props](#props) · [Themes](#themes) ·
[Logo](#logo) · [Advanced usage](#advanced-usage)

## Install

```bash
npm install designqr
```

Requires React and React DOM 18.2+ and a browser with WebGL. TypeScript types are
included. Core styles load automatically.

## Quick start

```tsx
import { DesignQR } from 'designqr';

export function Example() {
  return (
    <DesignQR
      value="https://github.com/johnson7543/design"
      style={{ width: '100%', maxWidth: 480 }}
    />
  );
}
```

The player defaults to a square Tree with the Spring theme. Drag to rotate it,
or tap to switch between the artwork and QR views. Set its dimensions through
`style` or `className`. Add `defaultView="qr"` to start in QR view.

In server-rendered React projects, render the interactive component in a client
component. Package imports also support ESM and CommonJS.

## Choose a design

Use `design="tree"` (the default) or `design="city"`:

```tsx
import { DesignQR } from 'designqr';

export function CityExample() {
  return <DesignQR value="https://github.com/johnson7543/design" design="city" />;
}
```

Change `value` to update the QR code and artwork.

## Themes

Tree presets are `spring`, `summer`, `autumn`, and `winter`. City defaults to
`shibuya`. Set `theme="summer"`, for example, to select the Summer Tree preset.

## Props

| Prop | Type | Default |
| --- | --- | --- |
| `value` | `string` | Required |
| `design` | `'tree' \| 'city'` | `'tree'` |
| `tree` | `TreeDesignOptions` | `{ shape: 'dome' }` |
| `theme` | `DesignQRThemePreset \| TreeTheme` | `'spring'` for Tree; `'shibuya'` for City |
| `view` | `'design' \| 'qr'` | Uncontrolled |
| `defaultView` | `'design' \| 'qr'` | `'design'` |
| `details` | `DesignQRDetailsOptions` | `{ title: '', titleScale: 1, showValue: false, contentScale: 1, border: false }` |
| `interaction` | `DesignQRInteractionOptions` | See below |
| `zoom` | `boolean \| DesignQRZoomOptions` | `false` |
| `logo` | `false \| DesignQRLogoOptions` | `false` |
| `transparentBackground` | `boolean` | `false` |
| `className` | `string` | — |
| `style` | `React.CSSProperties` | — |
| `ariaLabel` | `string` | Generated |
| `onReady` | `() => void` | — |
| `onViewChange` | `(view) => void` | — |
| `onZoomChange` | `(scale: number) => void` | — |
| `onError` | `(error: DesignQRError) => void` | — |

### Nested options

| Option | Type | Default / range |
| --- | --- | --- |
| `tree.shape` | `'dome' \| 'wide' \| 'pine'` | `'dome'` |
| `details.title` | `string` | `''`; max 40 characters |
| `details.titleScale` | `number` | `1`; responsive font-size multiplier clamped to `0.75–1.5` |
| `details.showValue` | `boolean` | `false` |
| `details.contentScale` | `number` | `1`; responsive font-size multiplier clamped to `0.75–1.5` |
| `details.border` | `false \| { padding?: number }` | `false`; padding defaults to `16` px, clamped to `4–32` |
| `interaction.dragToRotate` | `boolean` | `true` |
| `interaction.tapToToggleView` | `boolean` | `true` |
| `interaction.autoRotate` | `boolean` | `false` |
| `interaction.autoRotateDirection` | `'clockwise' \| 'counterclockwise'` | `'clockwise'` |
| `interaction.transitionSpeed` | `number` | `1`; clamped to `0.25–2` |
| `interaction.motionBlur` | `boolean` | `true` |
| `zoom.pinch` | `boolean` | `true` when zoom is enabled |
| `zoom.wheel` | `boolean` | `false` |

## Details, borders, and transparency

```tsx
<DesignQR
  value="https://github.com/johnson7543/design"
  defaultView="qr"
  details={{
    title: 'Visit our website',
    showValue: true,
    border: { padding: 16 },
  }}
  transparentBackground
/>
```

`details` adds a title, visible QR value, and optional card to the QR view.
`titleScale` and `contentScale` independently adjust the responsive text sizes.

`transparentBackground` removes the full-stage background while keeping the
artwork and details. Areas outside the artwork or card become transparent.

- With `details.border: false` (the default), the light QR background ends at
  the matrix edge. Provide a clear scanning margin in the surrounding layout.
- With `details.border: {}`, the package fills a four-module margin around the
  QR and displays the details card. `padding` controls additional decorative
  spacing; it does not remove the four-module margin.

## Logo

```tsx
import brandLogoUrl from './assets/logo.webp';

<DesignQR
  value="https://github.com/johnson7543/design"
  logo={{ src: brandLogoUrl, alt: 'Example brand', size: 0.16 }}
/>
```

Pass a URL string as `logo.src`:

| Asset location | `src` |
| --- | --- |
| `public/logo.webp` | `'/logo.webp'` |
| Bundled asset | Imported URL, as above |
| Remote asset | HTTPS URL with CORS |
| Inline asset | PNG, JPEG, or WebP data URL |

| Field | Contract |
| --- | --- |
| File types | PNG, JPEG, or WebP |
| `alt` | Optional; max 80 characters |
| `size` | QR-width fraction; default `0.16`, range `0.08–0.20` |
| Remote files | Must allow CORS |
| `src` length | Max 8,192 characters |
| Image limits | 2 MiB and 2,048 px per edge |

Logo paths resolve against the page displaying `DesignQR`. Set `logo={false}`
to remove the logo. On Tree, the logo appears in the canopy; on City, it appears
on the QFRONT billboard. In QR view, it appears at the center of the QR code.

## Viewing zoom

Enable viewing zoom with `zoom`:

```tsx
<DesignQR value="https://github.com/johnson7543/design" zoom={{ pinch: true, wheel: false }} />
```

`zoom` alone enables the same defaults. The viewing range is 1–3×.

- Pinch with two fingers to zoom; move both fingers to pan. Trackpad pinch is
  also supported.
- Set `wheel: true` to use ordinary mouse-wheel or trackpad scrolling for zoom.
- On desktop, Shift + drag or middle-button drag pans.
- With the player focused, `+` and `-` zoom, and `0` resets the view.

Pinch-enabled players capture touch gestures within their bounds; scrolling
outside the player is unaffected. One-finger rotation and tap-to-toggle remain
available when their interaction options are enabled.

Use `onZoomChange` to display the current scale, or `setZoom()` and `resetZoom()`
from the [ref API](#ref-api-and-png-export) for your own controls. Disabling
`zoom` resets scale and pan. `setZoom()` requires zoom to be enabled and clamps
scales to 1–3; non-finite values reset to 1.

Zoom persists across artwork and view changes.

## Keyboard and reduced motion

With `interaction.tapToToggleView` enabled, the player joins the tab order and
Enter or Space switches views. Disabling that option disables keyboard view
toggling. Set `ariaLabel` to provide a custom accessible name.

With `prefers-reduced-motion: reduce`, automatic rotation and motion blur are
disabled, transitions settle immediately, and City activity is frozen.

## Advanced usage

Use these options when you need controlled React state, CSS overrides,
programmatic controls, PNG exports, error handling, or custom Tree themes.

### Control the view

Use `defaultView="qr"` to start in QR view while letting the player manage later
changes. For controlled state, provide both `view` and `onViewChange`:

```tsx
import { useState } from 'react';
import { DesignQR, type DesignQRView } from 'designqr';

export function ControlledExample() {
  const [view, setView] = useState<DesignQRView>('design');

  return (
    <>
      <button onClick={() => setView(view === 'design' ? 'qr' : 'design')}>
        {view === 'design' ? 'Show QR' : 'Show artwork'}
      </button>
      <DesignQR
        value="https://github.com/johnson7543/design"
        view={view}
        onViewChange={setView}
      />
    </>
  );
}
```

Update controlled state in `onViewChange` to accept tap, keyboard, and ref-based
view requests. Use `defaultView` only for uncontrolled state.
`interaction.transitionSpeed` controls the turn speed: `0.5` is
slower and `2` is faster than the default `1`.

### Styling

Core styles load automatically. To load them through your own stylesheet pipeline
or include them before client hydration, you can still import:

```ts
import 'designqr/style.css';
```

Load this stylesheet before mounting the player to avoid automatic inline-style
insertion. For a Content Security Policy that permits nonce-authorized inline
styles, provide your server-generated nonce through
`<meta property="csp-nonce" content="…">`; the automatic stylesheet uses it.

Use `className` to scope CSS-variable overrides to a player:

```tsx
<DesignQR value="https://github.com/johnson7543/design" className="brand-qr" />
```

```css
.brand-qr {
  width: 100%;
  max-width: 480px;
  --designqr-title-font-family: Georgia, serif;
  --designqr-body-font-family: system-ui, sans-serif;
}
```

| Variable | Default | Use |
| --- | --- | --- |
| `--designqr-title-font-family` | `"Outfit"`, then system sans-serif | QR title |
| `--designqr-body-font-family` | `"Plus Jakarta Sans"`, then system sans-serif | Visible QR value |
| `--designqr-content-color` | `#3F352B` | Visible QR value |
| `--designqr-border-color` | `rgba(95, 78, 61, 0.25)` | QR detail frame and shadow |
| `--designqr-border-highlight-color` | `rgba(255, 255, 255, 0.45)` | QR detail frame highlight |
| `--designqr-focus-color` | `#3F352B` | Keyboard focus ring |
| `--designqr-focus-contrast-color` | `#FFFFFF` | Contrasting focus-ring edge |

Font files are not downloaded by the package. Load your preferred fonts in the
page or supply fallback families through these variables.

Focus-ring variables affect the player only. For Tree artwork colors, use a
[custom theme](#custom-themes).

### Ref API and PNG export

Attach a ref to call player methods. Wait for `onReady` before exporting, and
handle export errors:

```tsx
import { useRef, useState } from 'react';
import { DesignQR, type DesignQRHandle } from 'designqr';

export function ExportExample() {
  const player = useRef<DesignQRHandle>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  async function exportPng() {
    if (!player.current) return;
    setError('');
    try {
      const blob = await player.current.exportImage();
      const reader = new FileReader();
      reader.onload = () => setImageUrl(String(reader.result));
      reader.readAsDataURL(blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed.');
    }
  }

  return (
    <>
      <DesignQR
        ref={player}
        value="https://github.com/johnson7543/design"
        onReady={() => setReady(true)}
        onError={error => setError(error.message)}
      />
      <button disabled={!ready} onClick={exportPng}>Prepare PNG</button>
      {imageUrl && <a href={imageUrl} download="designqr.png">Download PNG</a>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
```

| Method | Result |
| --- | --- |
| `setView('design' \| 'qr')` | Requests a view change |
| `resetRotation()` | Restores the default camera angle and stops automatic rotation |
| `setZoom(scale)` | Sets viewing scale to 1–3× when zoom is enabled |
| `resetZoom()` | Restores viewing scale and pan to 1x |
| `pause()` | Stops animation |
| `resume()` | Restarts animation |
| `exportImage()` | Returns a PNG as `Promise<Blob>` |

Exports capture the current view with its details, logo, theme, CSS text/card
styling, and transparency. Viewing zoom and pan are excluded. To export the QR
view, switch to `qr` and allow the transition to finish before calling
`exportImage()`.

### Errors and content limits

Use `onError` to display or log errors:

```tsx
<DesignQR
  value="https://github.com/johnson7543/design"
  onError={({ code, message }) => console.error(code, message)}
/>
```

| Code | Meaning |
| --- | --- |
| `INVALID_CONFIG` | Invalid settings, unsupported theme combination, or oversized configuration |
| `UNSUPPORTED_DESIGN` | Unrecognized design name |
| `QR_GENERATION_FAILED` | The value cannot be encoded or exceeds the interactive QR size limit |
| `LOGO_LOAD_FAILED` | The logo could not be loaded; the QR remains usable |
| `WEBGL_UNAVAILABLE` | The browser cannot create a WebGL player |
| `WEBGL_CONTEXT_LOST` | The browser lost the active WebGL context |
| `EXPORT_FAILED` | PNG export failed; `exportImage()` also rejects |

`value` must be a non-empty string within 2,048 UTF-8 bytes. The player supports
QR matrices up to 57×57 modules; usable content length depends on the content and
whether a logo is enabled. Values are encoded as supplied. If a value exceeds
these limits, shorten it before passing it to the component. When QR generation
fails, no canvas is rendered and `onReady` is not called.

### Custom themes

Custom themes are supported for Tree. City does not yet support custom themes.

`TREE_THEME_PRESETS` contains the four seasonal Tree themes.
`DESIGN_QR_THEME_PRESETS` contains those themes plus `shibuya`.

Use `createTreeTheme(preset, overrides)` to customize a preset while keeping
related colors coordinated. `tree.shape` controls the silhouette independently
of theme settings.

```tsx
import { createTreeTheme, DesignQR } from 'designqr';

const customTheme = createTreeTheme('spring', {
  foliageShape: 'pixel',
  canopyDensity: 80,
  particleType: 'none',
});

export function CustomThemeExample() {
  return (
    <DesignQR
      value="https://github.com/johnson7543/design"
      tree={{ shape: 'wide' }}
      theme={customTheme}
    />
  );
}
```

For full control, use `satisfies ResolvedTreeTheme` to validate every theme field:

<details>
<summary>Complete theme example</summary>

```tsx
import { createTreeTheme, DesignQR, type ResolvedTreeTheme } from 'designqr';

const fullTheme = createTreeTheme('summer', {
  foliageColor: '#02983B',
  foliageHighlightColor: '#99CC81',
  foliageShadowColor: '#00785E',
  foliageMidtoneColor: '#00AC7A',
  foliageShape: 'leaf',
  foliagePaletteColors: ['#00785E', '#02983B', '#00AC7A', '#99CC81', '#99CC81'],
  foliagePaletteStops: [0.28, 0.65, 0.86, 1],
  foliageColorVariation: 0.0028,
  foliageVerticalLift: 0,

  qrFoliageColor: '#00785E',
  qrFoliageHighlightColor: '#00AC7A',
  qrFoliageShadowColor: '#00785E',
  qrFoliageMidtoneColor: '#02983B',
  qrFoliagePaletteColors: ['#005A46', '#00785E', '#02983B', '#00AC7A'],
  qrFoliagePaletteStops: [0.22, 0.52, 0.8],
  qrFoliageColorVariation: 0.03,
  blossomCenterColor: '#F7E95E',

  branchColor: '#956F50',
  branchHighlightColor: '#B18B69',
  branchShadowColor: '#795538',
  branchTipColor: '#C2A27C',
  branchStyle: 'natural',

  groundColor: '#F6F4D7',
  groundShadowColor: '#6B9277',
  groundSurfaceColor: '#BEC7B5',
  groundSurfaceShadowColor: '#A2BAA9',
  groundSurfaceVariation: 0.016,
  groundSurfaceShadowVariation: 0.04,
  pedestalColor: '#B1B1B8',
  groundFeature: 'grass',
  groundFeatureColor: '#99CC81',
  groundFeatureHighlightColor: '#D7DE8A',
  groundFeatureShadowColor: '#02983B',
  groundFeaturePaletteStartColors: ['#1F9E24', '#6BE01F', '#F0D133', '#0F6114'],
  groundFeaturePaletteEndColors: ['#33C224', '#99F51F', '#F0EB59', '#0F6114'],
  groundFeaturePaletteStops: [0.4, 0.7, 0.88],
  groundFeaturePaletteVariations: [0, 0, 0, 0],

  qrFinderColor: '#99CC81',
  qrFinderHighlightColor: '#D7DE8A',
  qrFinderShadowColor: '#6B9277',
  qrFinderEyeColor: '#02983B',
  qrFinderPaletteColors: ['#6B9277', '#99CC81', '#D7DE8A', '#D7DE8A'],
  qrFinderPaletteStops: [0.35, 0.75, 1],
  qrFinderColorVariation: 0.0035,

  skyTop: '#F6F4D7',
  skyBottom: '#D7DE8A',
  titleColor: '#00785E',
  canopyDensity: 100,
  particleType: 'none',
  particleAmount: 0,
  groundLeavesAmount: 16,
  weatherType: 'rain',
  weatherAmount: 120,
  weatherColor: '#A3CAE8',
  ambientParticleType: 'butterflies',
  ambientParticleAmount: 6,
  ambientParticleColor: '#88EEFF',
  snowflakeAmount: 0,
  snowflakeColor: '#F4F8FC',
} satisfies ResolvedTreeTheme);

export function FullThemeExample() {
  return <DesignQR value="https://github.com/johnson7543/design" theme={fullTheme} />;
}
```

</details>

## Inspiration

The built-in color palettes are inspired by 『配色アイデア手帖 日本の美しい色と言葉』.
Shibuya's blue palette is inspired by the manga *Blue Period* (『ブルーピリオド』／《藍色時期》).

## License and attribution

Package code is licensed under [MIT](LICENSE).

Shibuya artwork includes modified geometry from
**3D都市モデル（Project PLATEAU）渋谷区（2025年度）**, provided by MLIT's Urban Bureau
through [Project PLATEAU](https://www.geospatial.jp/ckan/dataset/plateau-13113-shibuya-ku-2025).
Reuse follows the [PLATEAU site policy](https://www.mlit.go.jp/plateau/site-policy/)
(PDL 1.0 / CC BY 4.0-compatible terms). Modifications include projection,
clipping, simplification, extrusion, and visual styling. Crossing markings are
interpreted from [GSI aerial imagery](https://maps.gsi.go.jp/development/ichiran.html).
The artwork is a stylized representation, not a navigation or engineering map.

Station lettering includes Noto CJK glyph outlines (Adobe, SIL OFL 1.1;
[license notice](third-party-licenses/noto-cjk.txt)) and the JR East vector mark
sourced through [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:JR_East_logo.svg).
These asset notices are separate from the package's code license.
