import { useEffect, useRef, useState } from 'react';
import { Pullground, type PullgroundHandle, type PullContext, type PullgroundGame, type PullgroundTheme, type PullOutcome } from '@johnson7543/pullground';

type Call = { context: PullContext; instance: number; version: number; resolve(): void; reject(error: unknown): void };
export default function Fixture() {
  const first = useRef<PullgroundHandle>(null);
  const second = useRef<PullgroundHandle>(null);
  const record = useRef({ calls: [] as Call[], mode: 'deferred', errors: 0, renders: 0 });
  const [mounted, setMounted] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [version, setVersion] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [longLabels, setLongLabels] = useState(false);
  const [motion, setMotion] = useState<'system' | 'reduced'>('system');
  const [game, setGame] = useState<PullgroundGame>('basketball');
  const [theme, setTheme] = useState<PullgroundTheme>('classic');
  useEffect(() => { record.current.renders++; });
  useEffect(() => {
    Object.assign(window, { pullgroundFixture: {
      record: record.current, setMounted, setDisabled, setVersion, setMotion, setLongLabels, setGame, setTheme,
      trigger: (instance = 0) => (instance ? second : first).current!.trigger(),
      join: () => {
        const a = first.current!.trigger();
        const b = first.current!.trigger();
        return a === b;
      },
      retained: () => first.current!,
      resolve: (index: number) => record.current.calls[index].resolve(),
      reject: (index: number) => record.current.calls[index].reject(new Error('Offline fixture')),
      outcome: undefined as PullOutcome | undefined,
    } });
    return () => { Reflect.deleteProperty(window, 'pullgroundFixture'); };
  }, []);

  function onPull(instance: number, context: PullContext): void | Promise<void> {
    const data = record.current;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    data.calls.push({ context, instance, version, resolve, reject });
    if (data.mode === 'throw') throw new Error('Synchronous fixture failure');
    if (data.mode === 'sync') { setChildCount(value => value + 1); return; }
    if (data.mode === 'immediate') resolve();
    return promise;
  }

  return (
    <main className="consumer-fixture">
      <h1>Consumer fixture</h1>
      <form onSubmit={event => { event.preventDefault(); document.body.dataset.submitted = 'true'; }}>
        {mounted && <Pullground ref={first} disabled={disabled} motion={motion} game={game} theme={theme}
          labels={{ region: 'First feed', ...(longLabels ? { error: 'The action could not finish. Check your connection and try again in a moment.' } : {}) }}
          onPull={context => onPull(0, context)} onPullError={() => { record.current.errors++; }}>
          <div className="fixture-drag">Pull from here</div>
          <button type="button" className="fixture-child" onClick={() => setChildCount(value => value + 1)}>Child {childCount}</button>
          <a className="fixture-link" href="#child-link">A normal link</a>
          <input aria-label="Child input" defaultValue="Editable text" />
          <div className="fixture-nested"><div>Nested scrolling content<br />Keep scrolling</div></div>
          <div data-pullground-ignore className="fixture-ignore">Ignored drag area</div>
          {Array.from({ length: 20 }, (_, index) => <p key={index}>Consumer-owned row {index + 1}</p>)}
        </Pullground>}
      </form>
      <Pullground ref={second} theme="ocean" className="fixture-themed" viewportClassName="fixture-viewport"
        labels={{ region: 'Second feed' }} onPull={context => onPull(1, context)}>
        <div className="fixture-drag">A separate instance</div>
        <p>Independent content</p>
      </Pullground>
      <button className="fixture-outside" type="button">Outside control</button>
    </main>
  );
}
