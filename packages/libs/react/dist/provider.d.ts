/**
 * @1consent/react — Provider (1CO-150)
 *
 * Server-renderable (RSC-compatible, no client APIs at render time). Renders:
 * 1. the synchronous CMP embed config (autoblocker + live framework/epoch),
 * 2. the inline React accelerator with framework-associated build stamps,
 * 3. children.
 *
 * The server never reads consent: output is byte-identical for every visitor,
 * so static rendering, ISR, and CDN caching are fully preserved.
 */
import type { ReactNode } from "react";
export type OneConsentEnvironment = "local" | "develop" | "production";
export interface OneConsentProviderProps {
    /**
     * 1Consent application short id. Falls back to the
     * `NEXT_PUBLIC_1CONSENT_APP_ID` environment variable where available.
     */
    appId?: string;
    /**
     * Framework-associated structural versions from `1c typegen`. The hosted
     * config resolves the visitor's framework synchronously, then the inline
     * accelerator selects only that framework's build stamp. Without the map
     * the fast path stays cold and the CMP resolves templates after it loads.
     */
    fastPathVersions?: Readonly<Record<string, string>>;
    /** CSP nonce forwarded to the inline engine script. */
    nonce?: string;
    /** Override the CMP embed script URL (derived from `appId` by default). */
    cmpSrc?: string;
    /**
     * 1Consent environment the CMP embed is loaded from (default:
     * `"production"`). Only 1Consent-internal setups need `"develop"`/`"local"`.
     */
    environment?: OneConsentEnvironment;
    /**
     * Load the CMP embed script (default true). Set to false when the embed
     * is added by other means (e.g. GTM).
     */
    loadCmp?: boolean;
    children?: ReactNode;
}
export interface ProviderSources {
    /** Resolved app id ("" when unresolved: the fast path stays cold). */
    appId: string;
    /** CMP embed URL, or undefined when `loadCmp` is false. */
    cmpSrc: string | undefined;
    /** JSON of the framework-associated build stamps. */
    frameworkVersions: string;
}
/** Resolve what the provider loads; throws when the CMP embed has no app id. */
export declare function resolveProviderSources({ appId, fastPathVersions, cmpSrc, environment, loadCmp, }: OneConsentProviderProps): ProviderSources;
/**
 * Server-rendered provider markup. The browser runs these scripts only when
 * they arrive in the HTML; React never executes a `<script>` it renders on the
 * client, so the client entry (`client-provider.tsx`) inserts them itself on a
 * client-only mount.
 */
export declare function OneConsentProvider(props: OneConsentProviderProps): import("react").JSX.Element;
