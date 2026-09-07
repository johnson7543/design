import { useEffect, useRef } from 'react';
import { Minus, Plus, X, ZoomIn } from 'lucide-react';
import { PREVIEW_ZOOM_MIN } from 'designqr/editor';
import { EDITOR_PREVIEW_ZOOM_MAX } from '../editor/preview-zoom';

export interface PreviewZoomControlsProps {
  scale: number;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onStep: (direction: number) => void;
  onReset: () => void;
}

export function PreviewZoomControls({ scale, isOpen, onToggle, onClose, onStep, onReset }: PreviewZoomControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const percent = `${Math.round(scale * 100)}%`;

  useEffect(() => {
    if (!isOpen) return;
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) onClose();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      toggleRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className="preview-zoom-tools" ref={containerRef}>
      <button
        ref={toggleRef}
        type="button"
        className={`floating-edit-toggle floating-zoom-toggle${isOpen ? ' open' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="preview-zoom-editor"
        aria-label={`Preview zoom: ${percent}. Exports unchanged`}
        title={`Preview zoom: ${percent} (view only)`}
      >
        <ZoomIn size={14} aria-hidden="true" />
        <span className="floating-stage-tool-label">{percent}</span>
      </button>
      {isOpen && (
        <div className="preview-zoom-panel" id="preview-zoom-editor" role="group" aria-labelledby="preview-zoom-title">
          <div className="preview-zoom-heading">
            <span id="preview-zoom-title">Preview zoom</span>
            <button type="button" className="preview-zoom-close" onClick={() => {
              onClose();
              toggleRef.current?.focus({ preventScroll: true });
            }} aria-label="Close preview zoom">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="preview-zoom-actions">
            <button type="button" className="preview-zoom-action" onClick={() => onStep(-1)}
              disabled={scale <= PREVIEW_ZOOM_MIN} aria-label="Zoom preview out">
              <Minus size={16} aria-hidden="true" />
            </button>
            <button type="button" className="preview-zoom-action preview-zoom-reset" onClick={onReset}
              aria-label={`Reset preview zoom to 100%. Currently ${percent}`} title="Reset view (0)">
              <span>{percent}</span><span className="preview-zoom-reset-label">Reset</span>
            </button>
            <button type="button" className="preview-zoom-action" onClick={() => onStep(1)}
              disabled={scale >= EDITOR_PREVIEW_ZOOM_MAX} aria-label="Zoom preview in">
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="preview-zoom-help">Pinch to zoom and pan. Mouse: scroll to zoom, Shift + drag to pan. Keys: + / − / 0.</p>
          <p className="preview-zoom-note">View only · exports and embeds unchanged.</p>
        </div>
      )}
    </div>
  );
}
