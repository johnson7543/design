import { createRef } from 'react';

import {
  connectDesignQREmbed,
  createDesignQREmbedUrl,
  createDesignQRIframeMarkup,
  createTreeTheme,
  DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
  DESIGN_QR_DETAIL_FONT_SCALE_MAX,
  DESIGN_QR_DETAIL_FONT_SCALE_MIN,
  DesignQR,
  TREE_THEME_PRESETS,
  VIEW_TRANSITION_SPEED_DEFAULT,
  VIEW_TRANSITION_SPEED_MAX,
  VIEW_TRANSITION_SPEED_MIN,
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
    titleScale: 1.1,
    showValue: true,
    contentScale: 0.85,
    border: { padding: 16 },
  },
  interaction: {
    dragToRotate: true,
    tapToToggleView: true,
    autoRotate: false,
    autoRotateDirection: 'clockwise',
    transitionSpeed: 1.5,
    motionBlur: true,
  },
  logo: {
    src: '/logo.webp',
    alt: 'Logo',
    size: 0.16,
  },
  transparentBackground: true,
} satisfies DesignQRProps;

export const transitionSpeedRange = {
  min: VIEW_TRANSITION_SPEED_MIN,
  default: VIEW_TRANSITION_SPEED_DEFAULT,
  max: VIEW_TRANSITION_SPEED_MAX,
};

export const detailFontScaleRange = {
  min: DESIGN_QR_DETAIL_FONT_SCALE_MIN,
  default: DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
  max: DESIGN_QR_DETAIL_FONT_SCALE_MAX,
};

export const customTreeTheme = createTreeTheme('summer', {
  foliageShape: 'pixel',
  groundFeature: 'pixel',
  titleColor: TREE_THEME_PRESETS.summer.titleColor,
});

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
