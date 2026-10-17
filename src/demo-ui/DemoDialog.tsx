import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Sparkles, X } from 'lucide-react';

export function DemoDialog({ title, description, closeLabel, onClose, children, overlay, className = '', backdropClassName = '' }: {
  title: string;
  description: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  overlay?: ReactNode;
  className?: string;
  backdropClassName?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={dialog} className={`modal-backdrop demo-dialog-backdrop ${backdropClassName}`}
      aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
          .filter(element => element.tabIndex >= 0 && !element.matches(':disabled, [aria-disabled="true"]') && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onPointerDown={event => { backdropPress.current = event.target === event.currentTarget; }}
      onClick={event => { if (backdropPress.current && event.target === event.currentTarget) onClose(); }}>
      <div className={`modal-content share-modal-content glass-panel demo-dialog-content ${className}`}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Sparkles size={18} className="sparkle-icon" aria-hidden="true" />
            <h2 className="modal-title" id={titleId}>{title}</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label={closeLabel} autoFocus>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="modal-desc" id={descriptionId}>{description}</p>
        {children}
      </div>
      {overlay}
    </dialog>
  );
}
