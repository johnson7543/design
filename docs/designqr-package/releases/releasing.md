# DesignQR release pipeline

Status: Active release procedure<br>
Scope: The public `designqr` npm package

[Back to the Design QR documentation index](README.md)

## Pipeline behavior

The [`Publish DesignQR`](../../../.github/workflows/publish-designqr.yml) workflow
has two entry points:

- A manual `workflow_dispatch` run executes every validation and package audit
  but never publishes.
- A pushed `designqr-v*` tag executes the same gates and publishes only when the
  tag exactly matches the version in `packages/designqr/package.json` and its
  commit belongs to `main`.

The workflow uses a GitHub-hosted runner, Node from `.nvmrc`, npm `11.15.0`, and
the npm Trusted Publishing OIDC flow. It does not require a long-lived npm token
after the trusted publisher is configured. Trusted Publishing also creates npm
provenance automatically for this public GitHub repository.

## One-time npm bootstrap

Use this bootstrap only when the package has no published version or trusted
publisher configured. Confirm npm account/package state before running it;
repository version metadata does not establish publication state. For a first
manual publication, use an account with package publishing 2FA:

```bash
npm login
npm run release:designqr:check
npm run check
npm run audit:designqr-package
npm publish --workspace designqr --access public
```

After the first version exists, configure its Trusted Publisher on npmjs.com:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `johnson7543` |
| Repository | `design` |
| Workflow filename | `publish-designqr.yml` |
| Environment | Leave empty |
| Allowed action | `npm publish` |

The same relationship can be created from an authenticated npm `11.15.0+` CLI:

```bash
npm trust github designqr \
  --repo johnson7543/design \
  --file publish-designqr.yml \
  --allow-publish
```

After one successful OIDC release, set npm Publishing access to require 2FA and
disallow token publishing. Protect the `designqr-v*` tag pattern on GitHub as an
additional release-control boundary.

The first manually published version should not subsequently be pushed with its
publishing tag because npm versions are immutable. Begin tag-driven publication
with the next version.

## Tag-driven release

1. Update the version in `packages/designqr/package.json` and `package-lock.json`.
2. Update package documentation and release notes.
3. Merge the release commit to `main` and wait for the Verify workflow to pass.
4. Run `Publish DesignQR` manually once to exercise the non-publishing audit.
5. Create and push the exact matching tag:

```bash
release_version=$(node -p "require('./packages/designqr/package.json').version")
npm run release:designqr:check -- --tag "designqr-v${release_version}"
git tag -a "designqr-v${release_version}" -m "DesignQR ${release_version}"
git push origin "designqr-v${release_version}"
```

The tag run re-verifies the entire repository, audits the npm payload, and then
publishes the workspace. Do not retry a successful version with the same number;
increment the package version for every subsequent release.

## Local release contracts

```bash
npm run release:designqr:check
release_version=$(node -p "require('./packages/designqr/package.json').version")
npm run release:designqr:check -- --tag "designqr-v${release_version}"
npm run audit:designqr-package
```

The release contract checks package identity, semantic versioning, MIT licensing,
registry/repository metadata, public exports, package-lock synchronization, and
the exact release tag. The package audit permits only `dist`, `README.md`,
`LICENSE`, package metadata, and the required `third-party-licenses/noto-cjk.txt`
and `third-party-licenses/dotonbori-sources.txt` notices in the npm payload.
The Noto notice is also required by the metadata contract; the tarball audit
requires both notices.

## Current City release gates

The [tarball audit](../../../scripts/audit-designqr-package.mjs) now includes
the Dōtonbori notice and passed against the optimized local build on 2026-09-22. Review
that notice against current runtime details before release; payload inclusion
does not establish that every description is current.

The shared `npm run check` path includes dedicated Dōtonbori editor/scene
smokes, the 64 KiB package-owned static ESM startup budget and the installed
City package check, including Tokyo Tower and all-city code-loading failures. Both
workflows inherit these required gates for the three-city release. The [City release plan](city-release-plan.md)
records candidate readiness, device qualification, artifact
verification and coordinated editor/hosted-player rollout. Publishing and
production deployment are separate operations.
