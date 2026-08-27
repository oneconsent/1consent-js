import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export type NpmReleaseState = "bootstrap" | "published" | "stage";

const EXPLICIT_NOT_FOUND = /"code"\s*:\s*"E404"|npm error code E404/;
const BETA_VERSION =
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-beta\.(0|[1-9][0-9]*)$/;
const RELEASE_PACKAGES = [
    ["react", "@1consent/react", "packages/libs/react"],
    ["cli", "@1consent/cli", "packages/libs/cli"],
] as const;
const SHA512_INTEGRITY = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

export function interpretNpmViewResult(
    status: number | null,
    output: string,
    packageSpec: string,
): boolean {
    if (status === 0) return true;
    if (EXPLICIT_NOT_FOUND.test(output)) return false;

    throw new Error(
        `[NpmRelease] Registry lookup failed for ${packageSpec}; refusing to infer package absence:\n${output}`,
    );
}

export function classifyPackageState(
    exactVersionExists: boolean,
    packageExists: boolean,
): NpmReleaseState {
    if (exactVersionExists) return "published";
    return packageExists ? "stage" : "bootstrap";
}

export function interpretNpmIntegrityResult(
    status: number | null,
    stdout: string,
    stderr: string,
    packageSpec: string,
): string {
    if (status !== 0) {
        throw new Error(
            `[NpmRelease] Registry integrity lookup failed for ${packageSpec}:\n${stdout}${stderr}`,
        );
    }
    let integrity: unknown;
    try {
        integrity = JSON.parse(stdout);
    } catch (error) {
        throw new Error(`[NpmRelease] Registry returned invalid integrity JSON for ${packageSpec}`, {
            cause: error,
        });
    }
    if (typeof integrity !== "string" || !SHA512_INTEGRITY.test(integrity)) {
        throw new Error(`[NpmRelease] Registry returned invalid integrity for ${packageSpec}`);
    }
    return integrity;
}

export function assertPublishedIntegrityMatches(
    packageSpec: string,
    localIntegrity: string,
    registryIntegrity: string,
): void {
    if (!SHA512_INTEGRITY.test(localIntegrity) || localIntegrity !== registryIntegrity) {
        throw new Error(
            `[NpmRelease] ${packageSpec} already exists but does not match the reviewed local tarball; refusing to skip publication`,
        );
    }
}

export function assertPublishedBetaTagMatches(
    packageSpec: string,
    version: string,
    currentBetaVersion: string | undefined,
): void {
    if (currentBetaVersion !== version) {
        throw new Error(
            `[NpmRelease] ${packageSpec} exists but the beta tag resolves to ${currentBetaVersion ?? "nothing"}; refusing an old-tag rerun`,
        );
    }
}

function betaVersionParts(version: string): readonly [number, number, number, number] {
    const match = BETA_VERSION.exec(version);
    if (!match) {
        throw new Error(`[NpmRelease] Invalid beta channel version: ${version}`);
    }
    return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

export function assertBetaChannelAdvances(
    releaseVersion: string,
    currentBetaVersion: string | undefined,
): void {
    if (currentBetaVersion === undefined) return;
    const [releaseMajor, releaseMinor, releasePatch, releaseBeta] = betaVersionParts(releaseVersion);
    const [currentMajor, currentMinor, currentPatch, currentBeta] =
        betaVersionParts(currentBetaVersion);
    const releaseParts = [releaseMajor, releaseMinor, releasePatch, releaseBeta];
    const currentParts = [currentMajor, currentMinor, currentPatch, currentBeta];

    for (let index = 0; index < releaseParts.length; index += 1) {
        const releasePart = releaseParts[index];
        const currentPart = currentParts[index];
        if (releasePart === currentPart) continue;
        if (releasePart !== undefined && currentPart !== undefined && releasePart > currentPart) return;
        throw new Error(
            `[NpmRelease] ${releaseVersion} must be newer than the current beta tag ${currentBetaVersion}`,
        );
    }

    throw new Error(
        `[NpmRelease] ${releaseVersion} must be newer than the current beta tag ${currentBetaVersion}`,
    );
}

export function interpretNpmBetaTagResult(
    status: number | null,
    stdout: string,
    stderr: string,
    packageName: string,
): string | undefined {
    if (status !== 0) {
        if (EXPLICIT_NOT_FOUND.test(`${stdout}${stderr}`)) return undefined;
        throw new Error(
            `[NpmRelease] Registry lookup failed for ${packageName}@beta version:\n${stdout}${stderr}`,
        );
    }
    const output = stdout.trim();
    if (output === "" || output === "null") return undefined;

    let betaTag: unknown;
    try {
        betaTag = JSON.parse(output);
    } catch (error) {
        throw new Error(`[NpmRelease] Registry returned invalid JSON for ${packageName}@beta version`, {
            cause: error,
        });
    }
    if (typeof betaTag !== "string" || !BETA_VERSION.test(betaTag)) {
        throw new Error(`[NpmRelease] Registry returned an invalid beta tag for ${packageName}`);
    }
    return betaTag;
}

function npmPackageExists(packageSpec: string): boolean {
    const result = spawnSync("npm", ["view", packageSpec, "version", "--json"], {
        encoding: "utf8",
    });
    if (result.error) throw result.error;
    return interpretNpmViewResult(
        result.status,
        `${result.stdout ?? ""}${result.stderr ?? ""}`,
        packageSpec,
    );
}

function npmBetaTag(packageName: string): string | undefined {
    const result = spawnSync("npm", ["view", `${packageName}@beta`, "version", "--json"], {
        encoding: "utf8",
    });
    if (result.error) throw result.error;
    return interpretNpmBetaTagResult(
        result.status,
        result.stdout ?? "",
        result.stderr ?? "",
        packageName,
    );
}

function npmPackageIntegrity(packageSpec: string): string {
    const result = spawnSync("npm", ["view", packageSpec, "dist.integrity", "--json"], {
        encoding: "utf8",
    });
    if (result.error) throw result.error;
    return interpretNpmIntegrityResult(
        result.status,
        result.stdout ?? "",
        result.stderr ?? "",
        packageSpec,
    );
}

function localPackageIntegrity(directory: string): string {
    const cacheDirectory = mkdtempSync(resolve(tmpdir(), "1consent-release-integrity-"));
    try {
        const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
            cwd: resolve(directory),
            encoding: "utf8",
            env: { ...process.env, NPM_CONFIG_CACHE: cacheDirectory },
        });
        if (result.error) throw result.error;
        if (result.status !== 0) {
            throw new Error(
                `[NpmRelease] Local package integrity calculation failed for ${directory}:\n${result.stdout ?? ""}${result.stderr ?? ""}`,
            );
        }
        let report: unknown;
        try {
            report = JSON.parse(result.stdout ?? "");
        } catch (error) {
            throw new Error(`[NpmRelease] Local package report is invalid for ${directory}`, {
                cause: error,
            });
        }
        if (
            !Array.isArray(report) ||
            report.length !== 1 ||
            typeof report[0]?.integrity !== "string" ||
            !SHA512_INTEGRITY.test(report[0].integrity)
        ) {
            throw new Error(`[NpmRelease] Local package integrity is invalid for ${directory}`);
        }
        return report[0].integrity;
    } finally {
        rmSync(cacheDirectory, { recursive: true, force: true });
    }
}

export function releaseVersion(argv: readonly string[]): string {
    const flagIndex = argv.indexOf("--version");
    const version = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
    if (
        !version ||
        !BETA_VERSION.test(version)
    ) {
        throw new Error("[NpmRelease] --version must be a valid <major>.<minor>.<patch>-beta.<number> prerelease");
    }
    return version;
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
    const version = releaseVersion(argv);

    for (const [outputName, packageName, directory] of RELEASE_PACKAGES) {
        const exactVersionExists = npmPackageExists(`${packageName}@${version}`);
        const packageExists = exactVersionExists || npmPackageExists(packageName);
        if (exactVersionExists) {
            const packageSpec = `${packageName}@${version}`;
            assertPublishedIntegrityMatches(
                packageSpec,
                localPackageIntegrity(directory),
                npmPackageIntegrity(packageSpec),
            );
            assertPublishedBetaTagMatches(packageSpec, version, npmBetaTag(packageName));
        } else if (packageExists) {
            assertBetaChannelAdvances(version, npmBetaTag(packageName));
        }
        const state = classifyPackageState(exactVersionExists, packageExists);
        process.stdout.write(`${outputName}=${state}\n`);
    }
}

const entryPoint = process.argv[1];
if (entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)) {
    main();
}
