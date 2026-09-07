# DesignQR release notes

[Back to the Design QR documentation index](README.md)

## 0.2.0

Status: Prepared for release; npm publication is a separate step.

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
