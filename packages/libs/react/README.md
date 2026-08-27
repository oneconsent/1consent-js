# @1consent/react

React 19+ integration for 1Consent. It renders the synchronous CMP embed,
keeps third-party markup inert until consent, and exposes reactive consent
state without making server-rendered HTML visitor-specific.

## Distribution status

The first supported release line is `0.1.0-beta.*` on npm's `beta` dist-tag.
The package is publishable only from the protected, provenance-backed release
workflow after its public source repository and npm trusted publisher are
configured. Until the registry verification workflow passes, use the package
from this workspace rather than advertising a public install command.

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
