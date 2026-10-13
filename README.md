# 1Consent JavaScript packages

This public repository is the reviewable release and provenance record for the official
[`@1consent/react`](https://www.npmjs.com/package/@1consent/react),
[`@1consent/nextjs`](https://www.npmjs.com/package/@1consent/nextjs), and
[`@1consent/cli`](https://www.npmjs.com/package/@1consent/cli) packages.

It intentionally contains only the files distributed through npm, public documentation,
verification code, and release automation. Private product source and private build dependencies
are not mirrored here. Every tracked release file is recorded by path, size, and SHA-256 digest in
`public-release-manifest.json`.

All packages remain prerelease software. Install the current beta explicitly:

```sh
npm install @1consent/react@beta
npm install @1consent/nextjs@beta
npx @1consent/cli@beta --help
```

## Verify the release artifacts

Use Node.js 24:

```sh
npm test
npm run check:secrets
npm run verify:npm-packages
```

The verification checks the exact file manifest, inspects all three npm tarballs, and installs and
executes them in a clean consumer project.

The guarded beta release process is implemented in
[`publish-npm.yml`](.github/workflows/publish-npm.yml). Releases require an immutable beta tag,
the protected `npm-beta` environment, exact-manifest verification, and npm provenance.

Every beta is staged for a maintainer's npm 2FA approval. The first release uses a short-lived
stage-only token with 2FA bypass disabled; later releases use a configured trusted publisher.
Staging a new package creates npm's public `0.0.0-stage` registration placeholder. The reviewed
beta contents become installable only after approval. No beta is promoted to `latest`.
