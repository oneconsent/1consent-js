declare global {
    interface Window {
        __1consent?: unknown;
    }
}
/**
 * Whether the given service/category (name, tag, or id) has consent.
 * Returns `false` until consent is known — render nothing or a placeholder.
 */
export declare function useConsent(key: string): boolean;
