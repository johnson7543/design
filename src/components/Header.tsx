import React from 'react';
import { Eye, Box, Cpu, Info } from 'lucide-react';

interface HeaderProps {
  viewMode: '3d' | 'scan';
  onSetViewMode: (mode: '3d' | 'scan') => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onSetViewMode,
}) => {
  return (
    <div className="app-header-shell">
      <header className="site-header-layout app-header">
        <div className="header-brand">
          <div className="site-header-brand">
            <h1 className="brand-title">Design QR</h1>
          </div>
          <div className="tech-badge" title="WebGL Mode">
            <Cpu size={12} />
            <span>WebGL</span>
          </div>
          <details className="header-info">
            <summary
              className="header-info-trigger"
              aria-label="Show inspiration credits"
              title="Inspiration credits"
            >
              <Info size={14} aria-hidden="true" />
            </summary>
            <div className="header-info-popover" role="note">
              <p className="header-info-title">Inspired by</p>
              <ul className="header-info-list">
                <li>
                  <a
                    href="https://reactiive.io/demos/cherry-blossom-qrcode"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="header-info-author">Enzo</span>
                    <span>Cherry Blossom QR Code with WebGPU</span>
                  </a>
                </li>
                <li>
                  <a
                    href="https://siddique-mauve.vercel.app/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="header-info-author">Siddique</span>
                    <span>WebGLQR</span>
                  </a>
                </li>
              </ul>
            </div>
          </details>
        </div>

        <div className="header-actions">
          {/* View Mode Toggle Switcher (3D Tree vs 2D QR) */}
          <div className="view-mode-group">
            <button
              type="button"
              className={`mode-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => onSetViewMode('3d')}
              title="3D Tree"
              aria-pressed={viewMode === '3d'}
            >
              <Box size={16} />
              <span className="btn-label">3D Tree</span>
            </button>

            <button
              type="button"
              className={`mode-btn ${viewMode === 'scan' ? 'active' : ''}`}
              onClick={() => onSetViewMode('scan')}
              title="2D QR"
              aria-pressed={viewMode === 'scan'}
            >
              <Eye size={16} />
              <span className="btn-label">2D QR</span>
            </button>
          </div>
        </div>
      </header>
    </div>
  );
};
