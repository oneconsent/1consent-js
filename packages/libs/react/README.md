# @1consent/react

React 19+ integration for 1Consent. It renders the synchronous CMP embed,
keeps third-party markup inert until consent, and exposes reactive consent
state without making server-rendered HTML visitor-specific.

## Distribution status

The first supported release line is `0.1.0-beta.*` on npm's `beta` dist-tag.
The protected public-repository workflow stages each release with provenance
for a maintainer's npm 2FA approval. The first release uses a short-lived
stage-only token; later releases use trusted publishing. Before a release is
approved and verified against the registry, test the reviewed local tarball.

After verification, beta consumers install an explicit prerelease channel:

```sh
npm install @1consent/react@beta
```

## Public API

- `OneConsentProvider` embeds the CMP and framework-associated fast path.
- `OneConsent` gates plain script, iframe, pixel, or other intrinsic markup by
  configured service or category.
- `useConsent` returns the current decision and reacts to CMP updates.
- `OneConsentServiceMap` and `OneConsentCategoryMap` are declaration-merging
  targets populated by `1c typegen`.

The generated declaration files are included in the package. React is the
only peer dependency, Zod is the only public runtime dependency, and 1Consent
workspace implementation packages are bundled into the JavaScript artifact
instead of becoming consumer dependencies.

See the 1Consent developer reference for the complete API and integration
guidance.

## Before publication

From this repository's root, pack the reviewed artifact into an existing directory:

```sh
npm pack ./packages/libs/react --pack-destination /path/to/tarballs
```

Install that tarball in a React 19+ test project. This repository contains the
reviewed distribution artifacts; it does not contain the private source build.
