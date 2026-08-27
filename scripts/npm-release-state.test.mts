import assert from "node:assert/strict";
import { test } from "node:test";
import {
    assertPublishedIntegrityMatches,
    assertPublishedBetaTagMatches,
    assertBetaChannelAdvances,
    classifyPackageState,
    interpretNpmBetaTagResult,
    interpretNpmIntegrityResult,
    interpretNpmViewResult,
    releaseVersion,
} from "./npm-release-state.mts";

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
            interpretNpmIntegrityResult(
                1,
                "",
                "npm error code E500",
                "@1consent/cli@0.1.0-beta.0",
            ),
        /integrity lookup failed/,
    );
    assert.throws(
        () =>
            interpretNpmIntegrityResult(
                0,
                '"sha1-not-accepted"',
                "",
                "@1consent/cli@0.1.0-beta.0",
            ),
        /invalid integrity/,
    );
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
