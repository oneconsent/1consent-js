import process from "node:process";
import { pathToFileURL } from "node:url";

/**
 * npm release lines. Each line is versioned and tagged on its own; the packages
 * inside one line always release together at one version. A package's short
 * name is its directory under packages/libs and its @1consent scope suffix.
 */
export const NPM_RELEASE_LINES = Object.freeze({
    sdk: Object.freeze({ tagPrefix: "npm-v", packages: Object.freeze(["react", "nextjs", "cli"]) }),
    "site-check": Object.freeze({
        tagPrefix: "npm-site-check-v",
        packages: Object.freeze(["site-check"]),
    }),
});

export const BETA_VERSION_PATTERN =
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-beta\.(0|[1-9][0-9]*)$/;
export const STABLE_VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/**
 * npm release channels. A release's version picks its channel: a `-beta.<n>` prerelease stages
 * under the `beta` dist-tag, a plain `<major>.<minor>.<patch>` under `latest`. Each channel stages
 * from its own protected GitHub environment, which npm's trusted publisher and the provenance
 * check bind to. Keep the version patterns in step with the tag guard in publish-npm.yml.
 */
export const NPM_RELEASE_CHANNELS = Object.freeze({
    beta: Object.freeze({
        distTag: "beta",
        environment: "npm-beta",
        versionPattern: BETA_VERSION_PATTERN,
    }),
    stable: Object.freeze({
        distTag: "latest",
        environment: "npm-stable",
        versionPattern: STABLE_VERSION_PATTERN,
    }),
});

/**
 * @typedef {{ name: string, distTag: string, environment: string, versionPattern: RegExp }} NpmReleaseChannel
 */

/**
 * The channel a release version belongs to.
 * @param {unknown} version
 * @returns {NpmReleaseChannel}
 */
export function npmReleaseChannel(version) {
    for (const [name, channel] of Object.entries(NPM_RELEASE_CHANNELS)) {
        if (typeof version === "string" && channel.versionPattern.test(version)) {
            return { name, ...channel };
        }
    }
    throw new Error(
        `[NpmRelease] ${JSON.stringify(version)} is neither a <major>.<minor>.<patch> release nor a <major>.<minor>.<patch>-beta.<number> prerelease`,
    );
}

/**
 * @typedef {{ shortName: string, name: string, directory: string }} NpmReleasePackage
 * @typedef {{ name: string, tagPrefix: string, packages: NpmReleasePackage[] }} NpmReleaseLine
 */

/**
 * @param {unknown} name
 * @returns {NpmReleaseLine}
 */
export function npmReleaseLine(name) {
    if (typeof name !== "string" || !Object.hasOwn(NPM_RELEASE_LINES, name)) {
        throw new Error(
            `[NpmRelease] Unknown release line ${JSON.stringify(name)}; expected one of ${Object.keys(NPM_RELEASE_LINES).join(", ")}`,
        );
    }
    const line = NPM_RELEASE_LINES[/** @type {keyof typeof NPM_RELEASE_LINES} */ (name)];
    return {
        name,
        tagPrefix: line.tagPrefix,
        packages: line.packages.map((shortName) => ({
            shortName,
            name: `@1consent/${shortName}`,
            directory: `packages/libs/${shortName}`,
        })),
    };
}

/**
 * The immutable Git tag that releases `version` of `lineName`.
 * @param {string} lineName
 * @param {string} version
 */
export function npmReleaseTag(lineName, version) {
    return `${npmReleaseLine(lineName).tagPrefix}${version}`;
}

/**
 * The release line that owns a package directory, or undefined.
 * @param {string} directory
 */
export function npmReleaseLineOfDirectory(directory) {
    return Object.keys(NPM_RELEASE_LINES).find((name) =>
        npmReleaseLine(name).packages.some((entry) => entry.directory === directory),
    );
}

/**
 * The `--line` argument, validated.
 * @param {readonly string[]} argv
 */
export function npmReleaseLineArgument(argv) {
    const index = argv.indexOf("--line");
    const value = index >= 0 ? argv[index + 1] : undefined;
    return npmReleaseLine(value).name;
}

/**
 * `node scripts/npm-release-lines.mjs packages --line <name>` prints the line's short names.
 * @param {readonly string[]} argv
 */
export function main(argv = process.argv.slice(2)) {
    if (argv[0] !== "packages") {
        throw new Error("[NpmRelease] Usage: npm-release-lines.mjs packages --line <name>");
    }
    const line = npmReleaseLine(npmReleaseLineArgument(argv));
    process.stdout.write(`${line.packages.map(({ shortName }) => shortName).join(" ")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
