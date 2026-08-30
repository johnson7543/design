# Repository color registry

Status: Active global contract<br>
Scope: Every repository-authored interface, artwork, renderer, and asset color

[Back to the design-system documentation index](README.md)

This document is the complete color allowlist for the repository. A
repository-authored base RGB color is forbidden unless it appears below. The
ordering has no semantic meaning and does not prescribe how a color should be
used.

## Global color contract

- Reuse an approved semantic token or runtime palette constant before writing a
  raw color literal.
- Do not introduce a base color that is absent from the approved list. Updating
  the list requires an explicit user request to change the repository palette.
- Alpha values are rendering modifiers: any opacity may be applied to an
  approved base RGB color. Gradients, lighting, interpolation, and
  `color-mix()` may derive output colors only from approved bases.
- `transparent` and `currentColor` are approved semantic keywords. Other
  named CSS colors are prohibited; use an approved hex value or token instead.
- User-selected Custom Theme colors are runtime input and are not
  repository-authored defaults.
- Color roles and component mappings belong to each design's product
  documentation, not to this global registry.
- Run `npm run color:check` after changing colors.

## Approved base colors

These are the only repository-authored base colors that may be used. Hex is the
canonical notation; case and shorthand aliases normalize to the same base RGB
value.

<!-- approved-colors:start -->

```text
#000000  #00785e  #00ac7a  #02983b  #059669  #064e3b  #0f172a  #1c4ed8
#1e1b18  #282018  #286018  #2b221a  #305e88  #34d399  #38b04a  #3a8ef5
#3f352b  #40ad5a  #431407  #4c3540  #4f3235  #500724  #577a9e  #5c3824
#5d4c35  #5f4e3d  #6084a7  #60a5fa  #64585c  #6b9277  #7b4d26  #7d4e60
#7d6b5c  #7da3c4  #7f626c  #80656f  #85b667  #86b668  #88eeff  #8a987c
#8c4c16  #8caecc  #8da1b5  #95cfb6  #98596e  #99cc81  #9aa6b3  #9d8c73
#a3cae8  #a45e22  #a89888  #aec4e6  #b7cf9e  #bd3528  #bd956e  #bfd47b
#c07a3a  #c2d65c  #c38f95  #c6ae8d  #d0d3e2  #d32f2f  #d7de8a  #d8e5f0
#d98eaf  #d98eb0  #d9ebf8  #db2777  #e2451e  #e77433  #e8a0b0  #e8a800
#ea580c  #f0ccbd  #f1cdbd  #f3aa96  #f472b6  #f4a358  #f4b4cf  #f4f8fc
#f5af77  #f5f7fa  #f5f8fc  #f6e2d5  #f6f1e7  #f6f4d7  #f7e95e  #f8d2e3
#f8d9e5  #f8f0ec  #f9d3e3  #fbbf24  #fce0af  #fceef5  #fdf0f5  #fef6e9
#ffea44  #ffedf4  #fff9f1  #fff9f7  #fffaf3  #fffbf9  #fffcfa  #ffffff
```

<!-- approved-colors:end -->
