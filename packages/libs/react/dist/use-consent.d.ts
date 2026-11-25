declare global {
    interface Window {
        __1consent?: unknown;
    }
}
/**
 * Whether the given service/category (name, tag, or id) has consent.
 * Returns `false` until consent is known — render nothing or a placeholder.
 *
 * Consent is known once the CMP has loaded, however the page loads it. With
 * `OneConsentProvider` and generated `fastPathVersions` a stored choice is
 * also known before that, from the first client render.
 */
export declare function useConsent(key: string): boolean;
