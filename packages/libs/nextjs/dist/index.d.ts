/**
 * @1consent/nextjs (1CO-150)
 *
 * Thin Next.js wrapper around `@1consent/react`. The component API is pure
 * React (no Next-specific APIs — the server never reads consent, so pages
 * stay fully static/ISR-cacheable). Import optional cookie helpers from the
 * explicit `@1consent/nextjs/server` entrypoint.
 */
export * from "@1consent/react";
