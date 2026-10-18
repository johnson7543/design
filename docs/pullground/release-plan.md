# Pullground first release plan

Updated on 2026-10-19. **Proposed stable release: `@johnson7543/pullground@0.1.0`.**
The public prerelease `0.1.0-rc.1` is available on `next`. Stable `0.1.0` and the
matching website deployment remain in preparation.

## Stable candidate preparation — 2026-10-19

The maintainer confirmed desktop Firefox and Safari passed pull/aim, keyboard
controls, Export-dialog focus, and reduced motion. Browser/OS versions were not
supplied. Together with the earlier mobile confirmation, this completes the
requested manual browser acceptance.

Prepared `0.1.0` with `publishConfig.tag: latest`, a synchronized lockfile, stable
installation instructions, and updated compatibility documentation. Runtime code
is unchanged from the verified public prerelease. The
[stable release record](releases/0-1-0.md) tracks the final source/archive,
verification-only workflow, trusted publisher, tag publication, and deployment.
The exact archive passed React 19.0.0 and 19.2.8 consumer checks. Production
preflight passed at all three required viewports, and the tested live assets
match the candidate build. GitHub's complete release gate and both React
consumers passed on the final source commit. The downloaded CI archive matches
the local archive byte for byte. The maintainer approved the exact trusted
publisher and npm saved and verified the configuration. Stable npm publication
is the next execution step.

## Prerelease publication — 2026-10-19

The accepted archive was published to npm with public access and `--tag next`.
The registry publication time is `2026-10-18T16:12:24.690Z`, which is 2026-10-19
in Asia/Taipei. The downloaded registry archive matches the accepted candidate
byte for byte, and a fresh React 19.2.8 consumer passed. npm also assigned
`latest` to the first publication and rejected its removal with HTTP 400 after
browser authorization. Both `next` and `latest` currently resolve to this
prerelease; stable publication will move `latest` to `0.1.0`. The
[release record](releases/0-1-0-rc-1.md) retains the exact registry results.

Desktop Firefox/Safari acceptance and stable metadata preparation subsequently
completed as recorded above. Final qualification, trusted publishing, automated
publication, and the matching website deployment remain.

## Final prerelease candidate — 2026-10-18

The finalized consumer README and compatibility wording are committed in
`a8cfdbcf436f07f345bdae195a2a2f5e2672f495`.
[Final-commit Verify](https://github.com/johnson7543/design/actions/runs/39120609634)
passed the complete repository gate. The clean-checkout archive and both React
consumer reports match the SHA-256 printed by CI. The
[release record](releases/0-1-0-rc-1.md) contains the exact source, checksum,
artifact location, confirmed mobile checks, and subsequent publication evidence.

## CI-qualified implementation — 2026-10-18

The implementation is committed and pushed as
[`1a963ed91b05e515eb2878c799183420822e926f`](https://github.com/johnson7543/design/commit/1a963ed91b05e515eb2878c799183420822e926f).
Both GitHub runs completed successfully:

| Run | Evidence |
| --- | --- |
| [Verify](https://github.com/johnson7543/design/actions/runs/39061800605) | Complete `npm run check` on the committed implementation |
| [Publish Pullground — manual verification](https://github.com/johnson7543/design/actions/runs/39105725989) | Complete gate, clean-checkout archive, React 19.0.0 and 19.2.8 consumer checks, matching checksums, and retained artifacts; npm publication skipped |

The retained artifact is
`pullground-1a963ed91b05e515eb2878c799183420822e926f-1`. Its archive is
`johnson7543-pullground-0.1.0-rc.1.tgz` (35,901 bytes), with SHA-256
`f815349f9f231490779e45900ca8cf993234b36d9a42a99a1750cc594d8f33ae`.
The downloaded archive matches its manifest and both consumer reports; each
React version passed all six README examples and 16 demo examples. The manifest
identifies the commit above and `workingTreeDirty: false`.

At this stage, the consumer README still needed final prerelease wording. That
changed the package archive even though runtime code was unchanged. The final
clean commit and archive were qualified separately as recorded above; the
artifact here records the tested implementation baseline.

Before publication on 2026-10-18 UTC, the npm package lookup returned
404, and the maintainer renewed npm login; `npm whoami` confirms `johnson7543`.
The maintainer confirmed that iPhone Safari and Android Chrome both passed pull,
aim, release, and return-animation checks. Device models and OS/browser versions
were not supplied. Automated browser coverage is Chromium. Complete desktop
Firefox and Safari qualification before the stable release; the public prerelease
uses the recorded Chromium and mobile acceptance results. After publication,
verify a fresh registry installation, then configure trusted
publishing when preparing the stable candidate and deploy the matching website.

## Preparation progress — 2026-10-17

- Prepared unpublished `0.1.0-rc.1` metadata and synchronized the lockfile.
- Rewrote the consumer README with six complete examples and checked them,
  plus all 16 Export examples, against the actual package archive.
- Added the release metadata guard and negative tests, retained archive/hash
  evidence, and a verification-only/manual or tag-driven publishing workflow.
  The workflow has not yet run on GitHub.
- Passed isolated consumer imports, types, SSR/hydration, and Chromium interactions
  on React 19.0.0 and 19.2.8. The reviewed local archive is about 35 KiB compressed.
- Passed the complete local `npm run check`, with production smoke scenarios
  `desktop,small-mobile`. This includes the shared demo and DesignQR regressions,
  the full Pullground browser suite, and the installed package/README checks.
  The workflow has not run on GitHub, and clean-commit CI remains a separate gate.
- Recorded and visually reviewed a 16-second, 60 fps homepage preview covering
  all four games, with motion checks and an updated poster.
- Rechecked npm: the public package endpoint returned 404, and `npm whoami`
  returned 401 Unauthorized. An authenticated maintainer session is still needed
  for bootstrap; no account settings were changed.

See the [implemented release procedure](releasing.md) and
[release notes](release-notes.md). These preparation results precede the
clean-commit CI evidence above. The original local artifacts identify their
dirty-tree origin and remain review builds, separate from downloaded CI evidence.

The final local archive is
`artifacts/pullground/johnson7543-pullground-0.1.0-rc.1.tgz` (35,901 bytes), with
SHA-256 `f815349f9f231490779e45900ca8cf993234b36d9a42a99a1750cc594d8f33ae`.
Its manifest, checksum file, complete verification log, and per-React consumer
reports are retained alongside it. Rebuild and qualify a clean candidate before
publication; a later archive must have its own matching verification evidence.

## Release scope

Ship the React package, its demo at
`https://design.johnson7543.com/pullground`, and the home-page preview together.
The shared demo UI ships with the website; it does not need a separate npm package.

Freeze the first release around the implemented behavior:

- `Pullground` with an `onPull` callback for synchronous or async actions,
  automatic styles, and an imperative `trigger()` handle.
- Basketball, Dart, Bowling, and Stone skipping; Classic, Simple, Ocean, and
  Midnight themes. Basketball and Classic remain the defaults.
- Directional play, proportional artwork, accessible announcements, keyboard
  activation, and reduced motion. The host action controls completion; do not
  introduce a minimum delay to keep a game visible.
- The full-page demo with its large animated Pull guide, arrow, game/theme
  controls, and Export dialog containing copyable React examples.
- A recorded catalog preview linking to the demo, plus the existing `/refresh`
  redirect for old links.

The package owns a scrolling viewport rather than window-level scrolling.
Keep that integration boundary clear in the README. React 19 is the declared
peer dependency; React 18 and framework-specific server-component support are
outside this release's compatibility claims. New games, themes, and API options
can follow after release feedback.

## Baseline readiness — 2026-10-16

| Area | Evidence | Remaining gate |
| --- | --- | --- |
| Component and demo | Four games/themes and the latest Pull animation are implemented | Freeze the intended changes in a clean candidate commit |
| Local validation | Unit/type checks, build, package SSR/hydration, isolated consumer, Pullground browser smoke, shared demo smoke, and style/documentation checks passed during implementation | Run the complete CI gate on the final release commit |
| Package identity | [Manifest](../../packages/pullground/package.json) is private at `0.0.0`; MIT license and ESM/CJS/type exports exist | Prepare public metadata, version, and matching lockfile |
| npm availability | A read-only lookup of the public npm registry returned 404 for `@johnson7543/pullground` on the review date | Confirm the maintainer account can publish under `@johnson7543`; registry absence does not establish permission |
| Publishing | DesignQR has a release workflow; Pullground has none | Add Pullground validation and publishing automation |
| Compatibility | Automated Chromium checks and a React 19.2.8 consumer passed | Test the lowest declared React version and physical mobile browsers |
| Launch media | The existing portrait preview shows basketball and darts | Record a preview covering all four games |
| Website | The demo and catalog entry exist locally | Accept a frozen build, deploy it, and verify the public routes |

At the baseline review, the working tree included shared demo changes and
unrelated work, and HEAD did not yet contain the complete Pullground
implementation. Continue to select explicit changes and preserve unrelated
edits; do not stage the entire workspace or publish from a dirty tree.

## 1. Prepare the package and release tooling

Prepare `0.1.0-rc.1` as the first candidate, then `0.1.0` after qualification.
Remove `private: true` from the package when preparing that candidate. Keep the
repository root private. Add author, keywords, homepage, repository with
`directory: packages/pullground`, issue tracker, and public npm publish settings.
Update the lockfile with each version change.

Review the [package README](../../packages/pullground/README.md), root README,
and product index. Include installation, the single component import, a real
`onPull` example, games/themes, viewport sizing, action/error behavior, and the
tested compatibility range. An immediately resolved callback may finish before
the game plays; explain this without adding artificial delays to the component.
Keep publication wording accurate for each stage. Prepare a short `0.1.0`
release note describing the public API and its supported boundaries.

The implemented `release:pullground:check` script and
`.github/workflows/publish-pullground.yml` follow the
[DesignQR release workflow](../../.github/workflows/publish-designqr.yml) and
[release validation approach](../designqr-package/releases/releasing.md) as references:

- Validate package name, semantic version, lockfile agreement, license,
  repository, public access, exports, files, and tag/version agreement.
- Make manual workflow dispatch verification-only. Publish only for matching
  `pullground-v*` tags whose commit is on `main`.
- Send prereleases to `next` and stable versions to `latest`. Scope publishing
  to Pullground, and prevent concurrent publication of the same version.
- Use the repository's Node pin and npm 11.15.0 on a GitHub-hosted runner, with
  `contents: read` and `id-token: write` for trusted publishing.
- Build and retain one package archive per candidate. Extend the
  [isolated package check](../../scripts/check-pullground-package.mjs) to validate
  that supplied archive. Publish the exact tested `.tgz`, retaining its file
  manifest, size, SHA-256, and validation logs as release evidence.

The package check now retains the tested archive and can validate a supplied
archive without repacking. The workflow publishes those same tested bytes.
npm supports publishing a specific tarball, and a published package/version
cannot be reused. [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/)

## 2. Finish the demo launch materials

Keep the current clean composition and follow the
[shared demo UI standard](../global-standards/demo-ui.md). Check all four game
choices, all four component palettes, the animated guide, and all 16 exported
game/theme examples. Verify copying, closing the dialog, restoring focus, and
pausing guide motion while the dialog is open. Keep shared controls and dialog
tokens consistent with DesignQR.

Update the [recording scenario](../../scripts/demo-video-scenarios/pullground.json)
to show each game clearly in a short loop. Use the
[product demo recording workflow](../../skills/record-product-demo/SKILL.md)
and the existing MP4/WebP paths. Capture real interaction, inspect the contact
sheet and loop transition, and verify actual dimensions, frame rate, and
continuous motion. Preserve the home card's poster fallback, reduced-motion
behavior, and offscreen pause. Update the home/video documentation when the
scenario changes.

Accept the built demo locally or through an isolated preview target.
The [current Wrangler configuration](../../wrangler.jsonc) targets the production
custom domain and disables preview URLs; `npm run deploy` is a production
action, not a preview command.

## 3. Qualify the release candidate

Run `npm ci` and `npm run check` from a clean checkout of the candidate using the
pinned toolchain. The aggregate check already includes Pullground, shared demo
UI, DesignQR, production smoke, documentation, and package-consumer checks.
Retain its CI result; earlier local passes are supporting evidence, not a
substitute for the final candidate run.

Complete this acceptance matrix before the stable release. For the initial
public prerelease, require the recorded mobile acceptance, automated Chromium
coverage, both React consumer checks, and clean-commit/archive verification;
keep the remaining desktop-browser checks explicit in the release record.

| Surface | Required coverage |
| --- | --- |
| Responsive demo | 1440×900, 390×844, and 320×568; portrait/landscape on mobile; no clipped controls or guide overlap |
| Physical devices | iPhone Safari and Android Chrome: pull, aim, release, return, scroll boundary, and native overscroll behavior |
| Desktop browsers | Chromium, Firefox, and Safari: pointer gestures, keyboard activation, dialog focus, and reduced motion |
| Game behavior | Each game at low/high power and left/right aim; clean return after the action completes; no lingering status text or visible stutter |
| Action lifecycle | Sync completion, slow promise, rejection, disabled state, repeated trigger, and unmount/abort; callback executes once per accepted action |
| Package integration | Exact packed archive in an isolated consumer; ESM/CJS, types, automatic styles, DOM-free import, SSR, and hydration |
| React compatibility | React/React DOM 19.0.0 plus the repository's installed 19.2.8; narrow the peer range if the advertised minimum cannot pass |
| Website regression | Home card and preview, `/pullground`, `/refresh`, `/qr`, and `/qr/embed`; both demos' shared controls and Export/dialog behavior |

Record browser/OS versions and actual device models with the results. Emulation
does not replace the physical-device gate. Address failures and rerun affected
checks; if implementation changes after qualification, update the candidate
and its evidence before proceeding.

A reviewable candidate must identify its commit, package version, archive hash,
file list/size, website build, CI result, device results, preview assets, and
release notes. Acceptance requires no unresolved release-blocking failures.

## 4. Publish and launch in order

The recommended path uses a public prerelease to establish the new npm package,
then automated publication for `0.1.0`. The prerelease is a real public release,
not a private dry run.

1. **Bootstrap after candidate acceptance.** An authorized maintainer publishes
   the tested `0.1.0-rc.1` archive with public access and the `next` tag, using
   authenticated npm publishing with account 2FA. Install it from the registry
   into a fresh consumer and verify the package contents and demo example.
   Record the commit and archive hash. Do not push a publishing tag for this
   manually published version.
2. **Prepare the stable candidate.** Set `0.1.0`, update the lockfile and release
   documentation, and qualify the final commit and archive. Prefer only release
   metadata/documentation changes from the accepted prerelease; any runtime
   fixes require renewed validation.
3. **Configure trusted publishing when ready.** Connect the existing npm package
   to `johnson7543/design` and the exact `publish-pullground.yml` workflow, with
   direct publication explicitly enabled. `npm trust` requires an existing
   package, write permission, and account 2FA. Newly created trusted-publisher
   configurations must complete their first successful publish within two days,
   so configure this after qualification, close to the stable release.
   [npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/),
   [trusted publishing](https://docs.npmjs.com/trusted-publishers/)
4. **Publish stable.** Push `pullground-v0.1.0` for the accepted commit on `main`.
   The workflow verifies the tag, runs the gates, and publishes the tested archive
   to `latest`. Verify registry metadata, provenance, README, exports, and a fresh
   installation of `@johnson7543/pullground@0.1.0`.
5. **Deploy the matching website.** Record the current production deployment
   identifier, deploy from the accepted release commit, and verify the public
   home page, preview assets, canonical demo, legacy redirect, and DesignQR
   routes. Confirm the copied install command resolves to the published package.
6. **Announce after both checks pass.** Publish the prepared release notes with
   the npm package, demo, and source links. Keep the first announcement focused
   on playful pull actions, the four games, and the simple React integration.

For scoped public packages, npm requires explicit public access on first
publication. [npm scoped publishing guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
Account setup and publish/deploy actions belong to release execution; this
planning pass does not perform them.

## 5. Recovery and follow-up

During the first 24–48 hours, review installation failures, mobile gesture
reports, rendering/return stutter, and website route or asset errors. Record
reproduction steps against the exact package and deployment versions.

For a website regression, restore the recorded previous deployment and verify
its routes and assets. Cloudflare supports rolling back a Worker deployment to
a previously deployed version.
[Cloudflare rollback documentation](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

For a broken npm release, prepare and validate `0.1.1`; do not attempt to
overwrite `0.1.0`. Deprecate a defective version with a clear upgrade message
when appropriate. This is the first stable release, so there is no previous
stable Pullground version to restore. Coordinate the demo with the corrected
package and add a regression check for the reported failure.

Package metadata, consumer documentation, release tooling, refreshed media,
final-commit CI, maintainer mobile acceptance, and the first public prerelease
are complete. The release record tracks registry verification; the remaining
stable-release and website gates are listed above.
