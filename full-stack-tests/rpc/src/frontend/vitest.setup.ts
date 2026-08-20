/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { setupFrontend, teardownFrontend } from "./testSetup";

beforeAll(async () => {
  await setupFrontend(async () => {
    await ElectronApp.startup({
      iModelApp: {
        rpcInterfaces,
        localization: new EmptyLocalization(),
      },
    });
  });
});
afterAll(async () => {
  await teardownFrontend();
});
