# City QR 0.2.1 candidate

Status: Full local release qualification passed; Pixel 7 Pro visual/scan feedback positive; iPhone and remote CI pending; unpublished<br>
Prepared: 2026-09-21; reviewed: 2026-09-22<br>
Scope: 渋谷, 道頓堀 and 東京タワー; editor, hosted player and npm

[Back to releases](README.md) · [Release plan](city-release-plan.md)

## Prepared changes

- Package and workspace lock metadata identify `0.2.1`; the matching
  `designqr-v0.2.1` metadata check passes. No tag has been created or pushed.
- The shared `npm run check` gate now includes Dōtonbori editor/scene smokes
  and installed City package validation. Verify and Publish inherit them.
- The installed package checks include Tokyo Tower, independent instances,
  logo replacement/removal, both views, decoded PNG export and disposal.
  Root ESM/CJS and config CJS exports exercise all three preset identifiers.
- Release documentation records the northeast 30° Dōtonbori opening,
  adaptive Asahi logo backing, modeled exterior crab and the pre-1.0 version
  decision. Existing React prop/ref signatures remain unchanged; new preset
  values and public helpers/types are explicitly disclosed.
- Dōtonbori retains the validated buffer reduction from 105.3 to 47.3 MiB for
  the matched 29×29 QR, with a 56 MiB regression ceiling. This is retained
  transformation storage, not total browser/GPU memory.
- The Git-ignored standalone reference demo was mapped to approved colors
  to unblock this workspace's color check. It is not part of the candidate
  source snapshot or npm payload. Its layout/interactions were not changed;
  desktop captures were reviewed and produced no browser errors.

## Qualification record

The release scope includes the three-city implementation, generated assets,
editor integration, package checks and required documentation migration. The
unrelated Playable Refresh proposal and its root-index paragraph are excluded.
The maintainer authorized the final commit after Pixel 7 Pro visual and camera
scan checks. Final-commit CI and iPhone qualification remain separate gates.

| Gate | Result |
| --- | --- |
| Version/tag metadata | Passed for `designqr-v0.2.1` |
| Package tests | Final isolated staged source: 219 passed, including five loader lifecycle cases |
| Editor tests | 11 passed |
| Docs, design docs, colors and styles | Passed |
| Full browser/integration gate | All local `npm run check` gates passed against isolated staged source; browser sequence resumed after resolving a local preview port conflict |
| Fresh source snapshot install/build | Passed: isolated source, fresh `npm ci`, package + web build |
| npm payload audit | Passed: 323 files, 5,475.5 kB packed, 29,639.9 kB unpacked |
| Real-device qualification | Pixel 7 Pro: all cities/both directions visually smooth; camera scans reported good. Measured performance, explicit scan matrix, 20-cycle evidence and iPhone remain pending |
| Remote Verify/Publish rehearsal and npm Trusted Publisher state | Pending final commit/account verification |
| Public package and production website | Not published/deployed |
| Public testing preview | Deployed separately on 2026-09-22; version `6d520ce9-956b-4512-a851-bfad328fb7b2` |

## Final local commit qualification

The scoped staged source was exported to `/tmp/designqr-final-commit-38t1p3kh`
and installed with `npm ci`. All gates in `npm run check` passed using the CI
production-smoke selection `desktop,small-mobile`. The first sequence stopped
because the old local phone preview occupied port 4199. After that server was
stopped, the sequence resumed at `check:designqr-styles` and completed with exit
code 0. This is complete gate coverage, not an uninterrupted single-command run.
No product-source fixes were needed. Release metadata and the package audit
also passed. Only this qualification documentation was updated afterward.

All 23 web files are byte-identical to the frozen public preview. The final
installed-package test produced tarball SHA-256
`55f160c1b079ed48ea4d3fe06e681f36236fd0a9fef6ae351798def7329f9cee`, exactly matching
the frozen candidate. Final installed-package reports and captures are in
`/tmp/designqr-city-package-OLW5ga`; the install/check logs and principal JSON
reports are preserved under `city-release-0.2.1.local/evidence/`.

This qualifies the local release source. Remote Verify and the non-publishing
Publish workflow must still run on the committed SHA; no tag, npm publication
or production deployment is part of this commit.

## Physical-device handoff

The [public HTTPS preview](https://design-city-0-2-1-preview.johnson7543.workers.dev/qr) is deployed to
`design-city-0-2-1-preview`, using the frozen web artifact below. It has no
production custom-domain routes. Preview deployment does not qualify the
remaining physical-device or final-commit CI gates.

The [device testing handoff](city-device-testing.md) now contains direct links
for all three editors and players, restart instructions, build fingerprints
and a repeatable phone test procedure. The frozen web build, final npm tarball
and selected reports are preserved in the Git-ignored
`city-release-0.2.1.local/` directory. Initial Pixel 7 Pro feedback is recorded below; full device
qualification remains pending.

The maintainer confirmed access to **iPhone/Safari and Android/Chrome** on
2026-09-22. The requested “LTS” baseline is interpreted as latest stable
supported OS/browser releases available for each device, as detailed in the
[device testing handoff](city-device-testing.md). The Android device is a Pixel 7 Pro; its installed OS/browser versions and
the iPhone model remain pending. Run against the final optimized candidate; record the exact artifact
hash or deployment identifier, not only its version number.

| Field / check | iPhone / Safari | Android / Chrome |
| --- | --- | --- |
| Device model, OS, browser version | Pending | Pixel 7 Pro; OS/browser versions pending |
| Subjective smoothness | Pending | Maintainer confirms all three cities and both transformation directions are smooth |
| Candidate hash / deployment, network | Pending | Pending |
| Each city's cold load and first turn | Pending | Pending |
| Settled / transition frame pacing and measured memory | Pending | Pending |
| 20 forward/reverse turns; no crash or context loss | Pending | Pending |
| Preset/content changes; logo replacement/removal | Pending | Pending |
| Camera scan feedback | Pending | Maintainer reports all good; exact payload/logo matrix and repeat counts unspecified |
| URL and Japanese-text QR, with/without logo | Pending | Detailed matrix unconfirmed |
| Dense QR and exported PNG; three native-camera reads per case | Pending | Pending |
| Touch rotation/zoom, reset and reduced motion | Pending | Pending |
| Thermal behavior and retained-resource trend | Pending | Pending |

On 2026-09-22, the maintainer reported that testing on a Pixel 7 Pro was
“quite smooth,” following the public-preview handoff. This is positive
qualitative device feedback, not measured fps, memory, scan success or a
completed 20-cycle test. In follow-up, the maintainer confirmed all three
cities and both transformation directions were good. Exact browser, versions
and editor/player coverage were not provided; the preview association is
inferred from the conversation. The maintainer subsequently reported camera
scans were also all good and authorized the final commit. This confirms positive
scan feedback, without establishing each payload/logo case or repeat count.

Use the [release plan](city-release-plan.md) for the proposed 30 fps / p95 50 ms
acceptance and remaining matrix. A native-camera scan needs a second display
or device showing the QR. Record failures and first-turn measurements as well
as warmed results. Do not substitute viewport emulation for these checks.

## Optimized candidate artifacts

Fresh source snapshot: `/tmp/designqr-0.2.1-source-doqhkk10`, with a source hash
manifest and a successful fresh `npm ci`, package/web build and startup-budget
check. The unpublished tarball is
`/tmp/designqr-0.2.1-source-doqhkk10/designqr-0.2.1.tgz`.

SHA-256: `55f160c1b079ed48ea4d3fe06e681f36236fd0a9fef6ae351798def7329f9cee`.
Payload: 323 files, 5,475,524 packed bytes and 29,639,859 unpacked bytes.
The matching working-tree package is
`/tmp/designqr-0.2.1-optimized/designqr-0.2.1.tgz`; both tarballs are byte-identical.
Final consumer reports are in `/tmp/designqr-city-package-FZE9pf`. Only README.md
changed after that browser run; an entry-by-entry hash comparison verifies all
runtime files, declarations and other package entries are identical. The final
README describes on-demand loading and corrects the earlier 40-building study
text to the current 58-building Dōtonbori composition. The final payload audit
passed after repacking.

All City data remains included; deferral reduces startup cost rather than the
full install size. Clean-build logs use the `/tmp/city-lazy-clean-` prefix.

## Earlier candidate artifacts (superseded by loading fix)

The isolated source snapshot is `/tmp/designqr-0.2.1-source-rf848ibi`; its
`source-manifest.json` records the copied file hashes. It excludes ignored
files, existing build output and dependencies. This proves the captured source
can build after a fresh install, but is not a replacement for final-commit CI.

The unpublished package built from that snapshot is
`/tmp/designqr-0.2.1-candidate/designqr-0.2.1.tgz`.

SHA-256: `813ba7004ecf01cc2657ec68c80da985428ee19e80c6f25ff94d15f37b793969`.

The working-tree tarball installed and tested by the final gate is
`/tmp/designqr-city-package-Ur4e2F/designqr-0.2.1.tgz`; it has the **identical
SHA-256**. Its consumer reports and three-city captures are in the same directory.
The Tokyo Tower check passed independent instances, logo replacement/removal,
both views, PNG decoding and disposal. The Shibuya lazy-loading report wording
was narrowed after this run to match its actual Shibuya-chunk assertion; test
behavior is unchanged.

Local logs are `/tmp/city-release-check.log`, `/tmp/city-release-audit.log`,
`/tmp/city-release-clean-install.log` and `/tmp/city-release-clean-build.log`.
The complete Dōtonbori scene report is `/tmp/dotonbori-scene-oXNH9U/report.json`;
editor/hosted-player captures are in `/tmp/designqr-dotonbori-review`.

These temporary artifacts must be copied into durable release storage when the
candidate is frozen. Any package-source change requires repacking and recording
new hashes.

## Download-size resolution

The matched npm payload comparison against published `0.2.0` found a material
initial-loading regression. Byte counts below are exact; gzip measurements use
the same local gzip encoder on each published entry file, not network timings.

| Measurement | Published 0.2.0 | Candidate 0.2.1 |
| --- | ---: | ---: |
| npm tarball bytes | 1,536,045 | 5,456,302 |
| Unpacked bytes | 7,524,207 | 29,594,985 |
| Main ESM bytes | 846,825 | 6,579,671 |
| Main ESM gzip bytes | 207,006 | 1,109,978 |
| Main CJS gzip bytes | 188,023 | 995,957 |

In the earlier candidate, `ThreeFallbackRenderer.ts` statically imported
`TokyoTowerScene.ts`, which imported
`tokyo-tower-parts.ts` and the complete generated Blender model. City scene code
therefore reached the main entry even for Tree/Shibuya consumers. The former
lazy-loading assertion only checked Shibuya asset requests and missed inline
payloads. It has been replaced by all-city implementation/model request checks
and the static import-graph budget.

The loader now defers every City scene until that preset is selected. Small
camera and transition helpers no longer pull detailed Shibuya geometry into
startup. Measuring the complete static ESM import/export graph gives:

| Package-owned static JavaScript | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Published 0.2.0 | 877,980 | 216,572 |
| Earlier 0.2.1 candidate | 6,612,045 | 1,117,484 |
| Optimized 0.2.1 candidate | 162,783 | 46,661 |

The [machine-readable audit](city-startup-audit.json) records the static graphs,
source hashes and tarball measurement. The reduction versus the earlier candidate is 95.8%. These sums compress each
file independently at gzip level 9 and exclude external peers, dynamic imports,
images, maps and browser overhead. They are not total download or memory claims.
The total tarball still contains all cities for consumers who select them.

A 64 KiB gzip startup gate now validates built and installed-package ESM graphs.
Browser request assertions reject unrelated City implementations for Tree and
each selected preset. All nine delayed/failed/disposed loading cases passed in
the final installed package, including Japanese-text QR and PNG export after
a failed download. Shibuya's 23-edit audit also verifies renderer-owned GPU
resources are disposed exactly once. The QR stays usable on failure, paused frames stay frozen,
and late downloads cannot attach to disposed/replaced scenes.

## Remaining release acceptance

1. Retain the optimized candidate, its audit and browser reports as the
   automated qualification baseline. Requalify any subsequent code changes.
2. Run required remote CI and the non-publishing manual workflow against the
   scoped release commit; record its SHA, run links and elapsed time against
   the current 60-minute workflow limit. Local staged-source gates have passed.
3. Record actual iPhone/Safari and Android/Chrome performance and native-camera
   scan results using the release plan's acceptance matrix. Emulated mobile
   viewports and software WebGL are not substitutes.
4. Prepare the three-city launch stills/preview and verify examples against
   the accepted artifact. Record the current production build and rollback
   reference before coordinating package publication and website deployment.

Publication remains a later action after review of the concrete candidate and
outstanding evidence. The existing publishing tag workflow publishes to npm;
it is not a rehearsal command.
