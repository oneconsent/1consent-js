import { readFileSync } from "node:fs";
import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE_PACKAGES = ["@1consent/react", "@1consent/cli"] as const;
const SLSA_PREDICATE = "https://slsa.dev/provenance/v1";
const IN_TOTO_STATEMENT = "https://in-toto.io/Statement/v1";
const GITHUB_BUILD_TYPE =
    "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
const GITHUB_HOSTED_BUILDER = "https://github.com/actions/runner/github-hosted";
const SIGSTORE_BUNDLE_MEDIA_TYPE = "application/vnd.dev.sigstore.bundle.v0.3+json";
const IN_TOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";
const MAX_AUDIT_REPORT_BYTES = 10 * 1024 * 1024;

const FULCIO_OIDS = {
    issuer: "1.3.6.1.4.1.57264.1.8",
    buildSignerUri: "1.3.6.1.4.1.57264.1.9",
    buildSignerDigest: "1.3.6.1.4.1.57264.1.10",
    runnerEnvironment: "1.3.6.1.4.1.57264.1.11",
    sourceRepositoryUri: "1.3.6.1.4.1.57264.1.12",
    sourceRepositoryDigest: "1.3.6.1.4.1.57264.1.13",
    sourceRepositoryRef: "1.3.6.1.4.1.57264.1.14",
    sourceRepositoryIdentifier: "1.3.6.1.4.1.57264.1.15",
    sourceRepositoryOwnerUri: "1.3.6.1.4.1.57264.1.16",
    sourceRepositoryOwnerIdentifier: "1.3.6.1.4.1.57264.1.17",
    buildConfigUri: "1.3.6.1.4.1.57264.1.18",
    buildConfigDigest: "1.3.6.1.4.1.57264.1.19",
    buildTrigger: "1.3.6.1.4.1.57264.1.20",
    runInvocationUri: "1.3.6.1.4.1.57264.1.21",
    sourceRepositoryVisibility: "1.3.6.1.4.1.57264.1.22",
    deploymentEnvironment: "1.3.6.1.4.1.57264.1.23",
    tokenSubject: "1.3.6.1.4.1.57264.1.24",
} as const;
const REQUIRED_FULCIO_OIDS = new Set<string>(Object.values(FULCIO_OIDS));

type JsonRecord = Record<string, unknown>;

export interface ExpectedProvenance {
    version: string;
    repository: string;
    workflow: string;
    ref: string;
    commit: string;
    environment: string;
}

interface DerNode {
    tag: number;
    contentStart: number;
    end: number;
}

function fail(message: string): never {
    throw new Error(`[NpmProvenance] ${message}`);
}

function record(value: unknown, label: string): JsonRecord {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        fail(`${label} must be an object`);
    }
    return value as JsonRecord; // ASSERTION: The runtime guard proves a non-null, non-array object; TypeScript cannot infer its index signature.
}

function array(value: unknown, label: string): unknown[] {
    if (!Array.isArray(value)) fail(`${label} must be an array`);
    return value;
}

function string(value: unknown, label: string): string {
    if (typeof value !== "string" || value.length === 0) fail(`${label} must be a string`);
    return value;
}

function exactKeys(value: JsonRecord, expected: readonly string[], label: string): void {
    const actual = Object.keys(value).sort();
    const required = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(required)) {
        fail(`${label} fields changed; expected ${required.join(", ")}, received ${actual.join(", ")}`);
    }
}

function exact(value: unknown, expected: string, label: string): void {
    if (value !== expected) fail(`${label} does not match the selected release`);
}

function readDerNode(bytes: Buffer, offset: number, limit = bytes.length): DerNode {
    if (offset < 0 || offset + 2 > limit) fail("certificate contains a truncated DER node");
    const tag = bytes[offset];
    const firstLength = bytes[offset + 1];
    if (tag === undefined || firstLength === undefined) fail("certificate contains invalid DER");
    let contentStart = offset + 2;
    let length = firstLength;
    if ((firstLength & 0x80) !== 0) {
        const lengthBytes = firstLength & 0x7f;
        if (lengthBytes === 0 || lengthBytes > 4 || contentStart + lengthBytes > limit) {
            fail("certificate contains an unsupported DER length");
        }
        length = 0;
        for (let index = 0; index < lengthBytes; index += 1) {
            const byte = bytes[contentStart + index];
            if (byte === undefined) fail("certificate contains a truncated DER length");
            length = length * 256 + byte;
        }
        if (length < 128) fail("certificate contains a non-canonical DER length");
        contentStart += lengthBytes;
    }
    const end = contentStart + length;
    if (!Number.isSafeInteger(end) || end > limit) fail("certificate DER node exceeds its parent");
    return { tag, contentStart, end };
}

function derChildren(bytes: Buffer, node: DerNode): DerNode[] {
    const children: DerNode[] = [];
    let offset = node.contentStart;
    while (offset < node.end) {
        const child = readDerNode(bytes, offset, node.end);
        children.push(child);
        offset = child.end;
    }
    if (offset !== node.end) fail("certificate DER children do not fill their parent");
    return children;
}

function decodeOid(bytes: Buffer): string {
    if (bytes.length === 0) fail("certificate extension has an empty OID");
    const components: number[] = [];
    let value = 0;
    for (const byte of bytes) {
        value = value * 128 + (byte & 0x7f);
        if (!Number.isSafeInteger(value)) fail("certificate extension OID is too large");
        if ((byte & 0x80) === 0) {
            components.push(value);
            value = 0;
        }
    }
    if (value !== 0 || components.length === 0) fail("certificate extension has invalid OID data");
    const first = components.shift();
    if (first === undefined) fail("certificate extension has invalid OID data");
    const firstArc = first < 40 ? 0 : first < 80 ? 1 : 2;
    const secondArc = first - firstArc * 40;
    return [firstArc, secondArc, ...components].join(".");
}

function decodeUtf8Extension(bytes: Buffer): string {
    const valueNode = readDerNode(bytes, 0);
    if (valueNode.tag !== 0x0c || valueNode.end !== bytes.length) {
        fail("Fulcio extension is not one canonical DER UTF8String");
    }
    const value = bytes.subarray(valueNode.contentStart, valueNode.end).toString("utf8");
    if (value.length === 0 || value.includes("\uFFFD")) fail("Fulcio extension is not valid UTF-8");
    return value;
}

export function certificateExtensions(rawCertificateBase64: string): Map<string, string> {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(rawCertificateBase64)) {
        fail("provenance certificate is not canonical base64");
    }
    const certificate = Buffer.from(rawCertificateBase64, "base64");
    if (certificate.length === 0 || certificate.toString("base64") !== rawCertificateBase64) {
        fail("provenance certificate is invalid base64");
    }
    const outer = readDerNode(certificate, 0);
    if (outer.tag !== 0x30 || outer.end !== certificate.length) {
        fail("provenance certificate is not one DER sequence");
    }
    const certificateChildren = derChildren(certificate, outer);
    const tbsCertificate = certificateChildren[0];
    if (!tbsCertificate || tbsCertificate.tag !== 0x30) fail("certificate has no TBSCertificate");
    const extensionsWrapper = derChildren(certificate, tbsCertificate).find(
        (node) => node.tag === 0xa3,
    );
    if (!extensionsWrapper) fail("certificate has no extensions");
    const wrapperChildren = derChildren(certificate, extensionsWrapper);
    if (wrapperChildren.length !== 1 || wrapperChildren[0]?.tag !== 0x30) {
        fail("certificate has malformed extensions");
    }

    const result = new Map<string, string>();
    for (const extension of derChildren(certificate, wrapperChildren[0])) {
        if (extension.tag !== 0x30) fail("certificate has a malformed extension");
        const fields = derChildren(certificate, extension);
        const oidNode = fields[0];
        const valueNode = fields.at(-1);
        if (!oidNode || oidNode.tag !== 0x06 || !valueNode || valueNode.tag !== 0x04) {
            fail("certificate extension is missing its OID or value");
        }
        const oid = decodeOid(certificate.subarray(oidNode.contentStart, oidNode.end));
        // Fulcio's deprecated .1-.6 extensions are raw strings. Only the modern
        // .8-.24 identity fields below are DER UTF8String values and release policy inputs.
        if (!REQUIRED_FULCIO_OIDS.has(oid)) continue;
        if (result.has(oid)) fail(`certificate repeats Fulcio extension ${oid}`);
        result.set(
            oid,
            decodeUtf8Extension(certificate.subarray(valueNode.contentStart, valueNode.end)),
        );
    }
    return result;
}

function requiredExtension(extensions: Map<string, string>, oid: string, label: string): string {
    const value = extensions.get(oid);
    if (!value) fail(`certificate is missing ${label}`);
    return value;
}

function decodePayload(payloadBase64: string): JsonRecord {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payloadBase64)) {
        fail("provenance payload is not canonical base64");
    }
    const bytes = Buffer.from(payloadBase64, "base64");
    if (bytes.length === 0 || bytes.toString("base64") !== payloadBase64) {
        fail("provenance payload is invalid base64");
    }
    try {
        return record(JSON.parse(bytes.toString("utf8")), "provenance statement");
    } catch (error) {
        throw new Error("[NpmProvenance] provenance payload is not valid JSON", { cause: error });
    }
}

function npmPurl(packageName: string, version: string): string {
    const slash = packageName.indexOf("/");
    if (!packageName.startsWith("@") || slash < 2) fail(`unsupported package name ${packageName}`);
    return `pkg:npm/${encodeURIComponent(packageName.slice(0, slash))}/${encodeURIComponent(packageName.slice(slash + 1))}@${encodeURIComponent(version)}`;
}

function assertProvenanceBundle(
    packageName: string,
    bundleValue: unknown,
    expected: ExpectedProvenance,
): void {
    const wrapper = record(bundleValue, `${packageName} attestation wrapper`);
    exact(wrapper.predicateType, SLSA_PREDICATE, `${packageName} attestation predicate`);
    const bundle = record(wrapper.bundle, `${packageName} Sigstore bundle`);
    exact(bundle.mediaType, SIGSTORE_BUNDLE_MEDIA_TYPE, `${packageName} Sigstore bundle media type`);

    const envelope = record(bundle.dsseEnvelope, `${packageName} DSSE envelope`);
    exact(envelope.payloadType, IN_TOTO_PAYLOAD_TYPE, `${packageName} DSSE payload type`);
    const signatures = array(envelope.signatures, `${packageName} DSSE signatures`);
    if (signatures.length !== 1) fail(`${packageName} provenance must have one DSSE signature`);
    const signature = record(signatures[0], `${packageName} DSSE signature`);
    if (signature.keyid !== "") fail(`${packageName} provenance is not keyless`);
    string(signature.sig, `${packageName} DSSE signature bytes`);

    const statement = decodePayload(string(envelope.payload, `${packageName} DSSE payload`));
    exact(statement._type, IN_TOTO_STATEMENT, `${packageName} statement type`);
    exact(statement.predicateType, SLSA_PREDICATE, `${packageName} statement predicate`);
    const subjects = array(statement.subject, `${packageName} statement subjects`);
    if (subjects.length !== 1) fail(`${packageName} statement must have one subject`);
    const subject = record(subjects[0], `${packageName} statement subject`);
    exact(subject.name, npmPurl(packageName, expected.version), `${packageName} subject name`);
    const subjectDigest = record(subject.digest, `${packageName} subject digest`);
    if (!/^[a-f0-9]{128}$/.test(string(subjectDigest.sha512, `${packageName} SHA-512 digest`))) {
        fail(`${packageName} subject does not contain one SHA-512 digest`);
    }

    const predicate = record(statement.predicate, `${packageName} provenance predicate`);
    const buildDefinition = record(
        predicate.buildDefinition,
        `${packageName} provenance build definition`,
    );
    exact(buildDefinition.buildType, GITHUB_BUILD_TYPE, `${packageName} build type`);
    const externalParameters = record(
        buildDefinition.externalParameters,
        `${packageName} external parameters`,
    );
    exactKeys(externalParameters, ["workflow"], `${packageName} external parameters`);
    const workflow = record(externalParameters.workflow, `${packageName} provenance workflow`);
    exactKeys(workflow, ["path", "ref", "repository"], `${packageName} provenance workflow`);

    const repositoryUrl = `https://github.com/${expected.repository}`;
    exact(workflow.repository, repositoryUrl, `${packageName} workflow repository`);
    exact(workflow.path, expected.workflow, `${packageName} workflow path`);
    exact(workflow.ref, expected.ref, `${packageName} workflow ref`);

    const internalParameters = record(
        buildDefinition.internalParameters,
        `${packageName} internal parameters`,
    );
    exactKeys(internalParameters, ["github"], `${packageName} internal parameters`);
    const github = record(internalParameters.github, `${packageName} GitHub parameters`);
    exactKeys(
        github,
        ["event_name", "repository_id", "repository_owner_id"],
        `${packageName} GitHub parameters`,
    );
    exact(github.event_name, "workflow_dispatch", `${packageName} workflow trigger`);
    const repositoryId = string(github.repository_id, `${packageName} repository ID`);
    const ownerId = string(github.repository_owner_id, `${packageName} repository owner ID`);
    if (!/^\d+$/.test(repositoryId) || !/^\d+$/.test(ownerId)) {
        fail(`${packageName} provenance repository IDs must be numeric`);
    }

    const dependencies = array(
        buildDefinition.resolvedDependencies,
        `${packageName} resolved dependencies`,
    );
    if (dependencies.length !== 1) fail(`${packageName} provenance must resolve one source tree`);
    const source = record(dependencies[0], `${packageName} resolved source`);
    exact(
        source.uri,
        `git+${repositoryUrl}@${expected.ref}`,
        `${packageName} resolved source URI`,
    );
    const sourceDigest = record(source.digest, `${packageName} resolved source digest`);
    exact(sourceDigest.gitCommit, expected.commit, `${packageName} resolved commit`);

    const runDetails = record(predicate.runDetails, `${packageName} run details`);
    const builder = record(runDetails.builder, `${packageName} builder`);
    exact(builder.id, GITHUB_HOSTED_BUILDER, `${packageName} builder identity`);
    const metadata = record(runDetails.metadata, `${packageName} run metadata`);
    const invocationId = string(metadata.invocationId, `${packageName} invocation ID`);
    const invocationPattern = new RegExp(
        `^${repositoryUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/actions/runs/[1-9][0-9]*/attempts/[1-9][0-9]*$`,
    );
    if (!invocationPattern.test(invocationId)) fail(`${packageName} invocation ID is unexpected`);

    const verificationMaterial = record(
        bundle.verificationMaterial,
        `${packageName} verification material`,
    );
    const certificate = record(verificationMaterial.certificate, `${packageName} certificate`);
    const extensions = certificateExtensions(
        string(certificate.rawBytes, `${packageName} certificate bytes`),
    );
    const workflowIdentity = `${repositoryUrl}/${expected.workflow}@${expected.ref}`;
    const owner = expected.repository.split("/")[0];
    if (!owner) fail("repository owner is missing");
    const expectedExtensions = new Map<string, string>([
        [FULCIO_OIDS.issuer, "https://token.actions.githubusercontent.com"],
        [FULCIO_OIDS.buildSignerUri, workflowIdentity],
        [FULCIO_OIDS.buildSignerDigest, expected.commit],
        [FULCIO_OIDS.runnerEnvironment, "github-hosted"],
        [FULCIO_OIDS.sourceRepositoryUri, repositoryUrl],
        [FULCIO_OIDS.sourceRepositoryDigest, expected.commit],
        [FULCIO_OIDS.sourceRepositoryRef, expected.ref],
        [FULCIO_OIDS.sourceRepositoryIdentifier, repositoryId],
        [FULCIO_OIDS.sourceRepositoryOwnerUri, `https://github.com/${owner}`],
        [FULCIO_OIDS.sourceRepositoryOwnerIdentifier, ownerId],
        [FULCIO_OIDS.buildConfigUri, workflowIdentity],
        [FULCIO_OIDS.buildConfigDigest, expected.commit],
        [FULCIO_OIDS.buildTrigger, "workflow_dispatch"],
        [FULCIO_OIDS.runInvocationUri, invocationId],
        [FULCIO_OIDS.sourceRepositoryVisibility, "public"],
        [FULCIO_OIDS.deploymentEnvironment, expected.environment],
        [
            FULCIO_OIDS.tokenSubject,
            `repo:${expected.repository}:environment:${expected.environment}`,
        ],
    ]);
    for (const [oid, expectedValue] of expectedExtensions) {
        exact(
            requiredExtension(extensions, oid, `Fulcio identity extension ${oid}`),
            expectedValue,
            `${packageName} Fulcio identity extension ${oid}`,
        );
    }
}

export function assertVerifiedReleaseProvenance(
    auditReportValue: unknown,
    expected: ExpectedProvenance,
): void {
    if (!/^0\.\d+\.\d+-beta\.\d+$/.test(expected.version)) fail("version must be a 0.x beta");
    if (!/^[a-f0-9]{40}$/.test(expected.commit)) fail("commit must be a full lowercase SHA-1");
    if (expected.ref !== `refs/tags/npm-v${expected.version}`) {
        fail("ref must be the immutable npm tag for the selected version");
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(expected.repository)) {
        fail("repository must be an owner/name pair");
    }
    if (!/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(expected.workflow)) {
        fail("workflow must be a GitHub Actions workflow path");
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(expected.environment)) fail("environment is invalid");

    const auditReport = record(auditReportValue, "npm audit report");
    if (array(auditReport.invalid, "npm audit invalid list").length > 0) {
        fail("npm reported invalid signatures or attestations");
    }
    if (array(auditReport.missing, "npm audit missing list").length > 0) {
        fail("npm reported missing signatures or attestations");
    }
    const verified = array(auditReport.verified, "npm audit verified list");

    for (const packageName of RELEASE_PACKAGES) {
        const matches = verified.filter((entry) => {
            if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
            return entry.name === packageName && entry.version === expected.version;
        });
        if (matches.length !== 1) {
            fail(`${packageName}@${expected.version} is not exactly once in npm's verified list`);
        }
        const entry = record(matches[0], `${packageName} verified entry`);
        const attestations = record(entry.attestations, `${packageName} verified attestations`);
        exact(
            record(attestations.provenance, `${packageName} provenance metadata`).predicateType,
            SLSA_PREDICATE,
            `${packageName} provenance metadata`,
        );
        const provenanceBundles = array(attestations.bundles, `${packageName} verified bundles`).filter(
            (bundle) =>
                typeof bundle === "object" &&
                bundle !== null &&
                !Array.isArray(bundle) &&
                bundle.predicateType === SLSA_PREDICATE,
        );
        if (provenanceBundles.length !== 1) {
            fail(`${packageName} must have exactly one npm-verified SLSA v1 provenance bundle`);
        }
        assertProvenanceBundle(packageName, provenanceBundles[0], expected);
    }
}

function argument(argv: readonly string[], name: string): string {
    const index = argv.indexOf(name);
    const value = index >= 0 ? argv[index + 1] : undefined;
    if (!value) fail(`missing ${name}`);
    return value;
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
    const auditReportPath = resolve(argument(argv, "--audit-report"));
    const reportBytes = readFileSync(auditReportPath);
    if (reportBytes.byteLength > MAX_AUDIT_REPORT_BYTES) fail("npm audit report is too large");
    let auditReport: unknown;
    try {
        auditReport = JSON.parse(reportBytes.toString("utf8"));
    } catch (error) {
        throw new Error("[NpmProvenance] npm audit report is not valid JSON", { cause: error });
    }
    const expected: ExpectedProvenance = {
        version: argument(argv, "--version"),
        repository: argument(argv, "--repository"),
        workflow: argument(argv, "--workflow"),
        ref: argument(argv, "--ref"),
        commit: argument(argv, "--commit"),
        environment: argument(argv, "--environment"),
    };
    assertVerifiedReleaseProvenance(auditReport, expected);
    process.stdout.write(
        `[NpmProvenance] Verified npm signatures and exact GitHub release identity for ${RELEASE_PACKAGES.map((name) => `${name}@${expected.version}`).join(" and ")}.\n`,
    );
}

const entryPoint = process.argv[1];
if (entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)) main();
