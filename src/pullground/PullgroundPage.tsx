import { useState, type CSSProperties } from 'react';
import { Target } from 'lucide-react';
import { Pullground, type PullgroundGame, type PullgroundTheme } from '@johnson7543/pullground';
import { TREE_THEME_PRESETS } from 'designqr';
import { DemoChoice, DemoControls, DemoExportButton, DemoHeader, DemoPanel } from '../demo-ui/DemoChrome';
import { ExportModal } from './ExportModal';
import './pullground-demo.css';
import './pullground-themes.css';

const springThemeStyle = {
  '--pullground-demo-classic-sky-top': TREE_THEME_PRESETS.spring.skyTop,
  '--pullground-demo-classic-sky-bottom': TREE_THEME_PRESETS.spring.skyBottom,
} as CSSProperties;

const themeOptions = [
  { id: 'classic', label: 'Classic' },
  { id: 'simple', label: 'Simple' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'midnight', label: 'Midnight' },
] as const;

const gameLabels: Record<PullgroundGame, string> = { basketball: 'Basketball', dart: 'Dart', bowling: 'Bowling', stone: 'Stone skipping' };
const games = Object.keys(gameLabels) as PullgroundGame[];

function GameIcon({ game }: { game: PullgroundGame }) {
  if (game === 'dart') return <Target className="pullground-demo-game-icon" aria-hidden="true" />;
  if (game === 'stone') return (
    <svg className="pullground-demo-game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 8c0-2 2-4 5-4s4 1 4 3-3 4-6 4-3-1-3-3Z" />
      <path d="M6 14c-2 1-3 2-3 3 0 2 4 4 9 4s9-2 9-4c0-1-1-2-3-3M8 16c0 1 2 2 4 2s4-1 4-2" />
    </svg>
  );
  return (
    <svg className="pullground-demo-game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      {game === 'basketball' ? (
        <path d="M12 3v18M3 12h18M5.64 5.64a9 9 0 0 1 0 12.72M18.36 5.64a9 9 0 0 0 0 12.72" transform="rotate(45 12 12)" />
      ) : <><circle cx="9" cy="8" r="1" /><circle cx="14" cy="8" r="1" /><circle cx="11.5" cy="13" r="1.2" /></>}
    </svg>
  );
}

export default function PullgroundPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [game, setGame] = useState<PullgroundGame>('basketball');
  const [theme, setTheme] = useState<PullgroundTheme>('classic');
  return (
    <main className="app-root pullground-demo-page" data-theme={theme} data-stage-tone={theme === 'midnight' ? 'night' : undefined} style={springThemeStyle}>
      <Pullground className="pullground-demo-component" game={game} theme={theme} disabled={exportOpen} viewportClassName="pullground-demo-viewport" labels={{ region: `${gameLabels[game]} playground` }}
        onPull={async ({ signal }) => {
          await new Promise<void>((resolve, reject) => {
            const cancel = () => { clearTimeout(timer); reject(signal.reason); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 850);
            if (signal.aborted) cancel();
            else signal.addEventListener('abort', cancel, { once: true });
          });
        }}>
        <DemoHeader title="Pullground" flow className="pullground-demo-header" center={
          <span className="pullground-demo-hint" aria-hidden="true">
            <svg className="pullground-demo-hint-motion" viewBox="0 0 24 28" fill="none">
              <path d="m7 7 5 5 5-5" />
              <path d="m7 14 5 5 5-5" />
            </svg>
          </span>
        } />
        <p className="pullground-demo-guide">
          <span className="pullground-demo-guide-pull">Pull</span>
          <svg className="pullground-demo-guide-arrow" viewBox="0 0 32 48" aria-hidden="true" focusable="false">
            <path d="M16 5v36M6 31l10 10 10-10" />
          </svg>
        </p>
      </Pullground>
      <DemoControls className="pullground-demo-controls">
        <DemoPanel>
          <div className="action-buttons-row pullground-demo-actions" role="group" aria-label="Demo controls">
            <div className="design-type-tabs pullground-demo-games" role="group" aria-label="Game">
              {games.map(value => (
                <DemoChoice key={value} className="pullground-demo-game"
                  data-game={value} selected={game === value} onClick={() => setGame(value)}>
                  <GameIcon game={value} />
                  <span>{gameLabels[value]}</span>
                </DemoChoice>
              ))}
            </div>
            <DemoExportButton className="pullground-demo-export" label="Export React example"
              aria-expanded={exportOpen} onClick={() => setExportOpen(true)} />
          </div>
          <div className="season-tabs pullground-demo-themes" role="group" aria-label="Theme">
            {themeOptions.map(({ id, label }) => (
              <DemoChoice key={id} className="pullground-demo-theme"
                data-theme={id} selected={theme === id} onClick={() => setTheme(id)}>
                {label}
              </DemoChoice>
            ))}
          </div>
        </DemoPanel>
      </DemoControls>
      {exportOpen && <ExportModal game={game} theme={theme} onClose={() => setExportOpen(false)} />}
    </main>
  );
}
