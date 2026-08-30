import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DesignHomePage } from './DesignHomePage';
import { DesignNotFoundPage } from './DesignNotFoundPage';

const DesignQRApp = lazy(() => import('../App'));
const DesignQREmbedRoute = lazy(() => import('../routes/DesignQREmbedRoute'));

interface PageMetadataProps {
  title: string;
  description: string;
}

function PageMetadata({ title, description }: PageMetadataProps) {
  useEffect(() => {
    document.title = title;
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute('content', description);
  }, [description, title]);

  return null;
}

function DesignHomeRoute() {
  return (
    <>
      <PageMetadata
        title="Design — Interactive tools and experiments"
        description="A collection of thoughtful, interactive design tools by Johnson Wang."
      />
      <DesignHomePage />
    </>
  );
}

function DesignQRRoute() {
  return (
    <>
      <PageMetadata
        title="Design QR — Interactive 3D QR generator"
        description="Turn any link into an interactive 3D tree and a scannable, shareable QR card."
      />
      <Suspense
        fallback={
          <div className="design-route-loading" role="status">
            <span aria-hidden="true" />
            Opening Design QR…
          </div>
        }
      >
        <DesignQRApp />
      </Suspense>
    </>
  );
}

function DesignQREmbedPlayerRoute() {
  return (
    <Suspense
      fallback={
        <main className="designqr-embed-route design-route-loading" role="status">
          <span aria-hidden="true" />
          Opening DesignQR…
        </main>
      }
    >
      <DesignQREmbedRoute />
    </Suspense>
  );
}

function NotFoundRoute() {
  return (
    <>
      <PageMetadata
        title="Not found — Design"
        description="This Design page could not be found."
      />
      <DesignNotFoundPage />
    </>
  );
}

export function DesignPlatform() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DesignHomeRoute />} />
        <Route path="/qr" element={<DesignQRRoute />} />
        <Route path="/qr/embed" element={<DesignQREmbedPlayerRoute />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
