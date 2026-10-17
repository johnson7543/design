import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { GitHubLink } from '../components/GitHubLink';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function DemoHeader({ title, githubLabel = title, brandExtras, center, actions, flow = false, className = '' }: {
  title: string;
  githubLabel?: string;
  brandExtras?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  flow?: boolean;
  className?: string;
}) {
  return (
    <div className={`app-header-shell${flow ? ' demo-header-flow' : ''}`}>
      <header className={`site-header-layout app-header${center ? ' demo-header-centered' : ''} ${className}`}>
        <div className="header-brand">
          <div className="site-header-brand"><h1 className="brand-title">{title}</h1></div>
          {brandExtras}
        </div>
        {center}
        <div className="header-actions">
          <GitHubLink productName={githubLabel} />
          {actions}
        </div>
      </header>
    </div>
  );
}

export function DemoControls({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`controls-overlay demo-controls ${className}`}>{children}</div>;
}

export function DemoPanel({ children }: { children: ReactNode }) {
  return <div className="customizer-card glass-panel">{children}</div>;
}

export function DemoChoice({ selected, className = '', ...props }: ButtonProps & { selected: boolean }) {
  return <button type="button" {...props} className={`season-chip${selected ? ' active' : ''} ${className}`} aria-pressed={selected} />;
}

export function DemoExportButton({ label, className = '', title = label, ...props }: Omit<ButtonProps, 'children' | 'aria-label'> & { label: string }) {
  return (
    <button type="button" {...props} className={`share-icon-btn ${className}`} aria-label={label} title={title} aria-haspopup="dialog">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v13" />
        <path d="m16 6-4-4-4 4" />
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      </svg>
    </button>
  );
}

export function DemoCodeAction({ label, copied = false, className = '', title = label, ...props }: ButtonProps & { label: string; copied?: boolean }) {
  return <button type="button" {...props} className={`share-copy-icon-btn${copied ? ' copied' : ''} ${className}`} aria-label={label} title={title} />;
}
