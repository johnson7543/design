# DesignQR integration implementation plan

Status: In progress<br>
Last updated: 2026-08-31<br>
Target first public version: `designqr@0.1.0`

[Back to the Design QR documentation index](README.md)

## 1. Purpose

Turn the existing DesignQR editor and 3D tree renderer into one reusable product
that other websites and applications can use without copying a rendered 2D image.

The implementation will expose the same rendering behavior through:

1. The existing DesignQR editor at `/qr`.
2. A hosted interactive iframe at `/qr/embed`.
3. An installable React component named `DesignQR`.
4. A framework-neutral `<design-qr>` Web Component after the React and iframe
   contracts have stabilized.

All integration surfaces must consume the same versioned configuration and the
same renderer. The editor must not maintain a separate rendering path.

### Implementation progress

Completed in the first implementation slice:

- Added the root npm workspace and the initial `designqr@0.1.0` package scaffold.
- Added `DesignQRConfigV1`, defaults, normalization, typed errors, the schema-v1
  base64url codec, and the tree design registry.
- Migrated editor links to the current schema with complete custom-theme
  snapshots.
- Replaced the selector-based, download-only image compositor with one live
  presentation canvas. The editor displays this canvas and exports its PNG blob
  directly, including its background and visible QR details.
- Added package tests for normalization, malformed input, UTF-8 round trips,
  design lookup, title-color resolution, and current-schema links.

Completed in the second implementation slice:

- Moved QR generation, tree construction, seasonal constants, Three.js rendering,
  the live presentation surface, and canvas interaction into `packages/designqr`.
- Added the public `<DesignQR>` React component with controlled and uncontrolled
  views, responsive sizing, reduced-motion handling, offscreen/document-hidden
  pausing, isolated instance refs, and `setView`, reset, pause, resume, and
  WYSIWYG export handle methods.
- Scoped the reusable player CSS under `designqr-` classes and removed the old
  root renderer/component copies. The editor now imports the workspace package's
  player and renderer implementation.
- Made presentation fonts, detail colors, borders, focus, cursors, and
  interaction semantics package-owned. Enter and Space toggle only when
  tap-to-toggle is enabled, and reduced motion settles view and background
  changes immediately.
- Added Vite ESM/CJS library builds, TypeScript declarations, a CSS subpath
  export, and build-time ESM/CJS/SSR import checks.
- Added a standalone React/Vite consumer fixture that compiles against the
  package export map and demonstrates two independent instances, controlled and
  uncontrolled views, ref actions, and mount/unmount behavior.
- Added a production-browser consumer smoke test covering independent initial
  views, ref-driven view changes, unmount/remount behavior, and pixel-identical
  public `exportImage()` output.
- Added explicit Three.js scene-resource disposal and guarded animation-loop
  pause/resume behavior.

Completed in the third implementation slice:

- Added the lazy, chrome-free `/qr/embed` route with canonical configuration
  parsing, edge-to-edge responsive rendering, and stable invalid/WebGL fallbacks.
- Added the `designqr/embed` public subpath with hosted-URL generation, an
  exact-origin iframe controller, protocol-v1 guards, lifecycle commands, and
  request-correlated WYSIWYG PNG export.
- Added route-scoped Cloudflare framing headers: `/` and `/qr` remain self-only,
  while `/qr/embed*` detaches `X-Frame-Options`, uses `frame-ancestors *`, and
  applies `no-referrer` without weakening the rest of the site.
- Added a framework-neutral iframe consumer on a different local origin plus a
  browser smoke test that exercises configuration/view commands, child events,
  malformed input, visible-canvas/export pixel identity, and actual
  Wrangler-served response headers.
- Added protocol-envelope and hosted-URL unit coverage, ESM/CJS embed export
  checks, and the iframe fixture to the root release gate.

Completed in the fourth implementation slice:

- Made editor links, hosted-player URLs, iframe markup, and React snippets derive
  from one normalized `DesignQRConfigV1` snapshot of the current editor state.
- Expanded the Share modal into responsive `Share`, `Embed`, and `React` views,
  with WYSIWYG image download, system/direct sharing, hosted-player URL copy,
  safe iframe markup, a copyable npm install command, a minimal React example
  that emits only settings which differ from the public component defaults, an
  `Advanced` example that emits one package-only component with the complete
  current public setup and no generated host application UI, and a second
  package-only `Custom Theme` example that exposes the current resolved theme
  through every public `createTreeTheme()` parameter alongside the complete
  current render configuration.
- Unified Share-modal copy actions as accessible icon-only controls and added a
  tokenized syntax theme for HTML, shell, and TSX examples.
- Added strict compilation of generated preset/custom-theme TSX with URL and
  inline logos, plus browser checks that copied code exactly matches the active
  example and copy feedback does not leak between tabs.
- Made React example selection follow the canonical editor snapshot on every
  Share opening: URL-only defaults recommend `Simple`, non-theme customization
  recommends `Advanced`, and an active custom theme recommends `Custom Theme`.
  The recommendation remains visibly and accessibly marked after manual tab
  selection.
- Added `createDesignQRIframeMarkup()` to the public `designqr/embed` API and
  browser coverage that verifies Share and Embed carry the same encoded config
  without overflowing the 320 px layout.

Completed in the fifth implementation slice:

- Added complete, immutable Spring/Summer/Autumn/Winter theme objects and
  `createTreeTheme()`, including explicit renderer roles for foliage, branches,
  QR modules, ground, weather, ambient particles, snow, background, and text.
- Added time-based clockwise/counterclockwise automatic rotation and one
  fixed-footprint editor direction control that preserves the current yaw.
- Added clean-room Pixel foliage using the existing QR-derived voxel set, so the
  3D/2D turn remains one continuous object without a duplicate QR layer.
- Added an optional raster logo that moves from the 3D canopy to the QR center,
  is serialized by every integration surface, appears in the live/exported
  pixels, uses high QR error correction, and reports typed loading failures.
- Added the editor's dedicated logo upload/replace/size/remove controls. Local
  PNG, JPEG, and WebP originals up to 100 MiB are downsampled and re-encoded
  below 1 MiB while still meeting the stricter canonical-link source limit;
  inline preparation failures do not move the artwork stage.
- Expanded public declarations and the package README with the full theme,
  interaction, logo-source, error, and WYSIWYG export contracts. The theme
  guide now separates a small `createTreeTheme()` preset customization from a
  compile-checked `createTreeTheme()` call that supplies every parameter.
- Unified `createTreeTheme()` and Add Theme dependency cascades for source
  colors and exclusive particle selection, and moved fallen-ground placement
  onto a theme-owned deterministic seed so preset clones render identically
  through either integration path.

Completed in the transparent-background implementation slice:

- Added the sparse, backward-compatible schema-v1 `transparentBackground`
  boolean and matching React prop. Opaque remains the default, so existing
  configurations and their encoded links are unchanged.
- Propagated one setting through the editor, direct links, generated React
  examples, hosted iframe configuration and live `setConfig()` updates, and the
  WYSIWYG PNG path.
- Made the live presentation surface clear to alpha without duplicating the
  renderer. The underlying WebGL artwork remains alpha-capable, while the
  settled 2D theme-light fill matches the QR matrix when Border is disabled;
  enabling Border fills its card and reserves four clear QR modules before the
  configured decorative padding and frame.
- Added the persistent action-row toggle beside Blur, editor-only checkerboard
  preview, route-scoped transparent iframe document, responsive coverage,
  alpha/export assertions, and cross-origin QR decoding coverage.

Completed in publication preparation:

- Adopted the MIT license and added the public package metadata required by npm
  and repository-linked provenance.
- Added a package-specific release contract, exact tarball-content audit, and
  tag-gated GitHub Actions workflow for npm Trusted Publishing.
- Added a manual audit-only workflow path and documented the first-publication
  bootstrap, OIDC setup, tag/version contract, and token-hardening steps.

Still pending are migrating the editor from the package's editor canvas to the
high-level public component, explicit active-animation-loop instrumentation,
remaining publication verification, and the Web Component follow-up.

## 2. Decisions already made

| Concern | Decision |
| --- | --- |
| Product name | `DesignQR` |
| React component | `<DesignQR />` |
| Proposed npm package | `designqr` |
| Web Component | `<design-qr>` |
| Existing editor route | Keep `/qr` |
| Hosted player route | `/qr/embed` |
| Current design identifier | `tree` |
| React design parameter | `design="tree"` |
| Default design | `tree` |
| First package version | `0.1.0` |
| Package license | MIT |
| Initial hosted storage | Stateless, encoded configuration |
| Short-link backend | Deferred until URL length or product needs justify it |
| Image export | Required in `0.1.0`; snapshot the live presentation surface |

The unscoped `designqr` package name returned `404` from the official npm
registry on 2026-08-30. That is not a permanent reservation; the name should be
reserved before publication work begins.

## 3. Goals

- Allow React applications to render the interactive 3D QR tree directly.
- Allow any website builder or application with iframe support to embed it.
- Make `tree` an explicit design choice without hard-coding the entire public API
  around trees.
- Preserve the exact selected preset or custom theme in links and embeds.
- Ensure the title style follows the resolved theme by default.
- Keep the editor, iframe, and package output visually and behaviorally identical.
- Make image export a snapshot of the same rendered pixels shown in the player,
  without rebuilding the QR, background, border, title, or content in a parallel
  export renderer.
- Support responsive containers instead of requiring fixed pixel dimensions.
- Support more than one DesignQR instance on the same page.
- Avoid changing global host-page styles, browser history, or document metadata
  when DesignQR is imported as a component.
- Provide a stable configuration migration path before publishing the API.

## 4. Non-goals for version 0.1

- More visual designs beyond `tree`.
- A server-side QR rendering service.
- A permanent database of saved designs.
- User accounts, billing, permissions, or private designs.
- A native iOS or Android rendering engine. Native apps can initially use the
  hosted player in `WKWebView` or Android `WebView`.
- Arbitrary remote textures, models, fonts, scripts, or HTML supplied through the
  configuration.
- Supporting Internet Explorer or browsers without WebGL.
- Guaranteeing server-side rendering of the canvas. Importing the package must be
  SSR-safe, but WebGL initialization remains browser-only.

## 5. Current-state assessment

### 5.1 Application structure

- `src/platform/DesignPlatform.tsx` routes `/`, `/qr`, and the lazy `/qr/embed`
  hosted player.
- `src/App.tsx` currently owns editor state, QR generation, renderer configuration,
  theme persistence, share-link construction, browser-history updates, and the
  full editor UI.
- `packages/designqr/src/react/DesignQR.tsx` owns the public configuration and
  controlled/uncontrolled player contract.
- `packages/designqr/src/react/DesignQRCanvas.tsx` manages the WebGL source, the
  displayed presentation canvas, pointer interactions, responsive lifecycle, and
  component-owned image-export handle.
- `packages/designqr/src/renderer/RenderManager.ts` wraps the package-owned
  Three.js renderer, while `packages/designqr/src/renderer/webgl/ThreeFallbackRenderer.ts`
  owns the scene and guarded render loop.
- `packages/designqr/src/designs/tree/qr.ts` and `treeBuilder.ts` are the sole QR
  and tree implementations.

### 5.2 Coupling that must be removed

- `src/App.tsx` writes the selected background directly to `document.body`.
- `src/index.css` applies `overflow`, `user-select`, background, and sizing rules
  globally to `html` and `body`.
- The editor and public component share the package-owned live presentation
  surface and no longer use global selectors or a download-only visual renderer.
- Share links are constructed from `window.location` inside the editor.
- The editor updates browser history whenever configuration changes.
- `src/editor/types.ts` keeps `CustomTheme` persistence fields such as `id`,
  `label`, and `isCustom` outside the package-owned `TreeTheme` contract.
- Schema-v1 links now preserve preset or complete custom themes; the editor-facing
  state adapter remains in the root app until it migrates from the low-level
  package editor canvas to the high-level public component.
- Renderer destruction stops the animation loop, clears callbacks, and disposes
  discovered geometries, materials, textures, render lists, and renderer state.

### 5.3 Hosted framing boundary

`public/_headers` keeps these rules on the platform and editor routes:

```text
Content-Security-Policy: ... frame-ancestors 'self' ...
X-Frame-Options: SAMEORIGIN
```

The `/qr/embed*` rule detaches both inherited CSP and `X-Frame-Options`, then
replaces CSP with the same resource restrictions and `frame-ancestors *`.
Wrangler-served header assertions verify the public route can be framed while
`/` and `/qr` remain protected.

### 5.4 Build and release state

- The root package is private, owns an npm workspace, and builds one Vite
  application.
- `packages/designqr` produces ESM, CJS, CSS, source maps, and TypeScript
  declarations, with SSR-safe ESM/CJS import checks in the package build.
- Publication metadata remains private until naming, licensing, packed-consumer,
  and release checks are complete.
- Browser smoke scripts test `/`, `/qr`, an unknown route, navigation, standalone
  React consumption, cross-origin hosted-player control/export, logo lifecycle,
  visible/exported pixel identity, and final QR decoding at the minimum, default,
  and maximum supported logo sizes. The hosted smoke also asserts the real local
  Wrangler headers. Packed installation and explicit renderer-loop
  instrumentation remain pending.

## 6. Public naming and API

### 6.1 React usage

The primary developer experience should be:

```tsx
import { createTreeTheme, DesignQR } from 'designqr';
import 'designqr/style.css';

export function ProductQRCode() {
  return (
    <DesignQR
      value="https://example.com"
      design="tree"
      theme={createTreeTheme('spring', {
        foliageShape: 'pixel',
      })}
      tree={{
        shape: 'dome',
      }}
      logo={{
        src: '/logo.webp',
        alt: 'Example brand',
        size: 0.16,
      }}
      defaultView="design"
      transparentBackground
      details={{
        title: 'Visit our website',
        titleScale: 1,
        showValue: true,
        contentScale: 0.9,
        border: {
          padding: 16,
        },
      }}
      interaction={{
        dragToRotate: true,
        tapToToggleView: true,
        autoRotate: true,
        autoRotateDirection: 'counterclockwise',
        transitionSpeed: 1.5,
        motionBlur: true,
      }}
      onReady={() => console.log('DesignQR ready')}
      onViewChange={(view) => console.log(view)}
      onError={(error) => console.error(error)}
    />
  );
}
```

### 6.2 API naming rules

- Use `value`, not `url`, for the encoded QR content. The editor can continue to
  validate URLs, while the renderer remains usable for future text, Wi-Fi, or
  contact-data support.
- Use `design="tree"` as the public React parameter. It defaults to `tree`, but all
  primary documentation should show it explicitly.
- Use `tree` for design-specific options. Do not add tree-only options at the top
  level of the general component.
- Use `design` and `qr` for public view names. Internally, these map to the current
  `3d` and `scan` renderer states.
- Default the component to a responsive 1:1 footprint when only width is
  available. Apply customization directly through the component's `style` or
  `className` props—not a generated sizing wrapper or dedicated rendering
  `width` and `height` props.
- Derive the title color from the resolved theme. Do not add an unrelated title
  color prop in version 0.1.
- Keep `logo` optional. Accept only bounded PNG, JPEG, and WebP data URLs,
  same-origin paths, or HTTPS URLs; report loading failure through the typed
  error channel without replacing the usable tree/QR.
- Keep configured logo sources exact in Share, Embed, and generated React
  examples. Inline uploads remain inline so copied TSX is immediately runnable;
  app owners may later replace them with a public path, bundled import, or
  hosted HTTPS URL.
- Use `transparentBackground` for one cross-surface backdrop setting. It removes
  the full seasonal gradient, not artwork or QR light modules, and defaults to
  `false`.
- Reject unknown design identifiers with a typed `UNSUPPORTED_DESIGN` error.
- Clamp every numeric value and validate colors before they reach the renderer.

### 6.3 Current React props

```ts
export type DesignQRDesignName = 'tree';
export type DesignQRView = 'design' | 'qr';
export type DesignQRThemePreset =
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter';
export type AutoRotateDirection = 'clockwise' | 'counterclockwise';
export type TreeFoliageShape = 'blossom' | 'leaf' | 'pixel';

export interface TreeDesignOptions {
  shape?: 'dome' | 'wide' | 'pine';
  seed?: number;
}

export interface DesignQRDetailsOptions {
  title?: string;
  titleScale?: number;
  showValue?: boolean;
  contentScale?: number;
  border?: false | {
    padding?: number;
  };
}

export interface DesignQRInteractionOptions {
  dragToRotate?: boolean;
  tapToToggleView?: boolean;
  autoRotate?: boolean;
  autoRotateDirection?: AutoRotateDirection;
  transitionSpeed?: number;
  motionBlur?: boolean;
}

export interface DesignQRLogoOptions {
  src: string;
  alt?: string;
  size?: number;
}

export interface DesignQRError {
  code:
    | 'INVALID_CONFIG'
    | 'UNSUPPORTED_DESIGN'
    | 'QR_GENERATION_FAILED'
    | 'LOGO_LOAD_FAILED'
    | 'WEBGL_UNAVAILABLE'
    | 'WEBGL_CONTEXT_LOST'
    | 'EXPORT_FAILED';
  message: string;
  cause?: unknown;
}

export interface DesignQRHandle {
  setView(view: DesignQRView): void;
  resetRotation(): void;
  pause(): void;
  resume(): void;
  exportImage(): Promise<Blob>;
}

export interface DesignQRProps {
  value: string;
  design?: 'tree';
  tree?: TreeDesignOptions;
  theme?: DesignQRThemePreset | TreeTheme;
  view?: DesignQRView;
  defaultView?: DesignQRView;
  details?: DesignQRDetailsOptions;
  interaction?: DesignQRInteractionOptions;
  logo?: false | DesignQRLogoOptions;
  transparentBackground?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  onReady?: () => void;
  onViewChange?: (view: DesignQRView) => void;
  onError?: (error: DesignQRError) => void;
}
```

`view` is controlled when supplied. `defaultView` initializes internal state when
`view` is omitted. Supplying both should generate a development warning and use
`view`.

When `tapToToggleView` is enabled, the player is keyboard focusable and Enter or
Space requests the opposite view through the same controlled or uncontrolled
path as a pointer tap. Disabling it removes the toggle-specific button semantics,
tab stop, and keyboard action. Cursor state follows the enabled tap and drag
interactions.

### 6.4 Defaults

```ts
const DESIGN_QR_DEFAULTS = {
  design: 'tree',
  theme: 'spring',
  defaultView: 'design',
  tree: {
    shape: 'dome',
    seed: 0.5,
  },
  details: {
    title: '',
    showValue: false,
    border: false,
  },
  interaction: {
    dragToRotate: true,
    tapToToggleView: true,
    autoRotate: false,
    autoRotateDirection: 'clockwise',
    transitionSpeed: 1,
    motionBlur: true,
  },
  logo: false,
  transparentBackground: false,
} as const;
```

The component must require a non-empty `value`. The editor may continue to insert
its current default URL when its input is blank, but that editor convenience must
not silently affect package consumers.

## 7. Canonical configuration model

Every surface must normalize its input into one canonical, versioned structure.

```ts
export interface DesignQRConfigV1 {
  schemaVersion: 1;
  value: string;

  design: {
    type: 'tree';
    options: Required<TreeDesignOptions>;
  };

  theme:
    | {
        type: 'preset';
        preset: DesignQRThemePreset;
      }
    | {
        type: 'custom';
        value: TreeTheme;
      };

  view: {
    initial: DesignQRView;
  };

  details: {
    title: string;
    titleScale?: number;
    showValue: boolean;
    contentScale?: number;
    border: false | {
      padding: number;
    };
  };

  interaction: Required<DesignQRInteractionOptions>;
  logo: false | Required<DesignQRLogoOptions>;
  transparentBackground?: boolean;
}
```

The simple React prop `design="tree"` maps to
`config.design.type === 'tree'`. Keeping the canonical structure nested allows a
future design to carry its own options without polluting the common namespace.

### 7.1 Theme separation

Keep public visual configuration and editor persistence as two distinct concepts.
The executable `TreeTheme` source of truth is
[`config/types.ts`](../../packages/designqr/src/config/types.ts), and its
complete built-in values are exported as `TREE_THEME_PRESETS`. Consumers can
copy a preset safely with `createTreeTheme(preset, overrides)`.

```ts
const customTheme = createTreeTheme('spring', {
  foliageShape: 'pixel',
  canopyDensity: 72,
  weatherType: 'rain',
  weatherAmount: 120,
});

export interface SavedTreeTheme extends TreeTheme {
  id: string;
  label: string;
}
```

`SavedTreeTheme` belongs to the editor and local persistence. Only `TreeTheme`
belongs in the package and serialized configuration.

The public role groups are:

| Group | Roles |
| --- | --- |
| Canopy | Organic foliage roles, ordered five-color distribution and stops, RGB variation/lift, `foliageShape`, blossom center, and density |
| QR foliage | QR voxel/scan-face roles, ordered four-color distribution and stops, and RGB variation |
| Tree | Branch body, highlight, shadow, tip, and branch style |
| Ground | Light-module, surface, shadow, surface variations, pedestal, and four-band ground-feature ramps |
| Finder modules | Finder body, highlight, shadow, eye, ordered distribution, stops, and RGB variation |
| Presentation | Sky gradient and title |
| Environment | Falling particles, ground leaves and their deterministic layout seed, weather, ambient particles, and snow |

The package README lists every property in these groups. Partial custom themes
are a current public input; normalization fills missing renderer roles.
`createTreeTheme()` applies the same dependent-role release rules as the Add
Theme editor when source tones change, and its particle helper composes the
same exclusive falling, ambient, weather, snow, and ground-leaf setup. The
README's full `createTreeTheme()` literal remains explicit so TypeScript reports
newly required theme roles instead of silently deriving them. The Share modal
mirrors this public workflow: its additional `Custom Theme` advanced React
example imports `createTreeTheme()` and `ResolvedTreeTheme` from `designqr`,
lists every role from the current resolved theme as an explicit override, and
passes the resulting complete theme plus the canonical current render
configuration to `<DesignQR>` without editor-only metadata or placeholder
assets.
Built-in distributions preserve the pre-package seasonal output. Settled 2D
QRs retain those multi-tone distributions with or without a logo. Logo mode
uses high error correction and a bounded, frame-free image plane instead of
flattening the surrounding module colors or masking them with an oversized
backplate. One shared hue-preserving, scan-safe depth filter is applied to
settled dark modules in both states; logo activation does not add another color
adjustment. Custom and preset themes therefore receive identical 2D module
colors before and after logo changes without altering their source colors or 3D
rendering. Light modules use an independent shared sRGB display lift derived
from each theme's `groundColor`. This preserves the brighter reference negative
space without introducing a universal fixed light color, and both treatments
blend through the existing turn.

The title color resolves in this order:

1. Custom `theme.titleColor`.
2. Custom `theme.foliageShadowColor`.
3. Custom `theme.foliageColor`.
4. The selected preset's existing title color.

This makes title styling part of the theme contract rather than a disconnected UI
setting.

### 7.2 Normalization and validation

Add pure functions with no browser dependencies:

```ts
normalizeDesignQRConfig(input): DesignQRConfigV1
parseDesignQRConfig(input): Result<DesignQRConfigV1, DesignQRError>
encodeDesignQRConfig(config): string
decodeDesignQRConfig(encoded): Result<DesignQRConfigV1, DesignQRError>
```

Validation requirements:

- Enforce `schemaVersion`.
- Limit `value` to 2048 UTF-8 bytes, a conservative renderer-safe maximum for the
  current QR error-correction settings.
- Limit title length to the current 40-character product rule unless product
  requirements change it deliberately.
- Limit encoded canonical configurations to 16,384 characters. The editor must
  show a clear error and withhold invalid share/embed URLs instead of truncating
  a logo or silently dropping configuration.
- Accept logos only as raster data URLs, same-origin paths, or HTTPS URLs. Limit
  source text to 8,192 characters, alternate text to 80 characters, decoded
  image data to 2 MiB, image dimensions to 2,048 px per edge, and normalized
  logo size to `0.08`–`0.20` of QR width.
- Validate `#RGB` and `#RRGGBB` colors and normalize to `#RRGGBB`.
- Clamp canopy, environmental particle, border-padding, and logo-size values.
- Keep editor-only theme metadata outside serialized package configuration;
  normalization copies only public theme roles.
- Reject objects with an unsupported `design.type`.
- Never evaluate HTML, CSS, or script from configuration fields. Remote logo
  responses must be CORS-readable PNG, JPEG, or WebP data.
- Do not throw for user input at the route boundary; return a typed error and
  render a stable fallback.

### 7.3 Current schema contract

- Decode only canonical `DesignQRConfigV1` payloads with `schemaVersion: 1`.
- Treat unsupported payload shapes, unsupported schema versions, and unknown
  top-level configuration fields as invalid.
- Keep concise `DesignQRConfigInput` forms as current inputs to normalization and
  encode them into the canonical structure before sharing.
- Emit the schema version in every new editor and hosted-player link.
- Omit `transparentBackground` when false and emit it only when true, keeping
  default schema-v1 links byte-stable while accepting older v1 payloads.
- Test canonical round trips and rejection of unsupported payloads.

## 8. Target architecture

```text
DesignQR editor ───────────┐
Hosted /qr/embed route ────┼──> React <DesignQR>
External React consumer ───┘             │
                                         v
                              normalize configuration
                                         │
                                         v
                                  design registry
                                         │
                                type === "tree"
                                         │
                                         v
                        QR matrix -> tree builder -> renderer
```

The design registry initially contains one adapter:

```ts
const designRegistry = {
  tree: treeDesignAdapter,
} satisfies DesignRegistry;
```

The adapter owns tree-specific behavior:

- Configuration validation and defaults.
- QR-to-tree data construction.
- Tree theme resolution.
- Renderer creation and updates.
- Mapping `design`/`qr` public views to `3d`/`scan` renderer progress.
- Tree-specific interactions.

The shared React player owns generic behavior:

- Container and canvas lifecycle.
- Responsive sizing.
- Visibility handling and immediate view/background settlement under reduced
  motion.
- Controlled and uncontrolled view state.
- Interaction-aware semantics, keyboard activation, focus, and cursors.
- Package-owned presentation variables and fallbacks.
- Details/title rendering.
- Full-stage alpha compositing, the matrix-bounded transparent QR fill, and the
  optional filled Border card with its four-module clear margin.
- Error boundaries and public callbacks.
- Ref methods.

## 9. Proposed repository layout

Keep the existing application at the repository root and add an npm workspace for
the public package.

```text
tree-qr/
├── package.json                    # private workspace root and web app
├── src/
│   ├── App.tsx                     # editor only
│   ├── platform/
│   ├── components/                 # editor controls and modals
│   └── routes/
│       └── DesignQREmbedRoute.tsx
├── packages/
│   └── designqr/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── src/
│       │   ├── index.ts
│       │   ├── config/
│       │   │   ├── codec.ts
│       │   │   ├── defaults.ts
│       │   │   ├── normalize.ts
│       │   │   └── types.ts
│       │   ├── designs/
│       │   │   ├── registry.ts
│       │   │   └── tree/
│       │   │       ├── adapter.ts
│       │   │       ├── constants.ts
│       │   │       ├── qr.ts
│       │   │       ├── treeBuilder.ts
│       │   │       ├── themes.ts
│       │   │       └── renderer/
│       │   ├── react/
│       │   │   ├── DesignQR.tsx
│       │   │   ├── DesignQRDetails.tsx
│       │   │   └── useDesignQR.ts
│       │   └── style.css
│       └── test/
├── examples/
│   ├── react-vite-consumer/
│   └── iframe-consumer/
└── scripts/
```

Do not create separate `core`, `react`, and `element` npm packages for version
0.1. One package with explicit subpath exports is easier to release and version.
Internal folders can still maintain strict boundaries so they can be separated
later if needed.

## 10. Hosted iframe contract

### 10.1 URL

Version 0.1 uses:

```text
https://design.johnson7543.com/qr/embed?config=<base64url-config>
```

Provide a package helper so consumers never construct this manually:

```ts
const src = createDesignQREmbedUrl(config, {
  origin: 'https://design.johnson7543.com',
});
```

Base64url is transport encoding, not encryption. Documentation must state that the
QR value and theme configuration are visible to anyone with the URL. This is
normally acceptable because a QR value is itself intended to be readable.

### 10.2 Player behavior

The embed route must:

- Render only the player.
- Fill `100%` width and height.
- Have no minimum viewport based on the editor layout.
- Avoid editor navigation, local theme persistence, modals, analytics controls, and
  browser-history mutation.
- Show a stable `Invalid DesignQR configuration` fallback when parsing fails.
- Use the same fixed renderer pixel-ratio cap as the npm component.
- Pause when the document is hidden.
- Respect `prefers-reduced-motion` by disabling automatic rotation and blur and
  settling view and background changes immediately.
- Keep the hosted document, body, and application root transparent. The opaque
  default canvas still paints its theme gradient; transparent mode reveals the
  host through the iframe without a legacy `allowtransparency` attribute.

### 10.3 Suggested iframe markup

```html
<iframe
  src="https://design.johnson7543.com/qr/embed?config=..."
  title="Interactive DesignQR"
  width="600"
  height="600"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="no-referrer"
></iframe>
```

The host controls dimensions. DesignQR remains responsive inside them.
`allow-same-origin` is required so the parent helper receives the hosted
DesignQR origin instead of the sandboxed opaque `null` origin and can enforce an
exact `targetOrigin`. On a third-party host the iframe remains cross-origin.

### 10.4 Response headers

Keep the current restrictive headers for `/` and `/qr`. For `/qr/embed*`:

- Remove `X-Frame-Options` rather than using the non-standard `ALLOWALL` value.
- Replace the inherited CSP with a policy that keeps the current script, style,
  image, connection, object, and base restrictions while setting
  `frame-ancestors *` for a public embed.
- Set `Referrer-Policy: no-referrer` for the hosted player.
- Keep camera, microphone, and geolocation disabled.
- Test the actual deployed or Wrangler-served response headers. Do not rely only
  on Vite preview behavior.

Cloudflare `_headers` supports detaching headers inherited from a more pervasive
rule. Use that route-specific mechanism or set the response headers in Worker code
if the static rule interaction is ambiguous. Do not weaken the entire site to make
one route frameable.

### 10.5 `postMessage` protocol

Use a versioned message envelope:

```ts
interface DesignQRMessage<TType extends string, TPayload = undefined> {
  source: 'designqr';
  protocolVersion: 1;
  instanceId: string;
  type: TType;
  payload: TPayload;
}
```

Child-to-parent messages:

- `designqr:ready`
- `designqr:view-change`
- `designqr:error`
- `designqr:export-result`
- `designqr:export-error`

Parent-to-child messages:

- `designqr:connect`
- `designqr:set-config`
- `designqr:set-view`
- `designqr:pause`
- `designqr:resume`
- `designqr:reset-rotation`
- `designqr:export-image`

Security rules:

- Parent helpers must use the exact DesignQR origin as `targetOrigin`.
- `designqr:connect` is the only command allowed to use the `*` instance
  sentinel; the child replies with its concrete per-player instance ID before
  queued commands are sent.
- The iframe must require `event.source === window.parent`.
- Validate every message envelope and payload before use.
- Ignore unknown protocol versions and message types.
- Never pass messages into DOM HTML or code execution.
- Do not expose renderer internals over the protocol.
- Require a unique `requestId` on export requests and responses. The successful
  response carries the current PNG as a structured-cloned `Blob`; validate its
  `image/png` MIME type and enforce the protocol's 16 MiB maximum response size
  in the parent helper.

The iframe can function without `postMessage`; the protocol adds controlled updates
and events for application integrations. `designqr:export-image` must call the
same component-owned `exportImage()` method used by React consumers; it must not
introduce an iframe-specific image renderer.

## 11. npm package contract

### 11.1 Installation and exports

```bash
npm install designqr
```

Proposed package exports:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/designqr.js",
      "require": "./dist/designqr.cjs"
    },
    "./config": {
      "types": "./dist/config/index.d.ts",
      "import": "./dist/config.js",
      "require": "./dist/config.cjs"
    },
    "./embed": {
      "types": "./dist/embed/index.d.ts",
      "import": "./dist/embed.js",
      "require": "./dist/embed.cjs"
    },
    "./style.css": "./dist/designqr.css"
  },
  "sideEffects": [
    "./dist/designqr.css"
  ]
}
```

Initial dependency policy:

- `react` and `react-dom`: peer dependencies, supporting the lowest React version
  verified by the consumer fixture.
- `three` and `qrcode`: direct dependencies for a one-command installation.
- Do not bundle a second copy of React.
- Measure the package with and without externalizing Three.js before locking the
  final Three.js distribution policy.

### 11.2 Build output

- Use Vite library mode for ESM and CJS outputs.
- Generate `.d.ts` files with a dedicated TypeScript declaration build.
- Export package CSS separately.
- Include only `dist`, README, license, and required package metadata in the npm
  tarball.
- Add `files` and a strict `exports` map; do not allow undocumented internal path
  imports.
- Produce source maps for the package unless package-size review rejects them.
- Keep the website build and package build as separate scripts.

Suggested root commands:

```json
{
  "scripts": {
    "build:web": "tsc -b && vite build",
    "build:package": "npm run build --workspace designqr",
    "test:package": "npm run test --workspace designqr",
    "pack:package": "npm pack --workspace designqr",
    "check": "npm run lint && npm run test && npm run build:web && npm run build:package && npm run smoke:production"
  }
}
```

Exact scripts can change during implementation, but the root `check` command must
remain the single pre-release gate.

### 11.3 SSR behavior

- Package import must not access `window`, `document`, `navigator`, `performance`,
  or WebGL at module evaluation time.
- Server rendering may output the sized wrapper and accessible fallback.
- Canvas and renderer initialization must occur inside a client-side effect.
- Cleanup must be safe under React Strict Mode's development mount/unmount cycle.
- Add a Node import smoke test and at least one SSR consumer fixture before version
  `1.0.0`.

## 12. Web Component follow-up

After the package and iframe API have stabilized, expose:

```html
<script type="module" src="https://cdn.example.com/designqr-element.js"></script>

<design-qr
  value="https://example.com"
  design="tree"
  theme="spring"
  default-view="design"
></design-qr>
```

Complex configuration should use a JavaScript property instead of placing large
JSON in an HTML attribute:

```js
const element = document.querySelector('design-qr');
element.config = config;
```

The element should:

- Render in a Shadow Root to isolate styles.
- Dispatch `designqr-ready`, `designqr-view-change`, and `designqr-error` events.
- Reflect simple scalar attributes to properties.
- Dispose its renderer in `disconnectedCallback`.
- Reuse the package core rather than reimplementing the tree design.

Whether the CDN artifact bundles React is a later build-size decision. The public
custom-element contract should not depend on that implementation choice.

## 13. Implementation phases

### Phase 0: Reserve names and capture baselines

Tasks:

- Reserve the `designqr` npm name or select a final scoped alternative.
- Use MIT for package source and distribution.
- Capture screenshots/video of the current four presets, custom theme, design view,
  QR view, title, content, and border combinations.
- Save paired visible-surface and downloaded-image baselines for representative
  mobile and desktop states before replacing the current exporter.
- Record current production bundle sizes and representative desktop/mobile frame
  rates.
- Save known-decodable QR screenshots as test fixtures.

Exit criteria:

- Naming and licensing have no release blocker.
- Visual and performance baselines exist before refactoring.

### Phase 1: Current configuration foundation

Tasks:

- Add the public types, defaults, parser, normalizer, codec, and typed errors.
- Add the design registry with the `tree` adapter entry.
- Separate `TreeTheme` from `SavedTreeTheme`.
- Add explicit title-color resolution to the theme resolver.
- Add strict current-schema decoding and invalid-payload fixtures.
- Add unit tests for normalization, malicious/malformed values, numeric clamps,
  custom-theme snapshots, and canonical round trips.

Exit criteria:

- Every current editor state normalizes to `DesignQRConfigV1`.
- Encoding then decoding produces the same normalized configuration.
- Current schema-v1 shared URLs open correctly.

### Phase 2: Extract the package and reusable player

Tasks:

- Add the root npm workspace and `packages/designqr` package.
- Move reusable QR, tree, theme, renderer, and player code into the package.
- Keep editor controls, saved-theme persistence, share UI, and platform routing in
  the web app.
- Scope all player CSS beneath a package-owned root class.
- Remove global body/background mutations from reusable code.
- Replace global DOM queries with refs owned by the mounted instance.
- Introduce one component-owned live presentation surface for the exportable
  artwork. The surface shown to the user must already contain the theme
  background and any visible QR border, title, and content; export-time code must
  not recreate those layers.
- Implement `DesignQRHandle.exportImage()` by snapshotting the current committed
  frame and current artwork bounds from that live surface.
- Implement controlled/uncontrolled view behavior.
- Add `DesignQRHandle` ref methods and public events.
- Implement responsive `ResizeObserver` behavior.
- Pause rendering while offscreen or document-hidden.
- Fully dispose scene resources on unmount.
- Handle reduced motion and WebGL errors.

Exit criteria:

- The editor imports and renders the workspace package.
- There is only one tree renderer implementation.
- Two DesignQR components render independently on the same page.
- Mount/unmount repetition leaves no running animation loop or additional canvas.
- The host page's body styles and history remain untouched.
- Exporting either view does not change player state and returns the exact current
  visible artwork without invoking QR generation or a second visual renderer.

### Phase 3: Add the hosted player — complete

Tasks:

- Add `/qr/embed` to `DesignPlatform` as a lazy route.
- Parse `config`, normalize it, and render the package component.
- Add invalid-config and WebGL-unavailable fallbacks.
- Add route-specific iframe headers.
- Add the versioned `postMessage` protocol.
- Route `designqr:export-image` through the package component's `exportImage()`
  handle and return the result with the matching request ID.
- Add a cross-origin iframe fixture on a different local origin.
- Add production/Wrangler header assertions.

Exit criteria:

- A different origin can embed `/qr/embed` and interact with the tree.
- The iframe can start in either `design` or `qr` view.
- The iframe emits ready, view-change, and error events.
- A parent can request and receive a PNG snapshot of the iframe's current visible
  artwork without changing its view or configuration.
- `/` and `/qr` remain protected from external framing.

All Phase 3 tasks and exit criteria are covered by
`scripts/smoke-designqr-embed.mjs`, the framework-neutral iframe consumer, and
the package protocol tests. Production-domain headers should still be checked
once the release is deployed.

### Phase 4: Migrate sharing and integration UI — in progress

Tasks:

- Update editor state to produce the canonical config.
- Serialize a complete custom theme snapshot.
- Update the Share modal with `Share link`, `Embed`, and `React` sections.
- Generate iframe code using the same helper exported by the package.
- Generate a `Simple` React snippet for the minimal equivalent configuration,
  an `Advanced` runnable package-only snippet containing the complete current
  component setup and exact optional logo without surrounding controls, state,
  callbacks, or error UI, and an additional advanced
  `Custom Theme` snippet that exposes the current full resolved parameter
  surface through `createTreeTheme()` alongside the complete current render
  configuration.
- Add copy/open feedback and an embedded preview where space allows.
- Replace the editor's current selector-based image compositor with the package
  `exportImage()` handle. The editor retains only filename selection, download
  triggering, and user feedback.
- Use the canonical codec for browser-history links.
- Rename remaining user-facing `Design QR` copy to `DesignQR` where it refers to
  the product name.

Exit criteria:

- Editor, direct link, iframe, and React fixture render the same normalized state.
- Custom themes, Pixel foliage, title, title color, content, border, padding,
  logo, transparency, rotation direction, transition speed, and initial view all
  match.
- The editor download, React export, and iframe export return the same pixels for
  the same current frame and artwork bounds.

The canonical editor adapter, versioned links, WYSIWYG editor download, and all
three Share modal views are implemented. Phase 4 remains open until the editor
uses the high-level public component and the cross-surface equivalence smoke
covers the full current editor configuration and pixel contract.

### Phase 5: Package hardening and publication

Tasks:

- Finalize Vite library and TypeScript declaration builds.
- Add package API reference, examples, and changelog; keep the README and MIT
  license current.
- Run `npm pack` and audit the tarball contents.
- Install the tarball into the external React fixture and verify that its
  `exportImage()` result matches the fixture's displayed presentation surface.
- Verify ESM, CJS, TypeScript, React Strict Mode, production build, and Node import.
- Add bundle-size reporting.
- Publish `designqr@0.1.0` only after the full root check passes.
- Pin the editor to the workspace package version used for the release.

Exit criteria:

```bash
npm install designqr
```

followed by `import { DesignQR } from 'designqr'` works in the documented consumer
without internal imports or manual asset copying, and the consumer can obtain a
WYSIWYG PNG through the documented component handle.

### Phase 6: Web Component and CDN build

Tasks:

- Implement `<design-qr>` against the same core/player contract.
- Add Shadow DOM style isolation and DOM custom events.
- Produce an ESM CDN artifact.
- Add plain HTML, Vue, Angular, and Svelte smoke examples.
- Document attribute versus property configuration.

Exit criteria:

- A plain HTML page can render the tree with no React application setup.
- Connecting and disconnecting the element does not leak a renderer.

## 14. Editor migration details

The existing `App` should become an editor/controller around `DesignQR`, not a
second player implementation.

Responsibilities that remain in the editor:

- URL input validation and debounce behavior.
- Preset and saved-theme selection.
- Theme creation/edit/delete UI and `localStorage` persistence.
- Share and export modals.
- View controls, turntable controls, and editor layout.
- Updating the editor's browser URL.

Responsibilities moved to the package:

- QR matrix generation.
- Tree-data generation.
- Theme rendering and title-color resolution.
- Three.js initialization and lifecycle.
- Design/QR transition.
- Canvas pointer interactions.
- Responsive sizing.
- The optional QR title/content/border presentation.
- Renderer errors and public lifecycle events.

The editor may keep a debounced `value`, but it passes that value and normalized
configuration into the package rather than constructing `TreeData` itself.

## 15. Renderer lifecycle requirements

The public component must be safe in long-running applications and route changes.

On mount:

- Create one renderer for the owned canvas.
- Apply the normalized configuration.
- Size from the component container.
- Start rendering only when visible.

On update:

- Rebuild QR/tree data only when `value`, design options, or QR-relevant settings
  change.
- Update theme without rebuilding QR data when possible.
- Update view target without reconstructing the renderer.
- Avoid restarting the animation loop for ordinary prop changes.

On pause:

- Cancel the animation frame.
- Preserve enough state to resume without rebuilding unless the WebGL context was
  lost.

On unmount:

- Cancel animation frames and observers.
- Remove any window/document listeners registered by the instance.
- Dispose geometries, materials, textures, render targets, and renderer state.
- Clear callbacks that could retain React state.
- Do not remove or modify DOM outside the component root.

Add development instrumentation or tests capable of detecting multiple active
loops for one instance.

## 16. Styling requirements

- Prefix package classes with `designqr-`.
- Scope resets to `.designqr-root`; do not style `html`, `body`, `button`, `input`,
  or `canvas` globally.
- Use namespaced component CSS variables for presentation customization.
- Paint the theme background, artwork, and optional QR details on the live
  presentation surface so displayed and exported pixels share one path.
- When `transparentBackground` is true, clear the presentation to alpha and
  omit only the full-stage gradient. With Border disabled, retain a theme-derived
  settled fill that exactly matches the QR matrix and leave any surrounding scan
  margin to the host or export destination. With Border enabled, fill the entire
  rounded details card, reserve four clear modules around the matrix before the
  configured decorative padding and frame, and place metadata after that margin.
- Avoid relying on the editor's font imports. Package output should use a documented
  system-font fallback unless the host loads the preferred fonts.
- Ensure the title remains derived from the theme.
- Keep visible-value type smaller than title type by default, and apply the
  bounded `details.titleScale` / `details.contentScale` multipliers to the
  responsive package-owned sizes across live playback and export.
- Use the same four-module metadata anchor and text width with Border enabled or
  disabled so decoration cannot change text wrapping or truncation.
- Ensure details and borders never cover the scannable module area.
- Test small, rectangular, portrait, square, and landscape containers.

Package-owned presentation variables:

| Variable | Default | Contract |
| --- | --- | --- |
| `--designqr-title-font-family` | `"Outfit"`, then system sans-serif | QR title font |
| `--designqr-body-font-family` | `"Plus Jakarta Sans"`, then system sans-serif | Visible QR value font |
| `--designqr-content-color` | `#3F352B` | Visible QR value color |
| `--designqr-border-color` | `rgba(95, 78, 61, 0.25)` | Detail frame and shadow |
| `--designqr-border-highlight-color` | `rgba(255, 255, 255, 0.45)` | Detail frame highlight |
| `--designqr-focus-color` | `#3F352B` | Keyboard focus ring |
| `--designqr-focus-contrast-color` | `#FFFFFF` | Focus contrast edge |

Canvas presentation overrides apply to the displayed surface and WYSIWYG
export. Focus variables apply only to browser focus UI. Background and title
colors remain resolved theme inputs, not a second CSS configuration source.

## 17. WYSIWYG image export

Image export is required in `0.1.0`. It must capture the current rendered artwork,
not construct an approximation from configuration in a separate export process.

### 17.1 Visual contract

- Capture the currently visible `design` or `qr` frame at the moment the export
  request is committed.
- Include the exact configured background state and artwork. Transparent mode
  must preserve PNG alpha outside the artwork and either the matrix-bounded QR
  fill or enabled Border card. In QR view, include the border, padding, title,
  and content only
  when they are currently visible.
- Exclude editor chrome such as the header, hints, text input, theme drawer,
  editor controls, and modals.
- Use the current artwork bounds and backing-store pixel ratio. Version `0.1.0`
  does not expose alternate themes, hidden details, view overrides, or a separate
  high-resolution re-render through export options.
- Never change the current view, animation progress, rotation, details state, or
  configuration in order to export.

### 17.2 One visible render source

- The reusable player owns one final presentation surface for exportable pixels.
  That final surface is also the surface displayed to the user.
- The normal display path must place the background, WebGL artwork, QR border,
  title, and content onto that live surface before export is requested.
- If an internal compositor is required, its output canvas must be the displayed
  presentation surface. It cannot be a hidden canvas created only for download.
- `exportImage()` waits for a fully committed frame and calls `toBlob()` on the
  live presentation surface or copies the already-displayed pixels within its
  current artwork bounds. It must not call QR generation, tree building, or a
  separate renderer.
- Remove export-only recreation of gradients, borders, typography, truncation,
  and decoration. In particular, export code must not use a second set of
  `fillText`, `roundRect`, or theme-painting rules to imitate the UI.
- Semantic HTML may mirror canvas title/content for accessibility, but it must not
  create a second visible version that can drift from the exported output.
- Every instance owns its surface and refs. Do not use generic
  `document.querySelector` calls or capture another mounted DesignQR instance.

### 17.3 Public behavior

```ts
interface DesignQRHandle {
  // Existing lifecycle/view methods...
  exportImage(): Promise<Blob>;
}
```

- The returned blob is `image/png` in `0.1.0`.
- The package never triggers a browser download automatically.
- The editor owns filename selection, the temporary object URL, the download
  anchor, and success/error feedback.
- The iframe helper sends `designqr:export-image` with a request ID and resolves
  with the same blob returned by the package component.
- Reject with typed `EXPORT_FAILED` when the frame is unavailable, the WebGL
  context is lost, the canvas is tainted, or PNG encoding fails.

### 17.4 Acceptance criteria

- At equal dimensions, the exported PNG and the displayed presentation surface
  are pixel-identical within the current artwork bounds.
- Toggling title, content, border, padding, or logo changes both UI and export
  together, with no export-specific code path.
- Toggling transparency while active, paused, hidden, or offscreen updates the
  visible surface and exported corner alpha without remounting the renderer.
- Export during either 3D or 2D mode captures that current mode without a hidden
  transition.
- Repeated export does not rebuild QR/tree data, start another animation loop, or
  alter frame rate after completion.
- Two mounted instances can export independently.
- Final QR-view PNGs decode successfully with an independent QR decoder.

## 18. Test strategy

### 18.1 Unit tests

- Defaults and explicit options.
- Preset and custom-theme resolution.
- Complete immutable preset roles and `createTreeTheme()` overrides.
- Clockwise/counterclockwise defaults and invalid-direction input.
- Pixel foliage normalization and morph visibility.
- Logo source, alternate-text, size, format, and canonical-length limits.
- Title-color resolution order.
- Design registry lookup.
- Unsupported design errors.
- Numeric clamping and color validation.
- Configuration encode/decode round trips.
- Transparent-background default, sparse true round trip, invalid input,
  matrix-fill geometry, conditional four-module Border geometry, and endpoint
  opacity.
- Unsupported share-payload fixtures.
- Message-envelope validation.

### 18.2 Component tests

- Controlled and uncontrolled view behavior.
- Prop updates without remounting the renderer.
- Opaque-to-transparent-to-opaque updates while running and paused, including
  zero-alpha corners and WYSIWYG PNG alpha.
- Logo load, replacement, removal, failure, and rapid-source changes.
- Ready, view-change, and error callbacks.
- Strict Mode mount/unmount behavior.
- Two simultaneous components.
- No body-style or browser-history mutation.
- ResizeObserver updates.
- Reduced motion commits view and background changes without an intermediate
  frame and disables automatic rotation and morph blur.
- Enter and Space toggle in controlled and uncontrolled mode only when
  tap-to-toggle is enabled; focus and cursor semantics match enabled actions.
- Package presentation roles use scoped defaults without host application
  tokens, and supported overrides affect both display and export.
- `exportImage()` snapshots the owning instance and does not invoke QR/tree
  generation or mutate view state.
- Two mounted instances export their own presentation surfaces.

### 18.3 Browser tests

- Editor route still mounts.
- Embed route mounts with a valid configuration.
- Malformed configuration renders a fallback without an uncaught error.
- A parent page on a different origin loads and communicates with the iframe.
- Editor routes reject framing while the embed route allows it.
- Design-to-QR transition and QR-to-design transition work.
- Pointer drag, tap, Enter/Space toggle, turntable, reset, focus-visible, and
  interaction-aware cursor behavior work.
- Automatic direction reverses without resetting yaw, and Pixel foliage uses a
  single QR-derived voxel set through both turn directions.
- A logo remains continuous at the 3D canopy, intermediate turn, QR center, and
  reverse turn; its dedicated panel remains within the fixed overlay geometry,
  and uploads above the former 5 MiB limit prepare below 1 MiB without breaking
  canonical sharing.
- Pixel-compare the displayed presentation surface with `exportImage()` for both
  views and every title/content/border combination.
- Request an iframe export cross-origin and verify the request ID, MIME type,
  result pixels, and unchanged iframe state.
- Verify transparent iframe document styles, parent-background visibility,
  zero-alpha canvas/PNG corners, and live `setConfig()` propagation.
- Offscreen and hidden instances pause and resume.
- Reduced-motion browser coverage observes only settled view and background
  endpoints.
- WebGL context-loss fallback appears correctly.

### 18.4 QR reliability tests

- Capture final QR-view exports for representative payload lengths.
- Decode exported PNGs with an independent QR decoder.
- Cover each preset, custom themes, title/content combinations, border settings,
  logos at `0.08`, `0.16`, and `0.20`, and mobile/desktop sizes.
- Decode transparent outputs after compositing them over a representative
  uniform light host background. With Border disabled, verify the local fill
  exactly matches the QR matrix. With Border enabled, verify the filled card
  provides four clear modules before its decorative padding, frame, and
  metadata. Dark or patterned borderless hosts must provide their own suitable
  light margin if scanning is required.
- Never count matrix-generation unit tests alone as proof that the final rendered
  image scans.

### 18.5 Package consumer tests

- Build a Vite React consumer from the packed tarball.
- Type-check public props and ref methods.
- Verify ESM and CJS exports.
- Verify package import in Node does not evaluate browser globals.
- Verify CSS is exported and contains no global host-page reset.
- Verify the packed consumer renders presentation defaults without editor
  tokens or internal-selector overrides.
- Audit tarball contents and install size.

### 18.6 Performance checks

- Record startup time to `ready`.
- Record frame rate for one and multiple visible instances.
- Record memory before and after repeated mount/unmount cycles.
- Verify repeated exports do not create additional renderers, animation loops, or
  persistent canvases and do not cause sustained memory growth.
- Track application and package bundle sizes in CI output.
- Test a representative low-power mobile profile.
- Keep the renderer pixel-ratio cap fixed and consistent across package and
  hosted players.

## 19. Security and privacy checklist

- Keep the editor non-frameable.
- Allow framing only on the hosted player path.
- Validate all query configuration before rendering.
- Validate all `postMessage` data and origins.
- Do not use `dangerouslySetInnerHTML` for titles or encoded values.
- Do not load configuration-provided scripts, models, CSS, fonts, or arbitrary
  media. The only media exception is a validated PNG, JPEG, or WebP logo from a
  data URL, same-origin path, or HTTPS URL; remote responses must pass CORS,
  MIME, byte-size, and dimension checks.
- Do not treat base64url configuration as secret.
- Keep camera, microphone, and geolocation disabled.
- Use `noopener` and `noreferrer` for any link opened by integration UI.
- Avoid analytics that transmit encoded QR values by default.
- Document any future short-link storage retention policy before enabling it.

## 20. Release and rollout

1. Land schema and validation tests without changing visuals.
2. Land the workspace package and migrate the editor to it.
3. Run the editor against the workspace package for at least one release cycle.
4. Enable `/qr/embed` and validate headers on the deployed domain.
5. Add integration snippets to the Share modal.
6. Pack and test the package in the external fixture.
7. Publish `designqr@0.1.0`.
8. Add the Web Component only after the configuration and event API have proven
   stable.

Use semantic versioning after publication:

- Patch: fixes with no public behavior or type break.
- Minor: optional props, events, presets, or new design types.
- Major: configuration, prop, event, or serialization incompatibility.

Every new design type must add a new design-registry adapter and configuration
union member. It must not alter the meaning of `design="tree"`.

## 21. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Editor and package output drift | Editor must consume the package component. |
| Future designs make the API tree-specific | Keep `design` discriminated and tree options nested. |
| Host application styles break | Scope CSS and eliminate global body/document changes. |
| WebGL resources leak in SPAs | Full disposal, visibility pause, and repeated mount tests. |
| Package import breaks SSR | No browser globals at module scope; initialize in effects. |
| Custom themes disappear in embeds | Serialize the complete renderer theme snapshot. |
| Title no longer matches theme | Resolve title color inside the theme resolver. |
| Public embed weakens editor security | Detach/replace framing headers only on `/qr/embed*`. |
| Encoded URL becomes too long | Enforce a limit; introduce a short-ID API later. |
| Visual QR is not scannable | Decode final browser screenshots in automation. |
| Bundle is too large | Measure, lazy-load designs, and revisit Three.js externalization. |
| `postMessage` is spoofed | Exact origins, source checks, versioned schema validation. |

## 22. Deferred short-ID service

Only add a backend when one or more of these conditions is true:

- Custom configuration regularly exceeds the agreed URL-length limit.
- Users need editable, revocable, or private designs.
- Analytics must identify a design independently from its QR destination.
- Product requirements need stable short embed URLs.

Possible later contract:

```http
POST /api/designs
Content-Type: application/json

{ "config": { ...DesignQRConfigV1 } }
```

```json
{
  "id": "dqr_...",
  "embedUrl": "https://design.johnson7543.com/qr/embed/dqr_..."
}
```

Before adding it, decide authentication, ownership, expiration, abuse limits,
storage, deletion, privacy, and configuration migration. Do not create a stateful
API merely to imitate another QR product's URL format.

## 23. Open decisions

The package license is resolved as MIT. These remaining decisions do not block
schema and extraction work unless noted:

1. Whether to publish unscoped as `designqr` or create an owned npm scope.
2. Whether public iframe embedding should allow every origin or support optional
   saved-design allowlists later.
3. The verified minimum React version for peer dependencies.
4. Whether Three.js remains a direct dependency or is externalized as a peer after
   bundle and consumer testing.
5. The adoption threshold for a short-ID service; schema-v1 links currently
   enforce a 16,384-character encoded limit.

Recommended defaults are: unscoped `designqr`, public iframe embedding, React 18+
after verification, Three.js as a direct dependency initially, public WYSIWYG PNG
export in the first integration release, and no short-ID backend in version 0.1.

## 24. Definition of done

The integration project is complete when all of the following are true:

- `DesignQR` is the consistent product and public component name.
- `design="tree"` works and remains the documented explicit design parameter.
- The existing editor uses the same package component delivered to consumers.
- Preset and custom themes render identically across editor, link, iframe, and
  React usage.
- The title follows the resolved theme.
- The border, title, content, optional logo, initial view, Pixel foliage, and
  clockwise/counterclockwise interactions serialize correctly.
- A third-party origin can embed `/qr/embed`.
- `/` and `/qr` cannot be externally framed.
- An external fixture can install the packed package and render DesignQR.
- Multiple instances do not conflict or mutate host-page globals.
- Renderer mount/unmount and visibility transitions do not leak animation loops or
  WebGL resources.
- React, iframe, and editor exports snapshot the same live presentation surface;
  exported pixels match the current UI without an export-only visual renderer.
- Final QR-view screenshots decode in automated tests.
- Existing platform navigation and production smoke tests remain green.
- Package API, configuration schema, iframe markup, events, limitations, browser
  support, and migration policy are documented.
