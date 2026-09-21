# DesignQR release notes

[Back to the Design QR documentation index](README.md)

## 0.2.1 — planned

Status: Draft launch copy for the confirmed three-city release. Qualification
and publication remain pending; follow the [City release plan](city-release-plan.md).
The `0.2.1` target is a deliberate pre-1.0 version choice. This release includes
new City functionality as well as fixes.

Existing component props and ref signatures remain unchanged. The public preset
union adds `dotonbori` and `tokyo-tower`, and the package exports `CITY_PRESETS`,
`isCityPreset`, `DesignQRCityPreset` and `DesignQRTreePreset`. Consumers maintaining
exhaustive preset mappings should add the new cases. Existing Tree and default
Shibuya configurations remain the compatibility baseline for qualification.

- **道頓堀:** the bridge-centered night miniature adds its diagonal canal,
  detailed storefronts and signs, Donki wheel, boat and street activity. Complete
  surfaces transform together into the QR; its default turn uses the slower
  approximately 0.99-second pace.
- **Startup loading:** City implementations and models load only for the selected
  preset. Package-owned static ESM JavaScript falls from about 1.12 MB to
  46.7 kB gzipped in the matched candidate review; React/Three.js and deferred
  assets are excluded. QR rendering and export remain available if a City
  implementation fails to download.
- **道頓堀 memory:** shared surface motion data reduces transformation storage by
  about 55% in the 29×29 review, preserving all modeled detail and artwork.
- **東京タワー:** an illuminated tower miniature adds detailed lattice, decks,
  Foot Town and plaza, with complete geometry transforming into the QR.
- **渋谷:** the morning-blue City continues with refined buildings, station,
  landmark and sign detail, and QR-content-driven variation.
- **Personalization and delivery:** all three presets support uploaded logos,
  3D/QR playback, sharing, hosted embeds and PNG export. Dōtonbori fits uploads
  near the top of its Asahi panel with contrasting backing for dark/light art.
- **Japanese names:** editor and accessible City labels use 渋谷, 道頓堀 and
  東京タワー; configuration identifiers stay unchanged.

```tsx
import { DesignQR } from 'designqr';

<DesignQR value="https://example.com" design="city" theme="shibuya" />;
<DesignQR value="https://example.com" design="city" theme="dotonbori" />;
<DesignQR value="https://example.com" design="city" theme="tokyo-tower" />;
```

The City designs are source-directed miniatures with documented artistic
composition and evidence limits. Final notes must match the accepted artifact
and device results.

## 0.2.0

Published baseline: npm `latest` verified as `0.2.0` on 2026-09-21. The matching
repository tag contains Tree and Shibuya; the two additional City presets belong
to the planned release above.

- **Shibuya City:** select `design="city"` for animated city artwork that turns
  into a QR code. Shibuya includes its morning-blue palette, buildings,
  pedestrians, traffic, railway, and station landmarks.
- **Automatic styles:** importing `DesignQR` loads its core styles. Explicit
  stylesheet imports and host CSS overrides remain available.
- **Viewing zoom:** optional pinch, wheel, and keyboard zoom, with ref controls
  and scale-change callbacks. PNG exports retain the original framing.
- **Content-driven artwork:** QR content determines procedural variation, and
  live City content updates preserve the running animation.
- **QR presentation:** Border enables the filled four-module margin. Logos,
  metadata, transparency, and PNG export work with both designs.
- **Package guide:** installation and prop examples lead the README; controlled
  state, styling, refs, errors, and custom Tree themes are grouped as advanced
  usage. City does not yet support custom themes.

```tsx
import { DesignQR } from 'designqr';

<DesignQR value="https://github.com/johnson7543/design" design="city" />
```

The package includes its City artwork and third-party license notice. No
separate model downloads or asset-copying setup is needed by consumers.
