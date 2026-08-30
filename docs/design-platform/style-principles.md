# Design platform style principles

Status: Active interface contract<br>
Scope: Catalog home, shared route loading, and fallback/not-found surfaces

[Back to the Design platform documentation index](README.md)

## Intent

The platform is a quiet gallery for interactive work: warm seasonal atmosphere,
generous whitespace, restrained typography, and product previews that carry the
visual emphasis. Platform chrome should remain simpler than the designs it
introduces.

## Layout and responsive behavior

- The home shell is centered at a maximum width of 1240 px with 32 px desktop
  page edges and 18 px edges at 620 px and below.
- The shared site header uses the same rail geometry consumed by product pages.
- The catalog is capped at 1040 px. Cards use a 9:16 preview, remain at or below
  258 px wide, and form three columns by default, two at 900 px, and one at
  620 px.
- The heading and catalog spacing may scale fluidly, while card geometry and
  centered alignment remain stable.
- The footer is a quiet terminal rail, centered and separated by the platform
  divider color.

## Component contracts

| Component | Contract |
| --- | --- |
| Site header | Brand remains left and the compact primary navigation remains right on the shared header rail. |
| Catalog heading | Centered display title followed by one restrained descriptive line. |
| Catalog card | Entire preview is the link target; media stays 9:16, covered, noninteractive, and does not compete with platform navigation. |
| Route loading | Full-viewport seasonal surface with a compact status label and motion-safe spinner. |
| Not found | Centered message, one brand mark, concise explanation, and one primary route back home. |
| Footer | Copyright only unless a future platform-level requirement is documented. |

## Interaction, accessibility, and motion

- Keyboard focus must remain visible on navigation, catalog cards, and fallback
  actions.
- Catalog media is decorative, muted, excluded from the tab order, and paused
  when offscreen.
- Hover may lift a card without changing its footprint or causing neighboring
  layout movement.
- Reduced-motion mode removes the loading spin and catalog-card transition and
  prevents preview autoplay.

## Implementation checklist

- Reuse the shared header layout and design tokens before adding local values.
- Keep route metadata synchronized with the rendered page.
- Verify the catalog at desktop, two-column tablet, and single-column mobile
  widths.
- Verify keyboard focus, reduced motion, video fallback/poster behavior, and the
  not-found route.
- Keep platform color roles synchronized with [the platform color mappings](color-mappings.md).
