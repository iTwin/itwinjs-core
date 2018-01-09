/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import ECPresentationManager from "@bentley/ecpresentation-backend/lib/backend/ECPresentationManager";
import ECPresentationGateway from "@bentley/ecpresentation-backend/lib/backend/ECPresentationGateway";
import ECPresentationGatewayDefinition from "@bentley/ecpresentation-backend/lib/common/ECPresentationGatewayDefinition";
import TestECPresentationManager from "../../helpers/backend/TestECPresentationManager";
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import { NavNode, NavNodeKeyPath, NavNodePathElement } from "@bentley/ecpresentation-backend/lib/common/Hierarchy";
import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-backend/lib/common/Content";
import { InstanceKeysList } from "@bentley/ecpresentation-backend/lib/common/EC";
import { PageOptions } from "@bentley/ecpresentation-backend/lib/common/ECPresentationManager";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { createRandomECInstanceKey } from "../../helpers/backend/random/EC";
import { createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement } from "../../helpers/backend/random/Hierarchy";
import { createRandomDescriptor } from "../../helpers/backend/random/Content";

describe("ECPresentationGatewayImpl", () => {

  it("is registered after including module", () => {
    Gateway.initialize(ECPresentationGateway);
    const impl = Gateway.getImplementationForGateway(ECPresentationGatewayDefinition);
    assert.isNotNull(impl);
    assert.instanceOf(impl, ECPresentationGateway);
  });

  it("uses default ECPresentationManager implementation if not overriden", () => {
    const manager = ECPresentationGateway.manager;
    assert.instanceOf(manager, ECPresentationManager);
  });

  describe("calls forwarding", () => {

    const gateway = new ECPresentationGateway();
    const testData = {
      imodelToken: IModelToken.create("test id", "changeset id", OpenMode.ReadWrite, "user id", "context id"),
      pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
      nodePathElements: [createRandomNodePathElement(3), createRandomNodePathElement(1)] as NavNodePathElement[],
      displayType: "sample display type",
      inputKeys: [createRandomECInstanceKey(), createRandomECInstanceKey(), createRandomECInstanceKey()],
      selectionInfo: {} as SelectionInfo,
      descriptor: createRandomDescriptor(),
      extendedOptions: { rulesetId: "aaa", someOtherOption: 789 },
    };
    const setupTestData = () => {
    };

    before(() => {
      setupTestData();
    });

    let manager: TestECPresentationManager;
    beforeEach(() => {
      manager = new TestECPresentationManager();
      ECPresentationGateway.manager = manager;
    });

    it("calls manager's getRootNodes", async () => {
      const result: NavNode[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
      manager.getRootNodes = (actualToken: IModelToken, actualPageOptions: PageOptions, actualExtendedOptions: object): Promise<NavNode[]> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualPageOptions, testData.pageOptions);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getRootNodesCount", async () => {
      const result = 999;
      manager.getRootNodesCount = (actualToken: IModelToken, actualExtendedOptions: object): Promise<number> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
      assert.equal(actualResult, result);
    });

    it("calls manager's getChildren", async () => {
      const parentNode = createRandomECInstanceNode();
      const result: NavNode[] = [createRandomECInstanceNode(), createRandomECInstanceNode(), createRandomECInstanceNode()];
      manager.getChildren = (actualToken: IModelToken, actualParentNode: NavNode, actualPageOptions: PageOptions, actualExtendedOptions: object): Promise<NavNode[]> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualParentNode, parentNode);
        assert.deepEqual(actualPageOptions, testData.pageOptions);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getChildren(testData.imodelToken, parentNode, testData.pageOptions, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getChildrenCount", async () => {
      const parentNode = createRandomECInstanceNode();
      const result = 999;
      manager.getChildrenCount = (actualToken: IModelToken, actualParentNode: NavNode, actualExtendedOptions: object): Promise<number> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualParentNode, parentNode);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getChildrenCount(testData.imodelToken, parentNode, testData.extendedOptions);
      assert.equal(actualResult, result);
    });

    it("calls manager's getNodePaths", async () => {
      const paths: NavNodeKeyPath[] = [
        [createRandomECInstanceNodeKey(), createRandomECInstanceNodeKey()],
        [createRandomECInstanceNodeKey()],
      ];
      const markedIndex = 555;
      const result: NavNodePathElement[] = [createRandomNodePathElement(3), createRandomNodePathElement(1), createRandomNodePathElement(2)];
      manager.getNodePaths = (actualToken: IModelToken, actualPaths: NavNodeKeyPath[], actualMarkedIndex: number, actualExtendedOptions: object): Promise<NavNodePathElement[]> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualPaths, paths);
        assert.deepEqual(actualMarkedIndex, markedIndex);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getNodePaths(testData.imodelToken, paths, markedIndex, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getFilteredNodesPaths", async () => {
      const filterText = "test filter";
      const result: NavNodePathElement[] = [createRandomNodePathElement(1), createRandomNodePathElement(2)];
      manager.getFilteredNodesPaths = (actualToken: IModelToken, actualFilterText: string, actualExtendedOptions: object): Promise<NavNodePathElement[]> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualFilterText, filterText);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getFilteredNodesPaths(testData.imodelToken, filterText, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getContentDescriptor", async () => {
      const result = testData.descriptor;
      manager.getContentDescriptor = (actualToken: IModelToken, actualDisplayType: string, actualInputKeys: InstanceKeysList, actualSelectionInfo: SelectionInfo | null, actualExtendedOptions: object): Promise<Descriptor | null> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualDisplayType, testData.displayType);
        assert.deepEqual(actualInputKeys, testData.inputKeys);
        assert.deepEqual(actualSelectionInfo, testData.selectionInfo);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getContentDescriptor(testData.imodelToken, testData.displayType,
        testData.inputKeys, testData.selectionInfo, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getContentSetSize", async () => {
      const result = 789;
      manager.getContentSetSize = (actualToken: IModelToken, actualDescriptor: Descriptor, actualInputKeys: InstanceKeysList, actualExtendedOptions: object): Promise<number> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualDescriptor, testData.descriptor);
        assert.deepEqual(actualInputKeys, testData.inputKeys);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getContentSetSize(testData.imodelToken, testData.descriptor,
        testData.inputKeys, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getContent", async () => {
      const result = new Content(testData.descriptor);
      manager.getContent = (actualToken: IModelToken, actualDescriptor: Descriptor, actualInputKeys: InstanceKeysList, actualPageOptions: PageOptions, actualExtendedOptions: object): Promise<Content> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualDescriptor, testData.descriptor);
        assert.deepEqual(actualInputKeys, testData.inputKeys);
        assert.deepEqual(actualPageOptions, testData.pageOptions);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getContent(testData.imodelToken, testData.descriptor,
        testData.inputKeys, testData.pageOptions, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

    it("calls manager's getDistinctValues", async () => {
      const fieldName = "test field name";
      const maxValueCount = 789;
      const result = ["one", "two", "three"];
      manager.getDistinctValues = (actualToken: IModelToken, actualDisplayType: string, actualFieldName: string, actualMaxValueCount: number, actualExtendedOptions: object): Promise<string[]> => {
        assert.deepEqual(actualToken, testData.imodelToken);
        assert.deepEqual(actualDisplayType, testData.displayType);
        assert.deepEqual(actualFieldName, fieldName);
        assert.deepEqual(actualMaxValueCount, maxValueCount);
        assert.deepEqual(actualExtendedOptions, testData.extendedOptions);
        return Promise.resolve(result);
      };
      const actualResult = await gateway.getDistinctValues(testData.imodelToken, testData.displayType,
        fieldName, maxValueCount, testData.extendedOptions);
      assert.deepEqual(actualResult, result);
    });

  });

});
