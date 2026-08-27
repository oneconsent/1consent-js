# @1consent/cli

The scoped 1Consent command-line interface. It synchronizes customer designs
and themes, reports workspace status, and generates typed React consent names
and framework-associated fast-path versions.

## Distribution status

The first supported release line is `0.1.0-beta.*` on npm's `beta` dist-tag.
The package is publishable only from the protected, provenance-backed release
workflow after its public source repository and npm trusted publisher are
configured. The unscoped npm package `1c` belongs to an unrelated project;
never direct customers to `npx 1c`.

After registry verification, the supported beta invocation is:

```sh
npx @1consent/cli@beta typegen --app YOUR_APP_ID
```

The installed executable remains named `1c`. The published artifact contains
self-contained executable and Design Kit bundles and has no runtime dependency
on private 1Consent workspace packages. Projects created by `1c init` load the
authoring plugin from `@1consent/cli/design-kit`; they do not install the
monorepo's internal Design Kit or contracts packages. The plugin supports Vite
8, declared as an optional peer so command-only CLI consumers do not install a
frontend build tool they never use.

Run `1c --help` for the source-backed command reference.
