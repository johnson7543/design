import {
  Type,
  X,
  Flower2,
  Sun,
  Leaf,
  Snowflake,
  Play,
  Pause,
  Blend,
  Sparkles,
  Scan,
  Plus,
  RotateCcw,
  RefreshCcw,
  RefreshCw,
  Settings2,
  ChevronDown,
  Gauge,
  Grid2X2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  QR_BORDER_PADDING_DEFAULT,
  VIEW_TRANSITION_SPEED_DEFAULT,
  VIEW_TRANSITION_SPEED_MAX,
  VIEW_TRANSITION_SPEED_MIN,
  VIEW_TRANSITION_SPEED_STEP,
} from 'designqr/editor';
import type { AutoRotateDirection, DesignQRLogoOptions } from 'designqr/config';
import type { CustomTheme } from '../editor/types';
import { THEME_PRESET_OPTIONS } from '../editor/theme-presets';
import {
  FloatingLogoControls,
  FloatingQRDetailsControls,
} from './FloatingFlatQRControls';

interface ControlsOverlayProps {
  url: string;
  onUrlChange: (newUrl: string) => void;
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
  customThemes: CustomTheme[];
  onOpenCreateTheme: () => void;
  onOpenEditTheme: (theme: CustomTheme) => void;
  onShare: () => void;
  shareDisabled?: boolean;
  isTurntable: boolean;
  onToggleTurntable: () => void;
  autoRotateDirection: AutoRotateDirection;
  onToggleAutoRotateDirection: () => void;
  onResetRotation: () => void;
  viewMode: '3d' | 'scan';
  onToggleScanMode?: () => void;
  isDetailsEditorOpen?: boolean;
  onToggleDetailsEditor?: () => void;
  isLogoEditorOpen?: boolean;
  onToggleLogoEditor?: () => void;
  qrTitle?: string;
  onQrTitleChange?: (newTitle: string) => void;
  transparentBackground?: boolean;
  onToggleTransparentBackground?: (transparent: boolean) => void;
  showQrContent?: boolean;
  onToggleShowContent?: (show: boolean) => void;
  qrBorderEnabled?: boolean;
  onToggleQrBorder?: (enabled: boolean) => void;
  qrBorderPadding?: number;
  onQrBorderPaddingChange?: (padding: number) => void;
  logo?: false | Required<DesignQRLogoOptions>;
  onLogoChange?: (logo: false | Required<DesignQRLogoOptions>) => void;
  onLogoFileSelect?: (file: File) => void;
  isPreparingLogo?: boolean;
  logoEditorError?: string;
  shareConfigurationError?: string;
  enableMotionBlur?: boolean;
  onToggleMotionBlur?: (enabled: boolean) => void;
  transitionSpeed?: number;
  onTransitionSpeedChange?: (speed: number) => void;
}

function formatTransitionSpeed(speed: number): string {
  return `${Number(speed.toFixed(2))}×`;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  url,
  onUrlChange,
  activeThemeId,
  onSelectTheme,
  customThemes,
  onOpenCreateTheme,
  onOpenEditTheme,
  onShare,
  shareDisabled = false,
  isTurntable,
  onToggleTurntable,
  autoRotateDirection,
  onToggleAutoRotateDirection,
  onResetRotation,
  viewMode,
  onToggleScanMode,
  isDetailsEditorOpen = false,
  onToggleDetailsEditor,
  isLogoEditorOpen = false,
  onToggleLogoEditor,
  qrTitle = '',
  onQrTitleChange,
  transparentBackground = false,
  onToggleTransparentBackground,
  showQrContent = false,
  onToggleShowContent,
  qrBorderEnabled = false,
  onToggleQrBorder,
  qrBorderPadding = QR_BORDER_PADDING_DEFAULT,
  onQrBorderPaddingChange,
  logo = false,
  onLogoChange,
  onLogoFileSelect,
  isPreparingLogo = false,
  logoEditorError = '',
  shareConfigurationError = '',
  enableMotionBlur = true,
  onToggleMotionBlur,
  transitionSpeed = VIEW_TRANSITION_SPEED_DEFAULT,
  onTransitionSpeedChange,
}) => {
  const transitionSpeedLabel = formatTransitionSpeed(transitionSpeed);

  const getSeasonIcon = (name: string) => {
    switch (name) {
      case 'spring':
        return <Flower2 size={15} />;
      case 'summer':
        return <Sun size={15} />;
      case 'autumn':
        return <Leaf size={15} />;
      case 'winter':
        return <Snowflake size={15} />;
      default:
        return <Flower2 size={15} />;
    }
  };

  return (
    <div className="controls-overlay">
      {/* Floating tools directly above the content input */}
      <div className="floating-tools-stack">
        {viewMode === 'scan' && isDetailsEditorOpen && (
          <FloatingQRDetailsControls
            title={qrTitle}
            onTitleChange={onQrTitleChange}
            showContent={showQrContent}
            onToggleShowContent={onToggleShowContent}
            borderEnabled={qrBorderEnabled}
            onToggleBorder={onToggleQrBorder}
            borderPadding={qrBorderPadding}
            onBorderPaddingChange={onQrBorderPaddingChange}
          />
        )}

        {isLogoEditorOpen && (
          <FloatingLogoControls
            logo={logo}
            onLogoChange={onLogoChange}
            onLogoFileSelect={onLogoFileSelect}
            isPreparingLogo={isPreparingLogo}
            logoError={logoEditorError}
            configurationError={shareConfigurationError}
          />
        )}

        <div className="floating-top-tools-row">
          <div className="floating-edge-tools floating-left-tools" />

          {/* The mode hint stays anchored to the true horizontal center. */}
          <div className="floating-center-tools">
            {viewMode === '3d' ? (
              <button
                type="button"
                className="canvas-hint-badge"
                onClick={onToggleScanMode}
                title="Switch to 2D QR"
              >
                <Sparkles size={14} className="hint-icon" />
                <span>Tap tree for QR code</span>
              </button>
            ) : (
              <div className="floating-qr-tools-bar">
                <button
                  type="button"
                  className="canvas-hint-badge"
                  onClick={onToggleScanMode}
                  title="Switch to 3D Tree"
                >
                  <Scan size={13} className="hint-icon animate-pulse" />
                  <span>Tap for 3D</span>
                </button>
              </div>
            )}
          </div>

          <div className="floating-edge-tools floating-right-tools">
            {viewMode === 'scan' && (
              <button
                type="button"
                className={`floating-edit-toggle ${isDetailsEditorOpen ? 'open' : ''}`}
                onClick={onToggleDetailsEditor}
                aria-expanded={isDetailsEditorOpen}
                aria-controls="qr-details-editor"
                aria-label={isDetailsEditorOpen ? 'Hide QR editor' : 'Edit QR details'}
                title={isDetailsEditorOpen ? 'Hide QR editor' : 'Edit QR details'}
              >
                <Settings2 size={13} aria-hidden="true" />
                <span className="floating-stage-tool-label">Edit</span>
                <ChevronDown size={12} className="floating-edit-chevron" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              className={`floating-edit-toggle floating-logo-toggle ${isLogoEditorOpen ? 'open' : ''}`}
              onClick={onToggleLogoEditor}
              aria-expanded={isLogoEditorOpen}
              aria-controls="logo-editor"
              aria-label={isLogoEditorOpen ? 'Hide logo editor' : logo === false ? 'Add logo' : 'Edit logo'}
              title={isLogoEditorOpen ? 'Hide logo editor' : logo === false ? 'Add logo' : 'Edit logo'}
            >
              <ImageIcon size={13} aria-hidden="true" />
              <span className="floating-stage-tool-label">Logo</span>
              <ChevronDown size={12} className="floating-edit-chevron" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* 1. Input Cards Area */}
      <div className="input-cards-stack">
        {/* QR Content Input Bar */}
        <div className="input-card glass-panel">
          <div className="input-field-wrapper">
            <Type size={18} className="input-icon" />
            <input
              type="text"
              className="url-input"
              placeholder="Enter text..."
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              spellCheck={false}
            />
            {url && (
              <button
                className="clear-input-btn"
                onClick={() => onUrlChange('')}
                title="Clear"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Customizer & Actions Drawer */}
      <div className="customizer-card glass-panel">
        {/* 4 Season Selector Tabs + Compact '+' Add Theme button */}
        <div className="season-tabs">
          {THEME_PRESET_OPTIONS.map((season) => (
            <button
              type="button"
              key={season.id}
              className={`season-chip ${activeThemeId === String(season.id) ? 'active' : ''}`}
              onClick={() => onSelectTheme(String(season.id))}
              aria-pressed={activeThemeId === String(season.id)}
            >
              {getSeasonIcon(season.name)}
              <span>{season.label}</span>
            </button>
          ))}

          {/* Add Custom Theme Button ("+" only) */}
          <button
            type="button"
            className="season-chip add-theme-chip-compact"
            onClick={onOpenCreateTheme}
            title="Add Theme"
            aria-label="Add Theme"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Custom Themes Row — displayed when custom themes are saved */}
        {customThemes.length > 0 && (
          <div className="custom-themes-row">
            {customThemes.map((theme) => (
              <div
                key={theme.id}
                className={`custom-theme-chip-wrap ${activeThemeId === theme.id ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="season-chip custom-theme-btn"
                  onClick={() => onSelectTheme(theme.id)}
                  title={theme.label}
                  aria-pressed={activeThemeId === theme.id}
                >
                  <span
                    className="custom-theme-dot"
                    style={{ backgroundColor: theme.foliageColor }}
                  />
                  <span>{theme.label}</span>
                </button>
                <button
                  type="button"
                  className="custom-theme-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditTheme(theme);
                  }}
                  title="Edit Theme"
                >
                  <Settings2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action Row inside Drawer: Left tools, Right Share Icon Button */}
        <div className="action-buttons-row">
          <div className="drawer-left-actions">
            {/* Rotate / Auto-Spin Icon-Only Button */}
            <button
              type="button"
              className={`drawer-icon-btn ${isTurntable ? 'active' : ''}`}
              onClick={onToggleTurntable}
              title={isTurntable ? 'Pause Spin' : 'Auto Spin'}
              aria-label={isTurntable ? 'Pause Spin' : 'Auto Spin'}
              aria-pressed={isTurntable}
            >
              {isTurntable ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              type="button"
              className="drawer-icon-btn"
              onClick={onToggleAutoRotateDirection}
              title={
                autoRotateDirection === 'clockwise'
                  ? 'Change spin to counterclockwise'
                  : 'Change spin to clockwise'
              }
              aria-label={
                autoRotateDirection === 'clockwise'
                  ? 'Change spin to counterclockwise'
                  : 'Change spin to clockwise'
              }
              aria-pressed={autoRotateDirection === 'counterclockwise'}
            >
              {autoRotateDirection === 'clockwise'
                ? <RefreshCw size={16} />
                : <RefreshCcw size={16} />}
            </button>

            {/* Reset the tree to its original viewing angle. */}
            <button
              type="button"
              className="drawer-icon-btn"
              onClick={onResetRotation}
              title="Reset rotation"
              aria-label="Reset rotation"
            >
              <RotateCcw size={16} />
            </button>

            {/* Motion Blur Icon-Only Toggle */}
            <button
              type="button"
              className={`drawer-icon-btn ${enableMotionBlur ? 'active' : ''}`}
              onClick={() => onToggleMotionBlur?.(!enableMotionBlur)}
              title={enableMotionBlur ? 'Disable Blur' : 'Enable Blur'}
              aria-label={enableMotionBlur ? 'Disable Blur' : 'Enable Blur'}
              aria-pressed={enableMotionBlur}
            >
              <Blend size={16} />
            </button>

            {/* Keep transparency available in both 3D and 2D modes. */}
            <button
              type="button"
              className={`drawer-icon-btn transparent-background-btn ${transparentBackground ? 'active' : ''}`}
              onClick={() => onToggleTransparentBackground?.(!transparentBackground)}
              title={
                transparentBackground
                  ? 'Disable transparent background'
                  : 'Enable transparent background'
              }
              aria-label="Transparent background"
              aria-pressed={transparentBackground}
            >
              <Grid2X2 size={16} aria-hidden="true" />
            </button>

            <label
              className="transition-speed-control"
              title={`3D/2D transition speed: ${transitionSpeedLabel}`}
            >
              <Gauge size={15} className="transition-speed-icon" aria-hidden="true" />
              <input
                id="transition-speed"
                className="transition-speed-slider"
                type="range"
                min={VIEW_TRANSITION_SPEED_MIN}
                max={VIEW_TRANSITION_SPEED_MAX}
                step={VIEW_TRANSITION_SPEED_STEP}
                value={transitionSpeed}
                onChange={(event) => onTransitionSpeedChange?.(Number(event.target.value))}
                aria-label="3D and 2D transition speed"
                aria-valuetext={`${transitionSpeedLabel} speed`}
              />
              <output className="transition-speed-value" htmlFor="transition-speed">
                {transitionSpeedLabel}
              </output>
            </label>
          </div>

          {/* Share Button */}
          <button
            type="button"
            className="share-icon-btn"
            aria-label="Share link"
            title={shareDisabled ? 'Fix the QR content before sharing' : 'Share link'}
            onClick={onShare}
            disabled={shareDisabled}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2v13"></path>
              <path d="m16 6-4-4-4 4"></path>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
