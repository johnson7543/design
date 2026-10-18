# Pullground

Playful pull actions for React. Wrap your content, pull down at the top, and
release to run an action with a tiny basketball, dart, bowling, or stone skipping
interaction. Use it to change a card, load content, shuffle a selection, or
refresh data. Every accepted pull runs your callback, regardless of the shot.

One component import. Styles included. TypeScript types included. React 19.

[Source](https://github.com/johnson7543/design/tree/main/packages/pullground) ·
[Issues](https://github.com/johnson7543/design/issues) ·
[Release progress](https://github.com/johnson7543/design/blob/main/docs/pullground/release-plan.md)

## Install

Install in an existing React 19 web application:

```sh
npm install @johnson7543/pullground
```

Your app provides React and React DOM. No provider, configuration file, or
separate CSS import is required.

To test a local build, run this in the source repository:

```sh
npm ci
npm run pack:pullground
```

Copy `artifacts/pullground/johnson7543-pullground-0.1.0.tgz` into your
application directory, then install it there:

```sh
npm install ./johnson7543-pullground-0.1.0.tgz
```

## Quick start

This complete example advances a card on every pull:

```tsx
import { useState } from 'react';
import { Pullground } from '@johnson7543/pullground';

const cards = ['Make something small.', 'Try another direction.', 'Keep playing.'];

export default function App() {
  const [index, setIndex] = useState(0);

  return (
    <Pullground onPull={() => setIndex(current => (current + 1) % cards.length)}>
      <article>{cards[index]}</article>
    </Pullground>
  );
}
```

Basketball and Classic are the defaults. Pullground supplies a scrolling viewport
that is `24rem` tall and fills its container's width. Your content stays mounted
while the reveal opens and closes.

Synchronous actions finish immediately, so they may not show the released shot.
For work that takes time, return its promise. The pending state and game end as
soon as your action settles; Pullground never adds an artificial completion delay.

## Async actions and errors

Pass the supplied `AbortSignal` to your request and return or await all the work
that should keep the component busy. This example expects your application to
provide `/api/updates`, returning an array of `{ id, title }` objects:

```tsx
import { useState } from 'react';
import { Pullground } from '@johnson7543/pullground';

type Item = { id: string; title: string };

export function Updates({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);

  return (
    <Pullground
      labels={{ region: 'Latest updates', error: 'Could not load updates. Pull to retry.' }}
      onPull={async ({ signal }) => {
        const response = await fetch('/api/updates', { signal });
        if (!response.ok) throw new Error('Could not load updates');
        const next: Item[] = await response.json();
        if (!signal.aborted) setItems(next);
      }}
      onPullError={error => console.error('Loading updates failed', error)}
    >
      <ul>{items.map(item => <li key={item.id}>{item.title}</li>)}</ul>
    </Pullground>
  );
}
```

`onPull` runs once when a pull is accepted, when the keyboard gesture is released,
or when you call `trigger()`. It is not a drag-progress callback. Its `source` is
`'pull'`, `'keyboard'`, or `'imperative'`.

- Return normally or resolve to finish successfully. Visible game/status artwork
  clears immediately, and the content returns smoothly. Success is announced to
  assistive technology without a visible success message.
- Throw or reject to fail. Content remains visible, the busy state clears, and
  `labels.error` stays visible. Pull again, use the keyboard, or call `trigger()`
  to retry. `onPullError` is optional and receives the original error once.
- Unmounting aborts the signal. Check it before updating your own state if your
  async work does not support cancellation. Disabling the component blocks new
  actions; it does not abort work already accepted.

Pullground does not fetch on mount. Your app owns the data, requests, timeout,
and retry policy. Avoid starting a request without returning or awaiting it:
the component cannot track work that your callback leaves running independently.

## Games and themes

Select a game and palette with two props. All four themes work with all four games:

```tsx
import { Pullground } from '@johnson7543/pullground';

export function Playground({ onNext }: { onNext: () => void | Promise<void> }) {
  return (
    <Pullground game="stone" theme="ocean" onPull={onNext}>
      <main>Your content</main>
    </Pullground>
  );
}
```

| `game` | Interaction |
| --- | --- |
| `basketball` (default) | Shoot toward a hoop with a moving net; a full-power shot at the board can shatter it |
| `dart` | Throw at a target; pull strength controls height and hits settle with a small wobble |
| `bowling` | Roll toward ten pins that react to the impact direction; the ball disappears as it rolls away |
| `stone` | Skip a pebble through diminishing hops and water ripples |

Pull farther for more power. Pull right to aim left, or left to aim right, like
drawing a slingshot. There is no score requirement or minimum power for your
action. Game changes cancel an unfinished pull but preserve accepted work and
child content.

| `theme` | Appearance |
| --- | --- |
| `classic` (default) | Cream surface, warm stone material, and tan artwork |
| `simple` | White, black, and gray |
| `ocean` | Pale seafoam surface and muted green/teal artwork |
| `midnight` | Dark blue surface and muted blue artwork with pale edges |

Themes set the component surface, inherited text/focus ink, and game artwork.
Your app owns the surrounding page and child content. Changing a theme preserves the current gesture,
action, and mounted children. The package does not include the demo's header,
animated Pull guide, game/theme controls, or Export dialog.

## Size and scrolling

Set `viewportClassName` to size the owned scrolling element. Setting a height on
the outer root alone does not resize the viewport:

```tsx
import { Pullground, type PullgroundProps } from '@johnson7543/pullground';

export function PullPage({ children, onPull }: Pick<PullgroundProps, 'children' | 'onPull'>) {
  return (
    <Pullground onPull={onPull} viewportClassName="page-viewport">
      {children}
    </Pullground>
  );
}
```

Add this rule to your application's CSS:

```css
.page-viewport {
  block-size: 100svh;
}
```

For an embedded panel, use a bounded size such as
`block-size: clamp(14rem, 60svh, 30rem)` instead. Game artwork, strokes, aim,
and reveal proportions scale together with the viewport's shorter side.
There are no device-specific artwork sizing props.

Pulls start only when this viewport is at its top. It contains overscroll at its
boundaries; surrounding page scrolling remains available outside it. It does
not attach a pull gesture to `window` or replace the document's scroll policy.
Avoid putting all your content inside a separate nested scroller if that content
should start the pull gesture.

Links, form controls, editable content, and nested scrolling areas keep their
native interaction. Add `data-pullground-ignore` to a custom interaction surface
such as a map or canvas wrapper to exclude it from pulling.

## Props

| Prop | Type / default | Purpose |
| --- | --- | --- |
| `children` | `ReactNode`, required | Your content |
| `onPull` | `(context: PullContext) => void \| Promise<void>`, required | Run the host action |
| `onPullError` | `(error: unknown) => void` | Observe an active action failure |
| `game` | `PullgroundGame`, `'basketball'` | Choose the decorative interaction |
| `theme` | `PullgroundTheme`, `'classic'` | Choose the component palette |
| `disabled` | `boolean`, `false` | Block new actions and cancel an unfinished pull |
| `motion` | `'system' \| 'reduced'`, `'system'` | Follow the OS preference or force reduced motion |
| `labels` | `Partial<PullgroundLabels>` | Localize the region, instructions, and status |
| `className` | `string` | Class on the root section |
| `style` | `CSSProperties` | Inline styles on the root section |
| `viewportClassName` | `string` | Class on the owned scrolling viewport |
| `ref` | `Ref<PullgroundHandle>` | Access `trigger()` |

The package exports `Pullground` and these types: `PullgroundProps`,
`PullgroundGame`, `PullgroundTheme`, `PullgroundLabels`, `PullgroundHandle`,
`PullContext`, `PullSource`, and `PullOutcome`.

## Run an action from your own control

The package has no built-in action button. Connect an existing control through
the optional ref:

```tsx
import { useRef } from 'react';
import { Pullground, type PullgroundHandle } from '@johnson7543/pullground';

export function Actions({ onNext }: { onNext: () => void | Promise<void> }) {
  const pullground = useRef<PullgroundHandle>(null);

  async function runAction() {
    const result = await pullground.current?.trigger();
    if (result?.status === 'error') console.error(result.error);
  }

  return (
    <>
      <button type="button" onClick={() => { void runAction(); }}>Next</button>
      <Pullground ref={pullground} onPull={onNext}>
        <main>Your content</main>
      </Pullground>
    </>
  );
}
```

`trigger()` works at any scroll position and runs the action without a shot.
Concurrent calls join the same promise, including when the component becomes
disabled while work is pending. The promise resolves with a typed outcome rather
than rejecting for an action failure:

| Outcome | Meaning |
| --- | --- |
| `{ status: 'success' }` | The callback completed |
| `{ status: 'error', error }` | The callback threw or rejected |
| `{ status: 'aborted' }` | The component unmounted during the action |
| `{ status: 'skipped', reason: 'disabled' }` | A new action was blocked |
| `{ status: 'skipped', reason: 'unmounted' }` | The handle has no mounted controller |

A host-generated `AbortError` is still an action error. Only component disposal
produces the `aborted` outcome. Late settlement after unmount cannot change the
component's state, even if the host ignored its signal.

## Accessibility and localization

Focus the viewport at its top, hold Space or Enter to charge, then release to
play and run the action. Left/Right Arrow adjust aim while charging. Escape or
blur cancels. Nested controls retain their keyboard behavior.

The content subtree exposes `aria-busy` while work is pending. A separate polite
live region announces the state, and decorative game artwork is hidden from
assistive technology. There is no visible “release” or “working” wording.
Failure feedback remains visible so the user can retry.

Override only the labels you need:

```tsx
import { Pullground } from '@johnson7543/pullground';

export function Localized({ onNext }: { onNext: () => void | Promise<void> }) {
  return (
    <Pullground
      onPull={onNext}
      labels={{
        region: '可下拉的內容',
        instructions: '在頂部向下拉後放開。向右拉會向左發射。也可按住空白鍵或 Enter，以左右方向鍵瞄準，放開後執行。',
        release: '放開即可繼續',
        pending: '處理中',
        success: '完成',
        error: '發生錯誤，請再試一次。',
      }}
    >
      <main>你的內容</main>
    </Pullground>
  );
}
```

The default region is “Pullable content”; release, pending, success, and error
labels are “Release to continue”, “Working…”, “Done”, and “Something went wrong.
Try again.” The default instructions describe pointer and keyboard aiming.

The OS reduced-motion preference is always respected. Set `motion="reduced"`
to force static pull/progress icons and immediate closing. Hidden documents skip
decorative motion while the host action continues.

## Styling

Styles are included in server and client rendering and shared across instances.
The optional `@johnson7543/pullground/style.css` export exists for stylesheet
tooling, but importing it is not needed for normal use. The component inherits
your font and does not include a global reset or restyle child controls.

For custom integration, override these CSS variables on your root `className`:

| Variable | Role |
| --- | --- |
| `--pullground-surface` | Root and reveal surface |
| `--pullground-ink` | Text and focus |
| `--pullground-art-surface` | Board, target, pins, and stone facet |
| `--pullground-outline` | Edges, net, and ripples |
| `--pullground-accent` | Projectile bodies and effects |
| `--pullground-on-accent` | Ball seams and finger holes |
| `--pullground-muted` | Secondary status ink |
| `--pullground-divider` | Backboard marking |
| `--pullground-error` | Error text |

For example, `.your-root-class { --pullground-surface: transparent; }` lets an
existing page background show through. Preset and sizing defaults use low
specificity, so ordinary classes can override them. Keep text and focus visible
when applying your own colors.

## Compatibility and troubleshooting

The package ships ESM, CommonJS, and TypeScript declarations, with React
externalized. DOM-free imports and initial server rendering are supported.
In frameworks that separate server and client components, put usage inside your
application's client boundary. Framework-specific Server Component integration
and React 18 support are not claimed.

Automated validation covers React 19.0.0 and 19.2.8 in isolated consumers,
including Chromium touch emulation and SSR/hydration. The maintainer also reported
successful pull, aim, release, and return-animation checks on iPhone Safari and
Android Chrome. Desktop Firefox and Safari checks were also confirmed for
pull/aim, keyboard controls, demo Export-dialog focus, and reduced motion.
Device models and OS/browser versions were not recorded.

| Symptom | Check |
| --- | --- |
| Pull does not start | The owned viewport must be at scroll position zero, enabled, and outside an ignored/interactive or nested scrolling area |
| A short pull still runs the action | Any recognized positive pull is accepted; game power and scoring never gate the callback |
| The game disappears quickly | Your callback already finished; return the promise for actual pending work |
| The game is static | Check the OS motion preference and the `motion` prop |
| The viewport stays `24rem` tall | Apply sizing through `viewportClassName`, rather than only the root |
| An API error looks like success | Throw on non-success HTTP responses; `fetch` does not reject for HTTP error status alone |

For maintainers, see the
[architecture and checks](https://github.com/johnson7543/design/blob/main/docs/pullground/architecture.md)
and [release procedure](https://github.com/johnson7543/design/blob/main/docs/pullground/releasing.md).

## License

MIT. See [LICENSE](LICENSE).
