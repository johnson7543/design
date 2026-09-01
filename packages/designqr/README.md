# DesignQR

React component for an interactive 3D tree and scannable 2D QR.

## Install

```bash
npm install designqr
```

Requires React 18.2+ and a browser with WebGL.

## Quick start

```tsx
import { DesignQR } from 'designqr';
import 'designqr/style.css';

export function Example() {
  return <DesignQR value="https://example.com" />;
}
```

The root is a responsive 1:1 square. Set its size with `style` or `className`.

## Props

| Prop | Type | Default |
| --- | --- | --- |
| `value` | `string` | Required |
| `design` | `'tree'` | `'tree'` |
| `tree` | `TreeDesignOptions` | `{ shape: 'dome', seed: 0.5 }` |
| `theme` | `DesignQRThemePreset \| TreeTheme` | `'spring'` |
| `view` | `'design' \| 'qr'` | Uncontrolled |
| `defaultView` | `'design' \| 'qr'` | `'design'` |
| `details` | `DesignQRDetailsOptions` | `{ title: '', showValue: false, border: false }` |
| `interaction` | `DesignQRInteractionOptions` | See below |
| `logo` | `false \| DesignQRLogoOptions` | `false` |
| `transparentBackground` | `boolean` | `false` |
| `className` | `string` | — |
| `style` | `React.CSSProperties` | — |
| `ariaLabel` | `string` | Generated |
| `onReady` | `() => void` | — |
| `onViewChange` | `(view) => void` | — |
| `onError` | `(error: DesignQRError) => void` | — |

`view` is controlled. When both `view` and `defaultView` are set, `view` wins.

### Nested options

| Option | Type | Default / range |
| --- | --- | --- |
| `tree.shape` | `'dome' \| 'wide' \| 'pine'` | `'dome'` |
| `tree.seed` | `number` | `0.5`; clamped to `0–1` |
| `details.title` | `string` | `''`; max 40 characters |
| `details.showValue` | `boolean` | `false` |
| `details.border` | `false \| { padding?: number }` | `false`; padding defaults to `16`, range `4–32` |
| `interaction.dragToRotate` | `boolean` | `true` |
| `interaction.tapToToggleView` | `boolean` | `true` |
| `interaction.autoRotate` | `boolean` | `false` |
| `interaction.autoRotateDirection` | `'clockwise' \| 'counterclockwise'` | `'clockwise'` |
| `interaction.transitionSpeed` | `number` | `1`; clamped to `0.25–2` |
| `interaction.motionBlur` | `boolean` | `true` |

## Styling

`designqr/style.css` scopes its rules and defaults to `.designqr-root`. Use
`className` for CSS-variable overrides; canvas detail overrides appear in both
the live player and `exportImage()`.

| Variable | Default | Use |
| --- | --- | --- |
| `--designqr-title-font-family` | `"Outfit"`, then system sans-serif | QR title |
| `--designqr-body-font-family` | `"Plus Jakarta Sans"`, then system sans-serif | Visible QR value |
| `--designqr-content-color` | `#3F352B` | Visible QR value |
| `--designqr-border-color` | `rgba(95, 78, 61, 0.25)` | QR detail frame and shadow |
| `--designqr-border-highlight-color` | `rgba(255, 255, 255, 0.45)` | QR detail frame highlight |
| `--designqr-focus-color` | `#3F352B` | Keyboard focus ring |
| `--designqr-focus-contrast-color` | `#FFFFFF` | Contrasting focus-ring edge |

The focus variables affect browser focus UI only and are not drawn into image
exports. Theme colors, including the background and title, belong in `theme`.

Set `transparentBackground` to remove the full-stage seasonal backdrop while
keeping the tree, QR artwork, details, and exported PNG on a transparent canvas.
At the settled QR endpoint, the theme-light local plate stays within the normal
QR/detail-border footprint: without Border it matches the matrix, and with
Border it expands only into the configured padding, capped at four modules.
Pixels outside that footprint remain transparent. The hosted iframe document is
transparent as well, so the iframe element's or parent application's background
shows through.

## Keyboard and motion

When `interaction.tapToToggleView` is enabled, the player uses interactive
semantics, joins the tab order, and toggles view with Enter or Space. When it is
disabled, those keyboard actions and button semantics are absent. Pointer
cursors likewise reflect the enabled tap and drag actions.

With `prefers-reduced-motion: reduce`, automatic rotation and motion blur are
disabled. View and theme-background changes settle immediately without an
animated morph or background blend.

## Custom themes

| Level | API | Use |
| --- | --- | --- |
| Preset | `theme="spring"` | Built-in theme |
| Custom | `createTreeTheme('spring', overrides)` | High-level changes; same resolver as Add Theme |
| Full | `createTreeTheme('spring', { ... } satisfies ResolvedTreeTheme)` | Every renderer field; broader than the Add Theme UI |

Presets: `spring`, `summer`, `autumn`, `winter`.

### Customize a preset

`createTreeTheme()` derives dependent palettes and QR roles from the supplied
high-level fields.

```tsx
import { createTreeTheme, DesignQR } from 'designqr';
import 'designqr/style.css';

const customTheme = createTreeTheme('spring', {
  foliageShape: 'pixel',
  canopyDensity: 80,
  particleType: 'none',
});

export function CustomThemeExample() {
  return (
    <DesignQR
      value="https://example.com"
      tree={{ shape: 'wide', seed: 0.5 }}
      theme={customTheme}
      details={{
        title: 'Visit our website',
        showValue: true,
        border: { padding: 16 },
      }}
      interaction={{
        dragToRotate: true,
        tapToToggleView: true,
        autoRotate: true,
        autoRotateDirection: 'counterclockwise',
        transitionSpeed: 1.5,
        motionBlur: true,
      }}
    />
  );
}
```

### Full renderer theme

Use `satisfies ResolvedTreeTheme` to check that every theme field is present.

```tsx
import { createTreeTheme, DesignQR, type ResolvedTreeTheme } from 'designqr';
import 'designqr/style.css';

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
  groundLeavesSeed: 1,
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
  return <DesignQR value="https://example.com" theme={fullTheme} />;
}
```

`tree.shape` is a component option, not a theme field. Add Theme metadata values
such as `id`, `label`, and `isCustom` are not part of the package theme.

## Logo

```tsx
import brandLogoUrl from './assets/logo.webp';

<DesignQR
  value="https://example.com"
  logo={{ src: brandLogoUrl, alt: 'Example brand', size: 0.16 }}
/>
```

The imported asset is a URL string, not image bytes.

| Asset location | `src` |
| --- | --- |
| `public/logo.webp` | `'/logo.webp'` |
| Bundled asset | Imported URL, as above |
| Remote asset | HTTPS URL with CORS |
| Inline asset | PNG, JPEG, or WebP data URL |

| Field | Contract |
| --- | --- |
| `src` | PNG, JPEG, or WebP data URL; same-origin path; or HTTPS URL |
| `alt` | Optional; max 80 characters |
| `size` | QR-width fraction; default `0.16`, range `0.08–0.20` |
| Remote files | Must allow CORS |
| `src` length | Max 8,192 characters |
| Image limits | 2 MiB and 2,048 px per edge |
| Failure | Calls `onError` with `LOGO_LOAD_FAILED`; QR remains usable |

Editor Share, Embed, and generated React examples retain the configured logo
source. An uploaded logo is emitted as its exact inline data URL, so copied TSX
runs without a replacement asset. For maintained application code, prefer a
public path, bundled import, or hosted HTTPS URL. Paths resolve against the page
running `DesignQR`.

## Ref API

Attach a `RefObject<DesignQRHandle>` to the component.

| Method | Result |
| --- | --- |
| `setView('design' \| 'qr')` | Requests a view change |
| `resetRotation()` | Restores the default camera angle |
| `pause()` | Stops animation |
| `resume()` | Restarts animation |
| `exportImage()` | Returns `Promise<Blob>` containing the visible PNG |

## Hosted iframe

For non-React hosts, use `designqr/embed`:

```ts
import {
  connectDesignQREmbed,
  createDesignQREmbedUrl,
  createDesignQRIframeMarkup,
} from 'designqr/embed';

const frame = document.querySelector<HTMLIFrameElement>('#designqr')!;
frame.src = createDesignQREmbedUrl({
  value: 'https://example.com',
  theme: 'spring',
  view: 'design',
});

const html = createDesignQRIframeMarkup(frame.src);
const player = connectDesignQREmbed(frame);

player.setView('qr');
const png = await player.exportImage();
player.destroy();
```

```html
<iframe
  id="designqr"
  title="Interactive DesignQR"
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="no-referrer"
></iframe>
```

The default hosted player is `https://design.johnson7543.com/qr/embed`. Pass
`{ origin }` for another host. Keep both sandbox permissions so commands can run
with exact-origin checks. Encoded URLs are readable transport, not encryption.

## License

[MIT](LICENSE)
