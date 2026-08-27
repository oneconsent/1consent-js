/**
 * @1consent/nextjs — Shared Types
 */
export type ConsentDecision = "A" | "D" | "G";
export interface ConsentCookieExpectation {
    appId: string;
    frameworkId: string;
    frameworkType: "gdpr" | "tcf" | "us";
    machine: "P" | "S" | "D";
    primaryLanguage: string;
    structuralVersion: string;
    consentEpoch: number;
}
export interface ConsentCookieValue extends ConsentCookieExpectation {
    decision: ConsentDecision;
    /** Absolute epoch-ms legal expiry derived from the original decision timestamp. */
    expiresAt: number;
}
/**
 * Consent state as read from the `1consent` cookie on the server.
 * - `'none'` = no cookie present (first visit) or unparseable value
 * - `ConsentDecision` = A (all accepted), D (all denied), G (granular)
 */
export type ConsentCookieState = ConsentDecision | "none";
