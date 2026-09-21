# Package architecture

Status: Active maintenance reference<br>
Scope: Package boundaries, canonical configuration, rendering lifecycle, and hosted integration

[Back to package documentation](README.md)

## Ownership and entry points

The editor, hosted player, and external React consumers share package rendering.
The editor owns input controls, saved-theme metadata, browser URL updates,
logo preparation, and sharing UI. The package owns QR generation, artwork,
canvas interaction, presentation, and PNG export.

| Boundary | Executable source | Maintenance rule |
| --- | --- | --- |
| Public React player | [`DesignQR.tsx`](../../packages/designqr/src/react/DesignQR.tsx), [`react/types.ts`](../../packages/designqr/src/react/types.ts) | Preserve controlled/uncontrolled views, instance isolation, callbacks, and ref methods |
| Canonical configuration | [`config/`](../../packages/designqr/src/config/) | Normalize all integration inputs through the same schema and defaults |
| Design adapters | [`designs/registry.ts`](../../packages/designqr/src/designs/registry.ts) | Tree and City use registered adapters; design-specific options stay nested |
| Canvas lifecycle | [`DesignQRCanvas.tsx`](../../packages/designqr/src/react/DesignQRCanvas.tsx) | Own sizing, visibility, gestures, reduced motion, and renderer cleanup |
| Renderer and presentation | [`RenderManager.ts`](../../packages/designqr/src/renderer/RenderManager.ts), [`PresentationSurface.ts`](../../packages/designqr/src/renderer/PresentationSurface.ts) | Keep one shared artwork and export pipeline |
| Hosted iframe | [`DesignQREmbedRoute.tsx`](../../src/routes/DesignQREmbedRoute.tsx), [`embed/`](../../packages/designqr/src/embed/) | Consume canonical config and the public player, without editor controls |
| Editor integration | [`editor.ts`](../../packages/designqr/src/editor.ts), [`vite.config.ts`](../../vite.config.ts) | `designqr/editor` is a workspace alias, not a published package subpath |

The published export map is authoritative in
[`package.json`](../../packages/designqr/package.json): `designqr`,
`designqr/config`, `designqr/embed`, and `designqr/style.css`. Installation and
prop examples belong in the [public package README](../../packages/designqr/README.md).
Keep ESM/CJS imports safe without browser globals; initialize canvas resources
only when mounted in a browser. React is a peer dependency; Three.js and QR
encoding are package dependencies.

## Canonical configuration

The flow is input → normalization → registered design adapter → generated
artwork data → shared renderer and presentation surface. The editor currently
uses the package's internal canvas entry; do not assume it mounts the public
React wrapper or introduce a second renderer during a future migration.

[`normalize.ts`](../../packages/designqr/src/config/normalize.ts) defines accepted
inputs and typed errors. [`codec.ts`](../../packages/designqr/src/config/codec.ts)
normalizes before encoding schema-v1 JSON as base64url and validates decoded
payloads. Base64url is transport encoding, not encryption.

- Preserve rejection of unsupported schemas, unknown canonical fields, and
  unsupported design values. Route boundaries render stable errors instead of
  retaining stale artwork.
- Keep complete resolved visual themes separate from editor metadata such as
  saved-theme IDs and labels. Serialize public visual roles only.
- Share links, hosted URLs, and generated React examples derive from the same
  normalized editor snapshot. Never truncate configuration to make a link fit.
- Keep default serialization stable: false optional transparency is omitted;
  enabled transparency is encoded. Test defaults and canonical round trips
  before changing schema behavior.
- Limits and defaults belong in
  [`defaults.ts`](../../packages/designqr/src/config/defaults.ts), with validation
  in the normalizer and renderer. A valid configuration must also fit the
  supported interactive QR matrix; the renderer checks that separately.
- Treat configured titles and QR values as data. Logo loading accepts validated
  raster sources with protocol, MIME, CORS, size, and dimension checks; it must
  not enable configuration-provided scripts, styles, fonts, or models.

## Lifecycle and export

Each mounted instance owns its renderer, observers, input listeners, callbacks,
and presentation surface. Ordinary view or configuration updates must not
start duplicate animation loops. Pause preserves state for resumption; teardown
cancels work and disposes owned GPU resources without affecting other instances.
Shared asset caches and per-instance resources have distinct lifetimes.

Use container dimensions, visibility, and document state to govern rendering.
Reduced motion settles view/background changes directly. Pending asynchronous
asset or logo work must not mutate a disposed instance or supersede newer input.
Current content-update guarantees are specified in the
[rendering principles](style-principles.md) and [City contracts](cities/README.md).

`exportImage()` returns the package-owned presentation as a PNG `Blob`; it does
not trigger a download. The editor or host owns filename selection, object URLs,
and download actions. Export includes artwork, configured background, logo,
and visible details, while excluding editor chrome. Unavailable or failed
frames produce typed export errors.

Unzoomed output matches the visible presentation. Viewing zoom is the documented
exception: export captures the canonical 100% framing with the same renderer,
then restores the preview without advancing animation. Preserve the
[zoom and export contract](style-principles.md#view-only-zoom). Do not introduce
an offscreen replica, DOM screenshot, or independent export renderer.

## Hosted iframe protocol

[`protocol.ts`](../../packages/designqr/src/embed/protocol.ts) owns the message
schema and limits; [`controller.ts`](../../packages/designqr/src/embed/controller.ts)
owns the parent helper. Protocol v1 uses `source`, `protocolVersion`,
`instanceId`, a typed command/event, and its validated payload.

- The parent targets the exact hosted-player origin. The child accepts commands
  only from its parent and validates envelopes and payloads.
- Only the connection handshake accepts the wildcard instance sentinel. After
  readiness, commands address the concrete player instance.
- Export requests and responses correlate by `requestId`; successful responses
  contain a PNG `Blob`, with the protocol's size limit enforced by the parent.
- Unknown versions and message types do not invoke renderer behavior. Keep
  renderer internals outside the protocol.
- Standalone iframe playback works from its URL without a controller. Protocol
  export calls the same player export used by React consumers.

[`public/_headers`](../../public/_headers) separates frameable `/qr/embed` from
the editor and home page. Preserve route-specific framing, no-referrer, and
restricted device permissions. Verify actual Wrangler-served headers with the
embed smoke test; Vite preview alone does not verify deployment headers.

## Styling and asset boundaries

Package stylesheet loading, host overrides, nonce support, focus behavior, and
SSR constraints follow the [stylesheet contract](style-principles.md#package-stylesheet-loading).
Editor tokens must not become a required consumer dependency.

City source provenance, regeneration, and accuracy limits live with
[each city](cities/README.md). Ordinary package builds consume generated assets.
When changing generators or documented input locations, update dependent
provenance and verify geometry separately from metadata.
