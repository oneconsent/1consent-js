# Release guide

This guide is for maintainers of `@1consent/react`, `@1consent/nextjs`, `@1consent/cli`, and
`@1consent/site-check`. Consumer installation and integration examples are in the [README](README.md).

## Release lines

Packages release in lines. Each line has its own version and immutable tag prefix, and every
package in a line releases together at that line's version:

| Line | Packages | Tag |
| --- | --- | --- |
| `sdk` | `@1consent/react`, `@1consent/nextjs`, `@1consent/cli` | `npm-v<version>` |
| `site-check` | `@1consent/site-check` | `npm-site-check-v<version>` |

The lines are defined once in `scripts/npm-release-lines.mjs`; the workflow derives the line from
the tag.

## Repository boundary

This public repository contains the reviewed npm distribution files, public documentation,
verification code, and release automation. Private product source and private build dependencies
are not mirrored here. Every release file is recorded by path, byte size, and SHA-256 digest in
`public-release-manifest.json`.

Changes to this boundary require an explicit review and manifest update. Private source,
source maps, workspace dependencies, credentials, and unlisted files must not be exported.

npm provenance binds the published tarball to the public release commit and publishing workflow.
The private source build is outside this repository and cannot be reproduced from this checkout.
The manifest and clean-consumer checks verify the reviewed distribution artifacts.

## Verify artifacts

Use Node.js 24.15 or newer and npm 12.2.0 from the repository root. Both the quality and
publishing workflows pin this npm version so verification exercises its JSON output contracts:

```sh
npm test
npm run check:secrets
npm run verify:npm-packages
```

These checks verify the exact file manifest, inspect every package tarball, and install and
execute them in a clean consumer project. Before a release, also review the package metadata,
README examples, and npm registry state.

## Channels

A release's version picks its npm channel. The channels are defined once in
`scripts/npm-release-lines.mjs` (`NPM_RELEASE_CHANNELS`) and the workflow's tag guard:

| Version | Example tag | npm dist-tag | Protected environment |
| --- | --- | --- | --- |
| `<major>.<minor>.<patch>-beta.<n>` | `npm-v0.2.0-beta.0` | `beta` | `npm-beta` |
| `<major>.<minor>.<patch>` | `npm-v0.1.0` | `latest` | `npm-stable` |

The workflow never stages a beta under `latest` or a release under `beta`. Each channel advances
only forward: the workflow refuses a version that is not newer than the channel's current dist-tag,
and a beta must also be newer than the current `latest` release. On `latest`, npm's `0.0.0-stage`
registration placeholder counts as older than any release.

## Publishing policy

The workflow is [Publish npm](.github/workflows/publish-npm.yml). Publishing runs only from an
immutable release tag of one release line (`npm-v<version>` or `npm-site-check-v<version>`) whose
commit is contained in `main`, and stages only that line's packages under the channel's dist-tag.
Its publishing job runs in the channel's protected environment, validates the exact artifacts, and
includes npm provenance.

Every release is staged for a maintainer's npm 2FA approval. The first `0.1.0-beta.1` release of a line used a
short-lived, scope-limited token with **Read and write (stage only)** permission and **2FA bypass
disabled**. Later releases use the configured GitHub OIDC trusted publisher with stage-only
permission; a stable release always does.

For a new package, npm staging creates a publicly available `0.0.0-stage` registration placeholder
under `latest`. The staged version and its contents become installable only after approval. This
follows npm's documented [staging](https://docs.npmjs.com/staged-publishing/) and
[trusted-publishing](https://docs.npmjs.com/trusted-publishers/) mechanisms; the exact manifest,
tag naming, and environment policy are this project's safeguards.

The immutable `npm-v0.1.0-beta.0` tag records a preflight failure before npm staging.
The corrected first release is `0.1.0-beta.1`; the failed tag remains unchanged.

## Release sequence

1. Review the public snapshot and merge it into `main` after all required checks pass. Every
   package of the line carries the release version, and `publishConfig.tag` is the channel's
   dist-tag.
2. Create the release line's immutable tag from that exact reviewed commit. Never move or
   reuse a release tag.
3. Dispatch **Publish npm** from the tag with operation `publish` and publisher
   `trusted-publisher`.
4. Review each staged tarball in npm, then approve it with 2FA.
5. Dispatch the workflow from protected `main` with operation `verify` and `release_tag` set to
   the immutable tag. Read-only verification uses the reviewed verifier at the workflow commit
   while checking the original tagged artifacts, release identity, and protected environment.
   It cannot stage packages and has no npm credential or OIDC permission.
6. Confirm exact tarball integrity, the channel's dist-tag, clean installation/execution, and verified
   provenance before advertising the release. Record it in [CHANGELOG.md](CHANGELOG.md).

A pending stage is not a published version. Approve it before rerunning, or reject it explicitly
before restaging the same reviewed tag. The workflow skips an already published version only if
its tarball integrity matches the reviewed release and it still owns the channel's dist-tag.

## Trusted-publisher handoff

For each package, configure GitHub Actions for organization `oneconsent`, repository `1consent-js`,
workflow filename `publish-npm.yml`, with `npm stage publish` permission only: one connection with
environment `npm-beta` and one with environment `npm-stable`. A new connection must complete its
first successful publish within npm's two-day activation window; a saved configuration alone is not
a verified handoff, so add the `npm-stable` connection only when the first stable release is ready
to stage.

Restrict traditional package publishing access to **Require two-factor authentication and disallow
tokens**, delete the GitHub `NPM_BOOTSTRAP_TOKEN` secret, and revoke the temporary npm token during
handoff. Verify the OIDC connection works before recording the handoff as complete.
