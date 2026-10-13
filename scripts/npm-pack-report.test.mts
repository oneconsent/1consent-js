import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNpmPackReport } from "./npm-pack-report.mts";

const name = "@1consent/react";
const fixture = {
    name,
    version: "0.1.0-beta.0",
    filename: "1consent-react-0.1.0-beta.0.tgz",
    integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}`,
    unpackedSize: 3,
    files: [{ path: "dist/index.js", size: 3, mode: 0o644 }],
};

test("reads the npm 11 one-package array", () => {
    assert.deepEqual(parseNpmPackReport([fixture], name), fixture);
});

test("reads the npm 12 object keyed by the exact package name", () => {
    assert.deepEqual(parseNpmPackReport({ [name]: fixture }, name), fixture);
});

for (const [label, value] of [
    ["empty array", []],
    ["multiple reports", [fixture, fixture]],
    ["empty object", {}],
    ["multiple package keys", { [name]: fixture, other: fixture }],
    ["wrong package key", { other: fixture }],
    ["wrong package identity", [{ ...fixture, name: "@1consent/cli" }]],
    ["missing metadata", [{}]],
    ["invalid integrity", [{ ...fixture, integrity: "sha512-invalid" }]],
    ["outside tarball filename", [{ ...fixture, filename: "../outside.tgz" }]],
    ["Windows drive filename", [{ ...fixture, filename: "C:outside.tgz" }]],
    ["missing tarball filename", [{ ...fixture, filename: undefined }]],
    ["empty file inventory", [{ ...fixture, files: [] }]],
    ["invalid unpacked size", [{ ...fixture, unpackedSize: -1 }]],
    ["outside file path", [{ ...fixture, files: [{ path: "../outside", size: 3, mode: 0o644 }] }]],
    ["duplicate file paths", [{ ...fixture, files: [...fixture.files, ...fixture.files] }]],
    ["invalid size", [{ ...fixture, files: [{ path: "index.js", size: -1, mode: 0o644 }] }]],
    ["invalid mode", [{ ...fixture, files: [{ path: "index.js", size: 3, mode: "644" }] }]],
] satisfies Array<readonly [string, unknown]>) {
    test(`rejects ${label}`, () => {
        assert.throws(() => parseNpmPackReport(value, name), /\[NpmPack\]/);
    });
}
