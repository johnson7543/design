# Dōtonbori lighting and transformation

Status: All four enhancement steps implemented.<br>
Scope: Night presentation, synchronized surface transport, and landmark assembly.

The 2026-09-21 refinement compacts oversized panels before flight, preserves
smaller detail sizes and delays expansion until arrival. It also adds the
optional editor River view without changing the opening camera. All surface
groups share their start, settle and paint intervals, including Donki and Glico.
Donki's wheel also shares ordinary architecture's contraction and travel path
throughout the middle of the turn.

[Back to Dōtonbori](README.md) · [Current behavior](overview.md) ·
[Existing activity](motion-proposal.md)

## Direction and completed work

The river and landmarks organize the turn: light emphasizes 戎橋 and the canal,
buildings separate, their actual surfaces gather into QR cells, and the wheel
settles into a finder at the same time. The opening faces Glico from the northeast at a
low 30° elevation, retaining the 65°-north-of-east horizontal direction.
All 58 buildings, eight reference hosts, muted Donki finishes, bridge registration
and source road/river alignment retain their existing composition.

These effects are authored presentation. They introduce no new claims about
real buildings, lighting installations or observed advertising programs.

| Step | Implemented result |
| --- | --- |
| 1. Night lighting | Darker roof/wall massing, stronger low-level sign spill and river reflections, and tight bright-pixel glow behind sharp lettering. Transparent output bypasses glow. |
| 2. Synchronized choreography | One global clock starts all surface groups together and settles geometry at 90%. A restrained warm pulse emphasizes the canal; ordinary above-ground groups have a maximum 0.018-tile lift. |
| 3. Architectural continuity | Every drawn source triangle contributes, including concealed faces, roof equipment, shop fittings, sign textures and current actor poses. Matching planar triangles become panels; remaining triangles retain their source shape with a collapsed fourth corner. |
| 4. Landmark assembly | Donki's complete rail/cabin surfaces gather into the 24 dark outer cells of the top-right finder; interior relief fills its nine dark center cells. Glico keeps its recognizable textured fold. Both settle with the city. |

## Surface ownership and correspondence

The implementation adapts Tokyo Tower's area transport to a city with private
atlases, merged façade ownership and live instancing. Integer interval transport
splits source panels only at target-cell boundaries. Every source has positive
area ownership and every QR cell receives exactly one complete area of patches.
Original UVs, vertex paint, opacity and frozen shader uniforms travel with those
surfaces. Zero-area static triangles are counted separately; moving slots are
retained even when their starting geometry is collapsed.

Buildings and details supply dark cells; ground, bridge, waterfront fittings,
reflections and wake supply paper cells. The wheel reserves only the finder's
33 legal dark cells. Ordinary context supplies the central logo area, keeping
landmark destinations outside it. The Asahi uploaded image retains its shared,
independent journey and original image colors; the underlying panel uses its
current personalized atlas coordinates.

The turn has no sampled-detail cap. It batches complete surfaces by their
existing materials and borrows the five live textures. Source animation meshes
remain efficient and instanced in settled 3D. The transport is prepared with the
source content; moving positions and colors are captured once when a turn starts.
Only the progress uniform changes through playback and reversal. Content edits
rebuild correspondence at the current progress while preserving the activity
clock; newly generated context naturally reflects the new content.

## Choreography

The following intervals overlap and refer to normalized progress, not elapsed
milliseconds. Architecture, ground and landmarks share this clock in both
directions, including interrupted turns and QR-content edits.

| Phase | Visible action |
| --- | --- |
| Opening to middle | The warm pulse emphasizes the canal. Complete building groups move toward their assigned regions with bounded lift. Source paint and sign lettering remain visible. |
| Middle assembly | Panels larger than one cell contract before travel; small fittings keep their size. Pieces reach cell centers before expanding into assigned strips. Architecture, Donki's wheel and ground use 0–40% contraction, 40–74% travel and 72–90% expansion. |
| Landmark assembly | Donki's rail, cabin and relief patches travel with the architecture into their reserved finder cells. Over 0–74%, Glico folds with its frozen live artwork and a 0.12-tile lift. Both join the same 72–90% settle as ordinary surfaces. |
| 90–100% | All transported surfaces already cover the exact QR plane and use canonical inks. The shared QR/paper layers complete the pixel-stable endpoint handoff; transient geometry is hidden at 100%. |

Every group's colors settle over 54–90% of the same global clock. Glow
ends at 65%. Dōtonbori's `1×` default lasts approximately 0.99 seconds, using
its former `0.75×` pace. Speed controls scale this baseline in both directions;
the camera path, Border, transparent output and reduced-motion endpoints remain.
Reversing a fixed-content turn retraces the same frozen rendered frames.

## Review and resource boundary

A single-host prototype covered B040's body, attached façade and Glico artwork
before extending the transport to the full scene. The full mapping covers about
393,000 source triangles, including the completed roof finishes, interior
reveals, Donki relief contours, exterior crab and bridge/bank finishing.
The normal 29×29 review uses 16 material batches, retains five artwork textures, and
allocates 49,604,640 bytes (47.3 MiB) of transport storage, down from
110,445,240 bytes (105.3 MiB). Each patch stores four exact Float32 source
corners in indexed vertex buffers and one Float32 motion record in a numeric
data texture. All 16 motion textures, including row padding, are included in
the storage total. Ordinary indexed drawing preserves the rendering path;
colors, alpha, artwork UVs and live shader coordinates retain their precision
without additional artwork atlases or omitted surfaces.
The source bounds still control transparent-batch sorting. All nine reviewed
3D/intermediate/QR frames match the previous renderer pixel for pixel.
Static depth shading is baked into the existing paint after content changes.
A bounded affine fit keeps originally planar paint gradients compatible with
the existing paired-triangle transport; nonplanar surfaces and paint seams
remain separate. This avoids unnecessary fragment splits without dropping
any source face or adding a texture/pass.
Construction occurs on matrix/asset changes, with no per-frame tessellation.
Presentation-only edits retain the correspondence and geometry; palette changes
update uniforms, and logo changes refresh the current source UVs.
Dense-content tests enforce a 56 MiB storage ceiling, counting shared
vertex buffers once, draw indices and all numeric motion data. The
[buffer audit](../../../../assets/design-qr/dotonbori/reviews/surface-buffer-audit.json)
records the 55.1% reduction, unchanged surface inventory and rendered-frame
comparison. These retained arrays exclude artwork textures, JavaScript objects,
temporary construction memory, browser overhead and GPU storage. Software-GPU
checks establish correctness; physical-phone memory and frame pacing remain
release gates. The earlier
[transition audit](../../../../assets/design-qr/dotonbori/reviews/surface-transition-audit.json)
retains the pre-optimization construction and frame-gap measurements.
The complete transported QR also decodes at 90%, before the canonical layer handoff.

Checks cover complete draw-index inventory, source UVs and live geometry bounds,
positive source/cell area conservation, legal finder destinations, frozen
buffers, dense content edits, pauses, reduced motion, delayed assets and disposal.
Browser review separately renders ground, architecture, Glico and Donki with
their production shaders. Each starts moving by 5%, remains active at 88%, and
has identical pixels at 90% and 94%, proving there is no delayed landmark tail.
Each group retraces its rendered pixels in reverse.
Ten held phases also compare Donki's actual shader output with the same wheel
vertices and QR destinations using the ordinary architecture path. The pixels
must match at every phase, including contraction, travel and arrival.
Browser review also covers public view controls, all three
viewport sizes, 48 orbit views, Asahi logos and decoded QR export. The source
model remains fully visible at every settled 3D angle.

The [opening](../../../../assets/design-qr/dotonbori/reviews/sign-row-opening.png),
[early activation](../../../../assets/design-qr/dotonbori/reviews/river-transition-start.png),
[folding city](../../../../assets/design-qr/dotonbori/reviews/river-transition-fold.png),
[cell assembly](../../../../assets/design-qr/dotonbori/reviews/river-transition-settle.png),
[shared settle](../../../../assets/design-qr/dotonbori/reviews/landmark-finale.png)
and [exported QR](../../../../assets/design-qr/dotonbori/reviews/river-transition-qr.png)
retain review poses. Intermediate captures hold the night backdrop for comparison;
normal view actions animate the common backdrop to scan paper. The editable
Blender review retains the unchanged static geometry; browser motion is authored
in the renderer.

## References and implementation

- [Complete surface mapping and shaders](../../../../packages/designqr/src/designs/city/dotonbori-surface-morph.ts),
  [shared timing](../../../../packages/designqr/src/designs/city/dotonbori-transition.ts),
  and [scene lifecycle](../../../../packages/designqr/src/renderer/webgl/DotonboriScene.ts).
- [Tokyo Tower surface transport](../../../../packages/designqr/src/designs/city/tokyo-tower-morph.ts)
  supplies the area-conservation precedent; the city implementation also preserves textures and live poses.
- [Existing presentation glow](../../../../packages/designqr/src/renderer/PresentationSurface.ts)
  and [Three.js bloom controls](https://threejs.org/docs/pages/UnrealBloomPass.html)
  explain the separation of bright-area emphasis, radius and strength. No additional WebGL pass is used.
- [Source ledger](sources.md), [wheel references](ebisu-tower.md) and
  [palette roles](../../color-palettes.md#dotonbori-source-study-roles)
  remain authoritative for real-site evidence and approved colors.
