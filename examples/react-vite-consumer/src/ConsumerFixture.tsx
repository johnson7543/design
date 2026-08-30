import { useRef, useState } from 'react';
import { DesignQR, type DesignQRHandle } from 'designqr';

export function ConsumerFixture() {
  const primaryRef = useRef<DesignQRHandle>(null);
  const primaryHostRef = useRef<HTMLElement>(null);
  const [primaryView, setPrimaryView] = useState<'design' | 'qr'>('design');
  const [showSecondary, setShowSecondary] = useState(true);
  const [readyCount, setReadyCount] = useState(0);
  const [exportStatus, setExportStatus] = useState('idle');

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
        <button type="button" onClick={() => void verifyExport()}>
          Verify primary export
        </button>
      </div>

      <div className="consumer-grid">
        <section
          ref={primaryHostRef}
          className="consumer-player"
          aria-label="Controlled DesignQR fixture"
        >
          <DesignQR
            ref={primaryRef}
            value="https://example.com/primary"
            design="tree"
            theme="spring"
            view={primaryView}
            onViewChange={setPrimaryView}
            onReady={() => setReadyCount((count) => count + 1)}
            details={{
              title: 'Primary DesignQR',
              showValue: true,
              border: { padding: 16 },
            }}
          />
        </section>

        {showSecondary && (
          <section className="consumer-player" aria-label="Uncontrolled DesignQR fixture">
            <DesignQR
              value="https://example.com/secondary"
              design="tree"
              theme="winter"
              defaultView="qr"
              interaction={{ autoRotate: false, motionBlur: false }}
              onReady={() => setReadyCount((count) => count + 1)}
            />
          </section>
        )}
      </div>
    </main>
  );
}
