import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseNpmPackReport } from "./npm-pack-report.mts";
import {
    BETA_VERSION_PATTERN,
    NPM_RELEASE_CHANNELS,
    type NpmReleaseChannel,
    npmReleaseChannel,
    npmReleaseLine,
    npmReleaseLineArgument,
    STABLE_VERSION_PATTERN,
} from "./npm-release-lines.mjs";

export type NpmReleaseState = "bootstrap" | "published" | "stage";
export type NpmPublisherMode = "bootstrap-token" | "trusted-publisher";

const EXPLICIT_NOT_FOUND = /"code"\s*:\s*"E404"|npm error code E404/;
// npm's own registration placeholder: staging a new package publishes it under `latest`.
const NPM_STAGE_PLACEHOLDER = "0.0.0-stage";
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

export function releasePublisher(argv: readonly string[]): NpmPublisherMode {
    const flagIndex = argv.indexOf("--publisher");
    const publisher = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
    if (publisher !== "bootstrap-token" && publisher !== "trusted-publisher") {
        throw new Error("[NpmRelease] --publisher must be bootstrap-token or trusted-publisher");
    }
    return publisher;
}

export function assertPublisherMatchesRelease(
    publisher: NpmPublisherMode,
    version: string,
    states: readonly NpmReleaseState[],
): void {
    if (publisher === "bootstrap-token" && version !== "0.1.0-beta.1") {
        throw new Error(
            "[NpmRelease] The bootstrap token may stage only the first 0.1.0-beta.1 release",
        );
    }
    if (publisher === "trusted-publisher" && states.includes("bootstrap")) {
        throw new Error(
            "[NpmRelease] New packages require bootstrap-token staging before trusted publishers can be configured",
        );
    }
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
        integrity = singleNpmViewValue(JSON.parse(stdout), packageSpec);
    } catch (error) {
        throw new Error(
            `[NpmRelease] Registry returned invalid integrity JSON for ${packageSpec}`,
            {
                cause: error,
            },
        );
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

export function assertPublishedChannelTagMatches(
    packageSpec: string,
    version: string,
    channel: Pick<NpmReleaseChannel, "distTag">,
    currentTagVersion: string | undefined,
): void {
    if (currentTagVersion !== version) {
        throw new Error(
            `[NpmRelease] ${packageSpec} exists but the ${channel.distTag} tag resolves to ${currentTagVersion ?? "nothing"}; refusing an old-tag rerun`,
        );
    }
}

/** Numeric core and prerelease identifiers of a version this pipeline can meet on a dist-tag. */
function versionParts(version: string): {
    core: readonly [number, number, number];
    prerelease: readonly (number | string)[];
} {
    const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?$/.exec(
        version,
    );
    if (!match) throw new Error(`[NpmRelease] Invalid channel version: ${version}`);
    return {
        core: [Number(match[1]), Number(match[2]), Number(match[3])],
        prerelease: (match[4]?.split(".") ?? []).map((part) =>
            /^(0|[1-9][0-9]*)$/.test(part) ? Number(part) : part,
        ),
    };
}

/** SemVer 2.0.0 precedence: negative when `left` is older than `right`. */
export function compareReleaseVersions(left: string, right: string): number {
    const a = versionParts(left);
    const b = versionParts(right);
    for (let index = 0; index < 3; index += 1) {
        const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0);
        if (difference !== 0) return difference;
    }
    // A release ranks above every prerelease of the same core version.
    if (a.prerelease.length === 0 || b.prerelease.length === 0) {
        return b.prerelease.length - a.prerelease.length;
    }
    for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
        const x = a.prerelease[index];
        const y = b.prerelease[index];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        if (x === y) continue;
        if (typeof x === "number" && typeof y === "number") return x - y;
        // Numeric identifiers rank below alphanumeric ones.
        if (typeof x === "number") return -1;
        if (typeof y === "number") return 1;
        return x < y ? -1 : 1;
    }
    return 0;
}

export function assertChannelAdvances(
    releaseVersion: string,
    channel: Pick<NpmReleaseChannel, "distTag">,
    currentTagVersion: string | undefined,
): void {
    if (currentTagVersion === undefined) return;
    if (compareReleaseVersions(releaseVersion, currentTagVersion) <= 0) {
        throw new Error(
            `[NpmRelease] ${releaseVersion} must be newer than the current ${channel.distTag} tag ${currentTagVersion}`,
        );
    }
}

/**
 * A beta must rank above the current release on `latest`, so `@beta` never installs older code
 * than a plain install. npm's `0.0.0-stage` placeholder ranks below every beta.
 */
export function assertBetaFollowsLatest(
    releaseVersion: string,
    currentLatestVersion: string | undefined,
): void {
    if (currentLatestVersion === undefined) return;
    if (compareReleaseVersions(releaseVersion, currentLatestVersion) <= 0) {
        throw new Error(
            `[NpmRelease] ${releaseVersion} must be newer than the current latest release ${currentLatestVersion}`,
        );
    }
}

/** Whether a registry dist-tag value is one this channel may hold. */
function isChannelTagValue(channel: Pick<NpmReleaseChannel, "name">, value: string): boolean {
    if (channel.name === "beta") return BETA_VERSION_PATTERN.test(value);
    return STABLE_VERSION_PATTERN.test(value) || value === NPM_STAGE_PLACEHOLDER;
}

export function interpretNpmDistTagResult(
    status: number | null,
    stdout: string,
    stderr: string,
    packageName: string,
    channel: Pick<NpmReleaseChannel, "name" | "distTag">,
): string | undefined {
    const spec = `${packageName}@${channel.distTag}`;
    if (status !== 0) {
        if (EXPLICIT_NOT_FOUND.test(`${stdout}${stderr}`)) return undefined;
        throw new Error(`[NpmRelease] Registry lookup failed for ${spec} version:\n${stdout}${stderr}`);
    }
    const output = stdout.trim();
    if (output === "" || output === "null") return undefined;

    let tagVersion: unknown;
    try {
        tagVersion = singleNpmViewValue(JSON.parse(output), packageName);
    } catch (error) {
        throw new Error(`[NpmRelease] Registry returned invalid JSON for ${spec} version`, {
            cause: error,
        });
    }
    if (tagVersion === undefined) return undefined;
    if (typeof tagVersion !== "string" || !isChannelTagValue(channel, tagVersion)) {
        throw new Error(
            `[NpmRelease] Registry returned an invalid ${channel.distTag} tag for ${packageName}`,
        );
    }
    return tagVersion;
}

function singleNpmViewValue(value: unknown, packageSpec: string): unknown {
    if (!Array.isArray(value)) return value;
    if (value.length > 1) {
        throw new Error(`[NpmRelease] Ambiguous registry values for ${packageSpec}`);
    }
    return value[0];
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

function npmDistTag(packageName: string, channel: NpmReleaseChannel): string | undefined {
    const result = spawnSync(
        "npm",
        ["view", `${packageName}@${channel.distTag}`, "version", "--json"],
        { encoding: "utf8" },
    );
    if (result.error) throw result.error;
    return interpretNpmDistTagResult(
        result.status,
        result.stdout ?? "",
        result.stderr ?? "",
        packageName,
        channel,
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

function localPackageIntegrity(directory: string, packageName: string): string {
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
        return parseNpmPackReport(report, packageName).integrity;
    } finally {
        rmSync(cacheDirectory, { recursive: true, force: true });
    }
}

export function releaseVersion(argv: readonly string[]): string {
    const flagIndex = argv.indexOf("--version");
    const version = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
    if (!version) throw new Error("[NpmRelease] --version is required");
    npmReleaseChannel(version);
    return version;
}

/** Packages of a release line whose exact version is not yet on the registry. */
export function packagesToStage(
    results: ReadonlyArray<readonly [string, NpmReleaseState]>,
): string[] {
    return results.filter(([, state]) => state !== "published").map(([name]) => name);
}

export function assertReleaseFullyPublished(
    lineName: string,
    version: string,
    results: ReadonlyArray<readonly [string, NpmReleaseState]>,
): void {
    const pending = packagesToStage(results);
    if (results.length === 0 || pending.length > 0) {
        throw new Error(
            `[NpmRelease] Every ${lineName} package must already own ${version} on the ${npmReleaseChannel(version).distTag} channel; not yet published: ${pending.join(", ") || "(no packages)"}`,
        );
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
    const line = npmReleaseLine(npmReleaseLineArgument(argv));
    const version = releaseVersion(argv);
    const channel = npmReleaseChannel(version);
    const results: Array<readonly [string, NpmReleaseState]> = [];

    for (const { shortName, name: packageName, directory } of line.packages) {
        const exactVersionExists = npmPackageExists(`${packageName}@${version}`);
        const packageExists = exactVersionExists || npmPackageExists(packageName);
        if (exactVersionExists) {
            const packageSpec = `${packageName}@${version}`;
            assertPublishedIntegrityMatches(
                packageSpec,
                localPackageIntegrity(directory, packageName),
                npmPackageIntegrity(packageSpec),
            );
            assertPublishedChannelTagMatches(
                packageSpec,
                version,
                channel,
                npmDistTag(packageName, channel),
            );
        } else if (packageExists) {
            assertChannelAdvances(version, channel, npmDistTag(packageName, channel));
            if (channel.name === "beta") {
                const stable = { name: "stable", ...NPM_RELEASE_CHANNELS.stable };
                assertBetaFollowsLatest(version, npmDistTag(packageName, stable));
            }
        }
        const state = classifyPackageState(exactVersionExists, packageExists);
        results.push([shortName, state]);
    }
    if (argv.includes("--publisher")) {
        assertPublisherMatchesRelease(
            releasePublisher(argv),
            version,
            results.map((result) => result[1]),
        );
    }
    if (argv.includes("--require-published")) {
        assertReleaseFullyPublished(line.name, version, results);
    }
    for (const [outputName, state] of results) {
        process.stdout.write(`${outputName}=${state}\n`);
    }
    process.stdout.write(`to_stage=${packagesToStage(results).join(" ")}\n`);
}

const entryPoint = process.argv[1];
if (entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)) {
    main();
}
