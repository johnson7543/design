import { ArrowLeft, Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DesignNotFoundPage() {
  return (
    <main className="design-not-found">
      <div className="design-not-found-mark" aria-hidden="true">
        <Boxes size={24} />
      </div>
      <span>404</span>
      <h1>This idea isn’t here yet.</h1>
      <p>The page may have moved, or it may still be waiting to become something.</p>
      <Link to="/">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Design
      </Link>
    </main>
  );
}
