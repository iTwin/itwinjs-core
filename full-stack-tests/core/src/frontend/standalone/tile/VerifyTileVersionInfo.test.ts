/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { CurrentImdlVersion, EmptyLocalization, IModelTileRpcInterface } from "@itwin/core-common";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";

describe("iMdl format version", () => {
  before(async () => {
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.startup({ iModelApp: { localization: new EmptyLocalization(), rpcInterfaces: [IModelTileRpcInterface] }});
  });

  after(async () => {
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.shutdown();
  });

  it("should match between frontend and backend", async () => {
    const intfc = IModelTileRpcInterface.getClient();
    const info = await intfc.queryVersionInfo();
    assert(info.formatVersion === CurrentImdlVersion.Combined.valueOf(), "CurrentImdlVersion must match IModelTileIO::Version::Current()");
  });
});
