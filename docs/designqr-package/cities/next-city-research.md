# City: next Japanese preset research

Status: Research record; Tokyo Tower implemented as an authored night miniature<br>
Researched: 2026-09-08<br>
Scope: Japanese-city selection rationale and candidates for future expansion

[Back to the Design QR documentation index](README.md)

On 2026-09-18, the user selected **Tokyo Tower / 東京鐵塔 at night** as the
next City theme, with a collapse in which every tower element becomes part of
the 2D QR. The [Tokyo Tower overview](tokyo-tower/overview.md) owns its implemented behavior.
The earlier ranking and Kyoto sequence below remain historical research.

The current user-directed scope is Japanese cities only. Each preset should
depict one recognizable district or street scene within its city, with a
coherent geographic crop and a distinct architectural or motion identity.

**Selection rationale: Osaka’s Dōtonbori around Ebisubashi Bridge.** Make a
compact canal reconstruction with its actual pedestrian bridge, stepped
river walks, building arrangement and sign placement. The water creates a
different composition from Shibuya's crossing and offers a new city-to-QR
transformation. The detailed [build plan](dotonbori/build-plan.md) and
[source ledger](dotonbori/sources.md) apply the user's requirement that the
scene's appearance be established from evidence.

This ranking prioritizes visual difference from Shibuya, recognition at the
existing mobile scale, a distinctive movement, and plausible implementation
scope. It is a design judgment based on the repository and place references;
audience demand and development duration have not been measured.

## Current context

[Shibuya](shibuya/overview.md) and [Dōtonbori](dotonbori/overview.md) are implemented.
The comparison below records the selection rationale and alternatives for future
City expansion. Current implementation and unresolved reconstruction work belong
to their City documents; this research does not prescribe renderer wiring.

## Japanese candidate comparison

Relative effort describes expected new work after the shared second-preset
plumbing. These are qualitative estimates, not benchmark results.

| Priority | Specific scene | Reference evidence | Proposed visual hook | Expected new work |
| --- | --- | --- | --- | --- |
| 1 | **Osaka — Dōtonbori / Ebisubashi** | A pedestrian bridge crosses the canal between shopping streets, with large riverside signs; sightseeing boats use the waterway. [Osaka bridge reference](https://osaka-info.jp/experience/en/osaka/spot/551), [river cruise reference](https://osaka-info.jp/en/spot/tombori-river-cruise/). | Source-aligned riverfront architecture and bridge; a verified boat can add movement later. | Medium–high under the fidelity requirement: canal and bank levels, current bridge geometry, registered façades and new morph sources. Detailed reference coverage remains incomplete. |
| 2 | **Kyoto — Higashiyama / Yasaka Pagoda** | Yasaka Pagoda rises within an old neighborhood; the surrounding Higashiyama routes feature sloping stone streets and traditional townhouses. [Kyoto pagoda reference](https://kyoto.travel/en/destinations/hokanji-templeyasaka-pagoda/), [Higashiyama walking reference](https://kyoto.travel/en/itineraries/higashiyama-at-dawn/). | Layered tiled roofs and a pagoda frame a small pedestrian street in morning light. | Medium–high: a traditional building family, pagoda geometry, sloping ground and pedestrian/morph height handling. Verify one crop around the pagoda; the wider walking route is reference context. |
| 3 | **Sapporo — Susukino in winter** | Susukino has prominent illuminated signs, and the streetcar network serves the district; Sapporo also operates distinctive snow-clearing streetcars. [Japan National Tourism Organization](https://www.japan.travel/en/spot/550/), [Sapporo streetcar heritage](https://www.sapporo.travel/en/bunkazaisanpo/sapporotram/). | A streetcar passes lit shopfronts and snow-covered sidewalks, with restrained falling snow. | Medium: street-level tracks, a tram, winter surfaces and City-specific weather behavior. Tree's existing snow treatment provides a starting point, not automatic City support. |
| 4 | **Yokohama — Shinkō / Cosmo Clock waterfront** | The Minato Mirai waterfront includes Cosmo Clock 21 and a varied modern skyline. [Yokohama official skyline guide](https://www.yokohamajapan.com/en/article/yokohama-skyline/). | A slowly rotating Ferris wheel becomes the hero above the waterfront. | High: wheel and gondola motion, a tall silhouette, water and new morph sources. Verify a crop around the wheel; distant towers and the Red Brick Warehouse must not be squeezed into one miniature footprint. |
| 5 | **Nagasaki — Nakashima River / Meganebashi** | Meganebashi is a compact stone arch bridge whose reflection gives it its spectacles identity. [Nagasaki city bridge reference](https://en.at-nagasaki.jp/barrierfree/64024). | Twin stone arches, their reflections and riverside walkers create a quieter scene. | Medium: arch geometry, riverbank levels and pedestrian paths; water work can build on Dōtonbori. Nearby tram access is not evidence of tracks crossing this bridge. |

Kyoto is the strongest alternative if architectural variety is the priority.
Sapporo is the strongest alternative if new street activity and a winter
atmosphere matter most. Yokohama offers a bold silhouette with greater framing
and geometry work; Nagasaki offers a smaller, calmer river scene.

The earlier proposed sequence was **Tokyo / Shibuya → Osaka / Dōtonbori →
Kyoto / Higashiyama**. That gives the collection a busy crossing, a lively
canal, and a historic sloping street before expanding into another commercial
intersection. The user's Tokyo Tower selection supersedes that recommendation
for the next preset. Shibuya and Dōtonbori are now implemented; Tokyo Tower is
implemented as an authored miniature.

## Dōtonbori follow-up

Current runtime behavior is maintained in the [preset overview](dotonbori/overview.md).
Use its [build plan](dotonbori/build-plan.md) for unresolved reconstruction gates
and [source ledger](dotonbori/sources.md) for evidence. The research ranking above
is a dated design judgment, not a new implementation commitment.
