import React, { useEffect, useState } from 'react';
import { Eye, Box, Cpu, Info } from 'lucide-react';

const DESIGN_QR_GITHUB_URL = 'https://github.com/johnson7543/design';
const DESIGN_QR_GITHUB_API_URL = 'https://api.github.com/repos/johnson7543/design';
const DESIGN_QR_GITHUB_STAR_FALLBACK = 4;

function GitHubMarkIcon() {
  return (
    <svg
      className="github-star-mark"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
    </svg>
  );
}

function formatGitHubStarCount(count: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count);
}

interface HeaderProps {
  viewMode: '3d' | 'scan';
  onSetViewMode: (mode: '3d' | 'scan') => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onSetViewMode,
}) => {
  const [githubStarCount, setGitHubStarCount] = useState(
    DESIGN_QR_GITHUB_STAR_FALLBACK
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetch(DESIGN_QR_GITHUB_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('GitHub star count is unavailable.');
        return response.json() as Promise<{ stargazers_count?: unknown }>;
      })
      .then(({ stargazers_count: count }) => {
        if (
          !controller.signal.aborted
          && typeof count === 'number'
          && Number.isInteger(count)
          && count >= 0
        ) {
          setGitHubStarCount(count);
        }
      })
      .catch(() => {
        // Retain the last verified count when GitHub is unavailable or rate-limited.
      });

    return () => controller.abort();
  }, []);

  const formattedGitHubStarCount = formatGitHubStarCount(githubStarCount);

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
          <a
            className="github-star-link"
            href={DESIGN_QR_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`Star DesignQR on GitHub; ${githubStarCount} stars (opens in a new tab)`}
            title={`Star DesignQR on GitHub · ${githubStarCount} stars`}
            data-github-star-count={githubStarCount}
          >
            <GitHubMarkIcon />
            <span className="github-star-count" aria-hidden="true">
              {formattedGitHubStarCount}
            </span>
          </a>

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
