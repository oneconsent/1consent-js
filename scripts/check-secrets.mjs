import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const DATABASE_DSN = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'`<>]+/gu;
const NEON_PASSWORD = /\bnpg_[A-Za-z0-9_-]{12,}\b/gu;
const HIGH_CONFIDENCE_TOKEN_PATTERNS = [
    {
        kind: "private key",
        pattern:
            /-----BEGIN (?:(?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY|ENCRYPTED PRIVATE KEY|PGP PRIVATE KEY BLOCK)-----/gu,
    },
    { kind: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/gu },
    { kind: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/gu },
    { kind: "npm token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/gu },
    { kind: "GitLab token", pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/gu },
    { kind: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/gu },
    { kind: "Stripe live secret", pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/gu },
    { kind: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
    { kind: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/gu },
];
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DOCUMENTATION_HOSTS = new Set(["host", "..."]);
const DOCUMENTATION_PASSWORDS = new Set([
    "password",
    "secret",
    "changeme",
    "replace_me",
    "your_password",
]);
export const MAX_TRACKED_BLOB_BYTES = 64 * 1024 * 1024;

export class IndexedFileReadError extends Error {
    constructor(path, cause) {
        super(`Unable to scan tracked file safely: ${path}`);
        this.name = "IndexedFileReadError";
        this.cause = cause;
    }
}

function lineAt(text, offset) {
    return text.slice(0, offset).split("\n").length;
}

function isCredentialedRemoteDatabaseUrl(value) {
    try {
        const parsed = new URL(value);
        if (!parsed.username || !parsed.password) return false;
        if (LOCAL_DATABASE_HOSTS.has(parsed.hostname)) return false;
        if (DOCUMENTATION_HOSTS.has(parsed.hostname)) return false;
        if (DOCUMENTATION_PASSWORDS.has(parsed.password.toLowerCase())) return false;
        return true;
    } catch {
        return false;
    }
}

export function findHighConfidenceSecrets(text) {
    const findings = [];

    for (const { kind, pattern } of HIGH_CONFIDENCE_TOKEN_PATTERNS) {
        for (const match of text.matchAll(pattern)) {
            const offset = match.index;
            if (offset === undefined) continue;
            findings.push({ line: lineAt(text, offset), kind });
        }
    }

    for (const match of text.matchAll(DATABASE_DSN)) {
        const value = match[0];
        const offset = match.index;
        if (offset === undefined || !isCredentialedRemoteDatabaseUrl(value)) continue;
        findings.push({ line: lineAt(text, offset), kind: "credentialed remote database URL" });
    }

    for (const match of text.matchAll(NEON_PASSWORD)) {
        const offset = match.index;
        if (offset === undefined) continue;
        findings.push({ line: lineAt(text, offset), kind: "Neon database password" });
    }

    return findings;
}

function trackedFiles() {
    return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
        .split("\0")
        .filter(Boolean);
}

export function readIndexedFile(
    path,
    cwd = process.cwd(),
    maxBuffer = MAX_TRACKED_BLOB_BYTES,
    environment = process.env,
) {
    try {
        return execFileSync("git", ["show", `:${path}`], {
            cwd,
            env: environment,
            maxBuffer,
        });
    } catch (error) {
        // Preserve the underlying error for programmatic inspection, but expose
        // only the path. Child-process errors can carry the captured blob bytes
        // on stdout and must never be printed by this security check.
        throw new IndexedFileReadError(path, error);
    }
}

function main() {
    const findings = [];
    for (const path of trackedFiles()) {
        // Scan the Git index, not the working tree. Pre-commit must inspect the
        // exact bytes being committed even when a developer has since edited
        // the working-tree copy.
        let content;
        try {
            content = readIndexedFile(path);
        } catch (error) {
            console.error(
                error instanceof IndexedFileReadError
                    ? error.message
                    : `Unable to scan tracked file safely: ${path}`,
            );
            process.exitCode = 1;
            return;
        }
        if (content.includes(0)) continue;
        const text = content.toString("utf8");
        for (const finding of findHighConfidenceSecrets(text)) {
            findings.push({ path, ...finding });
        }
    }

    if (findings.length > 0) {
        console.error("High-confidence secrets found in tracked files:");
        for (const finding of findings) {
            // Never echo the matched value itself into CI or developer logs.
            console.error(`- ${finding.path}:${finding.line} [${finding.kind}]`);
        }
        process.exitCode = 1;
        return;
    }

    console.log("✓ No high-confidence credentials or private keys in tracked files.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
