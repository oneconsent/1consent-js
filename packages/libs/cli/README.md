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

Run `1c --help` for the command reference: `connect`, `init`, `pull`, `push`,
`status` and `typegen`. `1c typegen` writes its typed names for each adapter your
project declares in its `package.json` (`@1consent/nextjs`, `@1consent/react`).

## Preview a design locally

With CLI 0.3.0 or later, start in an empty authoring directory:

```sh
npx @1consent/cli init --local-preview
npm install
npm run dev
```

Place the full design under `designs/<name>/gdpr/`, `designs/<name>/tcf/`, or
`designs/<name>/us/`. The local preview uses sample data without a 1Consent API
key. The Design Kit shows compile results, theme tokens, localized text and mock
configuration. To pull or push drafts, use connected setup with a key that has
Designs and themes access.

## Connect an AI assistant

The connector is available in `0.2.0` and later. With Node.js 22.12 or newer,
run it in an interactive terminal.

```sh
npx @1consent/cli@latest connect
```

Choose Codex, Claude Code or Cursor and review the selected settings file before
it changes.
The connector adds the `1Consent` remote HTTP entry. It renames an existing
`oneconsent` entry for the same endpoint and preserves other servers and
comments. Conflicting custom entries require review.

Codex uses its native `mcp login` command. For Claude Code, start a new session
and open /mcp → 1Consent → Authenticate. The browser flow lets a new user create
an account, verify identity, accept the Terms/DPA,
enter a website and approve access. The existing account-setup transaction creates
the first workspace and site. Cursor completes authentication from Settings →
Tools & MCP → 1Consent → Connect. No API key or repository checkout is needed.

After authentication, paste the displayed first task into the connected assistant.
It reads the account, selects an authorized site and requests its
setup plan. Configuration and successful login do not prove that first request
or the website's consent integration works. The connector does not publish,
purchase, scan or change a site's configuration.

```sh
npx @1consent/cli@latest connect --client codex
npx @1consent/cli@latest connect --client cursor --check
npx @1consent/cli@latest connect --client codex --remove
```

`--check` is a read-only configuration check; it does not test authentication.
For configuration-only scripts, use `--client <codex|claude-code|cursor> --no-login`.
`--env develop` and `--env local` select the corresponding service environment;
the default is production. Codex respects an absolute `CODEX_HOME`; Claude Code
respects an absolute `CLAUDE_CONFIG_DIR`. A project-level `1Consent` or legacy `oneconsent` entry can
override a user connection; review and remove a conflicting project entry before
connecting. The connector never silently replaces those project settings.

If signup or approval expires, rerun the connector and start login again.
Cancellation leaves existing settings intact. A saved configuration remains
available after an unsuccessful login, so retries do not create duplicate entries.
If interrupted during a settings write, check that no setup process is running
before removing its `.1consent-lock` file and retrying. Symlinked settings files
and custom entries require review in the client's settings before editing.
Removing the local entry does not revoke account access; revoke the connection
separately in 1Consent's connected-assistant settings.

The adapter and configuration code includes MIT-licensed adaptations from
PostHog/wizard; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Before publication

The CLI requires Node.js 22.12 or newer. From this repository's root, pack the
reviewed artifact into an existing directory:

```sh
npm pack ./packages/libs/cli --pack-destination /path/to/tarballs
```

Install that tarball in a test project and run `./node_modules/.bin/1c --help`
there. The public registry invocation remains the scoped
`npx @1consent/cli` command above.
