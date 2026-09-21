# Dōtonbori motion proposal

Status: Steps 1–2 implemented on 2026-09-15; steps 3–6 on 2026-09-18; the wheel and exterior crab on 2026-09-20; secondary screens on 2026-09-21.

[Back to Dōtonbori](README.md)

## Review findings

The current implementation animates articulated walkers, independent pedestrian
stops, boat travel and the Glico LED panel. Glico's track and rainbow illustrations
crossfade on a 16-second authored loop, and its reflected light follows the same
phase. Water reflection strokes drift, change shape and shimmer. Spreading wake
crests remain behind the stern, disturb nearby reflections and fade. The existing
split noren and boat pennant bend in a gentle shared breeze with distinct flap
phases and quiet intervals. Two different counter actions, two bridge phone
gestures, a bridge visitor's greeting, one waving seated passenger and three
moving tank crabs add occasional local activity. Other passengers, fixed sign artwork
and lanterns retain their established presentation. The extended east canal
adds えびすタワー's 32 upright cabins on a fixed oval track and a 900-second circuit.
The street-facing かに道楽 crab adds slow folded-leg sweeps and opening pincers
on a separate authored 12-second cycle, using the same private scene clock.
The two secondary B031 screens also crossfade through independent original
campaign sequences while preserving their QR-selected opening identities.

The opening camera faces the central Glico sign from the northeast. Most 1F fittings become legible with
viewing zoom; orbiting exposes the remaining façades and their campaign screens.

The implemented sequence starts with the visible Glico panel and water, then
adds local actions while preserving the individually composed ground floors.

## Recommended additions

| Order | Addition | Implemented action | Evidence and limits |
| --- | --- | --- | --- |
| 1 — Complete | Glico LED program | Track and rainbow illustrations with readable holds and eased crossfades; retain the runner and current header. Reflected light follows the displayed phase. The complete textured panel, frame and reflection surfaces join the QR turn. | Owner/manufacturer still photographs were inspected [M5, S17]. Background motifs are reference-directed; timing, crossfades and reflected colors are authored. No motion footage or current playlist was verified. |
| 2 — Complete | Moving water and wake | Reflected bands drift and change shape. Curved stern ripples spread from historical boat positions, disturb nearby reflections and fade before the banks or tile edges. Current wave geometry and reflected colors join the QR turn. | Operator photographs show fine ripples and a modest trailing wake [S18]. Timing, spread and drift are authored; no measured local current or wave timing is claimed. |
| 3 — Complete | Noren and boat pennant | Gently bend the free ends of the existing split cloth curtains and mast flag. One weak breeze has distinct phases and occasional still periods. Top seams, doorway gaps and mast attachment stay fixed. Every fabric strip joins the QR turn. | These objects already exist as interpreted miniature fittings. The [cloth motion record](references/cloth-motion-reference.json) documents illustrative wind; real fabric motion and wind conditions remain unverified. |
| 4 — Complete | Occasional shop service | A B041 worker prepares food over the existing work surface. A B037 server exchanges a tray with one customer, who steps aside and returns it. | Two distinct authored scenes at existing interpreted counters. S15 and M7 support local food-service character, not these exact tenants, layouts or actions. Doors stay fixed. |
| 5 — Complete | Visitor and boat reactions | Two existing bridge visitors raise and lower phones independently. A third turns toward and greets the nearby boat; one existing seated passenger waves near the bridge. | The operator describes guide-led cruises [M6]. The participants, gestures and timing remain authored. Existing crowd locations and passenger count are retained. |
| 6 — Complete | Small crab-tank activity | Three crabs take short sideways steps and move their claws inside the existing B046-west display, with distinct phases and still intervals. | S16 records owner photographs of a first-floor tank, and the owner describes live-crab tanks [M3]. The model's placement and motion remain interpretations. Best as a close-up detail. |
| 7 — Complete | えびすタワー | Thirty-two upright cabins travel around a fixed oval track in 900 seconds. Complete cabin, rail, relief and storefront surfaces retain their pose through QR turns. | Operator specifications and manufacturer photographs establish the count, period and fixed track. Proportions and mounting details are interpreted; see [the reconstruction record](ebisu-tower.md). |
| 8 — Complete | Exterior かに道楽 crab | Eight folded legs and two pincers move slowly above the registered street entrance; shell and six uplights stay fixed. Full surfaces retain the current pose through QR turns. | Owner frontal/street photographs and WSTV historical footage; fitted dimensions and authored timing are documented in [S23](sources.md#s23--kani-exterior-crab-and-interior-refinement). |
| 9 — Complete | Secondary B031 screens | Two asynchronous three-campaign loops with long holds and slow crossfades, retaining the existing atlas. Both current blends survive QR turns. | Original QR-generated campaigns and authored 30/39-second timing; no claim about a real advertising playlist. |

## Implemented local activity

The existing fitted counter roles anchor two different scenes:

1. At the existing interpreted B041 takoyaki counter, a worker makes a short
   preparation movement with a thin pick over its existing work surface, then rests.
2. At one B037 dining counter, a server presents a small tray to one customer,
   who steps aside to hold it, returns it and steps aside again. The continuous
   40-second exchange never hides or teleports the tray. Food preparation uses
   a separate 23-second cycle with still intervals.

These are implemented representative behaviors, not verified tenants or observed service.
S15 and [Osaka Prefecture's Kukuru feature][M7] support local food-service
character; they do not identify B041 as Kukuru or establish a river-facing
cooking station. The [riverwalk operator's guide][M8] establishes that some
restaurants are accessible from the promenade, not the doorway mechanism or
layout of these modeled bays. Keep the existing interpreted shop identities.
Door animation and steam require their own supporting reference before inclusion.

Staff fit above the worktops inside the existing shallow openings. The customer
uses supported upper-promenade pavement and stays within the counter's bay,
clear of the doorway. Tests check the actual source-wall basis, all tank and
counter vertices, tray support and loop continuity. The normal opening camera
faces the Glico running man; all buildings remain present and details read best at close zoom.

Two bridge visitors hold phones in their hands throughout independent raise,
hold and lower cycles. Another turns toward the passing boat and greets it only
when near. One of the existing 26 seated passengers replaces its rigid body with
an articulated pose and a staggered wave. The tank's three existing rigid crabs
are replaced by bodies, jointed legs and claws. Their 21/27/33-second cycles have
short movements and still intervals; all parts stay inside the existing frame.

Every moving arm, tray, utensil, phone and crab limb contributes its current
pose to the QR turn. The three participating bridge visitors include their
hair, legs and bags as well as their torsos and heads. Every modeled surface has complete area correspondence in the QR. Shop activity retains
source-host ownership; all hosts and actors stay present throughout rotation and the turn.
Shared-clock pauses, reduced motion, content edits and reversals preserve the
complete action state. The [activity motion record](references/activity-motion-reference.json)
records the anchors, authored timings, clearances and evidence limits.

[M7]: https://osaka-shotengai-info.com/shop/takoyadotonbori-kukuru-honten/
[M8]: https://www.tonbori.jp/osanpo/

Food steam is a useful optional shop detail after confirming a visible hot-food
preparation point. Use a short, localized plume tied to that activity. The
current illustrative food-counter labels do not establish that a particular
real frontage cooks outdoors.

## Exterior crab — complete

The [Kani source record](references/kani-sign-reference.json) registers the
exterior assembly to B046-south, above the eave and below the first window band.
Owner stills establish the shell, eight folded legs, raised inward-facing
pincers, eyes and six uplights. WSTV's historical main-store footage was
inspected at 8–40 seconds to establish slow leg sweeps and opening claws.
The body stays fixed. Period, amplitudes and phase offsets remain authored;
the 12-second cycle is not a claim about today's mechanism.

Closed curved fingers, tapered leg segments and the complete shell retain
source-host ownership in one persistent vertex batch. Full-cycle geometry
checks cover the registered wall reservation and neighbouring-building
clearance. Pause, reduced motion and QR turns freeze the shared activity
clock; reversals and QR edits retain the same pose. The fixed river-side
opening camera sees the opposite face of this building. Orbit to its street
side; no duplicate crab, relocated host or view-dependent visibility is added.

## Secondary screens — complete

The two B031 generated screens cycle through original campaign artwork on
30- and 39-second loops. Each starts with its QR-selected design; fixed offsets
select two companions from the existing fourteen-design atlas. The first holds
for eight seconds and crossfades for two; the second holds for 10.8 and
crossfades for 2.2 seconds. No per-frame painting or texture uploads occur.
Panel-local coordinates and both frozen shader frames survive complete surface
transport, reversal, pause, reduced motion and content edits. This is more
useful when orbiting the city because the host may be occluded by foreground
geometry from the opening camera. It does not establish a real advertising
playlist or imply animation on every sign in the district.

## Implementation sequence

Step 1 is complete. The [Glico reference record](references/glico-animation-reference.json)
separates the photographed artwork motifs from the authored timing. Its atlas
is painted once per player; the sign and reflection share the activity phase,
freeze during the QR turn, and return in the same state on reversal. Folding
panels borrow the live shader so an intermediate crossfade remains intact.

Step 2 is complete. The [water motion record](references/water-motion-reference.json)
documents the inspected operator photographs and authored wave parameters.
Every active wake segment and retained water sample captures its current pose
and color for QR transformation. Boundary tests cover the complete boat loop,
and browser checks verify moving pixels, frozen reversals and stable buffers.

Step 3 is complete. The [cloth motion record](references/cloth-motion-reference.json)
documents the existing fitting assumptions, fixed seams, quiet breeze intervals
and reserved QR strips. Painted marks bend with the fabric, both faces render,
and noren retain their building ownership. Pause, reduced motion, QR turns,
reversals and content edits preserve the evaluated pose.

Steps 4–6 are complete. Shop staff and the customer, reacting visitors/passenger
and tank crabs use three retained vertex batches, with no added textures.
Geometry tests cover source fitting, prop contact, boat clearance and all 146
reserved parts through dense QR edits. Browser checks capture changing pixels
for each action, frozen buffers through both turn directions and exact PNG scans.
Timing and amplitude are art-direction choices, not real-world measurements.

Keep the Asahi upload attached to its sign and preserve its independent
sign-to-QR journey. Fixed sign cabinets, structural façades and indoor lamps
keep their established presentation. Use existing Osaka palette roles.

## Integration and review requirements

- Drive new motion from the existing per-player activity clock. Preserve phase
  through QR-content edits and freeze it during pause, reduced motion and QR turns.
- Keep every building present during rotation and the QR turn. Capture the
  current moving geometry/artwork so its frozen state contributes to the morph;
  return to the same state on reversal, then resume motion in settled 3D.
- Give shop mechanisms, cloth and sign effects source-building ownership so
  every part retains its source host through the morph. Clip wakes and reflections to water
  and the existing tile; keep moving fittings within their available clearance.
- Reuse textures and bounded geometry. Prefer vertex/shader motion or small
  object transforms over rebuilding facades or repainting a full atlas each frame.
- Compare normal-view and close-up readability at 1440 × 900, 390 × 844 and
  320 × 568. Verify pause, reduced motion, reversals, mid-turn content edits,
  full building/detail presence, independent players and exact QR/PNG scanning.

## Sources and limits

| Reference | Supports | Limits |
| --- | --- | --- |
| [M1 — Glico's sixth-generation sign announcement, 2014-10-23](https://www.glico.com/jp/newscenter/pressrelease/9609/) | The sign changed from neon to LED and supports video presentation. | Page inspected 2026-09-15. The detailed PDF was recovered using a space-encoded filename. Its historical descriptions of earlier generations do not establish sixth-generation animation timing. |
| [M2 — Glico's official sign description](https://www.glico.com/jp/health/contents/glicosign/) | Current sign identity, LED construction and the 2022 header revision. | Page inspected 2026-09-15. It does not specify the current complete animation playlist. |
| [M3 — Kani Doraku's owner description](https://douraku.co.jp/about/) | The owner describes live-crab tanks in its stores. | Supports the activity type, not the model's exact tank placement or animation. Page rechecked 2026-09-18. See the inspected first-floor photographs in [S16](sources.md#s16--kani-doraku-main-store-ground-floor). |
| [M4 — Glico's 2018-02-16 event announcement](https://www.glico.com/jp/newscenter/pressrelease/21265/) | The participating landmark descriptions explicitly include Kani Doraku's moving crab sign. | A historical event reference; it establishes neither today's choreography nor the sign's mounting dimensions. |
| [M5 — NEOS 149, owner/manufacturer sign report](https://www.sign-jp.org/98/neos149/museum.html) | Inspected still photographs show track and rainbow/road backgrounds used for Step 1's original illustrations. | 2015 issue; photo capture dates unknown. Stills do not establish motion or the current playlist. Image hashes and implementation limits are in [S17](sources.md#s17--glico-led-artwork-references). |
| [M6 — Ipponmatsu's Tombori River Cruise page](https://www.ipponmatsu.co.jp/cruise/tombori.html) | Inspected operator photographs show water texture, outward trailing ridges and DOTON's disturbed stern water. | Capture dates and wave timing are unknown. Images guide restrained appearance; parameters remain authored. See [S18](sources.md#s18--water-surface-and-boat-wake). |
| [M7 — Osaka Prefecture's Kukuru main-store feature][M7] | Local takoyaki preparation and food-service character already retained in S15. Page rechecked 2026-09-18. | Does not establish that the modeled B041 frontage is this tenant, nor its interior layout or a service choreography. |
| [M8 — Tonbori Riverwalk operator's walking guide][M8] | Describes restaurants entered from the promenade. Page rechecked 2026-09-18. | Broad riverwalk context; it does not register a particular entrance or door mechanism to this crop. |

The [existing source ledger](sources.md), [night references](references/night-reference.json)
and [waterfront references](references/waterfront-reference.json) retain the
site photographs, operator evidence and interpretation limits. Their photographs
support objects and setting; they do not establish motion timing.

Implementation reviewed in
[DotonboriScene](../../../../packages/designqr/src/renderer/webgl/DotonboriScene.ts),
[activity](../../../../packages/designqr/src/designs/city/dotonbori-activity.ts),
[river](../../../../packages/designqr/src/designs/city/dotonbori-river.ts),
[cloth](../../../../packages/designqr/src/designs/city/dotonbori-cloth.ts),
[shop activity](../../../../packages/designqr/src/designs/city/dotonbori-shop-activity.ts),
[visitor reactions](../../../../packages/designqr/src/designs/city/dotonbori-reactions.ts),
[landmark](../../../../packages/designqr/src/designs/city/dotonbori-landmark.ts),
[generated signs](../../../../packages/designqr/src/designs/city/dotonbori-generated-signs.ts)
and [storefronts](../../../../packages/designqr/src/designs/city/dotonbori-storefronts.ts).
