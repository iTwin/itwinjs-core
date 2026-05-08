/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, assert, beforeAll, describe, it } from "vitest";
import { CurrentImdlVersion, EmptyLocalization, IModelTileRpcInterface } from "@itwin/core-common";
import { ProcessDetector } from "@itwin/core-bentley";

describe("iMdl format version", () => {
  beforeAll(async () => {
    if (ProcessDetector.isElectronAppFrontend) {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { ElectronApp } = await import("@itwin/core-electron/lib/cjs/ElectronFrontend.js");
      await ElectronApp.startup({ iModelApp: { localization: new EmptyLocalization(), rpcInterfaces: [IModelTileRpcInterface] }});
    }
  });

  afterAll(async () => {
    if (ProcessDetector.isElectronAppFrontend) {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { ElectronApp } = await import("@itwin/core-electron/lib/cjs/ElectronFrontend.js");
      await ElectronApp.shutdown();
    }
  });

  it("should match between frontend and backend", async () => {
    const intfc = IModelTileRpcInterface.getClient();
    const info = await intfc.queryVersionInfo();
    assert(info.formatVersion === CurrentImdlVersion.Combined, "CurrentImdlVersion must match IModelTileIO::Version::Current()");
  });
});
