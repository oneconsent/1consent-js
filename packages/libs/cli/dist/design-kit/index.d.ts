import type { Plugin } from "vite";
export interface DesignKitOptions {
    /**
     * Root directory of the workspace (where designs/ and themes/ live).
     * Defaults to the Vite project root.
     */
    root?: string;
}
/**
 * Customer-facing Vite plugin bundled into `@1consent/cli/design-kit`.
 */
export declare function designKit(options?: DesignKitOptions): Plugin;
