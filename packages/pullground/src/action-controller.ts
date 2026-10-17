import type { PullgroundProps, PullOutcome, PullSource } from './types.ts';

export type ActionState = 'idle' | 'pending' | 'success' | 'error';
export type ActionOptions = Pick<PullgroundProps, 'disabled' | 'onPull' | 'onPullError'>;
interface Operation {
  abort: AbortController;
  promise: Promise<PullOutcome>;
  resolve(outcome: PullOutcome): void;
}

/** Each mounted instance owns one controller. No browser or React dependency. */
export function createActionController(
  getOptions: () => ActionOptions,
  onState: (state: ActionState) => void,
) {
  let active: Operation | null = null;
  let disposed = false;

  function trigger(source: PullSource): Promise<PullOutcome> {
    if (disposed) return Promise.resolve({ status: 'skipped', reason: 'unmounted' });
    if (active) return active.promise;
    const options = getOptions();
    if (options.disabled) return Promise.resolve({ status: 'skipped', reason: 'disabled' });

    let resolve!: (outcome: PullOutcome) => void;
    const promise = new Promise<PullOutcome>(finish => { resolve = finish; });
    const operation: Operation = { abort: new AbortController(), promise, resolve };
    active = operation;
    onState('pending');

    const settle = (outcome: Extract<PullOutcome, { status: 'success' | 'error' }>) => {
      if (disposed || active !== operation) return;
      active = null;
      onState(outcome.status);
      resolve(outcome);
      if (outcome.status === 'error') {
        try {
          getOptions().onPullError?.(outcome.error);
        } catch (error) {
          // An observer failure must not strand the operation's outcome Promise.
          console.error('Pullground onPullError callback failed:', error);
        }
      }
    };
    // Also catches synchronous host throws. Both settlement handlers consume late work.
    Promise.resolve().then(() => {
      if (!disposed) return options.onPull({ signal: operation.abort.signal, source });
    }).then(
      () => settle({ status: 'success' }),
      error => settle({ status: 'error', error }),
    );
    return promise;
  }

  return {
    trigger,
    isPending: () => active !== null,
    dispose() {
      disposed = true;
      const operation = active;
      active = null;
      if (operation) {
        operation.resolve({ status: 'aborted' });
        operation.abort.abort();
      }
    },
  };
}
