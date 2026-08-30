import { Minus, Plus, Tag, X } from 'lucide-react';
import {
  QR_BORDER_PADDING_MAX,
  QR_BORDER_PADDING_MIN,
  QR_BORDER_PADDING_STEP,
} from 'designqr/editor';
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
      className="floating-flat-qr-controls glass-panel expanded"
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
