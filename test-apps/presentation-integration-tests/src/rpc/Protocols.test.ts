/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { BentleyCloudRpcManager, RpcManager, IModelToken, WebAppRpcRequest } from "@bentley/imodeljs-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";

describe("PresentationRpcInterface usage with RPC protocols", () => {

  describe("BentleyCloudRpcProtocol", () => {

    let client: PresentationRpcInterface;
    let token: IModelToken;

    before(() => {
      const params = { info: { title: "Test", version: "1.0" } };
      BentleyCloudRpcManager.initializeClient(params, [PresentationRpcInterface]);
      client = RpcManager.getClientForInterface(PresentationRpcInterface);
      token = new IModelToken(faker.random.uuid(), faker.random.uuid(), faker.random.uuid());
    });

    it("creates valid request for getNodesCount", () => {
      const request = () => {
        const params = [{ imodel: token, knownBackendIds: [], rulesetId: faker.random.word() }];
        const r = new WebAppRpcRequest(client, "getNodesCount", params);
        (r as any).dispose(); // no way to properly destroy the created request...
      };
      expect(request).to.not.throw();
    });

  });

});
