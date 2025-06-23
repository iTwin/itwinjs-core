/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */

import { expect } from "chai";
import { RpcManager } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { TestIModelConnection } from "../IModelSetupUtils.js";
import { initialize, terminate } from "../IntegrationTests.js";

describe("PresentationRpcInterface", () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = TestIModelConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("getElementProperties", () => {
    let rpcInterface: PresentationRpcInterface;

    beforeEach(() => {
      rpcInterface = RpcManager.getClientForInterface(PresentationRpcInterface);
    });

    it("returns properties for requested element", async () => {
      const result = await rpcInterface.getElementProperties(imodel.getRpcProps(), {
        elementId: "0x1",
      });
      expect(result).to.matchSnapshot();
    });
  });
});
