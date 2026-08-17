/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { app } from "electron";
import { registerBackendCallback } from "../../callbacks/backend.js";

registerBackendCallback("provider:add", (a: number, b: number) => a + b);
registerBackendCallback("provider:asyncEcho", async (value: string) => ({ echoed: value }));
registerBackendCallback("provider:failure", () => {
  throw new Error("intentional callback failure");
});
registerBackendCallback("provider:mainProcessInfo", () => ({
  appReady: app.isReady(),
  electronVersion: process.versions.electron,
  processType: process.type,
}));
