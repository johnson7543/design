# Tokyo Tower source assets

Status: Blender-authored miniature integrated into the player<br>
Scope: Native model, evaluated geometry, part inventory, source evidence, and regeneration

[City documentation](../../../docs/designqr-package/cities/tokyo-tower/README.md)
owns behavior and accuracy limits.

The editable master is [tower.blend](tower.blend), created and rendered with
Blender 4.5.3 LTS. Its 3,624 modeled objects produce 27,238 complete surface
quads in the player. The seven `MODEL` collections contain all artwork; the
`REVIEW` collection contains cameras and the lighting rig. Its 180 warm spots
contribute baked illumination to the web model. Heights use the contractor's
construction elevation: 333 m tip, 120 m main floor, and 223.5 m upper floor.
The operator's 150m / 250m visitor labels are recorded separately. See the
[proportions reference](../../../docs/designqr-package/cities/tokyo-tower/proportions-reference.md).
Horizontal dimensions,
structural subdivisions, base crop, landscaping, and fittings are authored
interpretations, not a survey or a real-world structural inventory.

- [Native Blender master](tower.blend): individual named mesh objects, material
  roles, organized assemblies, metric units, four review cameras, and a night rig.
- [Blender night render](blender-night.png): Cycles review image with AgX and
  compositor glow. Runtime imports the same rig's baked illumination, with a
  separate source-only light compression and no bloom on the scan face.
- [Named-object OBJ](tower.obj): portable evaluated geometry;
  metres, Y up, with one named object per runtime part.
- [Part inventory](part-inventory.json): Blender object identifiers, complete
  surface counts, material roles, and Blender/geometry/OBJ hashes.
- [Runtime data](../../../packages/designqr/src/designs/city/tokyo-tower-blender-data.ts):
  the complete evaluated Blender mesh and per-corner Cycles lighting, stored as
  indexed quads with millimetre precision. Precision does not imply survey accuracy.

After editing and saving the `.blend`, export its actual evaluated geometry:

```bash
BLENDER_BIN=/path/to/blender node --experimental-strip-types scripts/build-tokyo-tower-assets.ts
```

The [exporter](../../../scripts/blender/export-tokyo-tower.py) retains every
mesh in every `MODEL` collection, including concealed faces and evaluated
modifiers. It partitions triangles/ngons into nondegenerate quads, verifies
surface area, and rejects missing palette roles or duplicate identifiers.
The [light bake](../../../scripts/blender/bake-tokyo-tower-light.py) uses a
temporary combined mesh for cross-member shadows and bounce, then discards it.
Every corner receives direct/indirect diffuse light and emission. Original
objects remain independently editable.
Assign approved `palette_role` material metadata to newly modeled surfaces.
Runtime imports this data directly; there is no external model or texture fetch.
Editing the portable OBJ alone does not update the player.

To reapply the brighter Landmark Light powers and luminous materials while
preserving the existing model and manual geometry edits, then bake/export/render:

```bash
/path/to/blender --background --threads 6 --python-exit-code 1 \
  --python scripts/blender/build-tokyo-tower.py -- --relight --render
```

The runtime uses source exposure 16 and per-channel highlight compression.
Opaque night playback adds soft glow on the existing presentation canvas;
transparent output and the settled QR omit that atmospheric layer.

The [authoring script](../../../scripts/blender/build-tokyo-tower.py) recreates
the original model and night review scene. Run it only when intentionally
replacing the saved model; it overwrites manual Blender edits:

```bash
/path/to/blender --background --threads 6 --python-exit-code 1 \
  --python scripts/blender/build-tokyo-tower.py -- --render
```

Source references, reviewed 2026-09-20:

- [Miyaji Engineering's renovation report, Figure 1](https://www.miyaji-eng.co.jp/technology/newsletter/media/28/no28-p064-070.pdf#page=2):
  construction floor/support elevations and the full tower silhouette.
- [Tokyo Tower's Towerpedia](https://en.tokyotower.co.jp/plan/towerpedia/): overall
  height, visitor deck labels, paint bands, and exterior-stair identity.
- [Official lighting reference](https://www.tokyotower.co.jp/lightup/): warm
  Landmark Light direction and deck lighting.
- [Official Foot Town guide](https://en.tokyotower.co.jp/foottown/): base building
  and roof access context.

The official [Landmark Light photograph](https://www.tokyotower.co.jp/lightup/img/img_002.jpg)
and [upper structure photograph](https://en.tokyotower.co.jp/plan/towerpedia/img/img_004.png)
were visually inspected for the steel weave, deck profiles, paint bands, and
antenna collars. No reference photographs or third-party mesh geometry are
redistributed. The model and render are repository-authored.
