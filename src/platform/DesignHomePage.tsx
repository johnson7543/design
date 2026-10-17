import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GitFork } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TREE_THEME_PRESETS } from 'designqr';

const springTheme = TREE_THEME_PRESETS.spring;

const springThemeStyle = {
  '--design-sky-top': springTheme.skyTop,
  '--design-sky-bottom': springTheme.skyBottom,
} as CSSProperties;

function CatalogPreview({ source, poster }: { source: string; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const updatePlayback = () => {
      if (visible && !reducedMotion.matches && !document.hidden) {
        void video.play().catch(() => {});
      } else video.pause();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        updatePlayback();
      },
      { rootMargin: '120px 0px', threshold: 0.1 }
    );

    observer.observe(video);
    reducedMotion.addEventListener('change', updatePlayback);
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener('change', updatePlayback);
      document.removeEventListener('visibilitychange', updatePlayback);
      video.pause();
    };
  }, [failed]);

  if (failed) return <img className="design-catalog-video" src={poster} alt="" aria-hidden="true" draggable="false" />;

  return (
    <video
      ref={videoRef}
      className="design-catalog-video"
      preload="none"
      loop
      muted
      playsInline
      draggable="false"
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
      onError={() => setFailed(true)}
    >
      <source src={source} type="video/mp4" onError={() => setFailed(true)} />
    </video>
  );
}

const designs = [
  {
    title: 'Design QR',
    path: '/qr',
    video: '/previews/design-qr-pixel-7.mp4',
    poster: '/previews/design-qr-pixel-7.webp',
  },
  {
    title: 'Pullground',
    path: '/pullground',
    video: '/previews/pullground.mp4',
    poster: '/previews/pullground.webp',
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
            {designs.map(({ title, path, video, poster }) => (
              <Link
                className="design-catalog-card"
                to={path}
                key={path}
                aria-label={`Open ${title}`}
              >
                <div className="design-catalog-preview">
                  <CatalogPreview source={video} poster={poster} />
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
