/**
 * React Server Components entrypoint.
 *
 * `OneConsent` and `OneConsentProvider` only emit static markup and are safe
 * to render on the server. `useConsent` is intentionally absent because it is
 * a client hook; keeping it out of this conditional export prevents its
 * React state/effect imports from contaminating an RSC dependency graph.
 */
export type { OneConsentProps } from "./one-consent.js";
export { OneConsent } from "./one-consent.js";
export type { OneConsentEnvironment, OneConsentProviderProps } from "./provider.js";
export { OneConsentProvider } from "./provider.js";
export type { OneConsentCategoryMap, OneConsentServiceMap, RegisteredCategoryName, RegisteredServiceName, } from "./types.js";
