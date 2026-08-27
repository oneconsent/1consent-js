import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, test } from "node:test";
import {
    PUBLIC_PACKAGE_FILES,
    PUBLIC_RELEASE_FILES,
    verifyPublicReleaseManifest,
    writePublicReleaseManifest,
} from "./public-release-manifest.mjs";

const temporaryRoots = [];
afterEach(() => {
    for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function packageManifest(name, directory) {
    const manifest = {
        name,
        version: "0.1.0-beta.0",
        repository: {
            type: "git",
            url: "git+https://github.com/oneconsent/1consent-js.git",
            directory,
        },
        publishConfig: {
            access: "public",
            provenance: true,
            registry: "https://registry.npmjs.org/",
            tag: "beta",
        },
    };
    if (name === "@1consent/nextjs") {
        manifest.dependencies = { "@1consent/react": "0.1.0-beta.0" };
        manifest.peerDependencies = { next: ">=16.0.0 <17.0.0" };
    }
    return manifest;
}

function fixture() {
    const root = mkdtempSync(resolve(tmpdir(), "1consent-public-release-manifest-"));
    temporaryRoots.push(root);
    for (const path of PUBLIC_RELEASE_FILES) {
        const absolute = resolve(root, path);
        mkdirSync(dirname(absolute), { recursive: true });
        writeFileSync(absolute, `${path}\n`);
    }
    for (const [directory, files] of Object.entries(PUBLIC_PACKAGE_FILES)) {
        for (const path of files) {
            const absolute = resolve(root, directory, path);
            mkdirSync(dirname(absolute), { recursive: true });
            if (path === "package.json") {
                const name = `@1consent/${directory.split("/").at(-1)}`;
                writeFileSync(absolute, `${JSON.stringify(packageManifest(name, directory))}\n`);
            } else {
                writeFileSync(absolute, `${directory}/${path}\n`);
            }
        }
    }
    chmodSync(resolve(root, "packages/libs/cli/dist/cli.js"), 0o755);
    writePublicReleaseManifest(root);
    return root;
}

test("verifies the exact reviewed release files", () => {
    const root = fixture();
    assert.doesNotThrow(() => verifyPublicReleaseManifest(root));
});

test("rejects an added file even when its contents look harmless", () => {
    const root = fixture();
    writeFileSync(resolve(root, "notes.txt"), "not reviewed\n");
    assert.throws(() => writePublicReleaseManifest(root), /Public repository file boundary changed/);
});

test("rejects files hidden below a root node_modules directory", () => {
    const root = fixture();
    const hidden = resolve(root, "node_modules/private-package/source.js");
    mkdirSync(dirname(hidden), { recursive: true });
    writeFileSync(hidden, "not reviewed\n");
    assert.throws(() => writePublicReleaseManifest(root), /Public repository file boundary changed/);
});

test("rejects a modified artifact", () => {
    const root = fixture();
    writeFileSync(resolve(root, "packages/libs/react/dist/index.js"), "changed\n");
    assert.throws(() => verifyPublicReleaseManifest(root), /differ from the reviewed/);
});

test("rejects private build metadata in public package manifests", () => {
    const root = fixture();
    const path = resolve(root, "packages/libs/react/package.json");
    const manifest = packageManifest("@1consent/react", "packages/libs/react");
    manifest.devDependencies = { "@1consent/shared": "workspace:*" };
    writeFileSync(path, `${JSON.stringify(manifest)}\n`);
    assert.throws(() => writePublicReleaseManifest(root), /development dependencies/);
});

test("rejects a Next.js adapter that does not pin the matching React beta", () => {
    const root = fixture();
    const path = resolve(root, "packages/libs/nextjs/package.json");
    const manifest = packageManifest("@1consent/nextjs", "packages/libs/nextjs");
    manifest.dependencies["@1consent/react"] = "0.1.0-beta.1";
    writeFileSync(path, `${JSON.stringify(manifest)}\n`);
    assert.throws(() => writePublicReleaseManifest(root), /Next.js adapter dependency boundary/);
});

test("rejects an unreviewed internal service hostname", () => {
    const root = fixture();
    writeFileSync(
        resolve(root, "packages/libs/react/dist/index.js"),
        'const url = "https://internal.1consent.app";\n',
    );
    assert.throws(() => writePublicReleaseManifest(root), /Unreviewed 1Consent service hostname/);
});
