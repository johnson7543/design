# Tokyo Tower proportions

Status: Implemented Blender geometry correction<br>
Reviewed: 2026-09-20<br>
Scope: Construction elevations, silhouette, steelwork, and remaining accuracy limits

[Back to Tokyo Tower](README.md)

## Primary references

Miyaji Engineering's [Tokyo Tower seismic renovation report, Figure 1, page 65](https://www.miyaji-eng.co.jp/technology/newsletter/media/28/no28-p064-070.pdf#page=2)
provides an elevation of the real tower. The reviewed PDF has SHA-256
`03d3bb48c12d57671d7e75d52a3bb7b86470ec856be26481ff073dbbb7037f0f`.
The operator's [Landmark Light photograph](https://www.tokyotower.co.jp/lightup/img/img_002.jpg)
and [upper-structure photograph](https://en.tokyotower.co.jp/plan/towerpedia/img/img_004.png)
provide complementary oblique views. References are linked, not redistributed.

The drawing explicitly labels these construction elevations:

| Anchor | Construction GL |
| --- | --- |
| H3, lower bracing level | +40 m |
| H11, main observation floor | +120 m |
| H23, upper observation floor | +223.5 m |
| H27, antenna support transition | +252.65 m |
| Upper support stages | +312.6 m and +325.5 m |
| Tip | +333 m |

The operator's [150m Main Deck and 250m Top Deck visitor labels](https://en.tokyotower.co.jp/plan/towerpedia/)
are retained as attraction names. They are not used as construction coordinates.
The former model placed the observation enclosures at those advertised numbers,
stretching the lower body and shortening the antenna support.

## Implemented interpretation

The native Blender model now places its observation enclosures around the
dimensioned floor levels. A lower arch and cross-bracing from the H3 region
give the lower body its fuller steel silhouette. Intermediate posts and four
braced bays replace the visually sparse lower faces. The upper lift spine is
visible within the lattice. An open, braced antenna support replaces the solid
tapered spike, with the thinner terminal support above GL+312.6 m.

Horizontal dimensions are estimates from the elevation and photographs:
approximately 80 m between footing centers, a 30.6 m main roof, and a 14.6 m
upper roof. These values, arch curvature, steel sections, pane spacing, and
antenna fittings are authored interpretations, not dimensioned survey results.
The main body tapers between these references. Bright Landmark Light fixtures follow the revised
structural levels and are rebaked onto every surface.

The [asset inventory](../../../../assets/design-qr/tokyo-tower/part-inventory.json)
records construction heights separately from visitor labels. Geometry tests
check the observation floor ranges, deck widths, footing span, and presence of
lower bracing and antenna webs, alongside complete surface-to-QR coverage.
The ground and all revised tower parts retain the existing reversible QR morph.
