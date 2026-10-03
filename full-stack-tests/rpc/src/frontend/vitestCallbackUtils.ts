/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { invokeBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/browser";

export async function executeBackendCallback(name: string, ...args: any[]): Promise<any> {
  return invokeBackendCallback(name, ...args);
}
