/**
 * @1consent/react — <OneConsent> (1CO-150)
 *
 * Wraps arbitrary third-party markup — a script, pixel, iframe, embed, or any
 * plain HTML — and withholds it until consent:
 *
 * ```tsx
 * <OneConsent service="Google Analytics">
 *     <script src="https://www.googletagmanager.com/gtag/js?id=G-XXX" />
 * </OneConsent>
 * ```
 *
 * Rendering strategy (identical on server and client — hydration-safe):
 * a wrapper `<div style="display:contents">` whose innerHTML holds the inert
 * `<template data-1c-service="…">` plus a one-line inline call into the
 * React fastpath. React never reconciles inside `dangerouslySetInnerHTML`
 * content, so the engine can insert promoted nodes there without hydration
 * mismatches. On the server-rendered page the inline call executes at HTML
 * parse time when the complete gate is encountered; on SPA mounts innerHTML
 * scripts never run and the engine's MutationObserver promotes the template.
 * Parsing may continue after the browser's first paint. Neither streamed
 * gate arrival nor an external download has a universal before-paint deadline.
 *
 * Head placement caveat: the wrapper `<div>` is not valid inside `<head>` —
 * the HTML parser silently ends `<head>` at the div and reparents it (and
 * everything after it) into `<body>`, which triggers a dev-mode hydration
 * mismatch. Use body placement with the bootstrap before governed resources.
 * Earlier gate placement reduces activation latency without promising a
 * first-paint deadline.
 */
import type { ReactNode } from "react";
import type { RegisteredCategoryName, RegisteredServiceName } from "./types.js";
interface BaseProps {
    /** CSP nonce for the inline parse-time resolve call. */
    nonce?: string;
    /**
     * Promote this block at most once per page load (1CO-169).
     *
     * By default a remounted `<OneConsent>` (SPA navigation, conditional
     * render) re-promotes: correct for visual content and UI-rendering
     * scripts, whose promoted DOM was destroyed with the old mount. Opt in
     * with `once` for global side-effect scripts (analytics loaders, pixels)
     * that must not re-execute on remount. Blocks with the same gating key
     * and identical children share a dedupe key — intentionally: "execute
     * once" extends to duplicate copies of the same snippet.
     */
    once?: boolean;
    children?: ReactNode;
}
export type OneConsentProps = BaseProps & ({
    /** Service name, tag, or id as configured in the dashboard. */
    service: RegisteredServiceName;
    category?: never;
} | {
    /** Category name or id as configured in the dashboard. */
    category: RegisteredCategoryName;
    service?: never;
});
export declare function OneConsent(props: OneConsentProps): import("react").JSX.Element;
export {};
