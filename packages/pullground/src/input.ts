import { createPull, movePull, type PullGesture } from './gesture.ts';

interface InputCallbacks {
  canStart(): boolean;
  move(distance: number, offsetX: number): void;
  release(distance: number, offsetX: number, keyboard: boolean): void;
  cancel(): void;
  keyboardStart(): void;
}
const interactive = 'a,button,input,textarea,select,summary,video,audio,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="slider"],[role="textbox"],[role="combobox"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[role="menuitem"],[tabindex],[data-pullground-ignore]';

function ignored(target: EventTarget | null, viewport: HTMLElement) {
  if (!(target instanceof Element)) return true;
  const control = target.closest(interactive);
  if (control && control !== viewport) return true;
  for (let element: Element | null = target; element && element !== viewport; element = element.parentElement) {
    const style = getComputedStyle(element);
    if ((/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight)
      || (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth)) return true;
  }
  return false;
}

export function attachInput(viewport: HTMLElement, callbacks: InputCallbacks) {
  let gesture: { id: number; kind: 'pointer' | 'touch'; pull: PullGesture } | null = null;
  let keyboard: { key: string; started: number; offsetX: number } | null = null;
  let suppressUntil = 0;
  const listeners: (() => void)[] = [];
  const listen = <K extends keyof GlobalEventHandlersEventMap>(
    target: EventTarget, type: K, handler: (event: GlobalEventHandlersEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler as EventListener, options);
    listeners.push(() => target.removeEventListener(type, handler as EventListener, options));
  };

  function clear() {
    const previous = gesture;
    gesture = null;
    keyboard = null;
    if (previous?.pull.claimed) suppressUntil = performance.now() + 500;
    if (previous?.kind === 'pointer' && viewport.hasPointerCapture(previous.id)) {
      viewport.releasePointerCapture(previous.id);
    }
  }
  function cancel() {
    if (!gesture && !keyboard) return;
    clear();
    callbacks.cancel();
  }
  const eligible = (target: EventTarget | null) => !gesture && !keyboard
    && callbacks.canStart() && viewport.scrollTop <= 1 && !ignored(target, viewport);

  function update(x: number, y: number) {
    if (!gesture) return false;
    if (!gesture.pull.claimed && viewport.scrollTop > 1) { cancel(); return false; }
    const wasClaimed = gesture.pull.claimed;
    if (!movePull(gesture.pull, x, y)) {
      if (gesture.pull.canceled) cancel();
      return false;
    }
    if (!wasClaimed && gesture.kind === 'pointer') {
      viewport.setPointerCapture(gesture.id);
      viewport.focus({ preventScroll: true });
    }
    callbacks.move(gesture.pull.distance, gesture.pull.offsetX);
    return true;
  }
  function finish(x: number, y: number) {
    update(x, y);
    const pull = gesture?.pull;
    clear();
    if (pull?.claimed && pull.maximum > 0 && callbacks.canStart()) callbacks.release(pull.distance, pull.offsetX, false);
    else callbacks.cancel();
  }

  listen(viewport, 'pointerdown', event => {
    suppressUntil = 0;
    if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary || event.defaultPrevented) return;
    if (eligible(event.target)) gesture = { id: event.pointerId, kind: 'pointer', pull: createPull(event.clientX, event.clientY) };
  });
  listen(document, 'pointerdown', event => {
    if (gesture?.kind === 'pointer' && event.pointerType !== 'touch' && event.pointerId !== gesture.id) cancel();
  });
  listen(document, 'pointermove', event => {
    if (gesture?.kind !== 'pointer' || gesture.id !== event.pointerId) return;
    if (update(event.clientX, event.clientY)) event.preventDefault();
  });
  listen(document, 'pointerup', event => {
    if (gesture?.kind === 'pointer' && gesture.id === event.pointerId) finish(event.clientX, event.clientY);
  });
  listen(document, 'pointercancel', event => {
    if (gesture?.kind === 'pointer' && gesture.id === event.pointerId) cancel();
  });
  listen(viewport, 'lostpointercapture', event => {
    if (gesture?.kind === 'pointer' && gesture.id === event.pointerId) cancel();
  });
  listen(viewport, 'touchstart', event => {
    suppressUntil = 0;
    if (event.touches.length !== 1) { cancel(); return; }
    if (event.defaultPrevented || !eligible(event.target)) return;
    const touch = event.touches[0];
    gesture = { id: touch.identifier, kind: 'touch', pull: createPull(touch.clientX, touch.clientY) };
  }, { passive: true });
  listen(document, 'touchstart', event => { if (event.touches.length > 1) cancel(); }, { passive: true });
  listen(viewport, 'touchmove', event => {
    if (gesture?.kind !== 'touch') return;
    if (event.touches.length !== 1 || !event.cancelable) { cancel(); return; }
    const touch = Array.from(event.touches).find(touch => touch.identifier === gesture?.id);
    if (touch && update(touch.clientX, touch.clientY)) event.preventDefault();
  }, { passive: false });
  listen(document, 'touchend', event => {
    if (gesture?.kind !== 'touch') return;
    const touch = Array.from(event.changedTouches).find(touch => touch.identifier === gesture?.id);
    if (touch) finish(touch.clientX, touch.clientY);
  }, { passive: true });
  listen(document, 'touchcancel', event => {
    if (gesture?.kind === 'touch' && Array.from(event.changedTouches).some(touch => touch.identifier === gesture?.id)) cancel();
  }, { passive: true });
  listen(viewport, 'click', event => {
    if (event.detail > 0 && performance.now() < suppressUntil) {
      event.preventDefault();
      event.stopPropagation();
      suppressUntil = 0;
    }
  }, { capture: true });
  listen(viewport, 'keydown', event => {
    if (event.target === viewport && keyboard && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
      event.preventDefault();
      keyboard.offsetX = Math.max(-90, Math.min(90, keyboard.offsetX + (event.code === 'ArrowLeft' ? -9 : 9)));
      return;
    }
    if (event.target !== viewport || (event.code !== 'Space' && event.code !== 'Enter')) return;
    if (event.repeat || keyboard) { if (keyboard) event.preventDefault(); return; }
    if (!eligible(viewport)) return;
    event.preventDefault();
    keyboard = { key: event.code, started: performance.now(), offsetX: 0 };
    callbacks.keyboardStart();
  });
  listen(document, 'keyup', event => {
    if (!keyboard || event.code !== keyboard.key) return;
    event.preventDefault();
    const distance = keyboardDistance();
    const offsetX = keyboard.offsetX;
    clear();
    if (callbacks.canStart()) callbacks.release(distance, offsetX, true);
    else callbacks.cancel();
  });
  listen(document, 'keydown', event => {
    if (event.key === 'Escape' && (gesture || keyboard)) { event.preventDefault(); cancel(); }
  });
  listen(viewport, 'blur', () => { if (keyboard) cancel(); });
  listen(window, 'blur', cancel);

  function keyboardDistance() {
    return keyboard ? Math.min(1, (performance.now() - keyboard.started) / 1750) * 180 : 0;
  }
  return {
    cancel,
    keyboardDistance,
    keyboardOffsetX: () => keyboard?.offsetX ?? 0,
    isKeyboard: () => keyboard !== null,
    dispose() { clear(); listeners.forEach(remove => remove()); },
  };
}
