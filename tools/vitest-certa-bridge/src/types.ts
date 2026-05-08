/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Controls whether the grep pattern includes or excludes matching tests.
 * - `"include"`: only run tests whose names match the pattern
 * - `"exclude"`: skip tests whose names match the pattern
 * @beta
 */
export type GrepMode = "include" | "exclude";

/**
 * A callback function that can be registered on the backend and invoked from browser-side test code.
 * @beta
 */
export type CertaBackendCallback = (...args: any[]) => unknown;

/** @internal */
export interface BridgeRequest {
  name: string;
  args: any[];
}

/** @internal */
export interface BridgeResponse {
  result?: any;
  error?: { message: string; stack?: string };
}

/**
 * Options for the vitest-certa-bridge Vite plugin.
 * @beta
 */
export interface CertaBridgeOptions {
  /** Path to the backend init module (relative to project root). The module performs initialization via side effects when imported. It may optionally export a cleanup function as its default export, which will be called when the dev server closes. */
  backendInitModule?: string;
  /** When set, configures Vite's dev-server proxy to forward `/ipc` WebSocket traffic to `ws://localhost:<backendPort>`. Required for tests that use `LocalhostIpcApp`. */
  backendPort?: number;
  /**
   * List of workspace package names (e.g. `["@itwin/core-frontend", "@itwin/core-common"]`).
   * When provided, the plugin auto-configures:
   * - `resolve.dedupe` to prevent duplicate instances (singleton hazard)
   * - `optimizeDeps.exclude` to keep Vite from pre-bundling workspace packages
   */
  workspacePackages?: string[];
}
