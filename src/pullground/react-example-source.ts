import type { PullgroundGame, PullgroundTheme } from '@johnson7543/pullground';
import basketballSource from './react-example.tsx?raw';
import dartSource from './react-dart-example.tsx?raw';
import bowlingSource from './react-bowling-example.tsx?raw';
import stoneSource from './react-stone-example.tsx?raw';

const sources: Record<PullgroundGame, string> = { basketball: basketballSource, dart: dartSource, bowling: bowlingSource, stone: stoneSource };

export function createReactExample(game: PullgroundGame, theme: PullgroundTheme) {
  const source = sources[game].trim();
  return theme === 'classic' ? source : source.replace('onPull={handlePull}', `theme="${theme}" onPull={handlePull}`);
}
