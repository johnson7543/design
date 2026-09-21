# Tokyo Tower night miniature

Status: Active runtime contract<br>
Scope: Tokyo Tower geometry, lighting, collapse, complete QR correspondence, and verification

[Back to Tokyo Tower](README.md)

`tokyo-tower` is the third City preset. Its editor label and accessible artwork
name are `東京タワー`. Editor, React consumers,
hosted playback, shared configuration, and PNG export use the same scene.
Shibuya remains the default City preset.

## Source and composition

The editable master is
[`tower.blend`](../../../../assets/design-qr/tokyo-tower/tower.blend), authored
and rendered in Blender 4.5.3 LTS. Its 3,624 named objects include four box-truss
legs, curved arch trusses, primary/secondary lattice, splice plates and bolts,
the chamfered two-storey Main Deck, rounded Top Deck, maintenance platforms,
antenna collars and bands, lift core, switchback stairs and rails, Foot Town
façades, entry canopy, paving, garden beds, faceted trees, benches, and lamps.
All evaluated surfaces, including concealed sides and undersides, export into
27,238 source quads. Triangles and ngons are partitioned rather than discarded.

The [proportions reference](proportions-reference.md) distinguishes the
operator's 150m / 250m visitor deck names from the contractor's construction
elevations: main floor GL+120 m, upper floor GL+223.5 m, and tip GL+333 m.
The model follows those construction levels, with a low arch, fuller lower
bracing, an upper lift spine, and an open antenna support. Horizontal
dimensions, member counts, joints, landscaping, base crop, and
fittings are authored interpretations. This is a recognizable miniature, not
a surveyed site reconstruction. The fixed warm-night treatment draws on the
[Landmark Light reference](https://www.tokyotower.co.jp/lightup/), independent
of the live lighting calendar.

The [asset index](../../../../assets/design-qr/tokyo-tower/README.md) links the
native model, Cycles night render, named-object OBJ, complete JSON inventory,
and export commands. The Blender file is authoritative: its evaluated geometry
exports to bundled [runtime data](../../../../packages/designqr/src/designs/city/tokyo-tower-blender-data.ts).
The [runtime adapter](../../../../packages/designqr/src/designs/city/tokyo-tower-parts.ts)
restores that topology and applies semantic paint. It does not approximate the
model procedurally or fetch an external model, texture, or font. Manual Blender
edits reach the player by running the exporter, without regenerating the model.
The [reference follow-up](build-plan.md) records remaining accuracy work.

## Night and framing

The fixed treatment follows the warm Landmark Light photograph: amber uplight
on steel, darker deck glazing, slender dark roofs, narrow illuminated rims,
and warm spill onto the plaza. White paint takes on the incident warm light.
The brighter treatment triples the authored floodlight powers, lifts city/moon
fill, and strengthens the existing deck and path-light emission. The lattice
stays legible against the deep night sky, with golden highlights rolling toward
light rather than remaining saturated red. Dark glazing retains the deck shape.
See the [lighting reference and limitations](lighting-reference.md).

The Blender scene has 180 modeled housings/lenses and 180 warm spots grouped up
the structure, plus two quiet environment fill lights. The fixture count follows
the operator's description; placement, aiming, power, and exposure are authored.
Emitters clear their opaque housings and mesh normals point outward.
The [Cycles bake](../../../../scripts/blender/bake-tokyo-tower-light.py) computes
direct diffuse light, indirect bounce, occlusion, and emission on every evaluated
surface corner. A temporary combined mesh allows cross-member shadows without
joining the editable objects. Subdivided plaza geometry retains local light spill.

Runtime imports this illumination with the geometry; its unlit material displays
the bake with no additional light passes, textures, or model fetch. Source-only
exposure and per-channel highlight compression are encoded at export. Blender's
AgX display and compositor glow remain review-only. In opaque playback, the
existing presentation canvas adds two soft, brightness-filtered glow composites
behind the sharp artwork; these use source pixels and no new render targets or
WebGL passes. Atmospheric glow fades over 8–65% progress and is omitted from
transparent output. Every source cut interpolates the baked
light; it follows the fragments and resolves fully into QR ink by 94% progress.

The initial view exposes two tower faces and the front base panel. The tower
uses a lower viewing pitch than the other cities (shared user pitch plus
0.16 radians), with a 0.27 world-unit reference focus. A tapered bounds profile
fits the island, legs, decks, and antenna independently. It can increase the
shared camera distance to prevent clipping; QR projection and density
compensation remain shared. Reset, orbit, zoom, and canonical PNG framing
retain normal player behavior.

Opaque mode uses a deep navy night atmosphere. QR mode transitions to the
existing light City scan background. Transparent mode omits both atmospheres.
See the [Tokyo Tower color roles](../../color-palettes.md#tokyo-tower-night-roles).

## Complete collapse into QR

[`tokyo-tower-morph.ts`](../../../../packages/designqr/src/designs/city/tokyo-tower-morph.ts)
owns correspondence and CPU pose evaluation.
[`TokyoTowerScene.ts`](../../../../packages/designqr/src/renderer/webgl/TokyoTowerScene.ts)
renders all surfaces in one persistent, opaque mesh. The same mesh renders 3D,
intermediate poses, and the scan face. There is no sampled detail budget,
disappearing source mesh, hidden surplus, or replacement QR layer.

The lower structure folds inward while decks and antenna descend with a
height-based stagger. Parts retain their local geometry early, then their
surfaces spread across the QR square and flatten. The island, forecourt,
illuminated paving, entry walkway, and paving joints have a separate, level
path to the QR paper. Their full footprint stays centered beneath the falling
tower throughout the turn instead of contracting into a corner. Ground colors
grade to mist paper over 18–90%; tower and context colors grade into shared QR
inks over 52–94%. Geometry settles at 100%. All motion uses the shared approximately
`0.74 / transitionSpeed` second turn. Reversal evaluates the same path, and
reduced motion commits directly to the requested endpoint.

Every source face owns a positive-area destination. Ground surfaces alone tile
all light cells. Their correspondence uses actual surface area and individual
face positions, so the large, sparsely tessellated island contributes broadly
across the paper instead of receiving the allocation of a small detail. Ground
thickness and concealed faces also retain positive destinations. Structural
parts tile dark cells outside the maximum logo footprint plus one module of
clearance. Foot Town, gardens, and other base context supply the remaining dark
cells, including that reserved center and distributed cells across the matrix.
Sources and destinations are ordered by angle/proximity, then an integer
interval partition splits source faces and target cells at shared boundaries.
Ground intervals are weighted by area; other source faces keep equal weights.
Broad ground faces first receive fixed subdivisions in both dimensions, with
edges no longer than 1/24 of the QR width. This preserves their full Blender
geometry and interpolated baked lighting while avoiding long, stretched ribbons.
Subdivisions are independent of QR content, so edits keep stable source tiles.
Each source face
and each destination cell is covered exactly once, without overlapping
patches. A fresh matrix has at most `refined faces + cells` patches. Higher source
detail increases subdivisions within real cells, never the QR matrix size.

Source quads subdivide into strips, then become flat cell patches. Adjacent
patches share exact endpoint boundaries and colors. At settlement all vertices
lie on one plane; thickness, source shading, and light spill are gone. Tests
cover supported interactive sizes 21 through 57 in steps of four.

Content changes preserve tower proportions. During a turn, old source split
boundaries and evaluated positional corrections retain the current pose while
targets are rebuilt. Corrections fall to zero at both endpoints. Ordinary
turns update uniforms without per-frame geometry allocation or destination
search. Each player owns its mesh/material; disposal releases both.

## Logo and scan presentation

A user logo occupies the small front Foot Town panel as product personalization.
The plain navy backing remains in the source inventory. The existing independent
image plane travels to the QR center; removal reveals the plain panel. User
pixels keep their original colors and alpha. Structural destinations avoid the
largest supported logo area, so it cannot conceal their only final contribution.

Shared City QR inks, finders, logo error correction, matrix fill, Border-owned
four-module margin, title/value anchoring, and export rules remain authoritative.
No tower geometry remains elevated or outside the matrix in settled QR view.
Transparent borderless hosts supply their own light margin.

## Verification

Tests bind the runtime geometry to the native Blender file's SHA-256 and verify
every exported surface, inventory identity, finite nonzero geometry, and complete
source/destination coverage for every supported matrix size. Light checks cover
every surface corner, warm highlights, shadowed regions, and continuity across
source subdivisions. Ground checks verify complete light-cell ownership,
substantial island contributions in all four quadrants, and a broad level
footprint throughout forward and reverse poses, including content retargeting.

Run `npm run test:designqr`, `npm run typecheck:designqr`, `npm run build`, and
`npm run smoke:tokyo-tower`. The smoke test verifies the real React scene,
persistent geometry through forward/reverse poses, full-orbit framing, dense
content edits, exact scan colors, maximum-logo PNG decoding, editor selection
and sharing at all three required viewports, and iframe Border/transparency
combinations. Captures go to `/tmp/designqr-tokyo-tower` by default.
Pixel comparisons verify visible glow in the opaque night view and no added glow
at the QR endpoint or in transparent output, allowing two channel levels of canvas
readback quantization. QR module centers retain exact palette RGB checks.

The fixture's unbranded scene reports one GPU geometry, no textures, and one
scene draw call. These are resource counts, not a hardware frame-rate claim.
Run shared editor and City regressions when modifying metadata, projection,
or presentation. Maintain documentation and color checks alongside tests.
