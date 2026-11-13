import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, test } from "node:test";
import {
    PUBLIC_EXECUTABLES,
    PUBLIC_PACKAGE_FILES,
    PUBLIC_RELEASE_FILES,
    verifyPublicReleaseManifest,
    writePublicReleaseManifest,
} from "./public-release-manifest.mjs";

const temporaryRoots = [];
afterEach(() => {
    for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function packageManifest(name, directory, version = "0.1.0-beta.0") {
    const manifest = {
        name,
        version,
        repository: {
            type: "git",
            url: "git+https://github.com/oneconsent/1consent-js.git",
            directory,
        },
        publishConfig: {
            access: "public",
            provenance: true,
            registry: "https://registry.npmjs.org/",
            tag: version.includes("-beta.") ? "beta" : "latest",
        },
    };
    if (name === "@1consent/nextjs") {
        manifest.dependencies = { "@1consent/react": version };
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
    for (const path of PUBLIC_EXECUTABLES) chmodSync(resolve(root, path), 0o755);
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

test("accepts reviewed public documentation and asset origins in customer authoring guidance", () => {
    const root = fixture();
    writeFileSync(
        resolve(root, "packages/libs/cli/dist/cli.js"),
        'const origins = { web: "https://1consent.app/docs/reference/cli", cdn: "https://cdn.1consent.app" };\n',
    );
    assert.doesNotThrow(() => writePublicReleaseManifest(root));
    assert.doesNotThrow(() => verifyPublicReleaseManifest(root));
});

test("does not extend the public documentation allowance to other environments", () => {
    const root = fixture();
    for (const host of ["1consent.dev", "cdn.1consent.dev", "1consent.local", "cdn.1consent.local"]) {
        writeFileSync(
            resolve(root, "packages/libs/cli/dist/cli.js"),
            `const url = "https://${host}";\n`,
        );
        assert.throws(() => writePublicReleaseManifest(root), /Unreviewed 1Consent service hostname/);
    }
});

function writePackageVersion(root, shortName, version) {
    const directory = `packages/libs/${shortName}`;
    writeFileSync(
        resolve(root, directory, "package.json"),
        `${JSON.stringify(packageManifest(`@1consent/${shortName}`, directory, version))}\n`,
    );
}

test("versions each release line on its own", () => {
    const root = fixture();
    writePackageVersion(root, "site-check", "0.1.0-beta.1");
    assert.doesNotThrow(() => writePublicReleaseManifest(root));
    assert.doesNotThrow(() => verifyPublicReleaseManifest(root));
});

test("keeps every package inside one release line at one version", () => {
    const root = fixture();
    writePackageVersion(root, "cli", "0.1.0-beta.1");
    assert.throws(() => writePublicReleaseManifest(root), /All sdk package versions must match/);
});

test("accepts a stable release line on the latest dist-tag", () => {
    const root = fixture();
    for (const shortName of ["react", "nextjs", "cli"]) writePackageVersion(root, shortName, "0.1.0");
    assert.doesNotThrow(() => writePublicReleaseManifest(root));
    assert.doesNotThrow(() => verifyPublicReleaseManifest(root));
});

test("rejects a dist-tag that is not the version's channel", () => {
    for (const [version, tag] of [
        ["0.1.0", "beta"],
        ["0.1.0-beta.4", "latest"],
    ]) {
        const root = fixture();
        const path = resolve(root, "packages/libs/react/package.json");
        const manifest = packageManifest("@1consent/react", "packages/libs/react", version);
        manifest.publishConfig.tag = tag;
        writeFileSync(path, `${JSON.stringify(manifest)}\n`);
        assert.throws(() => writePublicReleaseManifest(root), /Unsafe publishConfig/);
    }
});

test("rejects versions that are neither a release nor a beta prerelease", () => {
    for (const version of ["0.1.0-rc.1", "01.0.0"]) {
        const root = fixture();
        writePackageVersion(root, "react", version);
        assert.throws(() => writePublicReleaseManifest(root), /neither a release nor a beta/);
    }
});

test("rejects a package entry point that lost its executable bit", () => {
    for (const path of PUBLIC_EXECUTABLES) {
        const root = fixture();
        chmodSync(resolve(root, path), 0o644);
        assert.throws(() => writePublicReleaseManifest(root), /must be executable/);
    }
});
