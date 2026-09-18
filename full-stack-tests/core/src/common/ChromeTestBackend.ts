/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {} from "vitest";

/** @internal */
export const chromeBackendIdentityHeader = "x-core-test-backend-id";
/** @internal */
export const chromeBackendStartupTimeout = 30000;

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
