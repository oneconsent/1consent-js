/**
 * @1consent/react — client entry provider (1CO-1601)
 *
 * The `react-server` entry exports the hook-free markup provider. This client
 * entry keeps that markup whenever the scripts come from server HTML (server
 * rendering and hydration) and, on a client-only mount, inserts real script
 * elements instead: React never executes a `<script>` it renders on the client.
 */
import { type ReactNode } from "react";
import { type OneConsentProviderProps } from "./provider.js";
export declare function OneConsentProvider(props: OneConsentProviderProps): ReactNode;
