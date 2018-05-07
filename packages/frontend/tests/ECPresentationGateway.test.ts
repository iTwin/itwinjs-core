/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet } from "@bentley/ecpresentation-common";
import { ECPresentationGateway } from "@src/index";
import { createRandomDescriptor } from "@helpers/random/Content";
import { createRandomECInstanceNodeKey } from "@helpers/random/Hierarchy";
import FrontendGatewayConfiguration from "@helpers/TestGatewayConfiguration";

describe("ECPresentationGateway", () => {

  describe("getProxy", () => {

    it("throws when not registered", () => {
      expect(() => ECPresentationGateway.getProxy()).to.throw();
    });

    it("returns gateway when registered", () => {
      FrontendGatewayConfiguration.initialize([ECPresentationGateway]);
      const proxy = ECPresentationGateway.getProxy();
      expect(proxy).is.instanceof(ECPresentationGateway);
    });

  });

  describe("calls forwarding", () => {

    let gateway: ECPresentationGateway;
    let mock: moq.IMock<(<T>(operation: string, ...parameters: any[]) => Promise<T>)>;
    const testData = {
      imodelToken: new IModelToken(),
    };

    beforeEach(() => {
      gateway = new ECPresentationGateway();
      mock = moq.Mock.ofInstance(gateway.forward);
      gateway.forward = mock.object;
    });

    it("forwards getRootNodes call", async () => {
      await gateway.getRootNodes(testData.imodelToken, undefined, {});
      mock.verify((x) => x(moq.It.isAny(), undefined, {}), moq.Times.once());
    });

    it("forwards getRootNodesCount call", async () => {
      await gateway.getRootNodesCount(testData.imodelToken, {});
      mock.verify((x) => x(moq.It.isAny(), {}), moq.Times.once());
    });

    it("forwards getChildren call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      await gateway.getChildren(testData.imodelToken, parentKey, undefined, {});
      mock.verify((x) => x(moq.It.isAny(), parentKey, undefined, {}), moq.Times.once());
    });

    it("forwards getChildrenCount call", async () => {
      const parentKey = createRandomECInstanceNodeKey();
      await gateway.getChildrenCount(testData.imodelToken, parentKey, {});
      mock.verify((x) => x(moq.It.isAny(), parentKey, {}), moq.Times.once());
    });

    it("forwards getContentDescriptor call", async () => {
      await gateway.getContentDescriptor(testData.imodelToken, "test", new KeySet(), undefined, {});
      mock.verify((x) => x(moq.It.isAny(), "test", moq.It.is((a) => a instanceof KeySet), undefined, {}), moq.Times.once());
    });

    it("forwards getContentSetSize call", async () => {
      const descriptor = createRandomDescriptor();
      await gateway.getContentSetSize(testData.imodelToken, descriptor, new KeySet(), {});
      mock.verify((x) => x(moq.It.isAny(), descriptor, moq.It.is((a) => a instanceof KeySet), {}), moq.Times.once());
    });

    it("forwards getContent call", async () => {
      const descriptor = createRandomDescriptor();
      await gateway.getContent(testData.imodelToken, descriptor, new KeySet(), undefined, {});
      mock.verify((x) => x(moq.It.isAny(), descriptor, moq.It.is((a) => a instanceof KeySet), undefined, {}), moq.Times.once());
    });

  });

});
