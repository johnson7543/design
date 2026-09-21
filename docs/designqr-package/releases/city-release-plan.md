# City QR 0.2.1 release plan

Status: Release preparation in progress; qualification and publication pending<br>
Reviewed: 2026-09-21<br>
Scope: 渋谷, 道頓堀 and 東京タワー in the editor website, hosted player and public npm package

[Back to releases](README.md)

Release the three Japanese City miniatures together as `designqr@0.2.1`, with
the matching editor and `/qr/embed` build. Lead with each city's recognizable
artwork, its complete transformation into a scannable QR, and logo
personalization. Shibuya remains the default City preset. Keep the Japanese
display names and stable identifiers `shibuya`, `dotonbori` and `tokyo-tower`.

Release preparation is authorized and in progress; publishing, pushing a release
tag and deploying production follow acceptance of a concrete candidate. No release date is committed yet.

## Baseline and evidence

The public [npm registry](https://registry.npmjs.org/designqr/latest) reports
`latest: 0.2.0`, confirmed with `npm view designqr version dist-tags --json`
on the review date. The local `designqr-v0.2.0` tag contains Tree and Shibuya;
Dōtonbori and Tokyo Tower are additions to that baseline. The requested release
target is now **0.2.1**, replacing the earlier minor-release proposal. Recheck
registry state before reserving the final version.

### Version decision and compatibility

Use `0.2.1` as an explicit pre-1.0 release choice, not because the public API is
identical or this is a bug-fix-only release. Against `designqr-v0.2.0`:

- Existing React prop and ref signatures and package export paths are unchanged.
- `DesignQRThemePreset` adds `dotonbori` and `tokyo-tower`.
- Public exports add `DesignQRTreePreset`, `DesignQRCityPreset`, `CITY_PRESETS`
  and `isCityPreset` through the config entry and root re-export.
- Existing Tree and default-Shibuya usage is intended to remain compatible;
  confirm this from the installed candidate. Consumers with exhaustive preset
  mappings may need to handle the two added values.

[Semantic Versioning](https://semver.org/#spec-item-4) permits initial-development
flexibility for `0.y.z`; the usual feature-release convention would favor a
minor increment. This plan adopts the requested `0.2.1` target while disclosing
the additions in release notes. It does not establish a general policy of
shipping future API additions as patches. The metadata validator accepts this
version format but does not prove compatibility. Package and lockfile now
identify the unpublished `0.2.1` candidate.

### Readiness after the buffer fix

The large retained transformation buffer issue is closed: the matched review
fell from 105.3 MiB to 47.3 MiB, retaining all 58 buildings and producing identical
pixels at nine held transformation phases. The complete Dōtonbori scene smoke,
targeted tests, build, lint and type checks passed during that fix. The new
56 MiB regression ceiling includes source vertices, indices and numeric motion
data. This is not a total browser/GPU memory measurement or phone qualification.

**Release status: preparation is in progress; publication is not ready.**
CI enforcement, Tokyo Tower installed-package coverage, palette corrections and
documentation/notice corrections are implemented for local qualification.
An isolated fresh-install build passes. Final-commit reproduction and device
qualification remain outstanding. The [candidate record](city-0-2-1-candidate.md)
records the loading fix: the complete package-owned static ESM graph falls
from 1,117,484 to 46,661 gzip bytes, with a 64 KiB regression budget. Affected
browser and installed-package requalification passed, including nine
delayed/failed/disposed code-loading cases.
Keep the buffer optimization in the candidate and
rerun its regression gates with that candidate; no further artwork expansion
is required by this release plan.

| Item | Observed state | Release consequence |
| --- | --- | --- |
| Metadata | Package and lockfile identify `0.2.1`. | Validate `designqr-v0.2.1` and repeat on the final commit. |
| Payload | The optimized 0.2.1 audit passed: 323 files, 5,475.5 kB packed, 29,639.9 kB unpacked. Both Noto and Dōtonbori notices are included. | Final fresh-build and working-tree tarballs match. Runtime entries match the tested tarball; only README changed afterward. |
| Main CI | `npm run check` now includes both Dōtonbori smokes and the installed City package check. | Both workflows inherit these required gates; verify CI duration. |
| Installed-package coverage | The City tarball runner passed all three presets from the actual 0.2.1 tarball. | All loading-fix package checks passed; retain them on the final release commit. |
| Colors | The standalone reference demo now uses approved base colors; `color:check` passes. | Keep the required gate and review the palette-only reference change separately. |
| Editor styles | `style:check` passes. | Repeat after release-facing interface or preview changes. |
| Reproducibility | City sources, assets and documentation include substantial uncommitted/untracked work. | Assemble explicit release commits and prove a clean-checkout build, including asset plugins and generated inputs. |
| Dōtonbori correctness | The latest [sign review](../../../assets/design-qr/dotonbori/reviews/sign-visibility-audit.json) records 58 buildings, complete surface coverage, reversible turns and decoded export. | Retain these regressions in final-candidate qualification. |
| Dōtonbori memory | The [buffer audit](../../../assets/design-qr/dotonbori/reviews/surface-buffer-audit.json) records 49,604,640 bytes (47.3 MiB), including numeric motion data, down 55.1% from the matched 105.3 MiB baseline, with identical reviewed frames. Dense-content and scene checks enforce a 56 MiB ceiling. | This excludes other scene storage, artwork textures, GPU copies and browser overhead. Real-phone memory and frame pacing remain release gates. |
| Deployment | [Wrangler configuration](../../../wrangler.jsonc) targets the production custom domain; `workers_dev` and preview URLs are disabled. | Prepare a distinct preview target or use a local candidate review. `npm run deploy` is a production action. |

Existing browser evidence uses software WebGL. It proves specific visual and
scan behaviors, not production-device frame rate or total memory use. Remote
CI status, npm Trusted Publisher configuration and the currently deployed
website version were not verified in this planning pass.

Repository references: [package metadata](../../../packages/designqr/package.json),
[required commands](../../../package.json), [payload audit](../../../scripts/audit-designqr-package.mjs),
[Verify workflow](../../../.github/workflows/verify.yml),
[Publish workflow](../../../.github/workflows/publish-designqr.yml), and
[preset metadata](../../../packages/designqr/src/designs/city/presets.ts).
Visual acceptance follows the [package rendering contract](../style-principles.md),
[color roles](../color-palettes.md) and [editor contract](../../designqr-editor/style-principles.md).

## Delivery sequence

| Phase | Work | Required output / exit condition | Owner |
| --- | --- | --- | --- |
| 1. Freeze and close gaps | Assemble the three-city changes, resolve colors, connect missing CI checks, extend installed-package coverage, reconcile documentation and notices. | A clean-checkout candidate commit with all required checks executable and passing. | Engineering |
| 2. Qualify the candidate | Run automated gates, real-device performance/scan checks and artwork review. Fix release defects within the agreed scope. | Evidence tied to commit, version, device/browser versions and artifact hashes; no open release-blocking defects. | Engineering + device reviewer |
| 3. Prepare launch material | Finalize notes, examples, three screenshots and a real-product City preview with a static poster. | Material reflects the tested build, uses Japanese names and demonstrates a scannable QR. | Product / documentation |
| 4. Rehearse | Pack an unpublished candidate, install it in an external consumer, review the preview build and run the publishing workflow manually on the final commit. | A concrete candidate and completed acceptance record; the manual workflow performs no publication. | Maintainer |
| 5. Publish and observe | Publish npm, verify the registry artifact, deploy the matching website, verify production, then announce. | Package, editor, hosted player, examples and links agree; recovery references are recorded. | Maintainer |

Allow roughly **3–5 working days** for preparation, device review, launch
material and rehearsal if qualification finds no substantial rendering work.
This is an effort estimate, not a launch promise. Phone performance or memory
failures change the schedule. Freeze feature scope during this period and
prioritize reproducible release defects.

## Required engineering work

1. Keep Verify and Publish aligned. Both workflows call
   [`npm run check`](../../../package.json), now including the dedicated City gates. If the serial suite approaches the workflows'
   60-minute limits, split browser jobs by suite and make publication depend
   on every job for the same commit.
2. Extend [`check-designqr-city-package.mjs`](../../../scripts/check-designqr-city-package.mjs)
   to exercise all three presets from the packed package: ESM, CJS and SSR
   imports, a non-root host path, asset loading, independent instances, logo
   replacement/removal, QR export and disposal. A source-workspace import is
   insufficient evidence for package delivery.
3. Resolve the standalone demo's palette failures without dropping the global
   check or expanding the approved palette. Preserve unrelated work when
   preparing the release branch; avoid staging the entire dirty workspace.
4. Reconcile release-facing documents with the final implementation. The package README now records the northeast 30° Dōtonbori opening,
   the shared motion contract describes adaptive logo backing, and the
   source notice points to the implemented exterior-crab refinement. Review source attributions for all three
   cities and retain the Noto notice. Keep source photographs and research-only
   assets out of the npm payload.
5. Record package/web chunk sizes, cold-load timing and resource use. Compare
   Tree and Shibuya against `0.2.0` on the same device/network; new City assets
   must not silently impose a large load cost on existing consumers. Address
   unexpected eager loading or regressions before qualification closes.

## Acceptance matrix

Test all three presets in editor, React consumer, hosted iframe and exported
PNG. Keep a Tree and default-Shibuya regression path for existing consumers.

| Area | Acceptance |
| --- | --- |
| QR correctness | Decode URL, Japanese-text and dense supported matrices across the 21–57 module range. Cover no logo and maximum supported logo, square/wide/tall and transparent uploads. Confirm exact final QR colors and clean module boundaries. |
| Border and alpha | Verify Border's four-module margin and transparent output. Borderless scan tests supply the documented host-owned light margin. Export keeps canonical framing after preview zoom/pan. |
| Motion | Test both directions, mid-turn reversal, every supported speed, paused/content edits and repeated toggles. No delayed Donki tail, missing surfaces, leftover 3D geometry or jump at the QR endpoint. Dōtonbori `1×` stays approximately 0.99 s; the other cities stay approximately 0.74 s. |
| Accessibility / interaction | Verify the actual browser reduced-motion preference, keyboard focus, Japanese labels, drag/touch, zoom, reset and Auto Spin. Reduced motion goes directly to endpoints. |
| Responsive UI | Check 1440×900, 390×844 and 320×568 in 3D and 2D, including logo, edit and share controls. Preserve header/control rails and touch access. |
| Lifecycle | Check late/failed assets, documented errors, two players, preset changes, mount/unmount and repeated content edits. No accumulating buffers/textures, stale logo or corruption of another instance. |
| Integration | Existing `0.2.0` Tree/Shibuya configurations and shared links keep their meaning. All three examples work from the actual package, including iframe links and non-root deployments. |

City-specific visual acceptance:

- **渋谷:** station/crossing/landmark composition, readable main-logo billboard,
  QR-dependent building/sign details, traffic and pedestrians, and complete
  textured sign transport.
- **道頓堀:** bridge-centered diagonal river; all 58 buildings at every orbit;
  no overlapping facade skins or roof holes; B038 leaves Pip/FANCL clear;
  Asahi uploads stay fitted with contrasting backing and restore correctly;
  Donki transforms with the city; runner limbs, crowd clearance, boat, water
  and other activity retain their corrected behavior. Preserve the 30° opening.
- **東京タワー:** full antenna/base framing, leg and lattice integrity, night
  lighting, readable Foot Town logo, and complete tower/ground transformation
  with no geometry left outside the settled QR.

Use a recent iPhone/Safari, the oldest intended supported iPhone/Safari and a
representative midrange Android/Chrome, plus desktop Chrome, Safari and Firefox.
Record exact device, OS and browser versions; viewport emulation is additional
coverage. Test native iOS and Android camera scanning on representative
displayed and exported QRs, with three successful reads per selected case.

Proposed performance acceptance is at least 30 fps during settled activity and
transitions on the declared minimum device, with p95 frame time at or below
50 ms after assets are ready. Include the first turn, not only warmed repeats.
Run 20 forward/reverse turns and repeated preset/content changes without a
crash, context loss, growing retained resources or sustained performance decay.
Record cold-load time, transition wall time, peak measured memory and thermal
behavior. These are proposed targets to validate, not current performance claims.

## Candidate checks and evidence

The final clean candidate must pass:

```bash
npm ci
npm run release:designqr:check -- --tag designqr-v0.2.1
npm run check
npm run audit:designqr-package
```

The dedicated `smoke:dotonbori`, `smoke:dotonbori-scene` and
`check:designqr-city-package` commands are included in `npm run check`; use
individual commands for targeted reruns rather than duplicating successful suites.
`npm run check` includes lint, package/editor tests, type checking, docs, colors,
styles, builds, snippets, React/iframe checks, Shibuya, Tokyo Tower, zoom and
production smoke tests. Confirm all three required viewports: current workflow
configuration limits the general production suite to desktop and small-mobile,
so City-specific evidence must supply the middle viewport too.

Save the actual tarball, web build, checksums, reports, representative
3D/intermediate/2D captures, native-device results and matching source commit.
Retain editable native models and current generated-asset hashes in source
control. A successful dry-run pack check is one part of release acceptance.

## Launch material

- Finalize notes describing additions since `0.2.0`: 道頓堀, 東京タワー, the
  refined 渋谷 artwork, and the shared logo, scan and export experience. Describe
  source-based miniatures and documented composition choices accurately.
- Provide a copyable React example and hosted-player link per City, a
  square/wide logo example, and a PNG download example.
- Capture a 20–30 second real-product overview: show each city long enough to
  recognize it, run a complete forward/reverse transformation, demonstrate
  logo personalization, and finish with a scannable QR. Retain Dōtonbori's
  normal slower timing. Use [`record-product-demo`](../../../skills/record-product-demo/SKILL.md)
  and the [recording workflow](../../demo-videos/README.md), preserving genuine
  captured motion and visually reviewing contact sheets. A 60 fps claim
  requires source capture and verification at that rate.
- Prepare a matching poster and three stills. Verify catalog preview, fallback
  and reduced-motion behavior against the [home-page contract](../../home-page/style-principles.md).
  Keep editor and home-page changes within existing layout and color roles.

## Release and recovery

1. Complete the acceptance record with version, commit, checks, device evidence,
   screenshots, notes and known limitations. The maintainer reviews the
   concrete candidate before public release actions.
2. Merge to `main`, verify that exact commit and run Publish manually. Its
   manual entry point only validates. Keep the candidate tarball unpublished
   during rehearsal: the current tag workflow has no separate prerelease-channel
   policy and publishes without an explicit npm distribution tag.
3. Confirm npm Trusted Publishing is configured, record the currently deployed
   website version and retain the last known good package/build identifiers.
4. Push matching `designqr-v0.2.1` after release acceptance. Verify publication
   and install it into a fresh external consumer; check all three cities and
   QR export from that registry artifact.
5. Deploy the matching editor/hosted-player build. Recheck `/qr`, `/qr/embed`,
   direct shared links, logo replacement, Japanese labels and PNG scanning on
   the production domain. Announce after those checks pass.
6. Review production behavior and reports over the first 24–48 hours. Scan
   failure, missing assets, a blank scene, repeated tab crashes or broken share
   links are release defects. Restore the recorded previous website deployment
   when needed and ship an npm patch rather than reusing `0.2.1`. Record any
   old-website limitation for new City links during recovery.

The [release pipeline](releasing.md) remains authoritative for tag validation
and publishing mechanics. This plan adds City qualification and the coordinated
website/package rollout required before that procedure is used.
