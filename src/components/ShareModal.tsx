import React, { useEffect, useRef, useState } from 'react';
import {
  Braces,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

type ShareMode = 'share' | 'embed' | 'react';
type ReactExampleMode = 'simple' | 'advanced' | 'theme';
type CodeLanguage = 'html' | 'shell' | 'tsx';
type CopyTarget =
  | 'share-link'
  | 'embed-code'
  | 'embed-url'
  | 'react-install'
  | 'react-code-simple'
  | 'react-code-advanced'
  | 'react-code-theme';

const DESIGN_QR_INSTALL_COMMAND = 'npm install designqr';
const REACT_EXAMPLE_OPTIONS = [
  { mode: 'simple', label: 'Simple' },
  { mode: 'advanced', label: 'Advanced' },
  { mode: 'theme', label: 'Custom Theme' },
] as const satisfies ReadonlyArray<{
  mode: ReactExampleMode;
  label: string;
}>;
const CODE_TOKEN_PATTERN = /<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][A-Za-z0-9.-]*|\b[A-Za-z_$][A-Za-z0-9_$-]*\b|\b\d+(?:\.\d+)?\b|[{}[\]()<>=:;,.?/+*-]/g;
const CODE_KEYWORDS = new Set([
  'async',
  'await',
  'const',
  'export',
  'from',
  'function',
  'import',
  'let',
  'new',
  'return',
  'satisfies',
  'type',
]);
const CODE_LITERALS = new Set(['false', 'null', 'true', 'undefined']);

interface CopyFeedback {
  target: CopyTarget;
  status: 'copied' | 'failed';
}

interface ShareModalProps {
  shareUrl: string;
  embedUrl: string;
  embedCode: string;
  reactCode: string;
  reactAdvancedCode: string;
  reactThemeCode: string;
  recommendedReactExampleMode: ReactExampleMode;
  configurationError?: string;
  downloadDisabled?: boolean;
  onClose: () => void;
  onDownload: () => void;
}

function syntaxTokenClass(
  token: string,
  source: string,
  endIndex: number,
  language: CodeLanguage
): string | null {
  if (
    token.startsWith('//')
    || token.startsWith('/*')
    || token.startsWith('<!--')
  ) {
    return 'comment';
  }
  if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
    return 'string';
  }
  if (token.startsWith('<')) return 'tag';
  if (/^\d/.test(token)) return 'number';
  if (CODE_KEYWORDS.has(token)) return 'keyword';
  if (CODE_LITERALS.has(token)) return 'literal';

  if (language === 'shell') {
    if (token === 'npm') return 'keyword';
    if (token === 'install') return 'property';
    return 'string';
  }

  const remainder = source.slice(endIndex);
  if (/^\s*=/.test(remainder) || /^\s*:/.test(remainder)) return 'property';
  if (/^[A-Z]/.test(token)) return 'tag';
  if (/^[{}[\]()<>=:;,.?/+*-]$/.test(token)) return 'punctuation';
  return null;
}

function highlightCode(code: string, language: CodeLanguage): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of code.matchAll(CODE_TOKEN_PATTERN)) {
    const start = match.index;
    if (start > cursor) result.push(code.slice(cursor, start));

    const token = match[0];
    const kind = syntaxTokenClass(token, code, start + token.length, language);
    result.push(kind ? (
      <span className={`syntax-token syntax-${kind}`} key={key}>
        {token}
      </span>
    ) : token);
    cursor = start + token.length;
    key += 1;
  }

  if (cursor < code.length) result.push(code.slice(cursor));
  return result;
}

interface CodeViewProps {
  code: string;
  language: CodeLanguage;
  ariaLabel: string;
  className?: string;
}

const CodeView: React.FC<CodeViewProps> = ({
  code,
  language,
  ariaLabel,
  className = '',
}) => (
  <pre
    className={`share-code-view${className ? ` ${className}` : ''}`}
    aria-label={ariaLabel}
    data-language={language}
    tabIndex={0}
  >
    <code>{highlightCode(code, language)}</code>
  </pre>
);

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through for browsers that expose but deny the Clipboard API.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard access is unavailable.');
}

export const ShareModal: React.FC<ShareModalProps> = ({
  shareUrl,
  embedUrl,
  embedCode,
  reactCode,
  reactAdvancedCode,
  reactThemeCode,
  recommendedReactExampleMode,
  configurationError = '',
  downloadDisabled = false,
  onClose,
  onDownload,
}) => {
  const [activeMode, setActiveMode] = useState<ShareMode>('share');
  const [reactExampleMode, setReactExampleMode] = useState<ReactExampleMode>(
    recommendedReactExampleMode
  );
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
  }, []);

  const handleCopy = async (target: CopyTarget, value: string) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    try {
      await writeClipboard(value);
      setCopyFeedback({ target, status: 'copied' });
      confetti({
        particleCount: 36,
        spread: 54,
        origin: { y: 0.62 },
        colors: ['#e8a0b0', '#e8a800', '#3a8ef5', '#38b04a'],
        disableForReducedMotion: true,
      });
    } catch {
      setCopyFeedback({ target, status: 'failed' });
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback(null);
      feedbackTimerRef.current = null;
    }, 2500);
  };

  const handleSystemShare = async () => {
    if (!navigator.share) {
      await handleCopy('share-link', shareUrl);
      return;
    }

    try {
      await navigator.share({
        title: 'DesignQR',
        text: 'Explore my interactive DesignQR.',
        url: shareUrl,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      await handleCopy('share-link', shareUrl);
    }
  };

  const copyLabel = (target: CopyTarget, idleLabel = 'Copy') => {
    if (copyFeedback?.target !== target) return idleLabel;
    return copyFeedback.status === 'copied' ? 'Copied!' : 'Try again';
  };

  const copyIcon = (target: CopyTarget) => (
    copyFeedback?.target === target && copyFeedback.status === 'copied'
      ? <Check size={16} />
      : <Copy size={16} />
  );

  const renderCopyButton = (
    target: CopyTarget,
    value: string,
    idleLabel: string
  ) => {
    const label = copyLabel(target, idleLabel);
    return (
      <button
        type="button"
        className={`share-copy-icon-btn ${copyFeedback?.target === target && copyFeedback.status === 'copied' ? 'copied' : ''}`}
        onClick={() => handleCopy(target, value)}
        disabled={!value}
        aria-label={label}
        title={label}
        aria-live="polite"
      >
        {copyIcon(target)}
      </button>
    );
  };

  const activeReactCode = reactExampleMode === 'simple'
    ? reactCode
    : reactExampleMode === 'advanced'
      ? reactAdvancedCode
      : reactThemeCode;
  const activeReactExampleLabel = reactExampleMode === 'simple'
    ? 'Simple'
    : reactExampleMode === 'advanced'
      ? 'Advanced'
      : 'Custom Theme';
  const activeReactCopyTarget: CopyTarget = `react-code-${reactExampleMode}`;

  const selectReactExample = (mode: ReactExampleMode) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    if (copyFeedback !== null) setCopyFeedback(null);
    setReactExampleMode(mode);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content share-modal-content glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        aria-describedby="share-modal-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Sparkles size={18} className="sparkle-icon" />
            <h3 className="modal-title" id="share-modal-title">Share & Export</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close share dialog"
          >
            <X size={18} />
          </button>
        </div>

        <p className="modal-desc" id="share-modal-description">
          Download, share, or embed this DesignQR in your application.
        </p>

        {configurationError && (
          <p className="share-configuration-error" role="alert">
            {configurationError}
          </p>
        )}

        <div className="share-mode-switcher" aria-label="Share format">
          <button
            type="button"
            data-share-mode="share"
            className={activeMode === 'share' ? 'active' : ''}
            aria-pressed={activeMode === 'share'}
            onClick={() => setActiveMode('share')}
          >
            <Link2 size={15} />
            Share
          </button>
          <button
            type="button"
            data-share-mode="embed"
            className={activeMode === 'embed' ? 'active' : ''}
            aria-pressed={activeMode === 'embed'}
            onClick={() => setActiveMode('embed')}
          >
            <Code2 size={15} />
            Embed
          </button>
          <button
            type="button"
            data-share-mode="react"
            className={activeMode === 'react' ? 'active' : ''}
            aria-pressed={activeMode === 'react'}
            onClick={() => setActiveMode('react')}
          >
            <Braces size={15} />
            React
          </button>
        </div>

        {activeMode === 'share' && (
          <section className="share-mode-panel" aria-label="Share design">
            <div className="share-actions-stack">
              <button
                type="button"
                className="share-action-item primary"
                disabled={downloadDisabled}
                onClick={() => {
                  onDownload();
                  onClose();
                }}
              >
                <div className="share-action-icon-wrap">
                  <Download size={20} />
                </div>
                <div className="share-action-text">
                  <span className="share-action-title">Download</span>
                  <span className="share-action-sub">Static QR Code Image</span>
                </div>
              </button>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  className="share-action-item"
                  onClick={handleSystemShare}
                  disabled={Boolean(configurationError)}
                >
                  <div className="share-action-icon-wrap">
                    <Share2 size={20} />
                  </div>
                  <div className="share-action-text">
                    <span className="share-action-title">Share via Apps</span>
                    <span className="share-action-sub">Send the editable design link</span>
                  </div>
                </button>
              )}
            </div>

            <div className="share-link-box-label">Or share the editable link directly</div>
            <div className="share-link-box">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="share-link-input"
                aria-label="Editable DesignQR link"
                onClick={(event) => event.currentTarget.select()}
              />
              {renderCopyButton('share-link', shareUrl, 'Copy editable link')}
            </div>
          </section>
        )}

        {activeMode === 'embed' && (
          <section className="share-mode-panel" aria-label="Embed DesignQR">
            <div className="share-integration-summary">
              <Code2 size={18} />
              <div>
                <strong>Interactive iframe</strong>
                <span>For websites, builders, and app WebViews.</span>
              </div>
            </div>

            <div className="share-code-card">
              <div className="share-code-header">
                <span>HTML</span>
                {renderCopyButton('embed-code', embedCode, 'Copy iframe code')}
              </div>
              <CodeView
                code={embedCode}
                language="html"
                ariaLabel="DesignQR iframe code"
              />
            </div>

            <div className="share-link-box-label">Hosted player URL</div>
            <div className="share-link-box">
              <input
                type="text"
                readOnly
                value={embedUrl}
                className="share-link-input"
                aria-label="Hosted DesignQR player URL"
                onClick={(event) => event.currentTarget.select()}
              />
              <a
                className={`share-open-btn${embedUrl ? '' : ' disabled'}`}
                href={embedUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!embedUrl}
                tabIndex={embedUrl ? 0 : -1}
              >
                <ExternalLink size={16} />
                <span>Open</span>
              </a>
              {renderCopyButton('embed-url', embedUrl, 'Copy hosted player URL')}
            </div>
          </section>
        )}

        {activeMode === 'react' && (
          <section className="share-mode-panel" aria-label="Use DesignQR in React">
            <div className="share-integration-summary">
              <Braces size={18} />
              <div>
                <strong>React component</strong>
                <span>Copy runnable TSX for the current design.</span>
              </div>
            </div>

            <div className="share-link-box-label">Install package</div>
            <div className="share-link-box share-install-box">
              <code
                className="share-install-code"
                aria-label="DesignQR npm install command"
                tabIndex={0}
              >
                {highlightCode(DESIGN_QR_INSTALL_COMMAND, 'shell')}
              </code>
              {renderCopyButton(
                'react-install',
                DESIGN_QR_INSTALL_COMMAND,
                'Copy install command'
              )}
            </div>

            <div className="share-code-card">
              <div className="share-code-header react-code-header">
                <div
                  className="react-example-switcher"
                  role="group"
                  aria-label="React example type"
                >
                  {REACT_EXAMPLE_OPTIONS.map(({ mode, label }) => {
                    const isActive = reactExampleMode === mode;
                    const isRecommended = recommendedReactExampleMode === mode;
                    const recommendationLabel = `${label}, recommended for the current editor setup`;

                    return (
                      <button
                        type="button"
                        key={mode}
                        data-react-example={mode}
                        data-recommended={isRecommended}
                        className={[
                          isActive ? 'active' : '',
                          isRecommended ? 'recommended' : '',
                        ].filter(Boolean).join(' ')}
                        aria-label={isRecommended ? recommendationLabel : label}
                        aria-pressed={isActive}
                        title={isRecommended ? recommendationLabel : undefined}
                        onClick={() => selectReactExample(mode)}
                      >
                        {isRecommended && (
                          <Sparkles
                            size={11}
                            className="react-example-recommended-icon"
                            aria-hidden="true"
                          />
                        )}
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
                {renderCopyButton(
                  activeReactCopyTarget,
                  activeReactCode,
                  `Copy ${activeReactExampleLabel} React code`
                )}
              </div>
              <CodeView
                code={activeReactCode}
                language="tsx"
                className="react-code"
                ariaLabel="DesignQR React code"
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
