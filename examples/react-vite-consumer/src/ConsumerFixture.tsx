import { useRef, useState } from 'react';
import {
  createTreeTheme,
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
  const [exportStatus, setExportStatus] = useState('idle');
  const [logoMode, setLogoMode] = useState<LogoMode>('green');
  const [logoError, setLogoError] = useState('');
  const [logoSize, setLogoSize] = useState(0.16);
  const [transparentBackground, setTransparentBackground] = useState(false);
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

  const selectLogoMode = (mode: LogoMode) => {
    setLogoError('');
    setLogoMode(mode);
  };

  const replaceLogoRapidly = () => {
    selectLogoMode('pink');
    window.setTimeout(() => selectLogoMode('green'), 0);
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
      data-export-status={exportStatus}
      data-logo-mode={logoMode}
      data-logo-error={logoError}
      data-logo-size={logoSize}
      data-transparent-background={transparentBackground}
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
            value="https://example.com/primary"
            design="tree"
            theme={scanTestMode ? SCAN_TEST_THEME : CUSTOMIZED_DEFAULT_THEME}
            view={primaryView}
            logo={logo}
            transparentBackground={transparentBackground}
            ariaLabel="Primary interactive DesignQR"
            onViewChange={setPrimaryView}
            onReady={() => setReadyCount((count) => count + 1)}
            onError={handlePrimaryError}
            details={scanTestMode
              ? undefined
              : {
                  title: 'Primary DesignQR',
                  showValue: true,
                  border: { padding: 16 },
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
      </div>
    </main>
  );
}
