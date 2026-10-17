import type { CSSProperties, ReactNode, Ref } from 'react';

export type PullSource = 'pull' | 'keyboard' | 'imperative';
export type PullgroundGame = 'basketball' | 'dart' | 'bowling' | 'stone';
export type PullgroundTheme = 'classic' | 'simple' | 'ocean' | 'midnight';
export interface PullContext {
  signal: AbortSignal;
  source: PullSource;
}
export type PullOutcome =
  | { status: 'success' }
  | { status: 'error'; error: unknown }
  | { status: 'aborted' }
  | { status: 'skipped'; reason: 'disabled' | 'unmounted' };

export interface PullgroundLabels {
  region: string;
  instructions: string;
  release: string;
  pending: string;
  success: string;
  error: string;
}
export interface PullgroundHandle {
  /** Runs onPull without a shot, or joins the current action while it is pending. */
  trigger(): Promise<PullOutcome>;
}
export interface PullgroundProps {
  children: ReactNode;
  /** Runs once on release, keyboard activation, or trigger(); never on drag frames. */
  onPull(context: PullContext): void | Promise<void>;
  onPullError?(error: unknown): void;
  disabled?: boolean;
  /** Decorative interaction. Defaults to basketball; never gates the action. */
  game?: PullgroundGame;
  /** Built-in palette. Defaults to classic; independent of game and motion. */
  theme?: PullgroundTheme;
  motion?: 'system' | 'reduced';
  labels?: Partial<PullgroundLabels>;
  className?: string;
  style?: CSSProperties;
  viewportClassName?: string;
  ref?: Ref<PullgroundHandle>;
}
