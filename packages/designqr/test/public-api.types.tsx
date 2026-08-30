import { createRef } from 'react';

import {
  connectDesignQREmbed,
  createDesignQREmbedUrl,
  createDesignQRIframeMarkup,
  DesignQR,
  type DesignQRHandle,
  type DesignQRProps,
} from '../src/index.ts';

export const designQRHandle = createRef<DesignQRHandle>();

export const designQRProps = {
  value: 'https://example.com',
  design: 'tree',
  theme: 'spring',
  tree: { shape: 'dome', seed: 0.5 },
  defaultView: 'design',
  details: {
    title: 'Visit our website',
    showValue: true,
    border: { padding: 16 },
  },
  interaction: {
    dragToRotate: true,
    tapToToggleView: true,
    autoRotate: false,
    motionBlur: true,
  },
  quality: 'high',
} satisfies DesignQRProps;

export const designQRConsumerFixture = (
  <DesignQR ref={designQRHandle} {...designQRProps} />
);

export const designQREmbedSource = createDesignQREmbedUrl({
  value: 'https://example.com',
});

export const designQREmbedMarkup = createDesignQRIframeMarkup(
  designQREmbedSource
);

export function connectDesignQRFrame(frame: HTMLIFrameElement) {
  return connectDesignQREmbed(frame, {
    onViewChange(view) {
      const currentView: 'design' | 'qr' = view;
      void currentView;
    },
  });
}
