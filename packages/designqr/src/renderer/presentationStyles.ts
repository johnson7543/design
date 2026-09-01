export interface DesignQRPresentationStyles {
  titleFontFamily: string;
  bodyFontFamily: string;
  contentColor: string;
  borderColor: string;
  borderHighlightColor: string;
}

export interface CSSCustomPropertyReader {
  getPropertyValue(property: string): string;
}

export const DESIGN_QR_PRESENTATION_STYLE_PROPERTIES = Object.freeze({
  titleFontFamily: '--designqr-title-font-family',
  bodyFontFamily: '--designqr-body-font-family',
  contentColor: '--designqr-content-color',
  borderColor: '--designqr-border-color',
  borderHighlightColor: '--designqr-border-highlight-color',
} as const);

export const DESIGN_QR_PRESENTATION_STYLE_DEFAULTS = Object.freeze({
  titleFontFamily:
    '"Outfit", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  bodyFontFamily:
    '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  contentColor: '#3F352B',
  borderColor: 'rgba(95, 78, 61, 0.25)',
  borderHighlightColor: 'rgba(255, 255, 255, 0.45)',
} as const satisfies DesignQRPresentationStyles);

export function resolveDesignQRPresentationStyles(
  style: CSSCustomPropertyReader
): DesignQRPresentationStyles {
  const read = (
    property: string,
    fallback: string
  ): string => style.getPropertyValue(property).trim() || fallback;

  return {
    titleFontFamily: read(
      DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.titleFontFamily,
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.titleFontFamily
    ),
    bodyFontFamily: read(
      DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.bodyFontFamily,
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.bodyFontFamily
    ),
    contentColor: read(
      DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.contentColor,
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.contentColor
    ),
    borderColor: read(
      DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.borderColor,
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.borderColor
    ),
    borderHighlightColor: read(
      DESIGN_QR_PRESENTATION_STYLE_PROPERTIES.borderHighlightColor,
      DESIGN_QR_PRESENTATION_STYLE_DEFAULTS.borderHighlightColor
    ),
  };
}
