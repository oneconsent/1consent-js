# Changelog

Releases of the `sdk` line: `@1consent/react`, `@1consent/nextjs` and `@1consent/cli` release
together at one version. Release tags are listed in [RELEASING.md](RELEASING.md).

## 0.3.1

- The Design Kit automatically selects a compatible design when the workspace
  contains one. The Designs screen lists full design views separately from partials.
- Local preview shows its viewport dimensions and can start a new visit for
  the selected banner. Saving a mock config refreshes the preview while
  preserving the visitor's choice.
- Mock service details show labeled sample declarations. Services inherit an
  essential category's consent setting, as in the hosted CMP.
- The Design Kit renders SVG linear gradients. The CLI guide explains how to
  export a draft from MCP for a keyless preview.
- `@1consent/react` and `@1consent/nextjs` share the release version.

## 0.3.0

- `@1consent/cli`: `init --local-preview` sets up a Design Kit workspace with sample
  data and no 1Consent API key. Connected setup masks API key entry.
- **Design Kit:** The Designs, Themes, Localized Content, and Mock Config screens
  show workspace files and validation results. Preview supports language
  selection, bookmarkable URLs, and a mobile settings sheet. Compiler errors point
  to the source file and line.
- `@1consent/cli`: `connect` displays the server as `1Consent`, migrates a matching
  legacy entry, and directs Claude Code users to authenticate through `/mcp`.
- `@1consent/react` and `@1consent/nextjs` share the release version. Their public APIs
  are unchanged.

## 0.2.0

- `@1consent/cli`: `npx @1consent/cli@latest connect` sets up the hosted 1Consent MCP
  connection in Codex, Claude Code or Cursor. It preserves other MCP entries and
  supports read-only configuration checks with `--check`.
- `@1consent/react`, `@1consent/nextjs`: `useConsent` reads consent from the hosted
  CMP after it loads, including integrations without a fast-path configuration.
  A returning visitor’s saved TCF choice is used only while the TCF router
  confirms it.

## 0.1.0

First stable release. `npm install @1consent/react`, `npm install @1consent/nextjs` and
`npx @1consent/cli` now install this version from the `latest` dist-tag; before it, `latest` held
npm's `0.0.0-stage` registration placeholder. The `beta` dist-tag stays at `0.1.0-beta.3`.

Changes since `0.1.0-beta.3`:

- `@1consent/react`: the consent fast path reads the same browser storage key as the hosted CMP
  when the site's configuration scopes its storage, so returning visitors' consent is found there.
- `@1consent/react`: the bundled fast-path engine follows the consent choices recorded when the
  visitor decided. A service or category that became optional, or was added, after that decision
  stays inactive until the visitor decides again.
- `@1consent/react`: `OneConsentProvider` loads the CMP and starts the consent engine in
  client-rendered apps (for example a Vite SPA started with `createRoot`). React never runs a
  `<script>` it renders in the browser, so the provider previously loaded nothing there. On a
  client-only mount it now inserts the CMP script, unless the page already loads it, and starts the
  engine once the CMP's configuration is available. Server-rendered output is unchanged.
- `@1consent/react`, `@1consent/nextjs`: React and React DOM peers are limited to React 19
  (`>=19.0.0 <20.0.0`), and `@1consent/react` no longer installs `zod`, which it never used.
- `@1consent/cli`: `1c pull` and `1c push` keep custom-banner design metadata
  (`banner.design.json`) in step with the dashboard.
- `@1consent/cli`: `1c init` points to workspace Settings → Developers for API keys, and scaffolds
  Biome 2.6.2.
- `@1consent/cli`: loading `.env` no longer prints a notice.
- `@1consent/cli`: `1c typegen` writes its typed service and category names for each adapter the
  project declares in its `package.json` (`@1consent/nextjs`, `@1consent/react`). A Next.js
  project that installs only `@1consent/nextjs` gets typed names under pnpm and Yarn Plug'n'Play
  too, where it cannot resolve `@1consent/react`.
- `@1consent/cli`: `1c --help` lists only the customer commands `init`, `pull`, `push`, `status`
  and `typegen`. The package contains only these commands: 1Consent's internal commands for
  publishing its own system designs (`push-system`, `publish`) are no longer part of it, and the
  offline MCP commands (`mcp`, `validate`) remain repository-only. The package
  has no runtime dependencies.

## 0.1.0-beta.3

Durable public identity and design regeneration fixes found in QA.

## 0.1.0-beta.2

First release staged through the GitHub OIDC trusted publisher.

## 0.1.0-beta.1

First public beta.
