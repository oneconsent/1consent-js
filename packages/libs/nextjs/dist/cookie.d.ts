/**
 * @1consent/nextjs — `1consent` cookie helpers (1CO-148)
 *
 * The cookie is scoped to the complete legal runtime identity (application,
 * resolved framework/type, deployment machine, primary language, structural
 * version, and consent epoch) and expires at the original decision boundary.
 * It is a server-visible hint for optional tiers such as middleware banner
 * suppression. It is NOT on the script-injection critical path and never
 * replaces authoritative client-side validation.
 *
 * Note: reading cookies in a Server Component opts the route into dynamic
 * rendering. Next.js 16 proxy callers can pass `request.cookies.get(...)`
 * into these pure helpers without importing a server runtime here.
 */
import type { ConsentCookieExpectation, ConsentCookieState, ConsentCookieValue } from "./types.js";
/** Canonical 1Consent cookie name. */
export declare const COOKIE_NAME = "1consent";
/**
 * Parse the `1consent` cookie value into a coarse `ConsentCookieState` only
 * when it matches the current request's complete trusted legal/config scope.
 *
 * @returns `'none'` if absent or invalid, otherwise the decision
 */
export declare function parseConsentCookie(value: string | undefined | null, expected: ConsentCookieExpectation, now?: number): ConsentCookieState;
/**
 * Read the canonical cookie only when its scope and absolute legal expiry are
 * valid for this request. Raw syntactic parsing stays inside the bundled
 * runtime contract so Next.js callers cannot accidentally skip validation.
 */
export declare function readConsentCookie(value: string | undefined | null, expected: ConsentCookieExpectation, now?: number): ConsentCookieValue | null;
