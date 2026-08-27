import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reactDir = resolve(repoRoot, "packages/libs/react");
const cliDir = resolve(repoRoot, "packages/libs/cli");
const consumerDir = mkdtempSync(resolve(tmpdir(), "1consent-package-smoke-"));
const cacheDir = resolve(consumerDir, "npm-cache");
const privateContractsManifest = resolve(repoRoot, "packages/contracts/package.json");

function peerInstallSpecifiers() {
    if (!existsSync(privateContractsManifest)) return ["react@19.2.8", "zod@4.4.3"];
    const reactRequire = createRequire(resolve(reactDir, "package.json"));
    const contractsRequire = createRequire(privateContractsManifest);
    return [
        dirname(reactRequire.resolve("react/package.json")),
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

function pack(packageDir) {
    const report = JSON.parse(
        run(
            "npm",
            ["pack", "--json", "--ignore-scripts", "--pack-destination", consumerDir],
            packageDir,
        ),
    );
    if (!Array.isArray(report) || report.length !== 1 || typeof report[0]?.filename !== "string") {
        throw new Error(`Could not pack ${packageDir}`);
    }
    return resolve(consumerDir, report[0].filename);
}

try {
    const reactTarball = pack(reactDir);
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
            `import { designKit } from "@1consent/cli/design-kit";\n` +
            `for (const name of ["OneConsent", "OneConsentProvider", "useConsent"]) {\n` +
            `  if (typeof sdk[name] !== "function") throw new Error(\`Missing export \${name}\`);\n` +
            `}\n` +
            `if (typeof designKit !== "function") throw new Error("Missing designKit export");\n`,
    );
    run(process.execPath, [smokeFile], consumerDir);

    const installedCli = JSON.parse(
        readFileSync(resolve(consumerDir, "node_modules/@1consent/cli/package.json"), "utf8"),
    );
    const installedSdk = JSON.parse(
        readFileSync(resolve(consumerDir, "node_modules/@1consent/react/package.json"), "utf8"),
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

    process.stdout.write("Clean package install smoke passed.\n");
} finally {
    rmSync(consumerDir, { recursive: true, force: true });
}
