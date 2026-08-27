/**
 * Next.js server-only helpers.
 *
 * Reading a cookie in a Server Component makes that route dynamic. Prefer
 * passing `request.cookies.get(COOKIE_NAME)?.value` from a Proxy or Route
 * Handler when static rendering must be preserved.
 */
export { COOKIE_NAME, parseConsentCookie, readConsentCookie } from "./cookie.js";
export type { ConsentCookieExpectation, ConsentCookieState, ConsentCookieValue, ConsentDecision, } from "./types.js";
