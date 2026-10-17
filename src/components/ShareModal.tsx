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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CodeView, HighlightedCode } from './CodeView';
import { DemoCodeAction } from '../demo-ui/DemoChrome';
import { DemoDialog } from '../demo-ui/DemoDialog';

type ShareMode = 'share' | 'embed' | 'react';
type ReactExampleMode = 'simple' | 'advanced' | 'theme';
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
  customThemeSupported?: boolean;
  recommendedReactExampleMode: ReactExampleMode;
  configurationError?: string;
  downloadDisabled?: boolean;
  onClose: () => void;
  onDownload: () => void;
}

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
  const previousFocus = document.activeElement;
  const container = previousFocus?.closest('dialog') ?? document.body;
  container.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
  if (!copied) throw new Error('Clipboard access is unavailable.');
}

export const ShareModal: React.FC<ShareModalProps> = ({
  shareUrl,
  embedUrl,
  embedCode,
  reactCode,
  reactAdvancedCode,
  reactThemeCode,
  customThemeSupported = true,
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
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  const confettiEffect = useRef<ReturnType<typeof confetti.create> | null>(null);

  useEffect(() => {
    const effect = confetti.create(confettiCanvas.current!, { resize: true });
    confettiEffect.current = effect;
    return () => {
      effect.reset();
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleCopy = async (target: CopyTarget, value: string) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    try {
      await writeClipboard(value);
      setCopyFeedback({ target, status: 'copied' });
      confettiEffect.current?.({
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
      <DemoCodeAction
        copied={copyFeedback?.target === target && copyFeedback.status === 'copied'}
        onClick={() => handleCopy(target, value)}
        disabled={!value}
        label={label}
        aria-live="polite"
      >
        {copyIcon(target)}
      </DemoCodeAction>
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
    <DemoDialog title="Share & Export" description="Download, share, or embed this DesignQR in your application."
      closeLabel="Close share dialog" onClose={onClose}
      overlay={<canvas ref={confettiCanvas} className="demo-dialog-effects" aria-hidden="true" />}>

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
                <HighlightedCode code={DESIGN_QR_INSTALL_COMMAND} language="shell" />
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
                  {REACT_EXAMPLE_OPTIONS.filter(({ mode }) => customThemeSupported || mode !== 'theme').map(({ mode, label }) => {
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
    </DemoDialog>
  );
};
