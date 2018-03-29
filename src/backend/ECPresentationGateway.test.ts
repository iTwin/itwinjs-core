/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { OpenMode } from "@bentley/bentleyjs-core";
import { Gateway, IModelToken } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";
import { Node, NodeKeyPath, NodePathElement } from "@bentley/ecpresentation-common";
import { SelectionInfo, Content } from "@bentley/ecpresentation-common";
import { PageOptions, KeySet } from "@bentley/ecpresentation-common";
import { createRandomECInstanceKey } from "../test-helpers/random/EC";
import { createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement } from "../test-helpers/random/Hierarchy";
import { createRandomDescriptor } from "../test-helpers/random/Content";
import { initializeGateway } from "../test-helpers/GatewayHelper";
import ECPresentationManager from "./ECPresentationManager";
import ECPresentationGateway from "./ECPresentationGateway";
import ECPresentation from "./ECPresentation";

describe("ECPresentationGatewayImpl", () => {

  afterEach(() => {
    ECPresentation.terminate();
  });

  it("is registered after calling ECPresentation.initialize", () => {
    ECPresentation.initialize();
    initializeGateway(ECPresentationGateway);
    const impl = Gateway.getProxyForGateway(ECPresentationGatewayDefinition);
    expect(impl).is.not.null;
    expect(impl).is.instanceof(ECPresentationGateway);
  });

  it("uses default ECPresentationManager implementation if not overridden", () => {
    ECPresentation.initialize();
    const gateway = new ECPresentationGateway();
    expect(gateway.getManager()).is.instanceof(ECPresentationManager);
  });

  describe("calls forwarding", () => {

    const testData = {
      imodelToken: new IModelToken("key path", false, "context id", "imodel id", "changeset id", OpenMode.ReadWrite, "user id"),
      pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
      nodePathElements: [createRandomNodePathElement(3), createRandomNodePathElement(1)] as NodePathElement[],
      displayType: "sample display type",
      inputKeys: new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()]),
      selectionInfo: {} as SelectionInfo,
      descriptor: createRandomDescriptor(),
      extendedOptions: { rulesetId: "aaa", someOtherOption: 789 },
    };
    const gateway = new ECPresentationGateway();
    const mock = moq.Mock.ofType<ECPresentationManager>();
    beforeEach(() => {
      mock.reset();
      ECPresentation.manager = mock.object;
    });

    it("calls manager's getRootNodes", async () => {
      const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
      mock.setup((x) => x.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("calls manager's getRootNodesCount", async () => {
      const result = 999;
      mock.setup((x) => x.getRootNodesCount(testData.imodelToken, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.eq(result);
    });

    it("calls manager's getChildren", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result: Node[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
      mock.setup((x) => x.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getChildren(testData.imodelToken, parentNodeKey, testData.pageOptions, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("calls manager's getChildrenCount", async () => {
      const parentNodeKey = createRandomECInstanceNodeKey();
      const result = 999;
      mock.setup((x) => x.getChildrenCount(testData.imodelToken, parentNodeKey, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getChildrenCount(testData.imodelToken, parentNodeKey, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.eq(result);
    });

    it("calls manager's getNodePaths", async () => {
      const paths: NodeKeyPath[] = [
        [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()],
        [createRandomECInstanceNodeKey()],
      ];
      const markedIndex = 555;
      const result: NodePathElement[] = [createRandomNodePathElement(3), createRandomNodePathElement(1), createRandomNodePathElement(2)];
      mock.setup((x) => x.getNodePaths(testData.imodelToken, paths, markedIndex, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getNodePaths(testData.imodelToken, paths, markedIndex, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("calls manager's getFilteredNodesPaths", async () => {
      const filterText = "test filter";
      const result: NodePathElement[] = [createRandomNodePathElement(1), createRandomNodePathElement(2)];
      mock.setup((x) => x.getFilteredNodesPaths(testData.imodelToken, filterText, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getFilteredNodesPaths(testData.imodelToken, filterText, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("calls manager's getContentDescriptor", async () => {
      const result = testData.descriptor;
      mock.setup((x) => x.getContentDescriptor(testData.imodelToken, testData.displayType, testData.inputKeys, testData.selectionInfo, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getContentDescriptor(testData.imodelToken, testData.displayType,
        testData.inputKeys, testData.selectionInfo, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("calls manager's getContentSetSize", async () => {
      const result = 789;
      mock.setup((x) => x.getContentSetSize(testData.imodelToken, testData.descriptor, testData.inputKeys, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getContentSetSize(testData.imodelToken, testData.descriptor,
        testData.inputKeys, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("calls manager's getContent", async () => {
      const result = {
        descriptor: testData.descriptor,
      } as Content;
      mock.setup((x) => x.getContent(testData.imodelToken, testData.descriptor, testData.inputKeys, testData.pageOptions, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getContent(testData.imodelToken, testData.descriptor,
        testData.inputKeys, testData.pageOptions, testData.extendedOptions);
      expect(actualResult).to.deep.eq(result);
    });

    it("calls manager's getDistinctValues", async () => {
      const fieldName = "test field name";
      const maxValueCount = 789;
      const result = ["one", "two", "three"];
      mock.setup((x) => x.getDistinctValues(testData.imodelToken, testData.displayType, fieldName, maxValueCount, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getDistinctValues(testData.imodelToken, testData.displayType,
        fieldName, maxValueCount, testData.extendedOptions);
      mock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

  });

});
