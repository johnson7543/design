import { useRef, useState } from 'react';
import {
  createTreeTheme,
  DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT,
  DESIGN_QR_DETAIL_FONT_SCALE_MAX,
  DESIGN_QR_DETAIL_FONT_SCALE_MIN,
  DESIGN_QR_DETAIL_FONT_SCALE_STEP,
  DESIGN_QR_MAX_TITLE_CHARACTERS,
  DESIGN_QR_MAX_VALUE_BYTES,
  DesignQR,
  type DesignQRError,
  type DesignQRHandle,
  type DesignQRLogoOptions,
} from 'designqr';
import {
  CUSTOMIZED_DEFAULT_THEME,
  FULL_PARAMETER_THEME,
} from './theme-examples';

const GREEN_LOGO: Required<DesignQRLogoOptions> = {
  src: '/fixture-logo.png',
  alt: 'Same-origin path fixture logo',
  size: 0.16,
};

const PINK_LOGO: Required<DesignQRLogoOptions> = {
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAALElEQVR4AZXBMQEAIAzAsK7+5eADM/xMQ5N5534CiSSSSCKJJJJIIokkkmgBCJcDjpdLh5wAAAAASUVORK5CYII=',
  alt: 'Pink fixture logo',
  size: 0.12,
};

const OVER_CAPACITY_VALUE = 'a'.repeat(1_274);
const DEFAULT_PRIMARY_TITLE = 'Primary DesignQR';
const DEFAULT_PRIMARY_VALUE = 'https://example.com/primary';
const LONG_PRIMARY_TITLE =
  'Primary DesignQR title intentionally extended beyond the forty-character package limit';
const LONG_PRIMARY_VALUE =
  '12345678901234567890123456789012345678901234567890123456789012345678901234567890';

type LogoMode = 'green' | 'pink' | 'none' | 'cors-failure';

const SCAN_TEST_THEME = createTreeTheme('spring', {
  foliageColor: '#000000',
  foliageHighlightColor: '#000000',
  foliageShadowColor: '#000000',
  foliageMidtoneColor: '#000000',
  foliagePaletteColors: [
    '#000000',
    '#000000',
    '#000000',
    '#000000',
    '#000000',
  ],
  foliageColorVariation: 0,
  qrFoliageColor: '#000000',
  qrFoliageHighlightColor: '#000000',
  qrFoliageShadowColor: '#000000',
  qrFoliageMidtoneColor: '#000000',
  qrFoliagePaletteColors: [
    '#000000',
    '#000000',
    '#000000',
    '#000000',
  ],
  qrFoliageColorVariation: 0,
  groundColor: '#FFFFFF',
  groundShadowColor: '#FFFFFF',
  groundSurfaceColor: '#FFFFFF',
  groundSurfaceShadowColor: '#FFFFFF',
  groundSurfaceVariation: 0,
  groundSurfaceShadowVariation: 0,
  pedestalColor: '#FFFFFF',
  groundFeature: 'none',
  qrFinderColor: '#000000',
  qrFinderHighlightColor: '#000000',
  qrFinderShadowColor: '#000000',
  qrFinderEyeColor: '#000000',
  qrFinderPaletteColors: [
    '#000000',
    '#000000',
    '#000000',
    '#000000',
  ],
  qrFinderColorVariation: 0,
  skyTop: '#FFFFFF',
  skyBottom: '#FFFFFF',
  titleColor: '#000000',
  particleType: 'none',
  particleAmount: 0,
  groundLeavesAmount: 0,
  weatherType: 'none',
  weatherAmount: 0,
  ambientParticleType: 'none',
  ambientParticleAmount: 0,
  snowflakeAmount: 0,
});

export function ConsumerFixture() {
  const primaryRef = useRef<DesignQRHandle>(null);
  const primaryHostRef = useRef<HTMLElement>(null);
  const [primaryView, setPrimaryView] = useState<'design' | 'qr'>('design');
  const [showSecondary, setShowSecondary] = useState(true);
  const [readyCount, setReadyCount] = useState(0);
  const [failureReadyCount, setFailureReadyCount] = useState(0);
  const [failureErrorCode, setFailureErrorCode] = useState('');
  const [exportStatus, setExportStatus] = useState('idle');
  const [logoMode, setLogoMode] = useState<LogoMode>('green');
  const [logoError, setLogoError] = useState('');
  const [logoSize, setLogoSize] = useState(0.16);
  const [primaryTitle, setPrimaryTitle] = useState(DEFAULT_PRIMARY_TITLE);
  const [primaryValue, setPrimaryValue] = useState(DEFAULT_PRIMARY_VALUE);
  const [titleEnabled, setTitleEnabled] = useState(true);
  const [titleScale, setTitleScale] = useState(
    DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT
  );
  const [contentEnabled, setContentEnabled] = useState(true);
  const [contentScale, setContentScale] = useState(
    DESIGN_QR_DETAIL_FONT_SCALE_DEFAULT
  );
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [borderEnabled, setBorderEnabled] = useState(true);
  const [primaryPaused, setPrimaryPaused] = useState(false);
  const [exportCornerAlpha, setExportCornerAlpha] = useState<number | null>(null);
  const scanTestMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('scan-test');

  const logo: false | Required<DesignQRLogoOptions> = logoMode === 'none'
    ? false
    : logoMode === 'pink'
      ? { ...PINK_LOGO, size: logoSize }
      : logoMode === 'cors-failure'
        ? {
            src: 'https://designqr-cors.invalid/logo.png',
            alt: 'CORS failure fixture logo',
            size: logoSize,
          }
        : { ...GREEN_LOGO, size: logoSize };
  const primaryTitleLength = Array.from(primaryTitle).length;
  const primaryValueByteLength = new TextEncoder().encode(primaryValue).length;

  const selectLogoMode = (mode: LogoMode) => {
    setLogoError('');
    setLogoMode(mode);
  };

  const replaceLogoRapidly = () => {
    selectLogoMode('pink');
    window.setTimeout(() => selectLogoMode('green'), 0);
  };

  const setPrimaryDetails = (title: string, value: string) => {
    setLogoError('');
    setExportStatus('idle');
    setPrimaryTitle(title);
    setPrimaryValue(value);
  };

  const handlePrimaryError = (error: DesignQRError) => {
    setLogoError(error.code);
  };

  const verifyExport = async () => {
    const handle = primaryRef.current;
    const canvas = primaryHostRef.current?.querySelector<HTMLCanvasElement>(
      '.designqr-presentation-canvas'
    );
    if (!handle || !canvas) {
      setExportStatus('not-ready');
      return;
    }

    handle.pause();
    try {
      const exported = await handle.exportImage();
      const displayed = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('The fixture canvas could not encode PNG.'));
        }, 'image/png');
      });
      const [exportedBytes, displayedBytes] = await Promise.all([
        exported.arrayBuffer(),
        displayed.arrayBuffer(),
      ]);
      const exportedView = new Uint8Array(exportedBytes);
      const displayedView = new Uint8Array(displayedBytes);
      const matches = exported.type === 'image/png'
        && exportedView.length === displayedView.length
        && exportedView.every((byte, index) => byte === displayedView[index]);
      const bitmap = await createImageBitmap(exported);
      const scratch = document.createElement('canvas');
      scratch.width = bitmap.width;
      scratch.height = bitmap.height;
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
      if (!scratchContext) throw new Error('The exported PNG context is unavailable.');
      scratchContext.drawImage(bitmap, 0, 0);
      bitmap.close();
      setExportCornerAlpha(scratchContext.getImageData(0, 0, 1, 1).data[3]);
      setExportStatus(matches ? 'matched' : 'mismatch');
    } catch {
      setExportStatus('failed');
    } finally {
      handle.resume();
    }
  };

  return (
    <main
      className="consumer-shell"
      data-ready-count={readyCount}
      data-failure-ready-count={failureReadyCount}
      data-failure-error-code={failureErrorCode}
      data-export-status={exportStatus}
      data-logo-mode={logoMode}
      data-logo-error={logoError}
      data-logo-size={logoSize}
      data-title-enabled={titleEnabled}
      data-title-scale={titleScale}
      data-content-enabled={contentEnabled}
      data-content-scale={contentScale}
      data-primary-title-length={primaryTitleLength}
      data-primary-value-byte-length={primaryValueByteLength}
      data-transparent-background={transparentBackground}
      data-border-enabled={borderEnabled}
      data-primary-paused={primaryPaused}
      data-export-corner-alpha={exportCornerAlpha ?? ''}
    >
      <h1>DesignQR package fixture</h1>
      <div className="consumer-actions">
        <button
          type="button"
          onClick={() => primaryRef.current?.setView(
            primaryView === 'design' ? 'qr' : 'design'
          )}
        >
          Toggle primary view
        </button>
        <button type="button" onClick={() => primaryRef.current?.resetRotation()}>
          Reset primary rotation
        </button>
        <button type="button" onClick={() => setShowSecondary((visible) => !visible)}>
          Mount or unmount secondary
        </button>
        <button type="button" data-action="verify-export" onClick={() => void verifyExport()}>
          Verify primary export
        </button>
        <button type="button" data-action="logo-none" onClick={() => selectLogoMode('none')}>
          Remove primary logo
        </button>
        <button type="button" data-action="logo-pink" onClick={() => selectLogoMode('pink')}>
          Use pink primary logo
        </button>
        <button type="button" data-action="logo-rapid" onClick={replaceLogoRapidly}>
          Replace primary logo rapidly
        </button>
        <button
          type="button"
          data-action="logo-cors-failure"
          onClick={() => selectLogoMode('cors-failure')}
        >
          Use blocked primary logo
        </button>
        <button type="button" data-action="logo-green" onClick={() => selectLogoMode('green')}>
          Restore green primary logo
        </button>
        <button type="button" data-action="logo-size-min" onClick={() => setLogoSize(0.08)}>
          Use minimum logo size
        </button>
        <button type="button" data-action="logo-size-default" onClick={() => setLogoSize(0.16)}>
          Use default logo size
        </button>
        <button type="button" data-action="logo-size-max" onClick={() => setLogoSize(0.2)}>
          Use maximum logo size
        </button>
        <button
          type="button"
          data-action="pause-primary"
          onClick={() => {
            primaryRef.current?.pause();
            setPrimaryPaused(true);
          }}
        >
          Pause primary
        </button>
        <button
          type="button"
          data-action="resume-primary"
          onClick={() => {
            primaryRef.current?.resume();
            setPrimaryPaused(false);
          }}
        >
          Resume primary
        </button>
        <button
          type="button"
          data-action="toggle-transparent"
          onClick={() => setTransparentBackground((transparent) => !transparent)}
        >
          Toggle transparent background
        </button>
        <button
          type="button"
          data-action="toggle-border"
          aria-pressed={borderEnabled}
          onClick={() => setBorderEnabled((enabled) => !enabled)}
        >
          {borderEnabled ? 'Disable primary border' : 'Enable primary border'}
        </button>
        <button
          type="button"
          data-action="toggle-title"
          aria-pressed={titleEnabled}
          onClick={() => setTitleEnabled((enabled) => !enabled)}
        >
          {titleEnabled ? 'Hide primary title' : 'Show primary title'}
        </button>
        <button
          type="button"
          data-action="toggle-content"
          aria-pressed={contentEnabled}
          onClick={() => setContentEnabled((enabled) => !enabled)}
        >
          {contentEnabled ? 'Hide primary content' : 'Show primary content'}
        </button>
        <button
          type="button"
          data-action="details-long"
          onClick={() => setPrimaryDetails(LONG_PRIMARY_TITLE, LONG_PRIMARY_VALUE)}
        >
          Use long title and content
        </button>
        <button
          type="button"
          data-action="details-reset"
          onClick={() => setPrimaryDetails(DEFAULT_PRIMARY_TITLE, DEFAULT_PRIMARY_VALUE)}
        >
          Reset title and content
        </button>
      </div>

      <div className="consumer-detail-fields" aria-label="Primary details test controls">
        <div className="consumer-detail-field">
          <label htmlFor="primary-title">Primary title</label>
          <input
            id="primary-title"
            data-field="primary-title"
            type="text"
            value={primaryTitle}
            onChange={(event) => setPrimaryDetails(event.target.value, primaryValue)}
          />
          <output data-output="primary-title-length" aria-live="polite">
            {primaryTitleLength} characters · package maximum {DESIGN_QR_MAX_TITLE_CHARACTERS}
          </output>
        </div>
        <div className="consumer-detail-field">
          <label htmlFor="primary-title-scale">Title size</label>
          <input
            id="primary-title-scale"
            data-field="primary-title-scale"
            type="range"
            min={DESIGN_QR_DETAIL_FONT_SCALE_MIN}
            max={DESIGN_QR_DETAIL_FONT_SCALE_MAX}
            step={DESIGN_QR_DETAIL_FONT_SCALE_STEP}
            value={titleScale}
            onChange={(event) => setTitleScale(Number(event.target.value))}
          />
          <output data-output="primary-title-scale" aria-live="polite">
            {titleScale.toFixed(2)}×
          </output>
        </div>
        <div className="consumer-detail-field">
          <label htmlFor="primary-value">Primary content / QR value</label>
          <textarea
            id="primary-value"
            data-field="primary-value"
            rows={2}
            value={primaryValue}
            onChange={(event) => setPrimaryDetails(primaryTitle, event.target.value)}
          />
          <output data-output="primary-value-length" aria-live="polite">
            {primaryValueByteLength} UTF-8 bytes · config maximum {DESIGN_QR_MAX_VALUE_BYTES}
          </output>
        </div>
        <div className="consumer-detail-field">
          <label htmlFor="primary-content-scale">Content size</label>
          <input
            id="primary-content-scale"
            data-field="primary-content-scale"
            type="range"
            min={DESIGN_QR_DETAIL_FONT_SCALE_MIN}
            max={DESIGN_QR_DETAIL_FONT_SCALE_MAX}
            step={DESIGN_QR_DETAIL_FONT_SCALE_STEP}
            value={contentScale}
            onChange={(event) => setContentScale(Number(event.target.value))}
          />
          <output data-output="primary-content-scale" aria-live="polite">
            {contentScale.toFixed(2)}×
          </output>
        </div>
      </div>

      <div className="consumer-grid">
        <section
          ref={primaryHostRef}
          className="consumer-player"
          data-fixture="primary"
          aria-label="Customized default-theme DesignQR fixture"
        >
          <DesignQR
            ref={primaryRef}
            value={primaryValue}
            design="tree"
            theme={scanTestMode ? SCAN_TEST_THEME : CUSTOMIZED_DEFAULT_THEME}
            view={primaryView}
            logo={logo}
            transparentBackground={transparentBackground}
            ariaLabel="Primary interactive DesignQR"
            onViewChange={setPrimaryView}
            onReady={() => setReadyCount((count) => count + 1)}
            onError={handlePrimaryError}
            details={{
              title: titleEnabled ? primaryTitle : '',
              titleScale,
              showValue: contentEnabled,
              contentScale,
              border: borderEnabled ? { padding: 16 } : false,
            }}
          />
        </section>

        {showSecondary && (
          <section
            className="consumer-player"
            data-fixture="secondary"
            aria-label="Full-parameter DesignQR fixture"
          >
            <DesignQR
              value="https://example.com/secondary"
              design="tree"
              theme={FULL_PARAMETER_THEME}
              defaultView="qr"
              interaction={{
                dragToRotate: false,
                tapToToggleView: false,
                autoRotate: false,
                motionBlur: false,
              }}
              ariaLabel="Secondary non-interactive DesignQR"
              onReady={() => setReadyCount((count) => count + 1)}
            />
          </section>
        )}

        <section data-fixture="generation-failure" hidden>
          <DesignQR
            value={OVER_CAPACITY_VALUE}
            logo={GREEN_LOGO}
            ariaLabel="Over-capacity DesignQR fixture"
            onReady={() => setFailureReadyCount((count) => count + 1)}
            onError={(error) => setFailureErrorCode(error.code)}
          />
        </section>
      </div>
    </main>
  );
}
