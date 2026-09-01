import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Crop,
  LoaderCircle,
  Move,
  RotateCcw,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  EDITOR_LOGO_CROP_MIN_SOURCE_EDGE,
  EDITOR_LOGO_CROP_ZOOM_MAX,
  EDITOR_LOGO_CROP_ZOOM_MIN,
  resolveEditorLogoCropBounds,
  type EditorLogoCrop,
  type EditorLogoSource,
} from '../utils/logo';

interface LogoCropDialogProps {
  source: EditorLogoSource;
  isPreparing: boolean;
  error?: string;
  onCancel: () => void;
  onApply: (crop: EditorLogoCrop) => void;
}

interface CropDrag {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCrop: EditorLogoCrop;
}

const CROP_CANVAS_SIZE = 512;
const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const LogoCropDialog: FC<LogoCropDialogProps> = ({
  source,
  isPreparing,
  error = '',
  onCancel,
  onApply,
}) => {
  const [crop, setCrop] = useState<EditorLogoCrop>({
    centerX: 0.5,
    centerY: 0.5,
    zoom: EDITOR_LOGO_CROP_ZOOM_MIN,
  });
  const [isDragging, setIsDragging] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<CropDrag | null>(null);

  const maximumZoom = useMemo(() => Math.max(
    EDITOR_LOGO_CROP_ZOOM_MIN,
    Math.min(
      EDITOR_LOGO_CROP_ZOOM_MAX,
      Math.min(source.width, source.height) / EDITOR_LOGO_CROP_MIN_SOURCE_EDGE
    )
  ), [source.height, source.width]);

  const normalizedCrop = useMemo(() => resolveEditorLogoCropBounds(
    source.width,
    source.height,
    crop
  ), [crop, source.height, source.width]);

  const updateCrop = (candidate: EditorLogoCrop) => {
    const next = resolveEditorLogoCropBounds(source.width, source.height, {
      ...candidate,
      zoom: Math.min(maximumZoom, candidate.zoom),
    });
    setCrop({
      centerX: next.centerX,
      centerY: next.centerY,
      zoom: next.zoom,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      source.source,
      normalizedCrop.sourceX,
      normalizedCrop.sourceY,
      normalizedCrop.sourceSize,
      normalizedCrop.sourceSize,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [normalizedCrop, source.source]);

  useEffect(() => {
    const uploadInput = document.querySelector<HTMLInputElement>(
      '.floating-logo-file-input'
    );
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => viewportRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      const restoreFocus = () => {
        if (uploadInput?.isConnected && !uploadInput.disabled) uploadInput.focus();
        else if (previousFocus?.isConnected) previousFocus.focus();
      };
      restoreFocus();
      window.requestAnimationFrame(restoreFocus);
    };
  }, []);

  useEffect(() => {
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isPreparing) {
          event.preventDefault();
          onCancel();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => document.removeEventListener('keydown', handleDialogKeyDown);
  }, [isPreparing, onCancel]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPreparing || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCrop: crop,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewportWidth = event.currentTarget.getBoundingClientRect().width;
    if (viewportWidth <= 0) return;

    const startBounds = resolveEditorLogoCropBounds(
      source.width,
      source.height,
      drag.startCrop
    );
    updateCrop({
      centerX: drag.startCrop.centerX
        - (event.clientX - drag.startClientX)
        * startBounds.sourceSize / (viewportWidth * source.width),
      centerY: drag.startCrop.centerY
        - (event.clientY - drag.startClientY)
        * startBounds.sourceSize / (viewportWidth * source.height),
      zoom: drag.startCrop.zoom,
    });
  };

  const endPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleCropKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isPreparing) return;
    const movement = event.shiftKey ? 0.08 : 0.015;
    const horizontalStep = normalizedCrop.sourceSize / source.width * movement;
    const verticalStep = normalizedCrop.sourceSize / source.height * movement;
    let centerX = crop.centerX;
    let centerY = crop.centerY;

    if (event.key === 'ArrowLeft') centerX -= horizontalStep;
    else if (event.key === 'ArrowRight') centerX += horizontalStep;
    else if (event.key === 'ArrowUp') centerY -= verticalStep;
    else if (event.key === 'ArrowDown') centerY += verticalStep;
    else return;

    event.preventDefault();
    updateCrop({ centerX, centerY, zoom: crop.zoom });
  };

  const resetCrop = () => updateCrop({
    centerX: 0.5,
    centerY: 0.5,
    zoom: EDITOR_LOGO_CROP_ZOOM_MIN,
  });

  return (
    <div
      className="modal-backdrop logo-crop-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isPreparing) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="modal-content logo-crop-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-crop-title"
        aria-describedby="logo-crop-description"
        aria-busy={isPreparing}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Crop size={18} className="modal-title-icon" aria-hidden="true" />
            <h3 className="modal-title" id="logo-crop-title">Crop logo</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={isPreparing}
            aria-label="Close crop dialog"
            title="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="modal-desc logo-crop-description" id="logo-crop-description">
          Drag or use arrow keys to position the image.
        </p>

        <div
          ref={viewportRef}
          className={`logo-crop-viewport${isDragging ? ' is-dragging' : ''}`}
          role="group"
          aria-label="Square logo crop area"
          aria-describedby="logo-crop-interaction-hint"
          tabIndex={isPreparing ? -1 : 0}
          data-center-x={normalizedCrop.centerX.toFixed(4)}
          data-center-y={normalizedCrop.centerY.toFixed(4)}
          data-zoom={normalizedCrop.zoom.toFixed(2)}
          onKeyDown={handleCropKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
        >
          <canvas
            ref={canvasRef}
            className="logo-crop-image"
            width={CROP_CANVAS_SIZE}
            height={CROP_CANVAS_SIZE}
            aria-hidden="true"
          />
          <span className="logo-crop-grid" aria-hidden="true" />
        </div>

        <div className="logo-crop-interaction" id="logo-crop-interaction-hint">
          <Move size={14} aria-hidden="true" />
          <span>Drag to reposition</span>
        </div>

        <div className="logo-crop-controls">
          <label className="logo-crop-zoom">
            <ZoomIn size={15} aria-hidden="true" />
            <span>Zoom</span>
            <input
              type="range"
              min={EDITOR_LOGO_CROP_ZOOM_MIN}
              max={maximumZoom}
              step={0.01}
              value={Math.min(crop.zoom, maximumZoom)}
              disabled={isPreparing || maximumZoom === EDITOR_LOGO_CROP_ZOOM_MIN}
              onChange={(event) => updateCrop({
                ...crop,
                zoom: Number(event.target.value),
              })}
              aria-label="Crop zoom"
              aria-valuetext={`${Math.round(crop.zoom * 100)} percent`}
            />
            <output>{Math.round(crop.zoom * 100)}%</output>
          </label>
          <button
            type="button"
            className="logo-crop-reset"
            onClick={resetCrop}
            disabled={isPreparing || (
              crop.zoom === EDITOR_LOGO_CROP_ZOOM_MIN
              && crop.centerX === 0.5
              && crop.centerY === 0.5
            )}
            aria-label="Reset crop"
            title="Reset crop"
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>

        <p
          className={`logo-crop-status${error ? ' is-error' : ''}`}
          role={error ? 'alert' : 'status'}
          aria-live="polite"
        >
          {isPreparing ? (
            <>
              <LoaderCircle size={14} className="floating-logo-spinner" aria-hidden="true" />
              Applying crop…
            </>
          ) : error || <span aria-hidden="true">&nbsp;</span>}
        </p>

        <div className="modal-actions-row logo-crop-actions">
          <button
            type="button"
            className="btn btn-ghost logo-crop-cancel"
            onClick={onCancel}
            disabled={isPreparing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary logo-crop-apply"
            onClick={() => onApply({
              centerX: normalizedCrop.centerX,
              centerY: normalizedCrop.centerY,
              zoom: normalizedCrop.zoom,
            })}
            disabled={isPreparing}
          >
            {isPreparing ? (
              <LoaderCircle size={15} className="floating-logo-spinner" aria-hidden="true" />
            ) : (
              <Crop size={15} aria-hidden="true" />
            )}
            {isPreparing ? 'Applying…' : 'Apply crop'}
          </button>
        </div>
      </section>
    </div>
  );
};
