# @1consent/nextjs

Next.js 16 adapter for the 1Consent React integration. It exposes the same
components and hook as `@1consent/react`, preserves React Server Component
boundaries for the App Router, and adds an isolated server entrypoint for
validated consent-cookie hints.

## Distribution status

The first supported release line is `0.1.0-beta.*` on npm's `beta` dist-tag.
The package is publishable only from the protected, provenance-backed release
workflow after its public source repository and npm trusted publisher are
configured. Until registry verification passes, use the workspace package
rather than advertising a public install command.

After verification, beta consumers install an explicit prerelease channel:

```sh
npm install @1consent/nextjs@beta
```

## App Router

Server Components can render the provider and consent gates directly:

```tsx
import { OneConsent, OneConsentProvider } from "@1consent/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <OneConsentProvider appId="YOUR_APP_ID">{children}</OneConsentProvider>
            </body>
        </html>
    );
}
```

`useConsent` is a client hook and must be imported from a Client Component:

```tsx
"use client";

import { useConsent } from "@1consent/nextjs";

export function AnalyticsStatus() {
    const granted = useConsent("Google Analytics");
    return <span>{granted ? "enabled" : "disabled"}</span>;
}
```

## Server helpers

The explicit server entrypoint validates the complete cookie scope and legal
expiry before returning a decision:

```ts
import { COOKIE_NAME, readConsentCookie } from "@1consent/nextjs/server";
```

Reading `cookies()` inside a Server Component makes the route dynamic. For
static pages, use the helper from a Proxy or Route Handler and pass the cookie
value explicitly. A cookie result is only a server-side hint; it does not
replace authoritative client-side consent enforcement.
