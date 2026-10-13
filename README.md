# 1Consent for React and Next.js

Add the 1Consent CMP to your application, keep third-party scripts and embeds inactive until
consent, and react to consent changes in your UI.

> **Preview:** `0.1.0-beta.0` is prepared but has not yet been published. The installation
> commands below apply after the first verified npm release.

## Packages

| Package | Use it for | Requirements |
| --- | --- | --- |
| [`@1consent/nextjs`](packages/libs/nextjs/README.md) | Next.js App Router integration and server cookie helpers | Next.js 16, React and React DOM 19+ |
| [`@1consent/react`](packages/libs/react/README.md) | Consent components and hooks in React applications | React 19+ |
| [`@1consent/cli`](packages/libs/cli/README.md) | Typed consent names and design synchronization | Node.js 22+; Vite 8 for Design Kit authoring |

## Install

For a Next.js 16 application:

```sh
npm install @1consent/nextjs@beta
```

For other React 19+ applications:

```sh
npm install @1consent/react@beta
```

The optional CLI generates service and category types from your published CMP configuration:

```sh
npx @1consent/cli@beta typegen --app YOUR_APP_ID
```

These packages are prerelease software. Use the explicit `beta` channel during the preview.

## Add consent gating

Create an application in 1Consent and publish its CMP configuration. Use its application ID
and the service names configured for it. The provider loads your hosted CMP.

In a Next.js App Router application, add the provider to `app/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { OneConsent, OneConsentProvider } from "@1consent/nextjs";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <OneConsentProvider appId="YOUR_APP_ID">
                    {children}
                    <OneConsent service="YouTube">
                        <iframe
                            title="Video"
                            src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
                            allowFullScreen
                        />
                    </OneConsent>
                </OneConsentProvider>
            </body>
        </html>
    );
}
```

Replace `YOUR_APP_ID` and `VIDEO_ID`, and ensure `YouTube` matches a service in your configuration.
Use plain HTML elements such as scripts, iframes, and images inside `OneConsent`, and place the
gate in the page body. For other React applications, import these components from
`@1consent/react` and mount the provider at your application root.

## Read consent in your UI

Use the hook in a Client Component:

```tsx
"use client";

import { useConsent } from "@1consent/nextjs";

export function VideoConsentStatus() {
    const allowed = useConsent("YouTube");
    return <span>{allowed ? "Video enabled" : "Video blocked"}</span>;
}
```

The hook returns `false` while consent is unknown and updates when the CMP reports a decision.
If your site uses a CSP nonce, pass it to both the provider and the consent gates.

## Guides and support

- [Next.js integration and server helpers](packages/libs/nextjs/README.md)
- [React components and hooks](packages/libs/react/README.md)
- [CLI and Design Kit](packages/libs/cli/README.md)
- [Report a bug](https://github.com/oneconsent/1consent-js/issues)
- [Report a security vulnerability](SECURITY.md)

This repository contains the reviewed npm distribution artifacts. Maintainers can find the
verification commands, repository boundary, and publishing policy in [the release guide](RELEASING.md).
