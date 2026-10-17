import type { PullgroundGame, PullgroundTheme } from '@johnson7543/pullground';
import { DemoDialog } from '../demo-ui/DemoDialog';
import { ReactExample } from './ReactExample';

export function ExportModal({ game, theme, onClose }: { game: PullgroundGame; theme: PullgroundTheme; onClose: () => void }) {
  return (
    <DemoDialog title="Export" description="Use Pullground in your React app."
      closeLabel="Close export dialog" onClose={onClose}
      backdropClassName="pullground-export-backdrop" className="pullground-export-modal">
      <ReactExample game={game} theme={theme} />
    </DemoDialog>
  );
}
