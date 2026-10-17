# Pullground architecture and verification

Status: Active implementation contract<br>
Scope: Package, host integration, input, lifecycle, and checks

[Back to the documentation index](README.md)

## Package boundary

The `@johnson7543/pullground` workspace is independent of DesignQR.
It exports one component, public types, and CSS. React 19 is externalized as a
peer. Vite emits ESM/CJS; TypeScript emits declarations. Only dist, README,
LICENSE, and metadata enter the tarball. There are no runtime dependencies,
browser globals at module import, or exported test hooks.

The component embeds the processed package CSS through React 19's
[style resource](https://react.dev/reference/react-dom/components/style).
React shares the stylesheet across instances and includes it in server-rendered
markup, so consumers need only the component import. The standalone CSS export
remains available. Root defaults and viewport sizing use zero-specificity
selectors so host classes override them before and after hydration.

The [package README](../../packages/pullground/README.md) owns usage and API
contracts. `/pullground` consumes built public exports without source aliases.
The home catalog uses that canonical URL; `/refresh` redirects to it.
`npm run dev` builds the workspace first; the production build compiles it before
the web app. These commands do not publish or deploy anything.

The demo sizes the component's owned viewport to the full page, placing the
shared header and integrated gesture hint inside its stable
child tree. The remaining page is an open pull surface.
The viewport is the page's vertical scroller; the reveal displaces that content
from the top. The package provides no action button or control row; its entry
points are pull, keyboard, and `trigger()`.
The demo's bottom bar is a sibling of the Pullground component, reusing DesignQR's
controls rail, glass customizer card, preset chips, and action row. The top row's
Basketball / Dart / Bowling / Stone skipping icon-and-label choices set `game`,
with Export right-aligned. At 640 px and below the choices form a two-column
grid while Export remains aligned to its top.
The theme preset row below sets the public `theme` prop;
the bar stays anchored through pull and return and owns its input independently.
An abortable 850 ms delay demonstrates pending and success states without fake
feed data or a separate demo state model.
The host's decorative chevrons and soft highlight repeat through CSS while
idle, pausing during a reveal, its return slide, and the Export dialog, then resuming at rest. Reduced motion keeps
them still. The cue never runs an action on its own.

The host page reuses DesignQR's Spring preset, `app-root` interface tokens,
header rail/brand styles, and shared [GitHubLink](../../src/components/GitHubLink.tsx).
The title is a non-interactive heading. GitHub live-count loading, validated
fallback, and request cleanup live in that shared component. These host imports
do not add a DesignQR dependency to the reusable Pullground package or example.

The React examples are real TSX modules for
[Basketball](../../src/pullground/react-example.tsx),
[Dart](../../src/pullground/react-dart-example.tsx),
[Bowling](../../src/pullground/react-bowling-example.tsx), and
[Stone skipping](../../src/pullground/react-stone-example.tsx), all checked by the
app build and displayed through Vite's raw imports. Export uses the selected
game's source through [the example generator](../../src/pullground/react-example-source.ts);
Dart, Bowling, and Stone skipping add their `game` prop, and nondefault palettes add `theme`. Display and
copy use the same trimmed source. It imports only the component, then shows a
plain `App` function wrapping page content. The async
`onPull` callback marks where consumers should run their action; it is a
placeholder, not a built-in host action. No prop-type wrapper, host CSS, or
imaginary endpoint is required. Its [copy interface](../../src/pullground/ReactExample.tsx)
is mounted only in the [Export modal](../../src/pullground/ExportModal.tsx),
a sibling of the Pullground component. Native `showModal()` provides background
inertness and focus containment; closing restores the previous focus. Escape,
the close control, and backdrop clicks dismiss the dialog. Backdrop dismissal
requires the pointer to start outside the surface so selecting code does not
accidentally close it. The demo disables new pulls while the dialog is open;
accepted work can still settle.
DesignQR's modal/code-card CSS and the shared
[CodeView](../../src/components/CodeView.tsx) provide the same theme and syntax
rendering without importing the QR-specific share workflow. Code is rendered as
text and spans, never inserted HTML. The file toolbar toggles
visual line wrapping independently of copied text. Clipboard failure selects the code
for manual copying; copy feedback timers are cleaned up on unmount.

## Internal responsibilities

| Source | Responsibility |
| --- | --- |
| [gesture](../../packages/pullground/src/gesture.ts) | Pure direction and positive-pull recognition |
| [shot model](../../packages/pullground/src/shot-model.ts) | Deterministic classification, shared pull/launch pose, and timestamp-based flight |
| [dart model](../../packages/pullground/src/dart-model.ts) | Shared pull/launch tip pose, power-based targeting, anchored impact wobble, and misses |
| [bowling model](../../packages/pullground/src/bowling-model.ts) | Grounded rolling trajectory, perspective, free horizontal aiming, contact propagation, and pin falls |
| [stone model](../../packages/pullground/src/stone-model.ts) | Diminishing ballistic hops, contact positions, depth, sinking, and expanding water ripples |
| [action controller](../../packages/pullground/src/action-controller.ts) | One active operation, shared outcome, cancellation/disposal |
| [input adapter](../../packages/pullground/src/input.ts) | Scoped touch/mouse/pen/keyboard and native child exclusions |
| [view controller](../../packages/pullground/src/view-controller.ts) | Per-instance resources, reveal/status measurement and decoration |
| [component](../../packages/pullground/src/Pullground.tsx) | Stable content, labels, semantic state and ref |

Action and decoration lifecycles are independent. Release starts the host
callback in the current turn's microtask, once per accepted release or activation.
`onPull` may return `void` for synchronous work or `Promise<void>` for pending
work. It is not a drag-progress callback. `PullgroundHandle.trigger()` invokes
the same action with `source: 'imperative'` without a shot. `onPullError` reports
an active failure; `labels.pending` supplies the general “Working…” announcement.
Success clears busy state, visible status, and any remaining shot immediately.
Closing commits the reveal's zero
height once, then uses a 180 ms Web Animation on the owned content's transform
to preserve a smooth visual return without relaying out the consumer tree on
each frame. The easing starts with zero velocity. There is no success hold or
minimum shot duration; reduced motion skips the return slide. The separate
live region still announces completion.
`theme` defaults to `classic`, with `simple`, `ocean`, and `midnight` as built-in
alternatives. The component renders `data-theme`; zero-specificity CSS presets
assign component palettes from the repository guide. `art-surface` owns the
backboard, fragment, and target fill independently of the host `surface`.
Related outline and body colors theme the game pieces, guides, and effects;
the demo does not supply these artwork colors. Theme is not
part of the action or motion state: changing it preserves the same controller,
gesture, accepted promise, and child tree. CSS paints the component surface;
the demo overrides it to transparent and maps only its stage background in
[demo themes](../../src/pullground/pullground-themes.css). Shared controls,
dialogs, and code retain DesignQR's tokens and reuse
[`src/demo-ui/`](../../src/demo-ui), following the
[demo UI standard](../global-standards/demo-ui.md).
`game` defaults to `basketball`; `dart`, `bowling`, and `stone` select alternative artwork and
motion models. All four SVG groups and their refs remain mounted; only the selected
group is displayed and animated. A game change cancels unsubmitted input and
clears decoration without recreating the controller, remounting consumer
content, aborting the signal, or replacing the accepted action promise.
The pull and shot use the full reveal for artwork, with no visible instruction
or status row. A CSS ring expands and fades while pulling; `samplePull` supplies
both the gesture pose and the initial shot pose, preventing a reset on release.
The dart uses `sampleDartPull`, bowling uses `sampleBowlingPull`, and stone skipping uses `sampleStonePull` for the same continuity. The basketball's squash
settles over the first 120 ms of flight. Reduced motion uses
a static release arrow instead of artwork.
A shared, short dotted aiming path samples the active shot model during the
pull; it uses owned SVG mutations and clears at release. All projectile models
accept a normalized pull direction, and the controller snapshots it with power when
the action is accepted. Flight never reads subsequent pointer positions.
Slow work retains only a compact, centered spinner after the shot. The release
and pending labels are announced through the live region without visible wording. Failure ends artwork,
preserves children, and exposes retry.

Pending callers share the exact Promise, including after the component becomes
disabled. Callback changes affect the next operation. Cleanup invalidates and
aborts accepted work, settles public outcomes, and consumes late settlement.
The host must still guard its own data writes against the supplied signal.
Host timeout/retry policy is not owned by the component. An active host rejection
is an error; only component disposal produces the aborted outcome.

Candidates record initial top-of-scroll eligibility and cannot become an accepted pull
by reaching the top later. Before claiming, upward movement or
`abs(dx) > max(5, abs(dy))` yields permanently. Claim when `dy > 0` and
`dy >= abs(dx)`. Maximum positive distance is separate from release distance.
Recognize coalesced touchend-only movement and ignore touch Pointer Events.
After claiming, preserve signed `offsetX` as well as vertical distance, including
the final release event. `clamp(logicalOffsetX / 90, -1, 1)` sets pull direction
independently of power; both axes use the same viewport and zoom conversion. Each gesture
starts centered. During keyboard charging, Left/Right Arrow move the logical
offset by 9 units, capped at ±90; they are not intercepted outside a charge.

Geometry uses one scale: `min(viewport.clientWidth, viewport.clientHeight) / 384`.
These are container layout dimensions, not window dimensions or zoomed screen
bounds. The controller passes the scale to CSS for the 160-unit court width and
uses it for the 168-unit pull cap and 144-unit shot reveal. SVG fitting preserves
the 160×132 coordinate system and scales every artwork element together.
Pointer/touch distance is converted from screen coordinates into these logical
units, accounting for host zoom once; keyboard charge already uses logical
units and retains its 1,750 ms duration. Ordinary status/error text keeps its
readable size independently of the decorative scene.

Power is `clamp(finalLogicalDistance / 180, 0, 1)`. The held x coordinate is
`80 + 12*direction`; the target-plane x coordinate is `80 - 48*direction`.
This keeps the held projectile under the pull while flight launches in the
opposite horizontal direction. The preview samples that same flight; release
preserves the held pose before moving toward the target.
Basketball perfect power is within 0.045 of 0.68; made power is within 0.12.
Perfect also requires a lateral offset of at most 3 units; made requires the
7.4-unit-radius ball to clear the 15-unit-half-width rim (offset at most 7.6).
Wider shots are misses and cannot wobble the net or pulse. Below/above the power
band remain short/long. Power comparisons use a 1e-10 arithmetic tolerance.
At full power, a ball overlapping the 42-unit-wide board at the contact plane
(center offset at most 28.4) produces `smash`; a wider throw flies past it.
These results only affect decoration.

The [net model](../../packages/pullground/src/net-model.ts) builds five
staggered rings of twelve knots into front and rear diamond-mesh paths. The top
ring remains fixed to the rim. A made ball retains 120 logical units/second of
downward velocity at the rim, then accelerates through the net. Its position
controls local clearance, lower-net stretch, and lateral deflection. After exit
around 804 ms, an analytic damped recoil starts at the free end and travels
upward; all knots settle by the existing 1,200 ms shot limit. Smash motion jolts
the free knots without detaching the rim. Misses use the resting geometry.
The ball paints above the mesh while rising or missing, and between the rear
and front cords during a descending make. The controller mutates the three
owned net paths in its existing shot frame, without another loop or React state.
The common artwork reset restores both geometry and drawing order immediately
on settlement, cancellation, hiding, reduced motion, or game changes.

A smash follows a separate 220 ms trajectory from the held pose to the board
face, holds contact for 35 ms with ball compression, then rebounds down toward
the aimed side (right for centered shots)
with faster spin. `sampleBackboard` and the five static fragment definitions
in the shot model drive the local board shake, fragment transforms/fade, and
single impact ring/rays at the contact position. All geometry remains in the shared 160×132 SVG space.
The same shot frame loop paints these owned SVG nodes without React updates,
extra timers, or consumer transforms. Normal shots do not paint the impact.
Fragments fade by 760 ms; the smash ends at 900 ms, while ordinary shots retain
their 1,200 ms limit. Action settlement still ends either shot immediately.
The existing artwork reset restores the intact board and clears all impact
opacity/transforms on completion, error, hiding, or reduced motion.

One effect lifetime owns listeners, ResizeObserver, motion/visibility
subscriptions, action controller, shot frame handle, and return Web Animation.
StrictMode replay leaves only the current resources. The frame loop runs only
for a keyboard charge or shot. Resize cancels unsubmitted input and scales an
accepted shot in the same SVG coordinate space. Return motion uses no JavaScript
frame loop. A new pull or action transfers its current transform offset back
into the reveal's layout before taking over, preserving visual continuity.
Completion, disposal, resize, hidden documents, and reduced motion release the
temporary transform.

Dart shares power and direction normalization. Its target center is (80,34), radius
23. For `delta = power - 0.68`, the tip aims at `(80 - 48*direction, 34 - 56*delta)`
and reaches that plane at 360 ms. Hits hold the tip steady while rotating the
shaft with a damped 280 ms wobble; misses fall away. A local outline pulse marks
contact, larger within the 3-unit bullseye radius. The dart rotates around its
tip and points along its trajectory from the held pose, using the difference
between the target and held coordinates. Decoration ends by 1,100 ms and
obeys the same completion, error, visibility, reduced-motion, and mode-change
cleanup as basketball. It never delays the host action.

Bowling renders only the ball and ten pins, with no ground artwork or hidden
side rails. The SVG allows horizontal overflow within the reveal so wide rolls
can pass beyond its logical side edges without being clipped.
It shares the same power, aiming, input, and action controllers. A held
ball starts at `(80 + 12*direction, 96 + 14*power)`. Its ground trajectory aims
opposite the pull at the head-pin plane (y=52); increasing power raises its
speed and travel distance. The ball rotates as it rolls and shrinks from 1 to
0.52 with depth. Horizontal position follows the aimed line without a lane-width
clamp. Wide rolls miss because they pass clear of the pins; collision detection
uses their actual position, without a separate gutter state.
The ball's opacity fades during the last 140 ms of `820 - 200*power` ms of
travel, reaching zero as the roll ends. Movement and rotation continue throughout
the visible fade; there is no stationary hold. Fully transparent balls stop
participating in collision detection while pin-to-pin motion can finish.
`createBowlingRoll` precomputes a lightweight planar collision model in fixed
1/240-second steps. Each pin has position, velocity, tipping direction, and
angular velocity. Body/head circles approximate its footprint; a tipping head's
contact velocity includes its angular motion. The prescribed ball trajectory
imparts one contact impulse per pin, using a six-to-one mass ratio. Pin-to-pin
contacts transfer opposing impulses along the contact normal. Each step
collects impulses before applying them, avoiding a left/right bias from SVG
array order. Gravity tips displaced pins; floor friction damps slides, and a
small floor bounce and soft rear-deck rebound contain the motion. This is a
small decorative approximation, not a general 3D rigid-body engine.

A light roll can stop short or leave pins standing; a stronger centered roll
can clear the rack. The ten SVG groups remain ordered back to front. Their
projected tipping poses can point left, right, or backward according to actual
contacts, including later redirection by another pin. `sampleBowlingPins`
interpolates the stored poses without mutation or frame-history dependence.
No random direction, preset row delay, or extra animation loop is used. The
1,100 ms decoration limit never extends the host action. The shared reset
restores the ball and every pin on settlement, game change, reduced motion,
document hiding, or cancellation.

Stone skipping renders a small flat pebble, a faint projected shadow, and up to
five pairs of elliptical contact ripples. It has no water rectangle or horizon.
`createStoneThrow` prepares the shallow launch and subsequent ballistic hops
once at release. Power controls forward speed, first-contact time, and rebound
energy. The first water contact occurs after `250 - 65*power` ms; later hops
lose 20% of forward speed and 32% of vertical launch speed at each contact.
Hops shorter than 55 ms end the sequence, capped at five contacts. The held
pose is `(80 + 12*direction, 98 + 12*power)` and launch velocity aims opposite
the horizontal pull. Depth scales the pebble and ripple sizes uniformly.

Each contact stores its actual timestamp and water coordinates. Two flattened
rings expand in place, the second delayed by 60 ms; both fade out within 360 ms
of contact. The pebble keeps drifting while it sinks over 120 ms, becoming
invisible before the demo's 850 ms action completes. `sampleStoneShot` and
`sampleStoneRipples` depend only on the prepared throw and elapsed time, so
sampling at different frame rates never moves an existing contact ripple.
The shared animation loop ends after the final ripple (at most 1,037 ms), or
immediately on action settlement, game change, reduced motion, or document
hiding. Synchronous actions still complete without waiting for the throw.

## Verification

From the repository root:

```sh
npm run test:pullground
npm run typecheck:pullground
npm run lint
npm run docs:check
npm run design-docs:check
npm run color:check
npm run style:check
npm run build
npm run smoke:pullground
npm run check:pullground-package
npm run smoke:demo-ui
npm run smoke:production
```

The [unit suite](../../packages/pullground/test/model.test.ts) covers gesture
direction, tiny/zero-final pulls, shot boundaries, continuous pull-to-flight poses,
full-power contact/compression/rebound and fragment timing, dart continuity,
power/direction-based hits and misses, mirrored flights, continuous aimed release,
and anchored dart impact. The [net suite](../../packages/pullground/test/net.test.ts)
covers fixed rim attachments, opening/stretch/recoil, angled contact, still
misses, bounded continuous motion, and frame-order independence. Action checks cover
operation deduplication, synchronous work for all activation sources, errors,
retry, callback changes, and disposal with late settlement.
The [bowling suite](../../packages/pullground/test/bowling.test.ts) covers release
continuity, grounded rolling, perspective, short/partial/strike/wide-miss results,
straight travel beyond the former lane edges without inward deflection,
disappearance during motion with no stationary visible ending,
mirrored aiming and contacts, momentum transfer, opposite falls of the same pin,
straight-back foreshortening, bounded continuous motion, and deterministic
sampling independent of frame order.
The [stone suite](../../packages/pullground/test/stone.test.ts) covers held-pose
continuity, power-based distance and contact counts, diminishing hops, mirrored
aim, contact-only ripples, stable ripple centers, sinking during motion,
bounded poses, and frame-order independence.

The [browser check](../../scripts/smoke-pullground.mjs) drives the
[consumer fixture](../../examples/pullground-consumer) with controlled
Promises, synchronous local content updates, Chromium mouse/keyboard/touch,
multiple instances, cancellation, reduced motion, and responsive layouts.
Completion assertions cover immediate and delayed actions, unfinished shots,
hidden documents, and reduced motion:
no visible status or artwork remains, closing begins immediately, and the live
announcement is preserved. A real made shot verifies mesh deformation beneath
a fixed rim, front-cord occlusion, and immediate restoration on completion.
Full-power mouse/touch and keyboard shots verify
the shatter effect and reset after success, failure, hiding, and reduced motion.
Frame samples check that return motion progresses
while the consumer layout stays fixed, and an interrupted return preserves its
current position. It checks the production demo, home
navigation and the legacy route redirect, the shared header/GitHub control, the anchored bottom control bar,
game selection by mouse/touch/keyboard, Dart, Bowling, and Stone skipping geometry at every demo size,
signed mouse/touch aiming, keyboard arrow steering, recentering between pulls,
bowling strikes/partial racks/wide misses, unclipped travel beyond the SVG side edge,
opposite impact directions on the same pin,
and pin resets on settlement or mode changes, stone aiming and contact ripples,
stone disappearance while work remains pending, and ripple cleanup on completion,
failure, game changes, reduced motion, and document hiding,
aim normalization through resizing/embeds/zoom, and full-power board misses,
mode changes during accepted work or unsubmitted charging, content identity,
full-page pull geometry, proportional artwork/gesture sizing across container
sizes, landscape, and CSS zoom,
content displacement, wordless pull guidance with its live announcement,
Export opening/dismissal, focus containment/restoration, modal sizing, native
code scrolling, exact clipboard contents, pending-copy feedback, and manual
copy after a clipboard rejection. It verifies automatic styles, one shared stylesheet after
remounting, host CSS overrides, and a centered hint within the single-row header.
Screenshots go to `/tmp/pullground-screenshots` by default;
set `CHROME_BIN` to choose Chromium.

The [package check](../../scripts/check-pullground-package.mjs) installs a
retained tarball into a temporary consumer, preferring npm's cache and downloading
missing dependencies (`--offline` makes this cached-only). It compiles every complete TSX
example from the packed README and all sixteen game/theme combinations from
the actual Export generator. It also checks ESM/CJS, styled server rendering
before JavaScript, hydration, and browser interactions without repository source
aliases. `--tarball` validates an existing archive without repacking;
`--react-version 19.0.0` tests the minimum declared runtime. The temporary consumer
is removed, while the archive, checksums, manifest, and per-React result remain
under `artifacts/pullground/`. See the [release procedure](releasing.md).

Chromium touch emulation is not physical iOS validation. Firefox, Safari/iOS,
React 18, and framework-specific Server Component integration need separate
validation before support is claimed. Manual assistive-technology testing
complements the DOM accessibility assertions.
