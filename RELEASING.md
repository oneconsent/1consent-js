# Release guide

This guide is for maintainers of `@1consent/react`, `@1consent/nextjs`, and `@1consent/cli`.
Consumer installation and integration examples are in the [README](README.md).

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

These checks verify the exact file manifest, inspect all three npm tarballs, and install and
execute them in a clean consumer project. Before a release, also review the package metadata,
README examples, and npm registry state.

## Beta publishing policy

The workflow is [Publish npm beta](.github/workflows/publish-npm.yml). It runs only from an
immutable `npm-v<version>` beta tag whose commit is contained in `main`. Its publishing job uses
the protected `npm-beta` environment, validates the exact artifacts, and includes npm provenance.

Every beta is staged for a maintainer's npm 2FA approval. The first `0.1.0-beta.1` release uses a
short-lived, scope-limited token with **Read and write (stage only)** permission and **2FA bypass
disabled**. Store it only as the environment secret `NPM_BOOTSTRAP_TOKEN`. Later releases use
the configured GitHub OIDC trusted publisher with stage-only permission.

For a new package, npm staging creates a publicly available `0.0.0-stage` registration placeholder.
The staged beta and its contents become installable only after approval. No beta is promoted to
`latest`. This follows npm's documented [staging](https://docs.npmjs.com/staged-publishing/) and
[trusted-publishing](https://docs.npmjs.com/trusted-publishers/) mechanisms; the exact manifest,
tag naming, and environment policy are this project's safeguards.

The immutable `npm-v0.1.0-beta.0` tag records a preflight failure before npm staging.
The corrected first release is `0.1.0-beta.1`; the failed tag remains unchanged.

## Release sequence

1. Review the public snapshot and merge it into `main` after all required checks pass.
2. Create the immutable beta tag from that exact reviewed commit. Never move or reuse a release tag.
3. Dispatch **Publish npm beta** from the tag with operation `publish`. Select publisher
   `bootstrap-token` for the first `0.1.0-beta.1` release, or `trusted-publisher` for later betas.
4. Review each staged tarball in npm, then approve it with 2FA.
5. Dispatch the same workflow from the same tag with operation `verify`.
6. Confirm exact tarball integrity, `beta` tags, clean installation/execution, and verified provenance
   before advertising the release. After the first verified release, replace the README's
   unpublished-preview notice with the actual published beta status.

A pending stage is not a published version. Approve it before rerunning, or reject it explicitly
before restaging the same reviewed tag. The workflow skips an already published version only if
its tarball integrity and `beta` tag match the reviewed release.

## Trusted-publisher handoff

Configure GitHub Actions for organization `oneconsent`, repository `1consent-js`, workflow filename
`publish-npm.yml`, environment `npm-beta`, with `npm stage publish` permission only. A new connection
must complete its first successful publish within npm's two-day activation window; a saved
configuration alone is not a verified handoff.

Restrict traditional package publishing access to **Require two-factor authentication and disallow
tokens**, delete the GitHub `NPM_BOOTSTRAP_TOKEN` secret, and revoke the temporary npm token during
handoff. Verify the OIDC connection works before recording the handoff as complete.
