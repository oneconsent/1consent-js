import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
    findHighConfidenceSecrets,
    IndexedFileReadError,
    MAX_TRACKED_BLOB_BYTES,
    readIndexedFile,
} from "./check-secrets.mjs";

const GIT_REPOSITORY_ENVIRONMENT_VARIABLES = [
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_CONFIG",
    "GIT_CONFIG_COUNT",
    "GIT_CONFIG_PARAMETERS",
    "GIT_DIR",
    "GIT_GRAFT_FILE",
    "GIT_IMPLICIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_NO_REPLACE_OBJECTS",
    "GIT_OBJECT_DIRECTORY",
    "GIT_PREFIX",
    "GIT_REPLACE_REF_BASE",
    "GIT_SHALLOW_FILE",
    "GIT_WORK_TREE",
];

function withoutGitRepositoryEnvironment(environment) {
    const isolatedEnvironment = { ...environment };
    for (const variable of GIT_REPOSITORY_ENVIRONMENT_VARIABLES) {
        delete isolatedEnvironment[variable];
    }
    return isolatedEnvironment;
}

function withTrackedBlob(contents, run, environment = process.env) {
    const cwd = mkdtempSync(join(tmpdir(), "1consent-secret-check-"));
    const gitEnvironment = withoutGitRepositoryEnvironment(environment);
    try {
        execFileSync("git", ["init", "--quiet"], { cwd, env: gitEnvironment });
        writeFileSync(join(cwd, "large.txt"), contents);
        execFileSync("git", ["add", "large.txt"], { cwd, env: gitEnvironment });
        run(cwd, gitEnvironment);
    } finally {
        rmSync(cwd, { recursive: true, force: true });
    }
}

test("detects a credentialed remote database URL without returning its value", () => {
    const remoteDsn = ["postgresql://owner", "s3cur3P4ssToken99", "db.acme.com/app"]
        .join(":")
        .replace(":db.acme", "@db.acme");
    assert.deepEqual(findHighConfidenceSecrets(`const url = "${remoteDsn}";`), [
        { line: 1, kind: "credentialed remote database URL" },
    ]);
});

test("detects a Neon password token assembled by source code", () => {
    const token = ["npg", "abcdefghijklmnop"].join("_");
    assert.deepEqual(findHighConfidenceSecrets(`password=${token}`), [
        { line: 1, kind: "Neon database password" },
    ]);
});

test("detects common high-confidence provider tokens without returning their values", () => {
    const tokens = [
        ["ghp", "a".repeat(36)].join("_"),
        ["github", "pat", `11${"A".repeat(20)}`, "b".repeat(40)].join("_"),
        ["npm", "b".repeat(36)].join("_"),
        ["sk", "live", "c".repeat(24)].join("_"),
        ["AKIA", "D".repeat(16)].join(""),
    ];
    const findings = findHighConfidenceSecrets(tokens.join("\n"));
    assert.deepEqual(
        findings.map(({ kind }) => kind),
        [
            "GitHub token",
            "GitHub fine-grained token",
            "npm token",
            "Stripe live secret",
            "AWS access key",
        ],
    );
    for (const token of tokens) assert.equal(JSON.stringify(findings).includes(token), false);
});

test("detects private key material without echoing it", () => {
    const headers = [
        ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
        ["-----BEGIN", "ENCRYPTED PRIVATE KEY-----"].join(" "),
        ["-----BEGIN", "PGP PRIVATE KEY BLOCK-----"].join(" "),
    ];
    const findings = findHighConfidenceSecrets(headers.join("\n"));
    assert.deepEqual(findings, [
        { line: 1, kind: "private key" },
        { line: 2, kind: "private key" },
        { line: 3, kind: "private key" },
    ]);
    for (const header of headers) assert.equal(JSON.stringify(findings).includes(header), false);
});

test("allows explicit localhost database fixtures", () => {
    const localDsn = "postgresql://postgres:postgres@localhost:5432/test";
    assert.deepEqual(findHighConfidenceSecrets(localDsn), []);
});

test("reports line numbers but never returns secret material", () => {
    const token = ["npg", "abcdefghijklmnop"].join("_");
    const findings = findHighConfidenceSecrets(`safe\nvalue=${token}\n`);
    assert.equal(findings[0]?.line, 2);
    assert.equal(JSON.stringify(findings).includes(token), false);
});

test("reads staged blobs larger than Node's default child-process buffer", () => {
    const contents = "safe content\n".repeat(100_000);
    assert.ok(Buffer.byteLength(contents) > 1024 * 1024);

    withTrackedBlob(contents, (cwd, gitEnvironment) => {
        assert.equal(
            readIndexedFile("large.txt", cwd, MAX_TRACKED_BLOB_BYTES, gitEnvironment).byteLength,
            Buffer.byteLength(contents),
        );
    });
});

test("fails closed without exposing blob contents when the safety limit is exceeded", () => {
    const marker = "sensitive-marker-that-must-not-be-reported";
    withTrackedBlob(marker.repeat(100), (cwd, gitEnvironment) => {
        assert.throws(
            () => readIndexedFile("large.txt", cwd, 128, gitEnvironment),
            (error) => {
                assert.ok(error instanceof IndexedFileReadError);
                assert.equal(error.message, "Unable to scan tracked file safely: large.txt");
                assert.equal(error.message.includes(marker), false);
                return true;
            },
        );
    });
});

test("does not mutate an inherited caller index", () => {
    const caller = mkdtempSync(join(tmpdir(), "1consent-secret-check-caller-"));
    const callerEnvironment = withoutGitRepositoryEnvironment(process.env);
    try {
        execFileSync("git", ["init", "--quiet"], { cwd: caller, env: callerEnvironment });
        const callerIndex = join(caller, ".git", "index");

        withTrackedBlob("safe content\n", (cwd, gitEnvironment) => {
            assert.equal(
                readIndexedFile("large.txt", cwd, MAX_TRACKED_BLOB_BYTES, gitEnvironment).toString(
                    "utf8",
                ),
                "safe content\n",
            );
        }, {
            ...callerEnvironment,
            GIT_INDEX_FILE: callerIndex,
        });

        const trackedPaths = execFileSync("git", ["ls-files"], {
            cwd: caller,
            env: callerEnvironment,
            encoding: "utf8",
        });
        assert.equal(trackedPaths, "");
    } finally {
        rmSync(caller, { recursive: true, force: true });
    }
});
