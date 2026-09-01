import type React from 'react';
import {
  Image as ImageIcon,
  ImagePlus,
  LoaderCircle,
  Minus,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  QR_BORDER_PADDING_MAX,
  QR_BORDER_PADDING_MIN,
  QR_BORDER_PADDING_STEP,
} from 'designqr/editor';
import {
  DESIGN_QR_LOGO_SIZE_MAX,
  DESIGN_QR_LOGO_SIZE_MIN,
  type DesignQRLogoOptions,
} from 'designqr/config';
import { InteractiveCheckbox } from './InteractiveCheckbox';

interface FloatingQRDetailsControlsProps {
  title: string;
  onTitleChange?: (title: string) => void;
  showContent: boolean;
  onToggleShowContent?: (show: boolean) => void;
  borderEnabled: boolean;
  onToggleBorder?: (enabled: boolean) => void;
  borderPadding: number;
  onBorderPaddingChange?: (padding: number) => void;
}

interface FloatingLogoControlsProps {
  logo: false | Required<DesignQRLogoOptions>;
  onLogoChange?: (logo: false | Required<DesignQRLogoOptions>) => void;
  onLogoFileSelect?: (file: File) => void;
  isPreparingLogo?: boolean;
  logoError?: string;
  configurationError?: string;
}

export const FloatingQRDetailsControls: React.FC<FloatingQRDetailsControlsProps> = ({
  title,
  onTitleChange,
  showContent,
  onToggleShowContent,
  borderEnabled,
  onToggleBorder,
  borderPadding,
  onBorderPaddingChange,
}) => {
  const changeBorderPadding = (direction: -1 | 1) => {
    const nextPadding = Math.min(
      QR_BORDER_PADDING_MAX,
      Math.max(QR_BORDER_PADDING_MIN, borderPadding + direction * QR_BORDER_PADDING_STEP)
    );
    onBorderPaddingChange?.(nextPadding);
  };

  return (
    <div
      id="qr-details-editor"
      className="floating-flat-qr-controls floating-details-editor glass-panel expanded"
      role="group"
      aria-label="QR detail options"
    >
      <div className="floating-qr-details-top-row">
        <div className="floating-qr-title-card">
          <Tag size={14} className="floating-title-icon" />
          <input
            type="text"
            className="floating-title-input"
            aria-label="QR title"
            placeholder="Add a title..."
            value={title}
            onChange={(event) => onTitleChange?.(event.target.value)}
            maxLength={40}
            spellCheck={false}
          />
          {title && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={() => onTitleChange?.('')}
              title="Clear title"
              aria-label="Clear title"
            >
              <X size={13} />
            </button>
          )}
        </div>

      </div>

      <div className="floating-flat-qr-options-row">
        <div className={`floating-border-control ${borderEnabled ? 'expanded' : ''}`}>
          <InteractiveCheckbox
            label="Border"
            checked={borderEnabled}
            onChange={(checked) => onToggleBorder?.(checked)}
            className="floating-border-toggle"
          />

          {borderEnabled && (
            <div
              className="floating-border-padding-control"
              role="group"
              aria-label="Border padding"
            >
              <button
                type="button"
                className="floating-border-padding-btn"
                onClick={() => changeBorderPadding(-1)}
                disabled={borderPadding <= QR_BORDER_PADDING_MIN}
                title="Decrease border padding"
                aria-label="Decrease border padding"
              >
                <Minus size={13} strokeWidth={2.4} />
              </button>
              <output className="floating-border-padding-value" aria-live="polite">
                {borderPadding}px
              </output>
              <button
                type="button"
                className="floating-border-padding-btn"
                onClick={() => changeBorderPadding(1)}
                disabled={borderPadding >= QR_BORDER_PADDING_MAX}
                title="Increase border padding"
                aria-label="Increase border padding"
              >
                <Plus size={13} strokeWidth={2.4} />
              </button>
            </div>
          )}
        </div>

        <InteractiveCheckbox
          label="Show Content"
          checked={showContent}
          onChange={(checked) => onToggleShowContent?.(checked)}
          className="floating-show-content-toggle"
        />
      </div>
    </div>
  );
};

export const FloatingLogoControls: React.FC<FloatingLogoControlsProps> = ({
  logo,
  onLogoChange,
  onLogoFileSelect,
  isPreparingLogo = false,
  logoError = '',
  configurationError = '',
}) => {
  const visibleError = logoError || configurationError;

  const handleLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) onLogoFileSelect?.(file);
  };

  const removeLogo = () => {
    onLogoChange?.(false);
  };

  const updateLogoSize = (size: number) => {
    if (logo === false) return;
    onLogoChange?.({ ...logo, size });
  };

  return (
    <div
      id="logo-editor"
      className={`floating-flat-qr-controls floating-logo-editor glass-panel expanded${visibleError ? ' has-logo-error' : ''}`}
      role="group"
      aria-label="Logo options"
      aria-busy={isPreparingLogo}
    >

      <div className={`floating-logo-control${logo !== false ? ' has-logo' : ''}`}>
        <label
          className={`floating-logo-upload${isPreparingLogo ? ' is-loading' : ''}`}
          title={`${logo === false ? 'Add' : 'Replace'} logo (PNG, JPEG, or WebP up to 100 MB; automatically optimized below 1 MB)`}
        >
          {isPreparingLogo ? (
            <LoaderCircle size={14} className="floating-logo-spinner" aria-hidden="true" />
          ) : logo === false ? (
            <ImagePlus size={14} aria-hidden="true" />
          ) : (
            <ImageIcon size={14} aria-hidden="true" />
          )}
          <span aria-live="polite">
            {isPreparingLogo ? 'Preparing…' : logo === false ? 'Add Logo' : 'Replace'}
          </span>
          <input
            className="floating-logo-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoFile}
            disabled={isPreparingLogo}
            aria-label={logo === false ? 'Add logo image' : 'Replace logo image'}
          />
        </label>

        {logo !== false && (
          <>
            <img
              className="floating-logo-preview"
              src={logo.src}
              alt=""
              aria-hidden="true"
            />
            <label className="floating-logo-size-control">
              <span>Size</span>
              <input
                type="range"
                min={DESIGN_QR_LOGO_SIZE_MIN}
                max={DESIGN_QR_LOGO_SIZE_MAX}
                step={0.01}
                value={logo.size}
                onChange={(event) => updateLogoSize(Number(event.target.value))}
                aria-label="Logo size"
                aria-valuetext={`${Math.round(logo.size * 100)} percent of QR width`}
              />
              <output>{Math.round(logo.size * 100)}%</output>
            </label>
            <button
              type="button"
              className="floating-logo-remove"
              onClick={removeLogo}
              title="Remove logo"
              aria-label="Remove logo"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {visibleError && (
        <p className="floating-logo-error" role="alert">{visibleError}</p>
      )}
    </div>
  );
};
