# Dōtonbori reconstruction requirements

Status: Open evidence and fidelity work<br>
Scope: Promoting the implemented Dōtonbori study to a documented reconstruction

[Back to Dōtonbori](README.md)

The [runtime overview](overview.md) owns implemented behavior; the
[Blender study](blender-study.md) owns source geometry and regeneration;
the [source ledger](sources.md) owns references and uncertainty. This document
tracks requirements that remain unresolved. Runtime detail or animation does
not, by itself, satisfy an evidence gate.

## Evidence gaps

| Area | Current basis | Work needed before a fidelity claim |
| --- | --- | --- |
| Source buildings | PLATEAU solids with separately recorded presentation offsets | Resolve LOD1-only features, adjoining building identities, roof/side/rear coverage, and dated façade registration |
| Bridge | Published deck dimensions, profile interpolation, and runtime fittings | Resolve the 31 mm profile/section discrepancy, local vertical registration, crossfall, surfacing, ramps, stair connections, and support/rail geometry |
| Canal and banks | GSI outline, standard-section levels, authored strips and display water level | Verify local bank transitions and benchmark epoch; record evidence for the chosen water state and fitting dimensions |
| Glico frontage | Published sign size and an authored host/frontage fit | Register dated frontal and oblique views; substantiate bottom elevation, support depth, wall identity, and orientation |
| Night frontages and lighting | S6/S10/S14 photographs, source-envelope fits for six additional central hosts, clipped reflections and illustrative light spill | Register a coherent dated façade set; reconcile B034's coarse stepped source with the photographed ribs, verify sign/support dimensions, and cover exposed rear faces |
| Boat | S13 operator drawing and photographs; published hull dimensions; channel containment and bridge clearance checked | Retain the distinction between measured hull dimensions and photo-sized fittings; reconcile source epochs/capacities before claiming a dated vessel reconstruction |
| Activity | Representative boat and pedestrian animation | Preserve containment and plausible paths; do not present representative activity as a dated observation |

## Reference and modeling workflow

1. Choose a coherent scene state and dated view set. Record capture date
   separately from dataset edition and object creation date.
2. Register frontal and oblique hero views, both banks, bridge approaches,
   stairs, and exposed roof/rear surfaces to identifiable source control points.
   Record residuals and conflicts; one photograph does not establish hidden depth.
3. Retain the metric source master alongside replacements. Follow its projection,
   axes, and dimensional rules. The user-authorized compact composition may
   translate an intact landmark as an explicitly recorded presentation offset.
   Preserve individual shapes, dimensions and facing directions; retain original
   geographic coordinates separately and do not describe compressed spacing as
   surveyed. Donki currently uses the documented 80 m west translation.
4. Replace unsupported detail only when evidence supports it. Keep permanent
   geometry, advertising/sign art, and user personalization separately identified.
   Preserve [approved material roles](../../color-palettes.md#dotonbori-source-study-roles).
5. Review matched reference/render pairs from the hero view and all exposed
   sides. Annotate omissions; numerical precision is not a site-accuracy claim.

## Runtime acceptance

- Preserve source masters, footprint shapes, river/road alignment, bridge registration
  and all eight landmark-host dimensions. Keep all 58 selected buildings and their
  attached details visible at every rotation, with normal depth occlusion.
  The product uses Shibuya's QR-generated context heights and architectural
  detail; document these artistic choices separately from measured source data.
  The compact presentation layout and recorded offsets must stay fixed across QR values.
- Keep visible layers in the reversible QR morph, including water, fittings, signs,
  and frozen actor poses. Follow the [shared motion contract](../../style-principles.md#motion)
  and the Dōtonbori runtime contract for camera, logo, and exact QR endpoints.
  All buildings and every attached detail must participate throughout the QR
  turn and reversal and remain present in settled 3D; every canonical QR cell
  must still appear.
- Retain independent asset loading, per-player state and disposal, delayed-load
  handling, and reduced-motion behavior. Compare load/render measurements with
  Shibuya before setting new budgets.
- Inspect both modes and intermediate turns at 1440×900, 390×844, and 320×568;
  test configuration round trips, concurrent players, PNG decoding, and repeated
  content edits. Use the [maintenance checks](../../maintenance.md#verification-by-change).

## Completion evidence

Ship source-linked object provenance, the editable master, runtime outputs,
matched review views, and explicit unresolved or intentionally omitted details.
Source measurements, photo interpretations, and authored presentation choices
must remain distinguishable. Keep the study label until the fidelity gaps above
are resolved and the final runtime is verified.
