import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import {
    assertBetaChannelAdvances,
    assertPublishedBetaTagMatches,
    assertPublishedIntegrityMatches,
    assertPublisherMatchesRelease,
    classifyPackageState,
    interpretNpmBetaTagResult,
    interpretNpmIntegrityResult,
    interpretNpmViewResult,
    releasePublisher,
    releaseVersion,
} from "./npm-release-state.mts";

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
    for (const name of ["react", "nextjs", "cli"])
        mkdirSync(resolve(directory, "packages/libs", name), { recursive: true });
    try {
        const result = spawnSync(
            "bash",
            [
                "-euo",
                "pipefail",
                "-c",
                `
            npm() {
                [[ "$*" == "stage publish --tag beta --access public --provenance" ]] || exit 97
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
        REACT_STATE: "bootstrap",
        NEXTJS_STATE: "stage",
        CLI_STATE: "published",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ["react|token", "nextjs|token"]);
});

test("the real trusted-publisher workflow clears inherited token authentication", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "trusted-publisher",
        NPM_BOOTSTRAP_TOKEN: "",
        REACT_STATE: "published",
        NEXTJS_STATE: "stage",
        CLI_STATE: "stage",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ["nextjs|oidc", "cli|oidc"]);
});

test("missing bootstrap credentials stop the real workflow before staging", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "bootstrap-token",
        NPM_BOOTSTRAP_TOKEN: "",
        REACT_STATE: "bootstrap",
        NEXTJS_STATE: "bootstrap",
        CLI_STATE: "bootstrap",
    });
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.calls, []);
    assert.match(result.stderr, /must be a stage-only token/);
});

test("unknown registry states stop the real workflow before staging any package", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "trusted-publisher",
        NPM_BOOTSTRAP_TOKEN: "",
        REACT_STATE: "stage",
        NEXTJS_STATE: "invalid",
        CLI_STATE: "stage",
    });
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.calls, []);
    assert.match(result.stderr, /Unexpected registry state/);
});

test("a fully verified published release performs no staging calls", () => {
    const result = executeStagingStep({
        PUBLISHER_MODE: "trusted-publisher",
        NPM_BOOTSTRAP_TOKEN: "",
        REACT_STATE: "published",
        NEXTJS_STATE: "published",
        CLI_STATE: "published",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, []);
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

test("accepts beta versions across the prerelease lane", () => {
    for (const version of ["0.1.0-beta.0", "0.2.0-beta.1", "1.0.0-beta.12"]) {
        assert.equal(releaseVersion(["--version", version]), version);
    }
});

test("rejects stable, malformed, and non-beta versions", () => {
    for (const version of [
        "0.1.0",
        "0.1.0-alpha.0",
        "0.1.0-beta",
        "01.1.0-beta.0",
        "0.1.0-beta.01",
    ]) {
        assert.throws(() => releaseVersion(["--version", version]), /must be a valid/);
    }
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

test("an existing version is skipped only while it owns the beta dist-tag", () => {
    const packageSpec = "@1consent/react@0.1.0-beta.0";
    assert.doesNotThrow(() =>
        assertPublishedBetaTagMatches(packageSpec, "0.1.0-beta.0", "0.1.0-beta.0"),
    );
    assert.throws(
        () => assertPublishedBetaTagMatches(packageSpec, "0.1.0-beta.0", "0.1.0-beta.1"),
        /refusing an old-tag rerun/,
    );
    assert.throws(
        () => assertPublishedBetaTagMatches(packageSpec, "0.1.0-beta.0", undefined),
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
        interpretNpmBetaTagResult(0, '["0.1.0-beta.4"]', "", "@1consent/react"),
        "0.1.0-beta.4",
    );
    assert.equal(interpretNpmBetaTagResult(0, "[]", "", "@1consent/react"), undefined);
    for (const report of [["0.1.0-beta.4", "0.1.0-beta.5"], [null], [["0.1.0-beta.4"]]]) {
        assert.throws(
            () => interpretNpmBetaTagResult(0, JSON.stringify(report), "", "@1consent/react"),
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
        assert.doesNotThrow(() => assertBetaChannelAdvances(release, current));
    }
    assert.doesNotThrow(() => assertBetaChannelAdvances("0.1.0-beta.0", undefined));
});

test("rejects equal and older releases before they can move the beta channel backward", () => {
    for (const release of ["0.1.0-beta.4", "0.1.0-beta.3", "0.0.99-beta.99"]) {
        assert.throws(
            () => assertBetaChannelAdvances(release, "0.1.0-beta.4"),
            /must be newer than the current beta tag/,
        );
    }
});

test("reads the current registry beta tag and permits a missing channel", () => {
    assert.equal(
        interpretNpmBetaTagResult(0, '"0.1.0-beta.4"\n', "", "@1consent/react"),
        "0.1.0-beta.4",
    );
    assert.equal(interpretNpmBetaTagResult(0, "", "", "@1consent/react"), undefined);
    assert.equal(interpretNpmBetaTagResult(0, "null\n", "", "@1consent/react"), undefined);
    assert.equal(
        interpretNpmBetaTagResult(
            1,
            "",
            JSON.stringify({ error: { code: "E404", summary: "No match found for version beta" } }),
            "@1consent/react",
        ),
        undefined,
    );
});

test("fails closed when the current beta tag cannot be trusted", () => {
    assert.throws(
        () => interpretNpmBetaTagResult(1, "", "npm error code E500", "@1consent/cli"),
        /Registry lookup failed/,
    );
    assert.throws(
        () => interpretNpmBetaTagResult(0, "not-json", "", "@1consent/cli"),
        /invalid JSON/,
    );
    assert.throws(
        () => interpretNpmBetaTagResult(0, '"latest"', "", "@1consent/cli"),
        /invalid beta tag/,
    );
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
            ["-euo", "pipefail", "-c", workflowScript("Derive the prerelease version")],
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
    assert.equal(result.output, "version=0.1.0-beta.1\ntag=npm-v0.1.0-beta.1\n");
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
    assert.equal(result.output, "version=0.1.0-beta.1\ntag=npm-v0.1.0-beta.1\n");
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
    ["stable tag", { RELEASE_TAG: "npm-v1.0.0" }],
    ["malformed tag", { RELEASE_TAG: "npm-v0.1.0-beta.1;echo bad" }],
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
