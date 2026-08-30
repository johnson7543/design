# DesignQR

Reusable React player for the interactive DesignQR tree and its scannable QR view.

```tsx
import { DesignQR } from 'designqr';
import 'designqr/style.css';

export function Example() {
  return <DesignQR value="https://example.com" />;
}
```

The component is a responsive 1:1 square by default. Customize it directly with
the component's `style` prop (or `className` for stylesheet-driven overrides);
no sizing wrapper is required. Use its ref for `setView`, `resetRotation`,
`pause`, `resume`, and WYSIWYG `exportImage` actions.

See the repository's `examples/react-vite-consumer` fixture for controlled and
uncontrolled views, multiple independent instances, and mount/unmount usage.

## Hosted iframe

Use the framework-neutral embed helpers when the host cannot mount React:

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

const copyReadyHtml = createDesignQRIframeMarkup(frame.src);

const player = connectDesignQREmbed(frame, {
  onReady: ({ view }) => console.log('ready', view),
  onViewChange: (view) => console.log(view),
  onError: (error) => console.error(error),
});

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

The helper uses the hosted player at
`https://design.johnson7543.com/qr/embed` by default. Pass `{ origin }` to use a
local or self-hosted player. `allow-same-origin` preserves the iframe's real
origin so the controller can validate every message with an exact origin; the
frame remains cross-origin from a third-party host.

The encoded URL is transport, not encryption: anyone with the URL can read its
QR value and theme configuration. Protocol v1 validates the source window,
origin, instance ID, command payload, export request ID, PNG MIME type, and a
16 MiB response limit. `exportImage()` snapshots the same live canvas visible in
the iframe and does not switch its view.

## License

DesignQR is available under the [MIT License](LICENSE).
