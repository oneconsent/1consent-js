# 1Consent JavaScript packages

Integrate a configured 1Consent CMP into React and Next.js applications, gate third-party
markup by consent, and generate typed service and category names with the CLI.

| Package | Purpose | Requirements |
| --- | --- | --- |
| [`@1consent/react`](packages/libs/react/README.md) | Consent provider, markup gates, and reactive consent hook | React 19+ |
| [`@1consent/nextjs`](packages/libs/nextjs/README.md) | App Router integration and server cookie helpers | Next.js 16, React and React DOM 19+ |
| [`@1consent/cli`](packages/libs/cli/README.md) | Design synchronization and consent type generation | Node.js 22+; Vite 8 for Design Kit authoring |

You need a 1Consent application ID and published CMP configuration. Service and category names
used in your integration must match that configuration. The provider loads the hosted CMP;
these packages provide the framework integration and tooling.

## Release status and installation

The first release, `0.1.0-beta.0`, is prepared but has not yet been published or verified against
the public npm registry. The commands below become supported after npm approval and registry
verification. All packages are prerelease software; install the `beta` channel explicitly:

```sh
npm install @1consent/react@beta
npm install @1consent/nextjs@beta
npx @1consent/cli@beta --help
```

## What this repository contains

This is the public release and provenance record for the three packages.

It intentionally contains only the files distributed through npm, public documentation,
verification code, and release automation. Private product source and private build dependencies
are not mirrored here. Every tracked release file is recorded by path, size, and SHA-256 digest in
`public-release-manifest.json`.

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
