import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PUBLIC_RELEASE_MANIFEST = "public-release-manifest.json";
export const PUBLIC_PACKAGE_FILES = {
    "packages/libs/react": [
        "LICENSE",
        "README.md",
        "dist/index.d.ts",
        "dist/index.js",
        "dist/one-consent.d.ts",
        "dist/provider.d.ts",
        "dist/react-server.d.ts",
        "dist/react-server.js",
        "dist/types.d.ts",
        "dist/use-consent.d.ts",
        "package.json",
    ],
    "packages/libs/nextjs": [
        "LICENSE",
        "README.md",
        "dist/cookie.d.ts",
        "dist/index.d.ts",
        "dist/index.js",
        "dist/react-server.d.ts",
        "dist/react-server.js",
        "dist/server.d.ts",
        "dist/server.js",
        "dist/types.d.ts",
        "package.json",
    ],
    "packages/libs/cli": [
        "LICENSE",
        "README.md",
        "dist/cli.js",
        "dist/design-kit/index.d.ts",
        "dist/design-kit/index.js",
        "dist/design-kit/runtime.js",
        "dist/design-kit/ui/assets/index.css",
        "dist/design-kit/ui/assets/index.js",
        "dist/design-kit/ui/index.html",
        "package.json",
    ],
};

export const PUBLIC_RELEASE_FILES = [
    ".github/dependabot.yml",
    ".github/workflows/publish-npm.yml",
    ".github/workflows/quality.yml",
    ".gitignore",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md",
    "RELEASING.md",
    "SECURITY.md",
    "package.json",
    ...Object.entries(PUBLIC_PACKAGE_FILES).flatMap(([directory, files]) =>
        files.map((path) => `${directory}/${path}`),
    ),
    "scripts/check-secrets.mjs",
    "scripts/check-secrets.test.mjs",
    "scripts/npm-release-state.mts",
    "scripts/npm-release-state.test.mts",
    "scripts/public-release-manifest.mjs",
    "scripts/public-release-manifest.test.mjs",
    "scripts/smoke-public-packages.mjs",
    "scripts/verify-npm-provenance.mts",
    "scripts/verify-npm-provenance.test.mts",
].sort();

const REVIEWED_1CONSENT_PACKAGE_HOSTS = new Set([
    "cmp.1consent.app",
    "cmp.1consent.dev",
    "cmp.1consent.local",
    "dashboard.1consent.app",
    "dashboard.1consent.dev",
    "dashboard.1consent.local",
    "web.cmp.1consent.app",
    "web.cmp.1consent.dev",
    "web.cmp.1consent.local",
]);

function normalize(path) {
    return path.replaceAll("\\", "/");
}

function walkFiles(root, directory = root) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (directory === root && entry.name === ".git") {
            continue;
        }
        const absolute = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) {
            throw new Error(
                `[PublicReleaseManifest] Symbolic links are not permitted: ${normalize(relative(root, absolute))}`,
            );
        }
        if (entry.isDirectory()) files.push(...walkFiles(root, absolute));
        else if (entry.isFile()) files.push(normalize(relative(root, absolute)));
    }
    return files.sort();
}

function fileRecord(root, path) {
    const content = readFileSync(resolve(root, path));
    return {
        path,
        bytes: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
    };
}

function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsWorkspaceProtocol(value) {
    if (typeof value === "string") return value.startsWith("workspace:");
    if (Array.isArray(value)) return value.some(containsWorkspaceProtocol);
    return isRecord(value) && Object.values(value).some(containsWorkspaceProtocol);
}

function packageMetadata(root, directory) {
    const manifestPath = resolve(root, directory, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!isRecord(manifest)) {
        throw new Error(`[PublicReleaseManifest] Invalid package manifest: ${directory}`);
    }
    const packageName = directory.split("/").at(-1);
    if (!packageName || manifest.name !== `@1consent/${packageName}`) {
        throw new Error(`[PublicReleaseManifest] Unexpected package identity: ${directory}`);
    }
    if (typeof manifest.version !== "string" || !/^0\.\d+\.\d+-beta\.\d+$/.test(manifest.version)) {
        throw new Error(`[PublicReleaseManifest] Package is not a 0.x beta: ${directory}`);
    }
    if (manifest.scripts !== undefined || manifest.devDependencies !== undefined) {
        throw new Error(
            `[PublicReleaseManifest] Public distribution manifests must not expose private build scripts or development dependencies: ${directory}`,
        );
    }
    if (containsWorkspaceProtocol(manifest)) {
        throw new Error(`[PublicReleaseManifest] Workspace dependency leaked into ${directory}`);
    }
    if (
        manifest.publishConfig?.access !== "public" ||
        manifest.publishConfig?.provenance !== true ||
        manifest.publishConfig?.registry !== "https://registry.npmjs.org/" ||
        manifest.publishConfig?.tag !== "beta"
    ) {
        throw new Error(`[PublicReleaseManifest] Unsafe publishConfig in ${directory}`);
    }
    if (manifest.repository?.url !== "git+https://github.com/oneconsent/1consent-js.git") {
        throw new Error(`[PublicReleaseManifest] Unexpected repository metadata in ${directory}`);
    }
    if (
        packageName === "nextjs" &&
        (manifest.dependencies?.["@1consent/react"] !== manifest.version ||
            manifest.peerDependencies?.next !== ">=16.0.0 <17.0.0")
    ) {
        throw new Error("[PublicReleaseManifest] Next.js adapter dependency boundary drifted");
    }
    return { directory, name: manifest.name, version: manifest.version };
}

function assertExactPackageFiles(root) {
    for (const [directory, expected] of Object.entries(PUBLIC_PACKAGE_FILES)) {
        const actual = walkFiles(resolve(root, directory));
        if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
            throw new Error(
                `[PublicReleaseManifest] ${directory} file boundary changed.\nExpected: ${[...expected].sort().join(", ")}\nActual: ${actual.join(", ")}`,
            );
        }
        for (const path of actual) {
            if (path.endsWith(".map") || (/\.(?:ts|tsx)$/.test(path) && !path.endsWith(".d.ts"))) {
                throw new Error(`[PublicReleaseManifest] Source or source map is not permitted: ${directory}/${path}`);
            }
            const content = readFileSync(resolve(root, directory, path), "utf8");
            for (const match of content.matchAll(/https?:\\?\/\\?\/([A-Za-z0-9.-]+)/g)) {
                const host = match[1];
                if (
                    /(?:^|\.)1consent\.(?:app|dev|local)$/.test(host) &&
                    !REVIEWED_1CONSENT_PACKAGE_HOSTS.has(host)
                ) {
                    throw new Error(
                        `[PublicReleaseManifest] Unreviewed 1Consent service hostname in ${directory}/${path}: ${host}`,
                    );
                }
            }
        }
    }

    const cliPath = resolve(root, "packages/libs/cli/dist/cli.js");
    if ((statSync(cliPath).mode & 0o111) === 0) {
        throw new Error("[PublicReleaseManifest] CLI entry point must be executable");
    }
}

export function createPublicReleaseManifest(root) {
    const normalizedRoot = resolve(root);
    assertExactPackageFiles(normalizedRoot);
    const actualReleaseFiles = walkFiles(normalizedRoot).filter(
        (path) => path !== PUBLIC_RELEASE_MANIFEST,
    );
    if (JSON.stringify(actualReleaseFiles) !== JSON.stringify(PUBLIC_RELEASE_FILES)) {
        throw new Error(
            `[PublicReleaseManifest] Public repository file boundary changed.\nExpected: ${PUBLIC_RELEASE_FILES.join(", ")}\nActual: ${actualReleaseFiles.join(", ")}`,
        );
    }
    const packages = Object.keys(PUBLIC_PACKAGE_FILES).map((directory) =>
        packageMetadata(normalizedRoot, directory),
    );
    if (new Set(packages.map(({ version }) => version)).size !== 1) {
        throw new Error("[PublicReleaseManifest] All public package versions must match");
    }
    const files = actualReleaseFiles.map((path) => fileRecord(normalizedRoot, path));
    return { schemaVersion: 1, packages, files };
}

export function writePublicReleaseManifest(root) {
    const manifest = createPublicReleaseManifest(root);
    writeFileSync(
        resolve(root, PUBLIC_RELEASE_MANIFEST),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    );
    return manifest;
}

export function verifyPublicReleaseManifest(root = process.cwd()) {
    const manifestPath = resolve(root, PUBLIC_RELEASE_MANIFEST);
    if (!existsSync(manifestPath) || !lstatSync(manifestPath).isFile()) {
        throw new Error(`[PublicReleaseManifest] Missing ${PUBLIC_RELEASE_MANIFEST}`);
    }
    const recorded = JSON.parse(readFileSync(manifestPath, "utf8"));
    const actual = createPublicReleaseManifest(root);
    if (JSON.stringify(recorded) !== JSON.stringify(actual)) {
        throw new Error(
            "[PublicReleaseManifest] Release files differ from the reviewed path, size, or SHA-256 manifest",
        );
    }
    process.stdout.write(
        `[PublicReleaseManifest] Verified ${actual.files.length} exact release files for ${actual.packages.map(({ name, version }) => `${name}@${version}`).join(" and ")}.\n`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    verifyPublicReleaseManifest();
}
