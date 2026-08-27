/**
 * @1consent/react (1CO-150)
 *
 * Framework-agnostic React integration for 1Consent. Works in any React 19+
 * context: Next.js (App or Pages Router), Vite SPAs, Remix/React Router,
 * Astro islands. No Next.js-specific APIs are used.
 */
export type { OneConsentProps } from "./one-consent.js";
export { OneConsent } from "./one-consent.js";
export type { OneConsentEnvironment, OneConsentProviderProps } from "./provider.js";
export { OneConsentProvider } from "./provider.js";
export type { OneConsentCategoryMap, OneConsentServiceMap, RegisteredCategoryName, RegisteredServiceName, } from "./types.js";
export { useConsent } from "./use-consent.js";
