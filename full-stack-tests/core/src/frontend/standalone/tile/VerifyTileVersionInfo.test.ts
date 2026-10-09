/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { CurrentImdlVersion, EmptyLocalization, IModelTileRpcInterface } from "@itwin/core-common";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronApp } from "@itwin/core-electron/renderer";

describe("iMdl format version", () => {
  beforeAll(async () => {
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.startup({ iModelApp: { localization: new EmptyLocalization(), rpcInterfaces: [IModelTileRpcInterface] }});
  });

  afterAll(async () => {
    if (ProcessDetector.isElectronAppFrontend)
      await ElectronApp.shutdown();
  });

  it("should match between frontend and backend", async () => {
    const intfc = IModelTileRpcInterface.getClient();
    const info = await intfc.queryVersionInfo();
    expect(info.formatVersion === CurrentImdlVersion.Combined).toBeTruthy();
  });
});
