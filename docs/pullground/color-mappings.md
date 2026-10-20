# Pullground color mappings

Status: Active product specification<br>
Scope: Package UI, basketball, dart, bowling, stone skipping, and `/pullground` demo

[Back to the design documentation index](README.md)

Colors come from the [global repository allowlist](../global-standards/colors.md).
This document assigns roles without authorizing new base colors. The executable
source is the [package CSS](../../packages/pullground/src/style.css).
Each preset gives the component's artwork its own palette within one color
family. Backboards, targets, and bowling pins have a material fill, edges and nets have an
outline tone, and balls/darts/stones have a body color reused by guides and effects.
These stay coordinated without contrasting highlight colors. Presets must
remain distinguishable when the surrounding page and reveal use the same background.
Text and keyboard focus retain readable contrast. All presets use these roles:

| Token suffix | Approved value or derivation | Components |
| --- | --- | --- |
| `surface` | Palette surface below | Component surface and reveal background |
| `art-surface` | Palette material below | Backboard, board fragments, dart target, bowling pins, and stone facet; independent of the host background |
| `ink` | Palette ink below | Text, focus, status icons |
| `on-accent` | Ink; Simple uses surface | Ball seams and bowling ball finger holes |
| `muted` | 70% ink mixed with surface; Ocean uses 75% | Status and secondary text |
| `divider` | 65% outline mixed with art surface | Board square |
| `outline` | Palette outline below | Backboard, fragment edges, net (rear cords at 35% opacity), target edge, dart shaft/tip/barrel, bowling pins, stone edge, stone shadow (up to 14%), and paired water ripples (up to 55% / 30%) |
| `accent` | Palette body below | Basketball, bowling ball, and stone body, rim, target rings/bullseye, dart flights, bowling pin bands, dotted aim guide at 40% opacity, fading release ring, hit pulse, and full-power impact ring/rays |
| `error` | Inherits `ink` | Persistent error text and announcement |

Tokens use the `--pullground-` prefix. Success is announced without a
visible status row. Essential text targets 4.5:1;
control graphics/focus target 3:1. Decorative dividers are not control boundaries.
Consumer color overrides are runtime input and need their own contrast review.

All four built-in palettes work with all four games. Theme selectors have zero
specificity so consumer classes and inline variables can override them:

| Theme | Surface | Ink | Art material | Outline | Body |
| --- | --- | --- | --- | --- | --- |
| `classic` | `#fff9f1` | `#3f352b` | Warm stone `#ebdbd3` | Sand `#9d8c73` | Tan `#c2a27c` |
| `simple` | `#ffffff` | `#000000` | Surface | 70% ink mixed with surface | 55% ink mixed with surface |
| `ocean` | 8% `#95cfb6` mixed with white | `#064e3b` | Seafoam: 35% `#95cfb6` mixed with white | 40% `#95cfb6` mixed with ink | Muted teal: 65% `#95cfb6` mixed with ink |
| `midnight` | `#0f172a` | `#cddbe4` | Deep blue `#29445f` | Pale blue `#809dca` | Muted blue `#436ea4` |

Ocean blends the approved seafoam base with white (`#ffffff`) or its deep green
ink. Its green family stays visually distinct from Midnight's blue artwork,
including on a common host background. Muted text uses a 70% ink blend against
the selected surface; Ocean uses 75% to preserve readable contrast. Art fills and
outlines are component-owned and do not depend on a demo-page color override.
Simple uses only achromatic colors, including
error and success feedback. Midnight paints the owned component surface to
keep its light ink readable. No palette changes gesture or motion behavior.

The demo follows the [shared demo UI standard](../global-standards/demo-ui.md).
Its shared components consume DesignQR's unchanged
[interface tokens](../../src/styles/design-tokens.css) and
[UI color mappings](../designqr-editor/color-mappings.md). Component themes own
the game artwork and stage background; they never redefine those control roles.

| Demo role | Shared token or treatment | Components |
| --- | --- | --- |
| Interface ink | `--qr-ink`, `--qr-ink-muted` | Labels, GitHub, choices, modal title/description, code toolbar |
| Play guide | `--qr-ink` | Centered “Pull” cue and rounded down arrow; the arrow uses 65–90% opacity, with emphasis from weight and motion without an accent color |
| Primary action | `--qr-accent`, `--qr-on-accent` | Shared icon-only Export square with the upward tray glyph |
| Panels and dialogs | `--qr-surface-panel`, `--qr-surface-elevated` | Bottom glass panel and native Export dialog |
| Ordinary controls | `--qr-surface-control`, `--qr-surface-control-hover` | GitHub, game/theme choices, Copy, Wrap |
| Selection | `--qr-surface-solid`, `--qr-border-strong`, `--qr-shadow-control-active` | Selected game and preset |
| Borders and focus | `--qr-border-*`, `--qr-focus-color` | Shared boundaries and keyboard focus |
| Copy success, including hover | `--qr-success` surface/border and `--qr-on-accent` check | Same feedback as DesignQR's code controls |
| Code | Shared `--qr-code-*` syntax palette | React examples in every game theme |
| Modal backdrop | Shared warm shadow at 45% opacity and 8 px blur | Native dialog backdrop |
| Artwork | Component material, outline, and body palettes above | Basketball, hoop, dart, target, bowling ball/pins, stone/ripples, guides, and game effects |
| Exposed night text | `--qr-on-night-stage`, `--qr-night-stage-border` | Midnight title, centered hint, “Pull” guide and arrow, header divider, and viewport focus |
| GitHub on a night stage | `--qr-surface-control-hover`, `--qr-surface-solid` on hover, `--qr-on-night-stage` focus | More opaque shared surface preserves contrast with normal interface ink |
| Pull highlight | Shared control-hover surface, fading to transparent | Diffuse pulsing glow behind the centered hint |

Only [stage colors](../../src/pullground/pullground-themes.css) vary around
the component. Classic consumes `TREE_THEME_PRESETS.spring` from the public
DesignQR package. Every stage uses a radial background centered at 50% / 30%:

| Demo theme | Stage background |
| --- | --- |
| Classic | Spring preset `#f6e2d5` → `#f0ccbd` |
| Simple | White → 4% black mixed into white |
| Ocean | 8% `#95cfb6` mixed into white → 18% `#064e3b` mixed into that surface |
| Midnight | 8% `#cddbe4` mixed into `#0f172a` → `#0f172a` |

The full-page component and reveal stay transparent over the stage. Backboard,
fragments, and target faces retain their own component material fills. Midnight
uses the common night-stage treatment for exposed header, hint, and guide text while its
GitHub control, bottom panel, and Export dialog keep the standard warm surfaces.
Simple's game and stage are achromatic; surrounding demo controls and syntax
retain the shared interface. The package itself has no demo UI dependency.

The package keeps Classic as its default for other consumers. The recorded catalog
preview preserves the Classic game palette and Spring stage without a color filter.
Its surrounding frame belongs to [home color mappings](../home-page/color-mappings.md);
the catalog runs no live gameplay.

The standalone [social video](../demo-videos/README.md#pullground-video-for-x)
records the complete demo UI with its existing Classic artwork, Spring stage,
and shared controls. It adds no editorial artwork, text, or color treatment.

Alpha and programmatic blends derive only from approved bases. Component
presets affect only their own instance. Demo stage styling is scoped to the
Pullground route; shared controls remain consistent across registered demos.
