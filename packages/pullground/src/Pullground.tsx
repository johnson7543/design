import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { createViewController, initialViewState } from './view-controller.ts';
import { BACKBOARD_FRAGMENTS } from './shot-model.ts';
import { REST_NET } from './net-model.ts';
import { BOWLING_PINS } from './bowling-model.ts';
import { STONE_RIPPLE_COUNT } from './stone-model.ts';
import type { PullgroundProps, PullgroundLabels } from './types.ts';
import styles from './style.css?inline';

const defaults: PullgroundLabels = {
  region: 'Pullable content',
  instructions: 'At the top, pull down and release to run the action. Pull right to aim left, or left to aim right. Or hold Space or Enter and use Left or Right Arrow to aim, then release to play and run the action.',
  release: 'Release to continue', pending: 'Working…',
  success: 'Done', error: 'Something went wrong. Try again.',
};

function StatusIcon({ kind }: { kind: 'pending' | 'error' | 'pull' }) {
  return (
    <svg className="pullground-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {kind === 'error' ? <><circle cx="10" cy="10" r="7" /><path d="M10 6v5m0 3v.1" /></>
        : kind === 'pull' ? <path d="M10 16V4m-5 5 5-5 5 5" />
        : <path d="M16.2 8a6.5 6.5 0 1 0-.5 5" />}
    </svg>
  );
}

export function Pullground(props: PullgroundProps) {
  const { children, className = '', style, viewportClassName = '', game = 'basketball', theme = 'classic', ref } = props;
  const labels = { ...defaults, ...props.labels };
  const id = useId();
  const options = useRef(props);
  const view = useRef<ReturnType<typeof createViewController> | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const ball = useRef<SVGGElement>(null);
  const net = useRef<SVGPathElement>(null);
  const netBack = useRef<SVGPathElement>(null);
  const netUnder = useRef<SVGPathElement>(null);
  const pulse = useRef<SVGCircleElement>(null);
  const backboard = useRef<SVGGElement>(null);
  const panel = useRef<SVGGElement>(null);
  const fragments = useRef<SVGGElement>(null);
  const impact = useRef<SVGGElement>(null);
  const dart = useRef<SVGGElement>(null);
  const dartPulse = useRef<SVGCircleElement>(null);
  const bowlingBall = useRef<SVGGElement>(null);
  const bowlingPins = useRef<SVGGElement>(null);
  const stone = useRef<SVGGElement>(null);
  const stoneShadow = useRef<SVGEllipseElement>(null);
  const stoneRipples = useRef<SVGGElement>(null);
  const aim = useRef<SVGPathElement>(null);
  const [state, setState] = useState(initialViewState);

  useEffect(() => { options.current = props; view.current?.syncOptions(); });
  useEffect(() => {
    const controller = createViewController({
      viewport: viewport.current!, reveal: reveal.current!, content: content.current!, status: status.current!,
      ball: ball.current!, net: net.current!, netBack: netBack.current!, netUnder: netUnder.current!, pulse: pulse.current!,
      backboard: backboard.current!, panel: panel.current!, fragments: fragments.current!, impact: impact.current!,
      dart: dart.current!, dartPulse: dartPulse.current!, bowlingBall: bowlingBall.current!, bowlingPins: bowlingPins.current!, aim: aim.current!,
      stone: stone.current!, stoneShadow: stoneShadow.current!, stoneRipples: stoneRipples.current!,
    }, () => options.current, setState);
    view.current = controller;
    return () => { controller.dispose(); if (view.current === controller) view.current = null; };
  }, []);
  useImperativeHandle(ref, () => ({
    trigger: () => view.current?.trigger()
      ?? Promise.resolve({ status: 'skipped', reason: 'unmounted' }),
  }), []);

  const pending = state.action === 'pending';
  const error = state.action === 'error';
  const showArt = (state.pulling || state.shooting) && !state.reduced;
  const visible = pending || error || state.pulling || state.shooting;
  const text = error && !state.pulling ? labels.error : '';
  const announcement = pending ? labels.pending : state.pulling ? labels.release : error ? labels.error
    : state.action === 'success' ? labels.success : '';

  return (
    <section className={`pullground-root ${className}`} style={style} aria-label={labels.region}
      data-state={state.action} data-art={showArt} data-pulling={state.pulling} data-reduced={state.reduced} data-game={game} data-theme={theme}>
      <style href="@johnson7543/pullground" precedence="pullground">{styles}</style>
      <div ref={viewport} className={`pullground-viewport ${viewportClassName}`}
        role="group" tabIndex={0} aria-label={labels.region} aria-describedby={`${id}-instructions`}>
        <div ref={reveal} className="pullground-reveal" aria-hidden={!visible}>
          <div className="pullground-art" aria-hidden="true">
            <svg className="pullground-court" viewBox="0 0 160 132" preserveAspectRatio="xMidYMid meet" fill="none">
              <path ref={aim} className="pullground-aim" />
              <g className="pullground-basketball-scene">
                <g ref={backboard}>
                  <g ref={panel} className="pullground-board-panel">
                    <rect className="pullground-backboard" x="59" y="9" width="42" height="28" rx="3" />
                    <path className="pullground-board-square" d="M72 33V22h16v11" />
                  </g>
                  <g ref={fragments} className="pullground-board-fragments" opacity="0">
                    {BACKBOARD_FRAGMENTS.map(fragment => <polygon key={fragment.points} points={fragment.points} />)}
                  </g>
                </g>
                <g ref={impact} className="pullground-impact" opacity="0">
                  <circle cx="80" cy="23" r="12" />
                  <path d="m59 16-5-3m47 3 5-3M59 30l-5 3m47-3 5 3" />
                </g>
                <ellipse className="pullground-rim" cx="80" cy="34" rx="15" ry="3.8" />
                <circle ref={pulse} className="pullground-pulse" cx="80" cy="34" r="16" opacity="0" />
                <path ref={netBack} className="pullground-net pullground-net-back" d={REST_NET.back} />
                <path ref={netUnder} className="pullground-net pullground-net-under" d={REST_NET.front} />
                <g ref={ball} transform="translate(80 90)">
                  <circle className="pullground-release-cue" r="13" />
                  <circle className="pullground-ball" r="7.4" />
                  <path className="pullground-seams" d="M-7.2 0H7.2M0-7.2V7.2M-5-5.3C1-4 1 4-5 5.3M5-5.3C-1-4-1 4 5 5.3" />
                </g>
                <path ref={net} className="pullground-net pullground-net-front" />
                <path className="pullground-rim" d="M65 34a15 3.8 0 0 0 30 0" />
              </g>
              <g className="pullground-dart-scene">
                <circle className="pullground-dart-target" cx="80" cy="34" r="23" />
                <circle className="pullground-dart-ring" cx="80" cy="34" r="16" />
                <circle className="pullground-dart-ring" cx="80" cy="34" r="9" />
                <circle className="pullground-dart-bullseye" cx="80" cy="34" r="3" />
                <circle ref={dartPulse} className="pullground-pulse" cx="80" cy="34" r="5" opacity="0" />
                <g ref={dart} className="pullground-dart" transform="translate(80 84)">
                  <circle className="pullground-release-cue" cy="16" r="15" />
                  <path className="pullground-dart-shaft" d="M0 0v24" />
                  <path className="pullground-dart-barrel" d="M0 7v9" />
                  <path className="pullground-dart-flight" d="m0 16-6 6v7l6-5 6 5v-7Z" />
                  <path className="pullground-dart-shaft" d="M0 17v10" />
                </g>
              </g>
              <g className="pullground-bowling-scene">
                <g ref={bowlingBall} className="pullground-bowling-ball" transform="translate(80 96)">
                  <circle className="pullground-release-cue" r="14" />
                  <circle className="pullground-bowling-body" r="10" />
                  <g className="pullground-bowling-holes">
                    <circle cx="-2.5" cy="-3" r="1.3" />
                    <circle cx="2.5" cy="-3" r="1.3" />
                    <circle cy="1.8" r="1.6" />
                  </g>
                </g>
                <g ref={bowlingPins} className="pullground-bowling-pins">
                  {BOWLING_PINS.map(pin => (
                    <g key={pin.id} className="pullground-bowling-pin" transform={`translate(${pin.x} ${pin.y}) scale(${pin.scale})`}>
                      <path className="pullground-bowling-pin-body" d="M-3.4 0C-4.5-2.7-3.5-5.7-2-8c1-2 .7-3.1.1-4.2a2.2 2.2 0 1 1 3.8 0C1.3-11.1 1-10 2-8 3.5-5.7 4.5-2.7 3.4 0Z" />
                      <path className="pullground-bowling-pin-band" d="M-1.5-9.5h3m-3.2 1.8h3.4" />
                    </g>
                  ))}
                </g>
              </g>
              <g className="pullground-stone-scene">
                <ellipse ref={stoneShadow} className="pullground-stone-shadow" cx="80" cy="112" rx="7" ry="1.8" opacity="0.1" />
                <g ref={stoneRipples} className="pullground-stone-ripples">
                  {Array.from({ length: STONE_RIPPLE_COUNT }, (_, index) => <ellipse key={index} opacity="0" />)}
                </g>
                <g ref={stone} className="pullground-stone" transform="translate(80 98) rotate(-12)">
                  <ellipse className="pullground-release-cue" rx="13" ry="8" />
                  <path className="pullground-stone-body" d="M-8 0C-7-3.5-2-5 3-4.2 7-3.5 9-1 8 1.5 6 4-2 4.5-6 3Z" />
                  <path className="pullground-stone-facet" d="M-5-1C-2-3 3-3 5-1.5" />
                </g>
              </g>
            </svg>
          </div>
          <div ref={status} className="pullground-status" aria-hidden="true" data-error={error && !state.pulling}>
            <span className="pullground-status-icon" data-spinning={pending}>
              <StatusIcon kind={pending ? 'pending' : error && !state.pulling ? 'error' : 'pull'} />
            </span>
            {text && <span>{text}</span>}
          </div>
        </div>
        <div ref={content} className="pullground-content" aria-busy={pending}>{children}</div>
      </div>
      <span id={`${id}-instructions`} className="pullground-sr-only">{labels.instructions}</span>
      <span className="pullground-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </section>
  );
}
