# DesignQR editor color mappings

Status: Active interface contract<br>
Scope: Editor controls, panels, syntax highlighting, and zoom chrome at /qr

[Back to the editor documentation index](README.md)

Use the [global approved colors](../global-standards/colors.md) through semantic
[`--qr-*` tokens](../../src/styles/design-tokens.css). Artwork colors belong to
[the package palettes](../designqr-package/color-palettes.md).

These interface roles also govern every demo through the
[shared demo UI standard](../global-standards/demo-ui.md). Game/artwork presets
do not recolor Export, GitHub, panels, choices, dialogs, copy feedback, or syntax.

## Interface surfaces

| Role | Semantic tokens |
| --- | --- |
| Text | `--qr-ink`, `--qr-ink-muted` |
| Panels | `--qr-surface-panel`, `--qr-surface-elevated` |
| Controls | `--qr-surface-control`, `--qr-border-default` |
| Primary actions | `--qr-accent` |
| Text exposed to Dōtonbori or Tokyo Tower night stages | `--qr-on-night-stage`, derived from the existing light interface color |
| Night-stage divider and exposed control borders | `--qr-night-stage-border`, the existing light interface color at 45% opacity |
| GitHub surface on night stages | `--qr-surface-control-hover`, becoming `--qr-surface-solid` on hover; normal interface ink and `--qr-on-night-stage` focus outline |
| Copy success, including hover | `--qr-success` surface and border, `--qr-on-accent` check |

Night-stage light ink applies to the 3D header title/capability badge and floating
Edit/Logo/Zoom disclosures. Their hover/open states reuse the warm control
surface, normal dark ink and accent border. GitHub keeps dark ink on a more
opaque shared surface; light panels keep existing mappings.
QR view restores the light scan backdrop and ordinary dark interface mappings.

## Interface syntax theme

Share-modal code examples use a light, Spring-aligned syntax palette. These
roles affect generated HTML, shell, and TSX presentation only; they do not alter
the rendered QR artwork.

| Role | Hex | Applied component mapping |
| --- | --- | --- |
| Keyword | `#98596E` | Imports, exports, declarations, and control-flow words |
| String | `#286018` | URLs, package names, labels, and string values |
| Tag / component | `#3A8EF5` | HTML tags and React component identifiers |
| Property | `#A45E22` | JSX props, object keys, and shell actions |
| Number | `#E77433` | Numeric configuration values |
| Literal | `#DB2777` | Boolean, null, and undefined literals |
| Comment | `#A89888` | Generated guidance comments |
| Punctuation | `#7D6B5C` | Brackets, operators, and separators |

## Editor preview zoom chrome

The left floating zoom disclosure reuses the Edit / Logo pill roles. Its
popover uses `--qr-surface-elevated`, `--qr-border-default`, and
`--qr-shadow-control-hover`; labels use `--qr-ink` and `--qr-ink-muted`.
Minus, percentage/reset, and plus use `--qr-surface-control`, the existing
control-hover and warm-pressed surfaces, accent borders, and the shared
`--qr-focus-color` outline. Limit-disabled buttons reduce opacity only. These
are interface roles, not new palette entries. Render-aware preview zoom applies
no color filter and changes neither palette assignments nor exported PNG colors.
The contextual River view action uses the same zoom-action ink, surface, border,
hover, pressed and focus roles.
