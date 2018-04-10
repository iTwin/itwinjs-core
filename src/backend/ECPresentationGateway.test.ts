/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as moq from "typemoq";
import ECPresentationGatewayDefinition from "@bentley/ecpresentation-common/lib/ECPresentationGatewayDefinition";
import { Gateway } from "@bentley/imodeljs-common/lib/Gateway";
import { IModelToken } from "@bentley/imodeljs-common/lib/IModel";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "@bentley/ecpresentation-common/lib/Hierarchy";
import { SelectionInfo, Content } from "@bentley/ecpresentation-common/lib/content";
import { PageOptions } from "@bentley/ecpresentation-common/lib/ECPresentationManager";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { createRandomECInstanceKey } from "../test-helpers/random/EC";
import { createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement } from "../test-helpers/random/Hierarchy";
import { createRandomDescriptor } from "../test-helpers/random/Content";
import ECPresentationManager from "./ECPresentationManager";
import ECPresentationGateway from "./ECPresentationGateway";

describe("ECPresentationGatewayImpl", () => {

  it("is registered after including module", () => {
    Gateway.initialize(ECPresentationGateway);
    const impl = Gateway.getImplementationForGateway(ECPresentationGatewayDefinition);
    assert.isNotNull(impl);
    assert.instanceOf(impl, ECPresentationGateway);
  });

  it("uses default ECPresentationManager implementation if not overridden", () => {
    const gateway = new ECPresentationGateway();
    assert.instanceOf(gateway.getManager(), ECPresentationManager);
  });

  describe("calls forwarding", () => {

    const testData = {
      imodelToken: new IModelToken("key path", false, "context id", "imodel id", "changeset id", OpenMode.ReadWrite, "user id"),
      pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
      nodePathElements: [createRandomNodePathElement(3), createRandomNodePathElement(1)] as NavNodePathElement[],
      displayType: "sample display type",
      inputKeys: [createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()],
      selectionInfo: {} as SelectionInfo,
      descriptor: createRandomDescriptor(),
      extendedOptions: { rulesetId: "aaa", someOtherOption: 789 },
    };
    const gateway = new ECPresentationGateway();
    const mock = moq.Mock.ofType<ECPresentationManager>();
    beforeEach(() => {
      mock.reset();
      gateway.setManager(mock.object);
    });

    it("calls manager's getRootNodes", async () => {
      const result: NavNode[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
      mock.setup((x) => x.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
      mock.verifyAll();
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getRootNodesCount", async () => {
      const result = 999;
      mock.setup((x) => x.getRootNodesCount(testData.imodelToken, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
      mock.verifyAll();
      assert.equal(actualResult, result);
    });

    it("calls manager's getChildren", async () => {
      const parentNode = createRandomECInstanceNode();
      const result: NavNode[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
      mock.setup((x) => x.getChildren(testData.imodelToken, parentNode, testData.pageOptions, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getChildren(testData.imodelToken, parentNode, testData.pageOptions, testData.extendedOptions);
      mock.verifyAll();
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getChildrenCount", async () => {
      const parentNode = createRandomECInstanceNode();
      const result = 999;
      mock.setup((x) => x.getChildrenCount(testData.imodelToken, parentNode, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getChildrenCount(testData.imodelToken, parentNode, testData.extendedOptions);
      mock.verifyAll();
      assert.equal(actualResult, result);
    });

    it("calls manager's getNodePaths", async () => {
      const paths: NavNodeKeyPath[] = [
        [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()],
        [createRandomECInstanceNodeKey()],
      ];
      const markedIndex = 555;
      const result: NavNodePathElement[] = [createRandomNodePathElement(3), createRandomNodePathElement(1), createRandomNodePathElement(2)];
      mock.setup((x) => x.getNodePaths(testData.imodelToken, paths, markedIndex, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getNodePaths(testData.imodelToken, paths, markedIndex, testData.extendedOptions);
      mock.verifyAll();
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getFilteredNodesPaths", async () => {
      const filterText = "test filter";
      const result: NavNodePathElement[] = [createRandomNodePathElement(1), createRandomNodePathElement(2)];
      mock.setup((x) => x.getFilteredNodesPaths(testData.imodelToken, filterText, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getFilteredNodesPaths(testData.imodelToken, filterText, testData.extendedOptions);
      mock.verifyAll();
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getContentDescriptor", async () => {
      const result = testData.descriptor;
      mock.setup((x) => x.getContentDescriptor(testData.imodelToken, testData.displayType, testData.inputKeys, testData.selectionInfo, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getContentDescriptor(testData.imodelToken, testData.displayType,
        testData.inputKeys, testData.selectionInfo, testData.extendedOptions);
      mock.verifyAll();
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getContentSetSize", async () => {
      const result = 789;
      mock.setup((x) => x.getContentSetSize(testData.imodelToken, testData.descriptor, testData.inputKeys, testData.extendedOptions))
        .returns(() => Promise.resolve(result))
        .verifiable();
      const actualResult = await gateway.getContentSetSize(testData.imodelToken, testData.descriptor,
        testData.inputKeys, testData.extendedOptions);
      mock.verifyAll();
      assert.deepEqual(actualResult, result);
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
      assert.deepEqual(actualResult, result);
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
      assert.deepEqual(actualResult, result);
    });

  });

});
