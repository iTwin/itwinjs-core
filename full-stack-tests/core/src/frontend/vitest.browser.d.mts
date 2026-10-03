/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {} from "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    reportCoreChromeBackendFailure(message: string): Promise<void>;
  }
}
