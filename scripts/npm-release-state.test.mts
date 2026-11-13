import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { NPM_RELEASE_CHANNELS } from "./npm-release-lines.mjs";
import {
    assertBetaFollowsLatest,
    assertChannelAdvances,
    assertReleaseFullyPublished,
    assertPublishedChannelTagMatches,
    assertPublishedIntegrityMatches,
    assertPublisherMatchesRelease,
    classifyPackageState,
    compareReleaseVersions,
    interpretNpmDistTagResult,
    interpretNpmIntegrityResult,
    interpretNpmViewResult,
    packagesToStage,
    releasePublisher,
    releaseVersion,
} from "./npm-release-state.mts";

const BETA = { name: "beta", ...NPM_RELEASE_CHANNELS.beta };
const STABLE = { name: "stable", ...NPM_RELEASE_CHANNELS.stable };

function workflowScript(stepName: string): string {
    const workflow = readFileSync(
        new URL("../.github/workflows/publish-npm.yml", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(workflow, /^\s*npm publish\b/m);
    const step = workflow.match(
        new RegExp(`- name: ${stepName}[\\s\\S]*? {8}run: \\|\\n(?<script>(?: {10}.*\\n)+)`),
    );
    const source = step?.groups?.script;
    assert.ok(source, `Missing workflow script: ${stepName}`);
    return source
        .split("\n")
        .map((line) => line.slice(10))
        .join("\n");
}

function executeStagingStep(environment: Record<string, string>): {
    status: number | null;
    calls: string[];
    stderr: string;
} {
    const script = workflowScript("Stage reviewed packages for npm 2FA approval");
    const directory = mkdtempSync(resolve(tmpdir(), "1consent-stage-workflow-test-"));
    const log = resolve(directory, "calls.log");
    for (const name of ["react", "nextjs", "cli", "site-check"])
        mkdirSync(resolve(directory, "packages/libs", name), { recursive: true });
    mkdirSync(resolve(directory, "scripts"));
    copyFileSync(
        new URL("./npm-release-lines.mjs", import.meta.url),
        resolve(directory, "scripts/npm-release-lines.mjs"),
    );
    try {
        const result = spawnSync(
            "bash",
            [
                "-euo",
                "pipefail",
                "-c",
                `
            npm() {
                [[ "$*" == "stage publish --tag $EXPECTED_DIST_TAG --access public --provenance" ]] || exit 97
                auth_kind=oidc
                if [[ -n "\${NODE_AUTH_TOKEN-}" ]]; then
                    [[ "$NODE_AUTH_TOKEN" == "stage-only-fixture" ]] || exit 98
                    auth_kind=token
                fi
                printf '%s|%s\n' "\${PWD##*/}" "$auth_kind" >> "$STAGING_TEST_LOG"
            }
            ${script}
        `,
            ],
            {
                cwd: directory,
                encoding: "utf8",
                env: {
                    ...process.env,
                    NODE_AUTH_TOKEN: "inherited-token-must-be-unset",
                    STAGING_TEST_LOG: log,
                    RELEASE_LINE: "sdk",
                    DIST_TAG: "beta",
                    EXPECTED_DIST_TAG: environment.DIST_TAG ?? "beta",
                    ...environment,
                },
            },
        );
        if (result.error) throw result.error;
        let calls: string[] = [];
        if (existsSync(log)) calls = readFileSync(log, "utf8").trim().split("\n");
        return { status: result.status, calls, stderr: result.stderr };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

test("the real workflow supplies the bootstrap token when explicitly staging missing and placeholder packages", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "bootstrap-token",
        NPM_BOOTSTRAP_TOKEN: "stage-only-fixture",
        STAGE_PACKAGES: "react nextjs",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ["react|token", "nextjs|token"]);
});

test("the real trusted-publisher workflow clears inherited token authentication", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "trusted-publisher",
        NPM_BOOTSTRAP_TOKEN: "",
        STAGE_PACKAGES: "nextjs cli",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ["nextjs|oidc", "cli|oidc"]);
});

test("the real workflow stages the site check line on its own", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "trusted-publisher",
        NPM_BOOTSTRAP_TOKEN: "",
        RELEASE_LINE: "site-check",
        STAGE_PACKAGES: "site-check",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ["site-check|oidc"]);
});

test("the real workflow stages a stable release under the latest dist-tag", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "trusted-publisher",
        NPM_BOOTSTRAP_TOKEN: "",
        DIST_TAG: "latest",
        STAGE_PACKAGES: "react nextjs cli",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ["react|oidc", "nextjs|oidc", "cli|oidc"]);
});

test("an unknown dist-tag stops the real workflow before staging", () => {
    for (const tag of ["", "next", "beta latest"]) {
        const result = executeStagingStep({
            PUBLISHER_MODE: "trusted-publisher",
            NPM_BOOTSTRAP_TOKEN: "",
            DIST_TAG: tag,
            STAGE_PACKAGES: "react",
        });
        assert.notEqual(result.status, 0);
        assert.deepEqual(result.calls, []);
    }
});

test("missing bootstrap credentials stop the real workflow before staging", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "bootstrap-token",
        NPM_BOOTSTRAP_TOKEN: "",
        STAGE_PACKAGES: "react nextjs cli",
    });
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.calls, []);
    assert.match(result.stderr, /must be a stage-only token/);
});

for (const [label, line, packages] of [
    ["a package from another release line", "sdk", "react site-check"],
    ["an SDK package in the site check line", "site-check", "site-check react"],
    ["a path outside the package directory", "sdk", "react ../react"],
    ["an unknown release line", "unknown", "react"],
] as const) {
    test(`${label} stops the real workflow before staging any package`, () => {
        const result = executeStagingStep({
            PUBLISHER_MODE: "trusted-publisher",
            NPM_BOOTSTRAP_TOKEN: "",
            RELEASE_LINE: line,
            STAGE_PACKAGES: packages,
        });
        assert.notEqual(result.status, 0);
        assert.deepEqual(result.calls, []);
    });
}

test("a fully verified published release performs no staging calls", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "trusted-publisher",
        NPM_BOOTSTRAP_TOKEN: "",
        STAGE_PACKAGES: "",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, []);
});

test("only packages missing their exact version are staged", () => {
    assert.deepEqual(
        packagesToStage([
            ["react", "published"],
            ["nextjs", "stage"],
            ["cli", "bootstrap"],
        ]),
        ["nextjs", "cli"],
    );
    assert.deepEqual(packagesToStage([["site-check", "published"]]), []);
});

test("verification requires every package of the line to own the exact version", () => {
    assert.doesNotThrow(() =>
        assertReleaseFullyPublished("site-check", "0.1.0-beta.1", [["site-check", "published"]]),
    );
    assert.throws(
        () =>
            assertReleaseFullyPublished("sdk", "0.1.0-beta.4", [
                ["react", "published"],
                ["nextjs", "stage"],
                ["cli", "published"],
            ]),
        /not yet published: nextjs/,
    );
    assert.throws(() => assertReleaseFullyPublished("sdk", "0.1.0-beta.4", []), /no packages/);
});

test("publishing uses an explicit authentication mode", () => {
    assert.equal(releasePublisher(["--publisher", "bootstrap-token"]), "bootstrap-token");
    assert.equal(releasePublisher(["--publisher", "trusted-publisher"]), "trusted-publisher");
    for (const args of [[], ["--publisher"], ["--publisher", "auto"]]) {
        assert.throws(() => releasePublisher(args), /must be bootstrap-token or trusted-publisher/);
    }
});

test("first-version token staging handles missing packages and registered staging placeholders", () => {
    assert.doesNotThrow(() =>
        assertPublisherMatchesRelease("bootstrap-token", "0.1.0-beta.1", [
            "bootstrap",
            "stage",
            "published",
        ]),
    );
});

test("the bootstrap token rejects the failed tag and later releases", () => {
    for (const version of ["0.1.0-beta.0", "0.1.0-beta.2", "0.2.0-beta.0", "1.0.0-beta.0"]) {
        assert.throws(
            () => assertPublisherMatchesRelease("bootstrap-token", version, ["stage"]),
            /may stage only the first/,
        );
    }
});

test("OIDC fails before staging a package without a trusted-publisher setup surface", () => {
    assert.throws(
        () =>
            assertPublisherMatchesRelease("trusted-publisher", "0.1.0-beta.0", [
                "published",
                "bootstrap",
                "stage",
            ]),
        /New packages require bootstrap-token staging/,
    );
    assert.doesNotThrow(() =>
        assertPublisherMatchesRelease("trusted-publisher", "0.1.0-beta.1", ["published", "stage"]),
    );
});

test("accepts beta prereleases and stable releases", () => {
    for (const version of ["0.1.0-beta.0", "0.2.0-beta.1", "1.0.0-beta.12", "0.1.0", "1.20.3"]) {
        assert.equal(releaseVersion(["--version", version]), version);
    }
});

test("rejects malformed and other prerelease versions", () => {
    for (const version of [
        "0.1.0-alpha.0",
        "0.1.0-rc.1",
        "0.1.0-beta",
        "01.1.0-beta.0",
        "0.1.0-beta.01",
        "01.0.0",
        "0.1",
        "v0.1.0",
    ]) {
        assert.throws(() => releaseVersion(["--version", version]), /neither a/);
    }
    assert.throws(() => releaseVersion([]), /required/);
});

test("the stable release is staged only by a trusted publisher", () => {
    assert.throws(
        () => assertPublisherMatchesRelease("bootstrap-token", "0.1.0", ["stage"]),
        /bootstrap token may stage only/,
    );
    assert.doesNotThrow(() =>
        assertPublisherMatchesRelease("trusted-publisher", "0.1.0", ["stage", "stage", "stage"]),
    );
});

test("an already published exact version is idempotently skipped", () => {
    assert.equal(classifyPackageState(true, true), "published");
});

test("an existing version is skipped only when its registry tarball is exact", () => {
    const integrity = `sha512-${"A".repeat(86)}==`;
    assert.doesNotThrow(() =>
        assertPublishedIntegrityMatches("@1consent/react@0.1.0-beta.0", integrity, integrity),
    );
    assert.throws(
        () =>
            assertPublishedIntegrityMatches(
                "@1consent/react@0.1.0-beta.0",
                integrity,
                `sha512-${"B".repeat(86)}==`,
            ),
        /does not match the reviewed local tarball/,
    );
});

test("an existing version is skipped only while it owns its channel's dist-tag", () => {
    assert.doesNotThrow(() =>
        assertPublishedChannelTagMatches("@1consent/react@0.1.0", "0.1.0", STABLE, "0.1.0"),
    );
    assert.throws(
        () => assertPublishedChannelTagMatches("@1consent/react@0.1.0", "0.1.0", STABLE, "0.0.0-stage"),
        /latest tag resolves to 0\.0\.0-stage/,
    );
    const packageSpec = "@1consent/react@0.1.0-beta.0";
    assert.doesNotThrow(() =>
        assertPublishedChannelTagMatches(packageSpec, "0.1.0-beta.0", BETA, "0.1.0-beta.0"),
    );
    assert.throws(
        () => assertPublishedChannelTagMatches(packageSpec, "0.1.0-beta.0", BETA, "0.1.0-beta.1"),
        /refusing an old-tag rerun/,
    );
    assert.throws(
        () => assertPublishedChannelTagMatches(packageSpec, "0.1.0-beta.0", BETA, undefined),
        /resolves to nothing/,
    );
});

test("parses only successful SHA-512 registry integrity responses", () => {
    const integrity = `sha512-${"A".repeat(86)}==`;
    assert.equal(
        interpretNpmIntegrityResult(
            0,
            `${JSON.stringify(integrity)}\n`,
            "",
            "@1consent/cli@0.1.0-beta.0",
        ),
        integrity,
    );
    assert.throws(
        () =>
            interpretNpmIntegrityResult(1, "", "npm error code E500", "@1consent/cli@0.1.0-beta.0"),
        /integrity lookup failed/,
    );
    assert.throws(
        () =>
            interpretNpmIntegrityResult(0, '"sha1-not-accepted"', "", "@1consent/cli@0.1.0-beta.0"),
        /invalid integrity/,
    );
});

test("reads npm 12 single-value registry integrity arrays", () => {
    const integrity = `sha512-${Buffer.alloc(64, 2).toString("base64")}`;
    assert.equal(
        interpretNpmIntegrityResult(
            0,
            JSON.stringify([integrity]),
            "",
            "@1consent/react@0.1.0-beta.0",
        ),
        integrity,
    );
    for (const report of [[], [integrity, integrity], [null], [[integrity]]]) {
        assert.throws(
            () =>
                interpretNpmIntegrityResult(
                    0,
                    JSON.stringify(report),
                    "",
                    "@1consent/react@0.1.0-beta.0",
                ),
            /invalid|Ambiguous/,
        );
    }
});

test("reads npm 12 beta-tag arrays and its empty missing-field result", () => {
    assert.equal(
        interpretNpmDistTagResult(0, '["0.1.0-beta.4"]', "", "@1consent/react", BETA),
        "0.1.0-beta.4",
    );
    assert.equal(interpretNpmDistTagResult(0, "[]", "", "@1consent/react", BETA), undefined);
    for (const report of [["0.1.0-beta.4", "0.1.0-beta.5"], [null], [["0.1.0-beta.4"]]]) {
        assert.throws(
            () => interpretNpmDistTagResult(0, JSON.stringify(report), "", "@1consent/react", BETA),
            /invalid|Ambiguous/,
        );
    }
});

test("an existing package without the requested version always uses staging", () => {
    assert.equal(classifyPackageState(false, true), "stage");
});

test("allows only releases that advance the current beta channel", () => {
    for (const [release, current] of [
        ["0.1.0-beta.1", "0.1.0-beta.0"],
        ["0.1.1-beta.0", "0.1.0-beta.99"],
        ["0.2.0-beta.0", "0.1.99-beta.99"],
        ["1.0.0-beta.0", "0.99.99-beta.99"],
    ]) {
        assert.doesNotThrow(() => assertChannelAdvances(release, BETA, current));
    }
    assert.doesNotThrow(() => assertChannelAdvances("0.1.0-beta.0", BETA, undefined));
});

test("rejects equal and older releases before they can move the beta channel backward", () => {
    for (const release of ["0.1.0-beta.4", "0.1.0-beta.3", "0.0.99-beta.99"]) {
        assert.throws(
            () => assertChannelAdvances(release, BETA, "0.1.0-beta.4"),
            /must be newer than the current beta tag/,
        );
    }
});

test("reads the current registry beta tag and permits a missing channel", () => {
    assert.equal(
        interpretNpmDistTagResult(0, '"0.1.0-beta.4"\n', "", "@1consent/react", BETA),
        "0.1.0-beta.4",
    );
    assert.equal(interpretNpmDistTagResult(0, "", "", "@1consent/react", BETA), undefined);
    assert.equal(interpretNpmDistTagResult(0, "null\n", "", "@1consent/react", BETA), undefined);
    assert.equal(
        interpretNpmDistTagResult(
            1,
            "",
            JSON.stringify({ error: { code: "E404", summary: "No match found for version beta" } }),
            "@1consent/react", BETA),
        undefined,
    );
});

test("fails closed when the current beta tag cannot be trusted", () => {
    assert.throws(
        () => interpretNpmDistTagResult(1, "", "npm error code E500", "@1consent/cli", BETA),
        /Registry lookup failed/,
    );
    assert.throws(
        () => interpretNpmDistTagResult(0, "not-json", "", "@1consent/cli", BETA),
        /invalid JSON/,
    );
    assert.throws(
        () => interpretNpmDistTagResult(0, '"latest"', "", "@1consent/cli", BETA),
        /invalid beta tag/,
    );
});

test("the latest channel advances from npm's placeholder and only forward", () => {
    for (const [release, current] of [
        ["0.1.0", "0.0.0-stage"],
        ["0.1.1", "0.1.0"],
        ["1.0.0", "0.99.99"],
    ]) {
        assert.doesNotThrow(() => assertChannelAdvances(release, STABLE, current));
    }
    for (const [release, current] of [
        ["0.1.0", "0.1.0"],
        ["0.0.9", "0.1.0"],
    ]) {
        assert.throws(
            () => assertChannelAdvances(release, STABLE, current),
            /must be newer than the current latest tag/,
        );
    }
});

test("a beta must rank above the current latest release", () => {
    assert.doesNotThrow(() => assertBetaFollowsLatest("0.2.0-beta.0", "0.1.0"));
    assert.doesNotThrow(() => assertBetaFollowsLatest("0.1.0-beta.4", "0.0.0-stage"));
    assert.doesNotThrow(() => assertBetaFollowsLatest("0.1.0-beta.4", undefined));
    for (const release of ["0.1.0-beta.4", "0.0.9-beta.0"]) {
        assert.throws(
            () => assertBetaFollowsLatest(release, "0.1.0"),
            /must be newer than the current latest release 0\.1\.0/,
        );
    }
});

test("orders versions by SemVer precedence", () => {
    for (const [older, newer] of [
        ["0.0.0-stage", "0.1.0-beta.0"],
        ["0.1.0-beta.3", "0.1.0"],
        ["0.1.0-beta.9", "0.1.0-beta.10"],
        ["0.1.0-beta.10", "0.1.1-beta.0"],
        ["0.1.0", "0.2.0-beta.0"],
        ["1.0.0-1", "1.0.0-beta"],
    ]) {
        assert.ok(compareReleaseVersions(older, newer) < 0, `${older} < ${newer}`);
        assert.ok(compareReleaseVersions(newer, older) > 0, `${newer} > ${older}`);
    }
    assert.equal(compareReleaseVersions("0.1.0", "0.1.0"), 0);
});

test("reads the latest tag, accepting only stable versions and npm's placeholder", () => {
    assert.equal(interpretNpmDistTagResult(0, '"0.0.0-stage"', "", "@1consent/react", STABLE), "0.0.0-stage");
    assert.equal(interpretNpmDistTagResult(0, '["0.1.0"]', "", "@1consent/react", STABLE), "0.1.0");
    for (const value of ['"0.1.0-beta.3"', '"0.0.0-other"', '"latest"']) {
        assert.throws(
            () => interpretNpmDistTagResult(0, value, "", "@1consent/react", STABLE),
            /invalid latest tag/,
        );
    }
});

test("bootstrap is reserved for a package name proven absent", () => {
    assert.equal(classifyPackageState(false, false), "bootstrap");
});

test("npm JSON E404 is the only structured absence signal", () => {
    assert.equal(
        interpretNpmViewResult(
            1,
            JSON.stringify({ error: { code: "E404", summary: "Not Found" } }),
            "@1consent/react",
        ),
        false,
    );
});

test("legacy npm E404 output is also recognized", () => {
    assert.equal(interpretNpmViewResult(1, "npm error code E404", "@1consent/cli"), false);
});

test("successful npm views prove package presence", () => {
    assert.equal(interpretNpmViewResult(0, '"0.1.0-beta.0"', "@1consent/cli"), true);
});

test("network and registry failures stop publication instead of enabling bootstrap", () => {
    for (const failure of [
        "npm error code ENOTFOUND",
        "npm error code E429",
        "npm error code E500",
        "npm error network request timed out",
    ]) {
        assert.throws(
            () => interpretNpmViewResult(1, failure, "@1consent/react"),
            /refusing to infer package absence/,
        );
    }
});

function executeReleaseSelection(environment: Record<string, string>) {
    const directory = mkdtempSync(resolve(tmpdir(), "1consent-release-selection-"));
    const output = resolve(directory, "outputs");
    try {
        const result = spawnSync(
            "bash",
            ["-euo", "pipefail", "-c", workflowScript("Derive the release line, version and channel")],
            {
                encoding: "utf8",
                env: {
                    ...process.env,
                    REF_TYPE: "tag",
                    RELEASE_TAG: "npm-v0.1.0-beta.1",
                    WORKFLOW_REF: "refs/tags/npm-v0.1.0-beta.1",
                    OPERATION: "publish",
                    REQUESTED_RELEASE_TAG: "",
                    ...environment,
                    GITHUB_OUTPUT: output,
                },
            },
        );
        if (result.error) throw result.error;
        return {
            status: result.status,
            stderr: result.stderr,
            output: existsSync(output) ? readFileSync(output, "utf8") : "",
        };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

test("publishing uses only the dispatched immutable tag", () => {
    const result = executeReleaseSelection({});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
        result.output,
        "line=sdk\nversion=0.1.0-beta.1\ntag=npm-v0.1.0-beta.1\ndist_tag=beta\nenvironment=npm-beta\n",
    );
});

test("a site check tag selects the site check line and its own version", () => {
    const result = executeReleaseSelection({
        RELEASE_TAG: "npm-site-check-v0.1.0-beta.1",
        WORKFLOW_REF: "refs/tags/npm-site-check-v0.1.0-beta.1",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
        result.output,
        "line=site-check\nversion=0.1.0-beta.1\ntag=npm-site-check-v0.1.0-beta.1\ndist_tag=beta\nenvironment=npm-beta\n",
    );
});

test("a stable tag stages under latest from the stable environment", () => {
    for (const [tag, line] of [
        ["npm-v0.1.0", "sdk"],
        ["npm-site-check-v1.0.0", "site-check"],
    ]) {
        const result = executeReleaseSelection({ RELEASE_TAG: tag, WORKFLOW_REF: `refs/tags/${tag}` });
        const version = tag.replace(/^npm-(?:site-check-)?v/, "");
        assert.equal(result.status, 0, result.stderr);
        assert.equal(
            result.output,
            `line=${line}\nversion=${version}\ntag=${tag}\ndist_tag=latest\nenvironment=npm-stable\n`,
        );
    }
});

test("the tag guard derives the same channel as the release-channel table", () => {
    for (const version of ["0.1.0", "2.3.4", "0.1.0-beta.3", "1.0.0-beta.0"]) {
        const tag = `npm-v${version}`;
        const result = executeReleaseSelection({ RELEASE_TAG: tag, WORKFLOW_REF: `refs/tags/${tag}` });
        const channel = version.includes("-beta.") ? BETA : STABLE;
        assert.equal(result.status, 0, result.stderr);
        assert.match(
            result.output,
            new RegExp(`dist_tag=${channel.distTag}\nenvironment=${channel.environment}\n$`),
        );
    }
});

test("main may select an existing immutable tag only for read-only verification", () => {
    const result = executeReleaseSelection({
        REF_TYPE: "branch",
        RELEASE_TAG: "main",
        WORKFLOW_REF: "refs/heads/main",
        OPERATION: "verify",
        REQUESTED_RELEASE_TAG: "npm-v0.1.0-beta.1",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
        result.output,
        "line=sdk\nversion=0.1.0-beta.1\ntag=npm-v0.1.0-beta.1\ndist_tag=beta\nenvironment=npm-beta\n",
    );
});

for (const [label, environment] of [
    [
        "publishing from main",
        {
            REF_TYPE: "branch",
            WORKFLOW_REF: "refs/heads/main",
            REQUESTED_RELEASE_TAG: "npm-v0.1.0-beta.1",
        },
    ],
    [
        "verification from an unreviewed branch",
        {
            REF_TYPE: "branch",
            WORKFLOW_REF: "refs/heads/feature",
            OPERATION: "verify",
            REQUESTED_RELEASE_TAG: "npm-v0.1.0-beta.1",
        },
    ],
    [
        "missing main verification tag",
        { REF_TYPE: "branch", WORKFLOW_REF: "refs/heads/main", OPERATION: "verify" },
    ],
    ["overriding a published tag", { REQUESTED_RELEASE_TAG: "npm-v0.1.0-beta.2" }],
    ["release-candidate tag", { RELEASE_TAG: "npm-v1.0.0-rc.1" }],
    ["malformed tag", { RELEASE_TAG: "npm-v0.1.0-beta.1;echo bad" }],
    ["malformed stable tag", { RELEASE_TAG: "npm-v1.0.0;echo bad" }],
    ["leading-zero stable tag", { RELEASE_TAG: "npm-v01.0.0" }],
    ["unknown release line tag", { RELEASE_TAG: "npm-other-v0.1.0-beta.1" }],
] satisfies Array<readonly [string, Record<string, string>]>) {
    test(`release selection rejects ${label}`, () => {
        const result = executeReleaseSelection(environment);
        assert.notEqual(result.status, 0);
        assert.equal(result.output, "");
    });
}

for (const operation of ["verify", "publish", "wrong-publish-commit"]) {
    test(`the real commit gate binds the selected tag for ${operation}`, () => {
        const directory = mkdtempSync(resolve(tmpdir(), "1consent-tag-commit-"));
        const git = (...args: string[]) =>
            execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
        try {
            git("init", "--quiet", "--initial-branch=main");
            git(
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.invalid",
                "commit",
                "--quiet",
                "--allow-empty",
                "-m",
                "reviewed release",
            );
            const releaseCommit = git("rev-parse", "HEAD");
            git(
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.invalid",
                "commit",
                "--quiet",
                "--allow-empty",
                "-m",
                "reviewed verifier",
            );
            const verifierCommit = git("rev-parse", "HEAD");
            git("update-ref", "refs/remotes/origin/main", verifierCommit);
            git("checkout", "--quiet", "--detach", releaseCommit);
            const output = resolve(directory, "outputs");
            const result = spawnSync(
                "bash",
                [
                    "-euo",
                    "pipefail",
                    "-c",
                    workflowScript("Require the tagged commit to be reviewed on main"),
                ],
                {
                    cwd: directory,
                    encoding: "utf8",
                    env: {
                        ...process.env,
                        GITHUB_OUTPUT: output,
                        OPERATION: operation === "verify" ? "verify" : "publish",
                        GITHUB_SHA: operation === "publish" ? releaseCommit : verifierCommit,
                    },
                },
            );
            if (result.error) throw result.error;
            if (operation === "wrong-publish-commit") {
                assert.notEqual(result.status, 0);
                assert.match(result.stderr, /exact dispatched tag commit/);
            } else {
                assert.equal(result.status, 0, result.stderr);
                assert.equal(readFileSync(output, "utf8"), `commit=${releaseCommit}\n`);
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
}

test("release checkout cannot be shadowed by a branch with the tag name", () => {
    const workflow = readFileSync(
        new URL("../.github/workflows/publish-npm.yml", import.meta.url),
        "utf8",
    );
    assert.ok(workflow.includes("ref: refs/tags/${{ steps.release.outputs.tag }}"));
    assert.equal(workflow.match(/ref: \$\{\{ needs\.prepare\.outputs\.commit \}\}/g)?.length, 2);
    assert.doesNotMatch(
        workflow,
        /ref: \$\{\{ (?:steps\.release|needs\.prepare)\.outputs\.tag \}\}/,
    );
});
