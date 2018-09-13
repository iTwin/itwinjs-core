/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { BentleyCloudRpcManager, RpcManager, IModelToken } from "@bentley/imodeljs-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";
import { WebAppRpcRequest } from "@bentley/imodeljs-common/lib/rpc/web/WebAppRpcRequest";

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

    it("creates valid request for getRootNodesCount", () => {
      const request = () => {
        const params = [{ imodel: token, knownBackendIds: [], rulesetId: faker.random.word() }];
        const r = new WebAppRpcRequest(client, "getRootNodesCount", params);
        (r as any).finalize(); // no way to properly destroy the created request...
      };
      expect(request).to.not.throw();
    });

  });

});
