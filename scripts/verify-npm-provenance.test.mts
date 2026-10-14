import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
    assertVerifiedReleaseProvenance,
    certificateExtensions,
    type ExpectedProvenance,
} from "./verify-npm-provenance.mts";

const expected: ExpectedProvenance = {
    version: "0.1.0-beta.0",
    repository: "oneconsent/1consent-js",
    workflow: ".github/workflows/publish-npm.yml",
    ref: "refs/tags/npm-v0.1.0-beta.0",
    commit: "a".repeat(40),
    environment: "npm-beta",
};

function derLength(length: number): Buffer {
    if (length < 128) return Buffer.from([length]);
    const bytes: number[] = [];
    let remaining = length;
    while (remaining > 0) {
        bytes.unshift(remaining & 0xff);
        remaining = Math.floor(remaining / 256);
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, ...contents: Buffer[]): Buffer {
    const content = Buffer.concat(contents);
    return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function oid(value: string): Buffer {
    const arcs = value.split(".").map(Number);
    const encoded: number[] = [arcs[0]! * 40 + arcs[1]!];
    for (const arc of arcs.slice(2)) {
        const component = [arc & 0x7f];
        let remaining = Math.floor(arc / 128);
        while (remaining > 0) {
            component.unshift(0x80 | (remaining & 0x7f));
            remaining = Math.floor(remaining / 128);
        }
        encoded.push(...component);
    }
    return der(0x06, Buffer.from(encoded));
}

function certificate(extensionValues: ReadonlyMap<string, string>): string {
    const extensions = [...extensionValues].map(([extensionOid, value]) =>
        der(0x30, oid(extensionOid), der(0x04, der(0x0c, Buffer.from(value)))),
    );
    const tbsCertificate = der(0x30, der(0xa3, der(0x30, ...extensions)));
    return der(0x30, tbsCertificate, der(0x30), der(0x03, Buffer.from([0]))).toString("base64");
}

function extensionValues(options: ExpectedProvenance): Map<string, string> {
    const repositoryUrl = `https://github.com/${options.repository}`;
    const workflowIdentity = `${repositoryUrl}/${options.workflow}@${options.ref}`;
    const invocation = `${repositoryUrl}/actions/runs/123/attempts/1`;
    return new Map([
        ["1.3.6.1.4.1.57264.1.8", "https://token.actions.githubusercontent.com"],
        ["1.3.6.1.4.1.57264.1.9", workflowIdentity],
        ["1.3.6.1.4.1.57264.1.10", options.commit],
        ["1.3.6.1.4.1.57264.1.11", "github-hosted"],
        ["1.3.6.1.4.1.57264.1.12", repositoryUrl],
        ["1.3.6.1.4.1.57264.1.13", options.commit],
        ["1.3.6.1.4.1.57264.1.14", options.ref],
        ["1.3.6.1.4.1.57264.1.15", "1234"],
        ["1.3.6.1.4.1.57264.1.16", "https://github.com/oneconsent"],
        ["1.3.6.1.4.1.57264.1.17", "5678"],
        ["1.3.6.1.4.1.57264.1.18", workflowIdentity],
        ["1.3.6.1.4.1.57264.1.19", options.commit],
        ["1.3.6.1.4.1.57264.1.20", "workflow_dispatch"],
        ["1.3.6.1.4.1.57264.1.21", invocation],
        ["1.3.6.1.4.1.57264.1.22", "public"],
        ["1.3.6.1.4.1.57264.1.23", options.environment],
        [
            "1.3.6.1.4.1.57264.1.24",
            `repo:${options.repository.split("/")[0]}@5678/${options.repository.split("/")[1]}@1234:environment:${options.environment}`,
        ],
    ]);
}

function auditReport(options: ExpectedProvenance = expected) {
    const repositoryUrl = `https://github.com/${options.repository}`;
    const invocation = `${repositoryUrl}/actions/runs/123/attempts/1`;
    const invalid: unknown[] = [];
    return {
        invalid,
        missing: [],
        verified: ["@1consent/react", "@1consent/nextjs", "@1consent/cli"].map((name) => {
            const slash = name.indexOf("/");
            const purl = `pkg:npm/${encodeURIComponent(name.slice(0, slash))}/${encodeURIComponent(name.slice(slash + 1))}@${options.version}`;
            const statement = {
                _type: "https://in-toto.io/Statement/v1",
                subject: [{ name: purl, digest: { sha512: "b".repeat(128) } }],
                predicateType: "https://slsa.dev/provenance/v1",
                predicate: {
                    buildDefinition: {
                        buildType:
                            "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
                        externalParameters: {
                            workflow: {
                                ref: options.ref,
                                repository: repositoryUrl,
                                path: options.workflow,
                            },
                        },
                        internalParameters: {
                            github: {
                                event_name: "workflow_dispatch",
                                repository_id: "1234",
                                repository_owner_id: "5678",
                            },
                        },
                        resolvedDependencies: [
                            {
                                uri: `git+${repositoryUrl}@${options.ref}`,
                                digest: { gitCommit: options.commit },
                            },
                        ],
                    },
                    runDetails: {
                        builder: { id: "https://github.com/actions/runner/github-hosted" },
                        metadata: { invocationId: invocation },
                    },
                },
            };
            return {
                name,
                version: options.version,
                attestations: {
                    provenance: { predicateType: "https://slsa.dev/provenance/v1" },
                },
                attestationBundles: [
                    {
                        predicateType: "https://slsa.dev/provenance/v1",
                        bundle: {
                            mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
                            verificationMaterial: {
                                certificate: { rawBytes: certificate(extensionValues(options)) },
                            },
                            dsseEnvelope: {
                                payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
                                payloadType: "application/vnd.in-toto+json",
                                signatures: [{ sig: "signed", keyid: "" }],
                            },
                        },
                    },
                ],
            };
        }),
    };
}

test("accepts only npm-verified bundles bound to the selected tagged release", () => {
    assert.doesNotThrow(() => assertVerifiedReleaseProvenance(auditReport(), expected));
});

test("extracts Fulcio's DER-encoded identity extensions", () => {
    assert.deepEqual(
        certificateExtensions(certificate(extensionValues(expected))),
        extensionValues(expected),
    );
});

test("rejects a valid-looking statement from another repository, ref, or commit", () => {
    for (const changed of [
        { ...expected, repository: "attacker/1consent-js" },
        { ...expected, ref: "refs/tags/npm-v0.1.0-beta.1" },
        { ...expected, commit: "c".repeat(40) },
    ]) {
        assert.throws(
            () => assertVerifiedReleaseProvenance(auditReport(changed), expected),
            /does not match the selected release/,
        );
    }
});

test("rejects a provenance certificate from another workflow environment", () => {
    const report = auditReport();
    report.verified[0]!.attestationBundles[0]!.bundle.verificationMaterial = {
        certificate: {
            rawBytes: certificate(
                extensionValues({ ...expected, environment: "unprotected-release" }),
            ),
        },
    };
    assert.throws(
        () => assertVerifiedReleaseProvenance(report, expected),
        /Fulcio identity extension/,
    );
});

test("rejects missing, duplicate, or non-keyless verified provenance", () => {
    const missing = auditReport();
    missing.verified.pop();
    assert.throws(
        () => assertVerifiedReleaseProvenance(missing, expected),
        /is not exactly once in npm's verified list/,
    );

    const duplicate = auditReport();
    duplicate.verified.push(duplicate.verified[0]!);
    assert.throws(
        () => assertVerifiedReleaseProvenance(duplicate, expected),
        /is not exactly once in npm's verified list/,
    );

    const tokenSigned = auditReport();
    tokenSigned.verified[0]!.attestationBundles[0]!.bundle.dsseEnvelope.signatures = [
        { sig: "signed", keyid: "unexpected" },
    ];
    assert.throws(() => assertVerifiedReleaseProvenance(tokenSigned, expected), /not keyless/);
});

test("rejects malformed certificate encoding and unverified audit results", () => {
    assert.throws(() => certificateExtensions("not base64"), /canonical base64/);

    const invalid = auditReport();
    invalid.invalid.push({ name: "@1consent/react" });
    assert.throws(
        () => assertVerifiedReleaseProvenance(invalid, expected),
        /invalid signatures or attestations/,
    );
});

test("rejects missing or duplicate npm-verified attestation bundles", () => {
    const missing = auditReport();
    missing.verified[0]!.attestationBundles.length = 0;
    assert.throws(
        () => assertVerifiedReleaseProvenance(missing, expected),
        /exactly one npm-verified/,
    );
    const duplicate = auditReport();
    duplicate.verified[0]!.attestationBundles.push(duplicate.verified[0]!.attestationBundles[0]!);
    assert.throws(
        () => assertVerifiedReleaseProvenance(duplicate, expected),
        /exactly one npm-verified/,
    );
});

test("rejects legacy name-only or inconsistent immutable GitHub subjects", () => {
    for (const subject of [
        `repo:${expected.repository}:environment:${expected.environment}`,
        `repo:oneconsent@9999/1consent-js@1234:environment:${expected.environment}`,
        `repo:oneconsent@5678/1consent-js@9999:environment:${expected.environment}`,
    ]) {
        const report = auditReport();
        const extensions = extensionValues(expected);
        extensions.set("1.3.6.1.4.1.57264.1.24", subject);
        report.verified[0]!
            .attestationBundles[0]!.bundle.verificationMaterial.certificate.rawBytes =
            certificate(extensions);
        assert.throws(
            () => assertVerifiedReleaseProvenance(report, expected),
            /Fulcio identity extension/,
        );
    }
});

test("accepts the public beta.1 report from npm 12.2 signature verification", () => {
    const report: unknown = JSON.parse(
        readFileSync(new URL("./fixtures/npm-audit-beta1.json", import.meta.url), "utf8"),
    );
    assert.doesNotThrow(() =>
        assertVerifiedReleaseProvenance(report, {
            ...expected,
            version: "0.1.0-beta.1",
            ref: "refs/tags/npm-v0.1.0-beta.1",
            commit: "79a694cae07befa6559ae1495cd84bd038e6f6ad",
        }),
    );
});
