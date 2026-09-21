# Tokyo Tower lighting reference

Status: Implemented warm Landmark Light interpretation<br>
Reviewed: 2026-09-19<br>
Scope: Real-tower evidence, authored lighting, and runtime transfer

[Back to Tokyo Tower](README.md)

The operator describes [Landmark Light](https://www.tokyotower.co.jp/lightup/)
as 180 lights, with silver summer and warm orange winter treatments. This preset
uses the fixed warm treatment requested for the design, independently of the
current date, live calendar, or special-event lighting.

The official [paired summer/winter photograph](https://www.tokyotower.co.jp/lightup/img/img_002.jpg)
was visually inspected. Its warm image guides amber structural highlights,
darker observation windows, narrow bright deck outlines, and variation between
strongly lit and shadowed steel. The
[upper-structure photograph](https://en.tokyotower.co.jp/plan/towerpedia/img/img_004.png)
supports antenna collars and the daylight paint-band identity; daylight white
paint does not require white night-time illumination.

The model uses the [contractor's construction height anchors](proportions-reference.md).
Deck roofs are
slimmer and dark, windows are mostly dark with sparse subdued interior light,
and 180 modeled floodlight housings/lenses accompany 180 warm Blender spots.
Positions are grouped across nine height zones and four faces, with two quiet
environment fill lights. The zones follow the corrected structural levels.
Fixture coordinates, beam angles, power, neighboring
surroundings, and exposure are authored, not surveyed or measured photometry.
The count follows the operator's description; it does not certify the arrangement.
The brighter art direction uses three times the original authored spotlight
powers, stronger city/moon fill, and stronger existing luminous rims/path lights.
This intensity is a presentation choice rather than measured tower brightness.

Blender Cycles bakes direct diffuse lighting, bounce, occlusion, and emission
onto the complete mesh. The player receives per-corner light values alongside
the geometry. Light follows every surface through collapse, then grades fully
into scan colors. There is no live lighting-calendar service or extra QR glow.
The Blender review render uses AgX and compositor glow; the browser uses a fixed
source exposure of 16 with per-channel highlight compression. Opaque playback
also adds soft source-derived glow behind the sharp model, fading away before
65% of the QR turn. Transparent output omits this atmospheric layer.
See the [runtime contract](overview.md) and
[asset workflow](../../../../assets/design-qr/tokyo-tower/README.md).

No official photographs are redistributed in the repository. The model, bake,
and review render are original authored assets. This is a reference-informed
miniature, not a photogrammetric reconstruction.
