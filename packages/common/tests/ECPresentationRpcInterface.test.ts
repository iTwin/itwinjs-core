/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet } from "@src/index";
import { ECPresentationRpcInterface } from "@src/index";
import { createRandomDescriptor } from "@helpers/random/Content";
import { createRandomECInstanceNodeKey } from "@helpers/random/Hierarchy";
import { initializeRpcInterface } from "@helpers/RpcHelper";

describe("ECPresentationRpcInterface", () => {

  describe("getClient", () => {

    it("throws when not registered", () => {
      expect(() => ECPresentationRpcInterface.getClient()).to.throw();
    });

    it("returns interface when registered", () => {
      initializeRpcInterface(ECPresentationRpcInterface);
      const proxy = ECPresentationRpcInterface.getClient();
      expect(proxy).is.instanceof(ECPresentationRpcInterface);
    });

  });

  describe("calls forwarding", () => {

    let rpcInterface: ECPresentationRpcInterface;
    let mock: moq.IMock<(<T>(operation: string, ...parameters: any[]) => Promise<T>)>;
    const testData = {
      imodelToken: new IModelToken(),
    };

    beforeEach(() => {
      rpcInterface = new ECPresentationRpcInterface();
      mock = moq.Mock.ofInstance(rpcInterface.forward);
      rpcInterface.forward = mock.object;
    });

    it("forwards getRootNodes call", async () => {
      await rpcInterface.getRootNodes(testData.imodelToken, undefined, {});
      mock.verify((x) => x(moq.It.isAny(), undefined, {}), moq.Times.once());
    });

    it("forwards getRootNodesCount call", async () => {
      await rpcInterface.getRootNodesCount(testData.imodelToken, {});
      mock.verify((x) => x(moq.It.isAny(), {}), moq.Times.once());
    });

    it("forwards getChildren call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildren(testData.imodelToken, parentKey, undefined, {});
      mock.verify((x) => x(moq.It.isAny(), parentKey, undefined, {}), moq.Times.once());
    });

    it("forwards getChildrenCount call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      await rpcInterface.getChildrenCount(testData.imodelToken, parentKey, {});
      mock.verify((x) => x(moq.It.isAny(), parentKey, {}), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      await rpcInterface.getContentDescriptor(testData.imodelToken, "test", new KeySet(), undefined, {});
      mock.verify((x) => x(moq.It.isAny(), "test", moq.It.is((a) => a instanceof KeySet), undefined, {}), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContentSetSize(testData.imodelToken, descriptor, new KeySet(), {});
      mock.verify((x) => x(moq.It.isAny(), descriptor, moq.It.is((a) => a instanceof KeySet), {}), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const descriptor = createRandomDescriptor();
      await rpcInterface.getContent(testData.imodelToken, descriptor, new KeySet(), undefined, {});
      mock.verify((x) => x(moq.It.isAny(), descriptor, moq.It.is((a) => a instanceof KeySet), undefined, {}), moq.Times.once());
    });

  });

});
