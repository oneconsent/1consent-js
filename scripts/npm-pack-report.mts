export interface NpmPackFile {
    path: string;
    size: number;
    mode: number;
}

export interface NpmPackReport {
    name: string;
    version: string;
    filename: string;
    integrity: string;
    unpackedSize: number;
    files: NpmPackFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSize(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRelativePath(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        !value.startsWith("/") &&
        !/^[A-Za-z]:/.test(value) &&
        !value.includes("\\") &&
        !value.includes("\0") &&
        value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
    );
}

/** Accept the documented npm 11 array and npm 12 package-keyed object, each for one package. */
export function parseNpmPackReport(value: unknown, expectedName: string): NpmPackReport {
    let candidate: unknown;
    if (Array.isArray(value) && value.length === 1) {
        candidate = value[0];
    } else if (
        isRecord(value) &&
        Object.keys(value).length === 1 &&
        Object.hasOwn(value, expectedName)
    ) {
        candidate = value[expectedName];
    } else {
        throw new Error(`[NpmPack] Expected exactly one package report for ${expectedName}`);
    }

    if (
        !isRecord(candidate) ||
        candidate.name !== expectedName ||
        typeof candidate.version !== "string" ||
        candidate.version.length === 0 ||
        !isRelativePath(candidate.filename) ||
        candidate.filename.includes("/") ||
        !candidate.filename.endsWith(".tgz") ||
        typeof candidate.integrity !== "string" ||
        !/^sha512-[A-Za-z0-9+/]{86}==$/.test(candidate.integrity) ||
        !isSize(candidate.unpackedSize) ||
        !Array.isArray(candidate.files) ||
        candidate.files.length === 0
    ) {
        throw new Error(`[NpmPack] Invalid package report for ${expectedName}`);
    }

    const files: NpmPackFile[] = [];
    const paths = new Set<string>();
    for (const file of candidate.files) {
        if (
            !isRecord(file) ||
            !isRelativePath(file.path) ||
            !isSize(file.size) ||
            !isSize(file.mode) ||
            paths.has(file.path)
        ) {
            throw new Error(`[NpmPack] Invalid or duplicate file entry for ${expectedName}`);
        }
        paths.add(file.path);
        files.push({ path: file.path, size: file.size, mode: file.mode });
    }

    return {
        name: candidate.name,
        version: candidate.version,
        filename: candidate.filename,
        integrity: candidate.integrity,
        unpackedSize: candidate.unpackedSize,
        files,
    };
}
