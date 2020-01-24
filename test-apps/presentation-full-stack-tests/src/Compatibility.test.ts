/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { PresentationRpcInterface, Ruleset, PresentationStatus, RulesetManagerState, PresentationRpcRequestOptions } from "@bentley/presentation-common";
import { initialize, terminate } from "./IntegrationTests";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { RpcManager } from "@bentley/imodeljs-common";

describe("Compatibility", () => {

  describe("frontend expects stateful backend", () => {

    let imodel: IModelConnection;
    let ruleset: Ruleset;
    let client: PresentationRpcInterface;
    let defaultRpcOptions: PresentationRpcRequestOptions;

    before(async () => {
      await initialize();
      client = RpcManager.getClientForInterface(PresentationRpcInterface);
      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await IModelConnection.openSnapshot(testIModelName);
      ruleset = require("../test-rulesets/Rulesets/default");
      defaultRpcOptions = {
        clientId: faker.random.uuid(),
        clientStateId: faker.random.uuid(),
      };
    });

    after(async () => {
      await imodel.closeSnapshot();
      terminate();
    });

    it("syncs state with backend and gets data", async () => {
      let result = await client.getNodesCount(imodel.iModelToken.toJSON(), { ...defaultRpcOptions, rulesetId: ruleset.id });
      expect(result).to.not.be.undefined;
      expect(result.statusCode).to.be.eq(PresentationStatus.BackendOutOfSync);

      const rulesets: RulesetManagerState = [ruleset];
      result = await client.syncClientState(imodel.iModelToken.toJSON(), { ...defaultRpcOptions, state: { rulesets } });
      expect(result).to.not.be.undefined;
      expect(result.statusCode).to.be.eq(PresentationStatus.Success);

      result = await client.getNodesCount(imodel.iModelToken.toJSON(), { ...defaultRpcOptions, rulesetId: ruleset.id });
      expect(result).to.not.be.undefined;
      expect(result.statusCode).to.be.eq(PresentationStatus.Success);
      expect(result.result).to.be.eq(1);
    });

  });

});
