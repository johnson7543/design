import { useEffect, useRef, useState } from 'react';
import { Check, Copy, FileCode2, WrapText } from 'lucide-react';
import type { PullgroundGame, PullgroundTheme } from '@johnson7543/pullground';
import { CodeView } from '../components/CodeView';
import { DemoCodeAction } from '../demo-ui/DemoChrome';
import { createReactExample } from './react-example-source';

export function ReactExample({ game, theme }: { game: PullgroundGame; theme: PullgroundTheme }) {
  const example = createReactExample(game, theme);
  const [wrapLines, setWrapLines] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const resetTimer = useRef<number | null>(null);
  const mounted = useRef(false);
  const codeView = useRef<HTMLPreElement>(null);
  const copyLabel = copyState === 'copied' ? 'React example copied' : copyState === 'copying' ? 'Copying React example' : 'Copy React example';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  async function copyExample() {
    if (copyState === 'copying') return;
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(example);
      if (!mounted.current) return;
      setCopyState('copied');
      resetTimer.current = window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      if (!mounted.current) return;
      codeView.current?.focus({ preventScroll: true });
      const code = codeView.current?.querySelector('code');
      if (code) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setCopyState('error');
    }
  }

  return (
    <section className="share-code-card pullground-demo-example" aria-labelledby="pullground-react-example-title">
      <div className="share-code-header">
        <span className="pullground-demo-example-title" id="pullground-react-example-title">
          <FileCode2 aria-hidden="true" />
          <span><span className="pullground-demo-sr-only">React example: </span>App.tsx</span>
        </span>
        <div className="pullground-demo-example-actions">
          <DemoCodeAction className="pullground-demo-wrap" label="Wrap code lines"
            aria-pressed={wrapLines} onClick={() => setWrapLines(value => !value)}>
            <WrapText aria-hidden="true" />
          </DemoCodeAction>
          <DemoCodeAction className="pullground-demo-copy" copied={copyState === 'copied'} label={copyLabel}
            disabled={copyState === 'copying'} onClick={() => { void copyExample(); }}>
            {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </DemoCodeAction>
        </div>
      </div>
      <p role="status" className={copyState === 'error' ? 'pullground-demo-copy-error' : 'pullground-demo-sr-only'}>
        {copyState === 'error' ? 'Copy unavailable. The code is selected for manual copying.'
          : copyState === 'copied' ? 'React example copied.' : ''}
      </p>
      <CodeView ref={codeView} code={example} language="tsx" className="pullground-demo-code" wrapLines={wrapLines} ariaLabel="React example code" />
    </section>
  );
}
