/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { CurrentImdlVersion, EmptyLocalization, IModelTileRpcInterface } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { assert } from "chai";

describe("iMdl format version", () => {
  before(async () => {
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.startup({ iModelApp: { localization: new EmptyLocalization(), rpcInterfaces: [IModelTileRpcInterface] } });
  });

  after(async () => {
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.shutdown();
  });

  it("should match between frontend and backend", async () => {
    const intfc = IModelTileRpcInterface.getClient();
    const info = await intfc.queryVersionInfo();
    assert(info.formatVersion === CurrentImdlVersion.Combined, "CurrentImdlVersion must match IModelTileIO::Version::Current()");
  });
});
