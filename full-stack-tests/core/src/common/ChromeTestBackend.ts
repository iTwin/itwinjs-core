/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {} from "vitest";

/** @internal */
export const chromeBackendIdentityHeader = "x-core-test-backend-id";
/** @internal */
export const chromeBackendStartupTimeout = 30000;
/** What the backend's test IPC `ping` returns, and what the Chrome preflight expects. @internal */
export const fullStackTestPing = { commandId: "full-stack-tests", version: "1.0.0" } as const;

/** @internal */
export interface ChromeBackendReadyMessage {
  type: "core-chrome-ready";
  backendId: string;
  pid: number;
}

declare module "vitest" {
  interface ProvidedContext {
    coreChromeBackendId: string;
  }
}
