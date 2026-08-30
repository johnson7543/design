# Design platform color mappings

Status: Active product specification<br>
Scope: Catalog home, shared route loading, fallback page, and favicon

[Back to the Design platform documentation index](README.md)

This document assigns colors from the
[global repository allowlist](../design-system/colors.md) to Design platform
roles. It does not authorize new base colors.

| Role | Approved base color | Applied components |
| --- | --- | --- |
| Primary ink | `#4c3540` | Brand, catalog heading, card text, fallback heading |
| Muted ink | `#80656f` | Navigation, catalog description, footer |
| Fallback muted ink | `#7f626c` | Not-found explanation |
| Brand accent | `#98596e` | Route loader, focus base, title accents, fallback mark and action |
| Atmosphere top | `#f6e2d5` | Home, loading, and fallback gradient |
| Atmosphere bottom | `#f1cdbd` | Home, loading, and fallback gradient |
| Blossom accent | `#f4b4cf` | Ambient glow, fallback mark, favicon block |
| Meadow accent | `#86b668` | Ambient glow and favicon block |
| Bright atmosphere | `#fffbf9` | Home atmospheric wash |
| Preview surface | `#fff9f7` | Catalog preview glass and favicon light block |
| Preview edge | `#fffcfa` | Catalog preview frame |
| Bright foreground | `#ffffff` | Hovered preview edge and primary-action text |
| Plum shadow | `#7d4e60` | Catalog preview elevation |
| Favicon blossom seam | `#f8d9e5` | Favicon overlap detail |
| Favicon meadow seam | `#b7cf9e` | Favicon overlap detail |

Alpha variants of these bases provide grid lines, glass surfaces, focus rings,
and shadows. The Spring route background may consume the matching values from
the shared seasonal runtime preset.
