import { execFileSync } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNpmPackReport } from "./npm-pack-report.mts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reactDir = resolve(repoRoot, "packages/libs/react");
const nextjsDir = resolve(repoRoot, "packages/libs/nextjs");
const cliDir = resolve(repoRoot, "packages/libs/cli");
const consumerDir = mkdtempSync(resolve(tmpdir(), "1consent-package-smoke-"));
const cacheDir = resolve(consumerDir, "npm-cache");
const privateContractsManifest = resolve(repoRoot, "packages/contracts/package.json");

function peerInstallSpecifiers() {
    if (!existsSync(privateContractsManifest)) {
        return ["next@^16.0.0", "react@^19.0.0", "react-dom@^19.0.0", "zod@^4.0.0"];
    }
    const reactRequire = createRequire(resolve(reactDir, "package.json"));
    const nextjsRequire = createRequire(resolve(nextjsDir, "package.json"));
    const contractsRequire = createRequire(privateContractsManifest);
    return [
        dirname(nextjsRequire.resolve("next/package.json")),
        dirname(reactRequire.resolve("react/package.json")),
        dirname(nextjsRequire.resolve("react-dom/package.json")),
        dirname(contractsRequire.resolve("zod/package.json")),
    ];
}

function run(command, args, cwd = repoRoot) {
    return execFileSync(command, args, {
        cwd,
        encoding: "utf8",
        env: { ...process.env, NPM_CONFIG_CACHE: cacheDir },
        stdio: ["ignore", "pipe", "inherit"],
    });
}

const publicPackageVersions = new Map(
    [reactDir, nextjsDir, cliDir].map((directory) => {
        const manifest = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
        return [manifest.name, manifest.version];
    }),
);

function packSource(packageDir) {
    const manifest = JSON.parse(readFileSync(resolve(packageDir, "package.json"), "utf8"));
    const hasWorkspaceDependency = Object.values(manifest.dependencies ?? {}).some(
        (specifier) => typeof specifier === "string" && specifier.startsWith("workspace:"),
    );
    if (!hasWorkspaceDependency) return packageDir;

    const staged = resolve(consumerDir, `pack-${basename(packageDir)}`);
    mkdirSync(staged, { recursive: true });
    for (const path of manifest.files ?? []) {
        const target = resolve(staged, path);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(resolve(packageDir, path), target);
    }
    for (const [name, specifier] of Object.entries(manifest.dependencies ?? {})) {
        if (typeof specifier !== "string" || !specifier.startsWith("workspace:")) continue;
        const version = publicPackageVersions.get(name);
        if (!version) throw new Error(`Cannot sanitize workspace dependency ${name}`);
        manifest.dependencies[name] = version;
    }
    delete manifest.scripts;
    delete manifest.devDependencies;
    delete manifest.private;
    writeFileSync(resolve(staged, "package.json"), `${JSON.stringify(manifest, null, 4)}\n`);
    return staged;
}

function pack(packageDir) {
    const value = JSON.parse(
        run(
            "npm",
            ["pack", "--json", "--ignore-scripts", "--pack-destination", consumerDir],
            packSource(packageDir),
        ),
    );
    const manifest = JSON.parse(readFileSync(resolve(packageDir, "package.json"), "utf8"));
    const report = parseNpmPackReport(value, manifest.name);
    return resolve(consumerDir, report.filename);
}

try {
    const reactTarball = pack(reactDir);
    const nextjsTarball = pack(nextjsDir);
    const cliTarball = pack(cliDir);

    writeFileSync(
        resolve(consumerDir, "package.json"),
        `${JSON.stringify({ name: "package-smoke", private: true, type: "module" }, null, 2)}\n`,
    );
    run(
        "npm",
        [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--package-lock=false",
            reactTarball,
            nextjsTarball,
            cliTarball,
            ...peerInstallSpecifiers(),
        ],
        consumerDir,
    );

    const help = run(resolve(consumerDir, "node_modules/.bin/1c"), ["--help"], consumerDir);
    if (!help.includes("typegen") || !help.includes("Manage 1Consent")) {
        throw new Error("Installed CLI did not expose the documented command surface");
    }
    const typegenHelp = run(
        resolve(consumerDir, "node_modules/.bin/1c"),
        ["typegen", "--help"],
        consumerDir,
    );
    if (!typegenHelp.includes("--app <shortId>")) {
        throw new Error("Installed CLI did not expose the documented typegen command");
    }

    const smokeFile = resolve(consumerDir, "smoke.mjs");
    writeFileSync(
        smokeFile,
        `import * as sdk from "@1consent/react";\n` +
            `import * as nextSdk from "@1consent/nextjs";\n` +
            `import { parseConsentCookie } from "@1consent/nextjs/server";\n` +
            `import { designKit } from "@1consent/cli/design-kit";\n` +
            `for (const name of ["OneConsent", "OneConsentProvider", "useConsent"]) {\n` +
            `  if (typeof sdk[name] !== "function") throw new Error(\`Missing export \${name}\`);\n` +
            `  if (typeof nextSdk[name] !== "function") throw new Error(\`Missing Next.js export \${name}\`);\n` +
            `}\n` +
            `if (parseConsentCookie(undefined, {}, 0) !== "none") throw new Error("Server helper did not fail closed");\n` +
            `if (typeof designKit !== "function") throw new Error("Missing designKit export");\n`,
    );
    run(process.execPath, [smokeFile], consumerDir);

    const rscSmokeFile = resolve(consumerDir, "smoke-rsc.mjs");
    writeFileSync(
        rscSmokeFile,
        `import * as nextSdk from "@1consent/nextjs";\n` +
            `if ("useConsent" in nextSdk) throw new Error("Next.js RSC export leaks useConsent");\n` +
            `for (const name of ["OneConsent", "OneConsentProvider"]) {\n` +
            `  if (typeof nextSdk[name] !== "function") throw new Error(\`Missing RSC export \${name}\`);\n` +
            `}\n`,
    );
    run(process.execPath, ["--conditions=react-server", rscSmokeFile], consumerDir);

    const installedCli = JSON.parse(
        readFileSync(resolve(consumerDir, "node_modules/@1consent/cli/package.json"), "utf8"),
    );
    const installedSdk = JSON.parse(
        readFileSync(resolve(consumerDir, "node_modules/@1consent/react/package.json"), "utf8"),
    );
    const installedNextjs = JSON.parse(
        readFileSync(resolve(consumerDir, "node_modules/@1consent/nextjs/package.json"), "utf8"),
    );
    if (installedCli.dependencies !== undefined) {
        throw new Error("Installed package retains runtime workspace dependencies");
    }
    if (
        installedCli.peerDependencies?.vite !== ">=8.0.0 <9.0.0" ||
        installedCli.peerDependenciesMeta?.vite?.optional !== true
    ) {
        throw new Error("Installed CLI does not declare its optional Vite 8 host boundary");
    }
    const sdkDependencies = Object.entries(installedSdk.dependencies ?? {});
    if (
        sdkDependencies.length !== 1 ||
        sdkDependencies[0]?.[0] !== "zod" ||
        String(sdkDependencies[0]?.[1]).startsWith("workspace:")
    ) {
        throw new Error("Installed React package dependency boundary drifted");
    }
    if (
        installedNextjs.dependencies?.["@1consent/react"] !== installedSdk.version ||
        installedNextjs.peerDependencies?.next !== ">=16.0.0 <17.0.0" ||
        Object.values(installedNextjs.dependencies ?? {}).some(
            (specifier) => typeof specifier === "string" && specifier.startsWith("workspace:"),
        )
    ) {
        throw new Error("Installed Next.js package dependency boundary drifted");
    }

    process.stdout.write("Clean package install smoke passed.\n");
} finally {
    rmSync(consumerDir, { recursive: true, force: true });
}
