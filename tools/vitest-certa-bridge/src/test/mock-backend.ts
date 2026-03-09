/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "../callbackRegistry";

registerBackendCallback("echo", (msg: string) => msg);
registerBackendCallback("add", (a: number, b: number) => a + b);
registerBackendCallback("getEnv", () => JSON.stringify({ NODE_ENV: "test" }));
registerBackendCallback("throwError", () => { throw new Error("intentional test error"); });

// Return a cleanup function (matches certa's pattern)
module.exports = async () => {
  // cleanup would go here
};
