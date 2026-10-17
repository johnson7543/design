# Pullground style principles

Status: Active interface contract<br>
Scope: Reusable component and the `/pullground` demo

[Back to the design documentation index](README.md)

## Intent

Ordinary content becomes briefly playful when a pull runs an action.
Show one tiny game at a time: basketball by default, a dart and target with
`game="dart"`, a ball and ten pins with `game="bowling"`, or a skipping pebble with
`game="stone"`. Bowling keeps the background clear, without lane outlines,
gutters, or floor marks. Stone skipping suggests water through contact ripples
and a faint shadow, without a horizon, water panel, or scene frame. No scoreboard,
power meter, sound, trails, or confetti.
The package artwork uses flat, tonal colors from the repository guide.
Each preset stays within one color family, using coordinated material, outline,
and body tones for the ball, dart, stone, targets, and effects without a contrasting
highlight color. Component themes must remain visibly distinct on a shared
host background; changing the demo chrome is insufficient. The demo embeds
the pull interaction into the whole page using DesignQR's header and control geometry.
The [shared demo UI standard](../global-standards/demo-ui.md) owns the header,
bottom panel, Export, dialog, and code controls. Classic retains its Spring
background; other presets change the stage while the surrounding controls keep
DesignQR's standard warm interface. Consumers own content and the action. `onPull` runs once on accepted release,
keyboard activation, or `trigger()`; it accepts `void` or `Promise<void>`.
Default announcements describe a general action: “Release to continue”,
“Working…”, and “Done”. Hosts can localize them through `labels`.
Maximum power can shatter the backboard; its five fragments stay local to the
basketball scene and use the same flat surface and outline treatment.

Executable sources are the [package CSS](../../packages/pullground/src/style.css),
[component](../../packages/pullground/src/Pullground.tsx), and
[view controller](../../packages/pullground/src/view-controller.ts).

## Layout and responsive behavior

- Fill the host width, inherit its font, and scope CSS to owned elements.
  Do not restyle arbitrary consumer buttons, links, SVGs, or text.
  Styles accompany the component automatically on server and client; repeated
  instances share one stylesheet. Consumer classes can override root defaults
  and viewport sizing without depending on stylesheet order.
- The package has no action button or control row. Pull and keyboard activation
  work directly on the viewport; hosts can use the imperative handle for their
  own controls.
- `theme` defaults to `classic` (warm stone board/target and tan ball/dart), with
  `simple` (white board/target and graphite artwork), `ocean` (seafoam
  board/target and muted teal artwork), and `midnight` (dark filled
  board/target and muted blue artwork with pale-blue edges).
  Ocean and Midnight use distinct green and blue color families, respectively,
  so their artwork differs beyond light versus dark surfaces.
  Presets set scoped color tokens on the component, including its surface,
  artwork, status, and focus. Backboards, fragments, dart targets, and bowling pins use an
  independent `art-surface` material, also used by the stone's small facet. Ball/dart/stone fills, rim, target rings,
  guides, and effects use the body tone; nets and edges use the outline tone.
  Pin bands use the body tone; water ripples and the stone shadow use the outline.
  Ball seams and finger holes use ink through
  `on-accent`; Simple uses its white surface.
  Text and keyboard focus keep sufficient contrast for readability.
  Host classes and inline variables can override every
  preset. Theme changes recolor the current scene without canceling input,
  resetting motion, remounting children, or interrupting accepted work.
- The owned viewport defaults to 24rem and accepts a sizing class. Idle reveal
  height is exactly zero. Pulling expands in normal flow, displacing the same
  child tree without remounting it.
- All game scenes, the reveal, gesture power, and left/right aim share a scale based on the
  viewport's shorter side. The court width is 5/12 of that side, accepted-shot
  reveal height is 3/8, and maximum pull height is 7/16. There are no fixed
  pixel caps or device breakpoints for the artwork. Pull height follows 88% of
  the drag distance until that proportional maximum. The SVG preserves its
  160:132 aspect ratio, fitting inside the changing reveal while pulling; ball,
  hoop, dart, target, bowling pins, stone, ripples, strokes, spacing, and trajectory scale together. Equivalent pulls
  relative to the container produce equivalent poses, shot power, and aim, including
  embedded containers, landscape layouts, and CSS zoom. There is
  no instruction or status row alongside the scene. Wide bowling rolls continue
  beyond the SVG's side edges within the reveal, without clipping or invisible
  gutter boundaries redirecting them. After the shot, pending
  work uses only a centered spinner in the 44 px status row, without visible
  wording. Error text can grow the status row. Success ends any remaining shot,
  clears visible status immediately, and closes the reveal's layout once. The
  same content tree then slides back over 180 ms using a temporary transform,
  with easing that starts smoothly instead of jumping. Consumer layout does
  not change on every return frame. There is no feedback hold; reduced motion
  closes immediately without a slide.
- Static spacing and layout live in CSS. Per-frame height/poses belong to the
  controller. Use the 4/8/12/16/24 px spacing steps.
- The demo uses a single Pullground viewport spanning the entire page. Its header,
  gesture hint, and short guide are children of the pullable content, so pulling reveals
  the selected game above the header and moves that content together. The space
  below the header accepts pulls, including the guide and page gutters.
  A bottom control bar stays anchored outside the pullable content. The React
  example lives in the Export dialog, also outside the
  scrolling/animated content. There is no enclosing demo card, frame, shadow,
  grip, action button, sample feed, or extra explanatory copy.
- A single word, “Pull”, and a downward arrow form a centered vertical group at
  45% of the pullable content's height, clear of the header and bottom controls.
  It uses the shared sans-serif family, 64–144 px responsive display type,
  a unit line height, -0.05em tracking, and medium-weight primary ink.
  The word has an elastic downward tug:
  an 8 px shift and 60% vertical stretch from its top edge, then a small
  recoil. The 3.6-second cycle rests for over half its duration; no layout moves.
  A slender arrow sits 16–24 px below the word. Its long shaft and rounded
  arrowhead scale from 32×48 px to 48×72 px. It inherits the same ink at
  65% opacity, moving down by 60% of the text size plus 16 px and brightening
  to 90% in time with the word's tug, then recoiling gently. This keeps the
  arrow below the stretched word at every size. The SVG is decorative and never takes focus.
  The guide has no card, border, or interactive surface, so dragging over its
  word or arrow still pulls the page. Both hide and pause during a reveal and return,
  then reappears when the page settles. Export pauses the motion; reduced
  motion keeps the word and arrow static. The same guide serves all four games.
- The shared `DemoHeader` uses its flow placement so it moves with the pull.
  It matches DesignQR's 760 px rail, 82 px height, and 32 px page edges;
  at 620 px and below it uses 72 px height and 18 px edges. “Pullground”
  is a non-interactive product heading in the shared brand typography. The
  right side reuses DesignQR's official GitHub mark/live-star-count pill, with
  the same fallback, accessible action name, hover, pressed, and focus states.
  A pull cue sits at the exact center of the header, between equal
  flexible columns for the title and actions. A wordless 28×32 px SVG shows
  two downward chevrons at every width. At 360 px and below the SVG is 24 px wide,
  leaving room for the full title with fallback fonts. The title, hint,
  and header actions stay vertically centered on one row. The hint accepts pulls
  through the containing header and hides during a reveal while keeping its
  footprint, so the title and GitHub control stay in place relative to each other.
  The chevrons softly blink from 30% to full opacity while moving down 5 px,
  staggered by 160 ms. A diffuse glass highlight pulses behind the cue.
  These repeat continuously in 2-second cycles, including after an action.
  The header stays still. The animation pauses while the reveal is
  visible, during the return slide, and while Export is open; reduced motion shows the still cue from
  the start.
  Header content stays in normal flow so it moves with the page during a pull.
- The bottom control bar reuses DesignQR's centered 580 px controls rail and
  glass customizer card, with the shared drawer padding, radius, and control
  states. It sits 24 px above the bottom safe area on desktop; at 640 px and
  below it uses an 8 px bottom gap and side gutters. Export is aligned to the
  right of the top row using `DemoExportButton`: the same accent square and
  18 px upward tray icon as DesignQR, without a visible label at any width.
  Its accessible name remains “Export React example”. The top row's left side has Basketball, Dart, Bowling, and Stone skipping choices using
  DesignQR's season-chip surfaces, spacing, typography, and standard control
  height. Each label has a 15 px outline icon: a basketball, dart target, bowling ball, or stone above ripples,
  inheriting the button's text color and hidden from assistive technology.
  At 640 px and below, the game choices form a two-column grid beside the
  top-aligned Export button; the shared chip height and theme row stay unchanged.
  Icons and full text labels remain visible on compact screens. Exactly one game is
  selected; native buttons expose `aria-pressed`, support Enter/Space, and have
  hover, pressed, disabled, and visible keyboard-focus states. Selecting a game
  never starts an action. Below the game and Export actions, a full-width
  preset row reuses DesignQR's `season-tabs` and `season-chip` styles for
  Classic, Simple, Ocean, and Midnight. All four names remain visible on one
  row at 320 px, using the shared control height, spacing, surface, border,
  and selected treatment. Native buttons expose `aria-pressed`, support
  Tab and Enter/Space, and retain hover, pressed, disabled, visible focus,
  and reduced-motion states. Focus outlines are not clipped by the row.
  Choosing a theme updates
  the component and stage background without recoloring the shared controls or
  starting an action. The bar does not move
  during pull, pending work, or return; dragging its surface never starts an action.
  The rail's transparent outer gutters still accept page pulls.
  The demo pull surface and control bar disable native text selection so
  dragging cannot select header text and turn the next pull into a browser
  text drag. Export code keeps normal selection and scrolling; consumer content
  in the reusable package keeps its existing text-selection behavior.
- The demo component and reveal backgrounds are transparent,
  preserving the selected radial page background. Typography, muted ink, glass surfaces,
  control states, and focus color reuse DesignQR's unchanged `--qr-*` tokens.
  Midnight uses the common night-stage treatment for exposed title, hint, guide, and
  viewport focus, plus the more opaque shared GitHub surface and light focus
  outline; panels and dialogs retain the warm shared surfaces. The
  full-page keyboard focus outline is inset 4 px so it remains visible.
- Export uses DesignQR's modal backdrop, elevated glass surface, title/close
  row, and code-card styles. Its responsive footprint is 560 px wide and up to
  580 px tall, with 24 px padding and radius on desktop. At 640 px and below it
  follows DesignQR's bottom sheet: 12 px outer edges plus the bottom safe area,
  18 px padding, and a 16 px radius. The title is “Export”, followed by a short
  React usage description. The example follows the game and theme selected in
  the bottom bar; Dart adds `game="dart"`, Bowling adds `game="bowling"`, Stone skipping adds `game="stone"`, and a nondefault palette adds
  `theme="simple"`, `theme="ocean"`, or `theme="midnight"`. Default props stay
  omitted. Every theme keeps the same shared dialog, syntax, and copy feedback;
  Simple's monochrome palette applies to the component and stage.
  No additional selector
  appears in the dialog.
  A native modal dialog makes the background inert, focuses Close on opening,
  and keeps keyboard focus inside. Close, Escape, or a click/tap starting and
  ending on the backdrop dismiss it and restore focus to Export. Pull input is
  disabled while open; code scrolling never reaches the pull surface.
- The React code card fills the remaining dialog space. Its fixed toolbar pairs
  a file icon and “App.tsx” with the shared 34 px icon-only Wrap lines and Copy controls.
  These use DesignQR's bordered control surfaces and focus treatment. Wrap lines
  exposes `aria-pressed` and a stronger tonal border when selected. The code area owns
  vertical scrolling; the title, Close, and toolbar remain available on short
  screens. Typography and syntax come from the shared DesignQR code renderer:
  0.72rem monospace, 1.55 line height, and 12 px padding; compact screens use
  0.68rem and 10 px padding. Long lines wrap by default. Disabling Wrap preserves
  source line lengths and scrolls horizontally inside the code area. Neither
  mode expands the dialog or page.
  The source uses one component import, a plain `App` function, and an async
  callback with a clearly marked place for the consumer's action. Copy has
  hover, pressed, focus, and pending-disabled states. Success changes the icon
  to the shared success check and surface for 1,800 ms and announces it.
  Clipboard failure focuses/selects the code and shows a manual-copy message.
  Closing the dialog clears copy feedback; reopening starts with wrapped code.
- Preserve usability at 1440×900, 390×844, 320×568, 280 px embedded width, and
  zoomed/translated layouts. Wrapped status rows grow without clipping.

## Component contracts

| Component | Contract |
| --- | --- |
| Artwork | SVG viewBox 160×132; basketball uses a 42×28 backboard, small rim with a tapered diamond-mesh net, and one flat ball; Dart uses a 46-unit circular target centered at (80,34), two inner rings, a bullseye, and one dart; Bowling uses only ten pins in four rows and a ball with three finger holes, with no ground artwork; Stone skipping uses one flat pebble, a faint shadow, and paired contact ripples; uniformly scales inside the reveal |
| Pull | Wordless: the held projectile follows downward strength and signed left/right movement; release launches in the opposite horizontal direction like a slingshot. The ball gently rotates/squashes, while the dart points along its flight. A soft release ring and short dotted trajectory preview provide guidance without labels; the preview ends immediately on release |
| Basketball shot | Continues from the held, aimed ball pose, relaxing its squash over 120 ms; ordinary shots reach their apex around 300 ms and rim around 580 ms, ending within 1,200 ms or when work settles. A make requires both suitable power and clearance inside the rim; wide shots miss without net wobble or a success pulse |
| Made basket | Twelve rim attachments stay fixed while the diamond mesh opens around the descending ball. The narrow throat stretches down by up to 6.5 logical units and follows an angled make. The ball passes in front on ascent, then behind the near cords on descent. After exit around 800 ms, the free end recoils first with a small damped ripple toward the rim; the mesh settles by 1,200 ms. Rear cords use 35% outline opacity for depth. No extra completion hold |
| Dart throw | Continues from the held tip pose and reaches the target plane at 360 ms; horizontal pull aims in the opposite direction, medium power aims at center height, stronger throws land higher, and weak or wide misses fall away. Only hits inside the circular target anchor the tip and briefly wobble the shaft; one local outline pulse marks the actual contact, larger within the bullseye. The throw ends within 1,100 ms or immediately when work settles |
| Bowling roll | Continues from the held ball pose in the aimed direction, rotating the finger holes and shrinking with depth. More power increases travel, speed, and pin impact. Light pulls stop short; sideways aiming can knock part of the rack or miss it entirely. Wide rolls travel freely without side rails. The ball fades out while still rolling, with no visible pause at its endpoint. Strong centered rolls can clear all ten pins. Contact impulses determine each pin's tipping direction, slide, and secondary collisions. A pin can fall either way regardless of its position in the rack; straight-back falls foreshorten against the ground plane. Floor friction and a small landing bounce settle the motion; untouched pins remain still. Pin motion ends within 1,100 ms or immediately when work settles |
| Stone skipping | Continues from the held pebble pose and travels opposite the pull direction. Stronger throws reach farther and make up to five water contacts; each hop loses forward speed and height. Two flattened outline ripples expand at each actual contact and fade in place. The stone shrinks with depth, then drifts and fades as it sinks, disappearing within 800 ms. The final ripples end within 1,037 ms or immediately when work settles. No score, water panel, horizon, or extra completion hold |
| Maximum power | A fully charged basketball reaches the board plane at 220 ms. Contact compresses the ball for 35 ms, then rebounds down toward the aimed side (right when centered). The board shakes and separates into five pieces, with a brief ring/rays in the same artwork tone at the contact. Fragments fade by 760 ms, and the smash ends by 900 ms or settlement. A wide throw flies past without breaking the board. Only artwork moves; the page and toolbar never shake |
| Pending | Centered spinner without visible wording; busy state follows the real operation independently of artwork, and the polite live region announces the pending label |
| Success | Clear visible text and artwork immediately, close layout once and slide content back with a transform, and announce “Done” through the separate polite live region |
| Error | Persistent text; ends celebratory art and retains consumer content. Retry through pull, keyboard, or the imperative handle |

## Interaction, accessibility, and motion

Start a pull only at the top (`scrollTop <= 1`) with one primary contact. Ignore
controls, editable content, nested scrollers, interactive widgets, and
`data-pullground-ignore`. Initial upward/horizontal intent stays native.
Any recognized positive pull counts, including 4 px or a pull eased back to
zero. There is no distance or scoring gate on the action.
After downward intent is claimed, left/right movement steers freely while
vertical displacement continues to set power. The held projectile follows the
finger, measured relative to its starting point. Aim and flight oppose the pull
like a slingshot: pull right to shoot left, or left to shoot right. The preview
and dart orientation follow that flight, with no position jump on release.
Returning horizontally to the starting point recenters the shot. Pure
horizontal intent before a pull stays native.
Direction is captured on release and resets for the next gesture. Hits and
misses are decorative and always start the same action.

Touch is processed once, with movement cancellation scoped to claimed pulls.
The viewport contains boundary overscroll; surrounding page scroll remains
available outside it. Escape, lost capture, multitouch, disable-before-release,
resize-during-pull, and cancellation do not submit. Resizing a shot rescales its
logical artwork without canceling accepted work.
Changing `game` cancels an unsubmitted pull or charge and clears current
decoration. Accepted work continues with its busy state and promise;
consumer content stays mounted. The next pull uses the selected game.

The focused viewport at its top supports hold/release Space or Enter. Full
charge takes 1,750 ms. Repeats do not duplicate actions; blur/hidden document
cancels charging. Nested controls keep their key behavior. Keyboard activation
provides the non-drag alternative; `trigger()` works at any scroll position.
During a keyboard charge, Left/Right Arrow move the held pull in ten steps per
side, including key repeats; release launches in the opposite direction, as
with a pointer gesture. Arrow keys outside an active charge keep their native
behavior. Accessible instructions describe both pointer and keyboard aiming.
Pull, keyboard, and `trigger()` can all retry a failed action.

A new pull can interrupt the return slide from its current visual offset without
snapping to rest first. New actions also take over the current offset. The
temporary transform is removed on completion, unmount, resize, document hiding,
or a switch to reduced motion; it never persists on idle consumer content.

Focus uses a 2 px ink outline with 3 px offset. `aria-busy` belongs only to the
content subtree; a separate polite live region announces release guidance when
pulling starts, then action state. Release and pending labels are never
visible in the reveal. Hide
decorative SVG from assistive technology and preserve child focus/form semantics.

The release ring expands and fades over a repeating 1,400 ms cycle only while
pulling. The projectile's pose follows the gesture directly; release continues from
that same pose, without resetting position or rotation. The scene scales with
the reveal's current height so expansion does not clip a full-size scene.
The short dotted guide samples the actual shot model ahead of the held pose.
It uses the existing accent at 40% opacity, has no independent animation loop,
and is cleared on release, cancellation, mode change, or completion.
Basketball net motion deforms individual mesh knots in the same SVG space;
the rim never translates with the net. A made ball retains downward momentum
through the opening. Contact widens the mesh locally, then the free end springs
back after the ball clears. Short, long, and wide misses leave the mesh still;
a backboard smash gives its free cords a brief jolt while the attachments remain
fixed. Every artwork reset restores the resting mesh and its drawing order.
The full-power impact uses the same SVG coordinates and proportional scale.
It introduces no page shake, sound, or extra completion delay. Completion,
failure, hidden documents, and reduced motion immediately clear the fragments
and restore the intact board for the next pull.

The bowling ball fades during the final 140 ms of its power-dependent
620–820 ms roll. It is fully transparent when its movement ends; pins can
continue settling afterward. A completed host action still clears everything
immediately.
Bowling computes a lightweight collision simulation once at release, using fixed
1/240-second steps. Impact location and relative velocity determine impulses;
the sweeping heads of tipping pins can knock their neighbors. No rack-position
rule or random choice assigns fall direction, and there is no fixed delay
between rows. Tipping projects onto the lane, including foreshortening for
straight-back falls. Floor friction, gravity, a small landing bounce, and the
rear of the pin deck contain and settle the motion. Rendering interpolates
snapshots through the existing animation loop, with no integration during
painting. Game changes, completion, failure, page hiding, and reduced motion
immediately restore all ten pins and the ball. Scores never affect `onPull`.

OS/prop reduced motion shows a static upward release arrow while pulling and
a static progress icon while pending, omitting shots, dart throws, bowling rolls/pin falls, stone skips/ripples, aiming guides, backboard impacts, rings,
spinner rotation, and transitions.
Hidden documents skip decoration while actions keep settling. Frames mutate
owned SVG/height values, not consumer React state. No frame loop runs when idle.

## Implementation checklist

Check mouse, keyboard, real touch dispatch, tiny pulls, native scrolling, slow/
fast/failed actions, synchronous actions, retry, two instances, StrictMode, unmount, and callback
updates. Review required viewports, localization, focus, zoom, and reduced motion.
Keep [colors](color-mappings.md) synchronized and run the commands in
[architecture and verification](architecture.md).
