import { useEffect, useRef, type CSSProperties } from 'react';
import { GitFork } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TREE_THEME_PRESETS } from 'designqr';

const springTheme = TREE_THEME_PRESETS.spring;

const springThemeStyle = {
  '--design-sky-top': springTheme.skyTop,
  '--design-sky-bottom': springTheme.skyBottom,
} as CSSProperties;

function DesignQRPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: '120px 0px', threshold: 0.1 }
    );

    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="design-catalog-video"
      preload="none"
      loop
      muted
      playsInline
      draggable="false"
      poster="/previews/design-qr-pixel-7.webp"
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src="/previews/design-qr-pixel-7.mp4" type="video/mp4" />
    </video>
  );
}

const designs = [
  {
    title: 'Design QR',
    path: '/qr',
    Preview: DesignQRPreview,
  },
];

export function DesignHomePage() {
  return (
    <div className="design-home" style={springThemeStyle}>
      <div className="design-home-shell">
        <header className="site-header-layout design-site-header">
          <Link
            className="site-header-brand design-site-brand"
            to="/"
            aria-label="Design Hub home"
          >
            <span>Design Hub</span>
          </Link>

          <nav className="design-site-nav" aria-label="Primary navigation">
            <a
              href="https://github.com/johnson7543/design"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
              <GitFork size={14} aria-hidden="true" />
            </a>
          </nav>
        </header>

        <main className="design-catalog">
          <div className="design-catalog-heading">
            <h1>Designs</h1>
            <p>Interactive tools and experiments.</p>
          </div>

          <div className="design-catalog-grid" aria-label="Available designs">
            {designs.map(({ title, path, Preview }) => (
              <Link
                className="design-catalog-card"
                to={path}
                key={path}
                aria-label={`Open ${title}`}
              >
                <div className="design-catalog-preview">
                  <Preview />
                </div>
              </Link>
            ))}
          </div>
        </main>

        <footer className="design-site-footer">
          <span>© {new Date().getFullYear()} Johnson Wang</span>
        </footer>
      </div>
    </div>
  );
}
