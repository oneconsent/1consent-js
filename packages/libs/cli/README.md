# @1consent/cli

The scoped 1Consent command-line interface. It synchronizes customer designs
and themes, reports workspace status, and generates typed React consent names
and framework-associated fast-path versions.

## Distribution status

Stable releases are published on npm's `latest` dist-tag; prereleases use the
`beta` dist-tag. The protected public-repository workflow stages each release
with provenance for a maintainer's npm 2FA approval, using trusted publishing.
The unscoped npm package `1c` belongs to an unrelated project;
never direct customers to `npx 1c`. Run the scoped package:

```sh
npx @1consent/cli typegen --app YOUR_APP_ID
```

The installed executable remains named `1c`. The published artifact contains
self-contained executable and Design Kit bundles and has no runtime dependency
on private 1Consent workspace packages. Projects created by `1c init` load the
authoring plugin from `@1consent/cli/design-kit`; they do not install the
monorepo's internal Design Kit or contracts packages. The plugin supports Vite
8, declared as an optional peer so command-only CLI consumers do not install a
frontend build tool they never use.

Run `1c --help` for the command reference: `init`, `pull`, `push`, `status`
and `typegen`. `1c typegen` writes its typed names for each adapter your
project declares in its `package.json` (`@1consent/nextjs`, `@1consent/react`).

## Before publication

The CLI requires Node.js 22.12 or newer. From this repository's root, pack the
reviewed artifact into an existing directory:

```sh
npm pack ./packages/libs/cli --pack-destination /path/to/tarballs
```

Install that tarball in a test project and run `./node_modules/.bin/1c --help`
there. The public registry invocation remains the scoped
`npx @1consent/cli` command above.
