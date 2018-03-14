/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as moq from "typemoq";
import ECPresentationManager, { NodeAddonDefinition, NodeAddonRequestTypes } from "@bentley/ecpresentation-backend/lib/ECPresentationManager";
import * as addonTypes from "@bentley/ecpresentation-backend/lib/AddonResponses";
import { NativePlatformRegistry, IModelHost } from "@bentley/imodeljs-backend";
import { IModelToken } from "@bentley/imodeljs-common";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { PageOptions } from "@bentley/ecpresentation-common/lib/ECPresentationManager";
import { NavNode, /*, NavNodeKeyPath, NavNodePathElement*/ NavNodeKey } from "@bentley/ecpresentation-common/lib/Hierarchy";
// import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-backend/lib/common/Content";
// import { InstanceKeysList } from "@bentley/ecpresentation-backend/lib/common/EC";
// import { createRandomECInstanceKey } from "../../helpers/random/EC";
// import { createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement } from "../../helpers/random/Hierarchy";
// import { createRandomDescriptor } from "../../helpers/random/Content";

describe("ECPresentationManager", () => {

  it("uses default native library implementation if not overridden", () => {
    IModelHost.startup();
    const manager = new ECPresentationManager();
    assert.instanceOf(manager.getNativePlatform(), NativePlatformRegistry.getNativePlatform().NativeECPresentationManager);
  });

  it("uses addon implementation supplied through props", () => {
    const mock = moq.Mock.ofType<NodeAddonDefinition>();
    const manager = new ECPresentationManager({ addon: mock.object });
    assert.equal(manager.getNativePlatform(), mock.object);
  });

  describe("addon setup based on constructor props", () => {

    const addon = moq.Mock.ofType<NodeAddonDefinition>();
    beforeEach(() => {
      addon.reset();
    });

    it("sets up ruleset directories if supplied", () => {
      const dirs = ["test1", "test2"];
      addon.setup((x) => x.setupRulesetDirectories(dirs)).verifiable();
      new ECPresentationManager({ addon: addon.object, rulesetDirectories: dirs });
      addon.verifyAll();
    });

  });

  describe("addon results conversion to ECPresentation objects", () => {

    const testData = {
      imodelToken: new IModelToken("key path", false, "context id", "imodel id", "changeset id", OpenMode.Readonly, "user id"),
      pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
      extendedOptions: {
        rulesetId: "aaa",
        someOtherOption: 789,
      },
    };

    const mock = moq.Mock.ofType<NodeAddonDefinition>();
    const manager = new ECPresentationManager({ addon: mock.object });
    beforeEach(() => {
      mock.reset();
      mock.setup((x) => x.getImodelAddon(testData.imodelToken)).verifiable(moq.Times.atLeastOnce());
    });
    afterEach(() => {
      mock.verifyAll();
    });

    it("returns rootNodes", async () => {
      // what the addon receives
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetRootNodes,
        params: {
          pageOptions: testData.pageOptions,
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const addonResponse: addonTypes.Node[] = [{
        NodeId: 123,
        ParentNodeId: 456,
        Key: {
          Type: "type1",
          PathFromRoot: ["p1", "p2", "p3"],
          ECClassId: "some_class_id_1",
        } as addonTypes.NodeKey,
        Label: "test1",
        Description: "description1",
        ExpandedImageId: "img_expanded_1",
        CollapsedImageId: "img_collapsed_1",
        ForeColor: "foreColor1",
        BackColor: "backColor1",
        FontStyle: "fontStyle1",
        HasChildren: true,
        IsSelectable: true,
        IsEditable: true,
        IsChecked: true,
        IsCheckboxVisible: true,
        IsCheckboxEnabled: true,
        IsExpanded: true,
      }, {
        NodeId: 789,
        ParentNodeId: null,
        Key: {
          Type: "ECInstanceNode",
          PathFromRoot: ["p1"],
          ECClassId: "some_class_id_2",
          ECInstanceId: "some_instance_id_2",
        } as addonTypes.ECInstanceNodeKey,
        Label: "test2",
        Description: "description2",
        ExpandedImageId: null,
        CollapsedImageId: null,
        ForeColor: null,
        BackColor: null,
        FontStyle: null,
        HasChildren: false,
        IsSelectable: false,
        IsEditable: false,
        IsChecked: false,
        IsCheckboxVisible: false,
        IsCheckboxEnabled: false,
        IsExpanded: false,
      }];
      // what the manager returns using addonResponse
      const expectedResult: NavNode[] = [{
        nodeId: addonResponse[0].NodeId,
        parentNodeId: addonResponse[0].ParentNodeId || undefined,
        key: {
          type: addonResponse[0].Key.Type,
          pathFromRoot: addonResponse[0].Key.PathFromRoot,
          classId: addonResponse[0].Key.ECClassId,
        } as NavNodeKey,
        label: addonResponse[0].Label,
        description: addonResponse[0].Description,
        imageId: addonResponse[0].ExpandedImageId || undefined,
        foreColor: addonResponse[0].ForeColor || undefined,
        backColor: addonResponse[0].BackColor || undefined,
        fontStyle: addonResponse[0].FontStyle || undefined,
        hasChildren: addonResponse[0].HasChildren,
        isSelectable: addonResponse[0].IsSelectable,
        isEditable: addonResponse[0].IsEditable,
        isChecked: addonResponse[0].IsChecked,
        isExpanded: addonResponse[0].IsExpanded,
        isCheckboxVisible: addonResponse[0].IsCheckboxVisible,
        isCheckboxEnabled: addonResponse[0].IsCheckboxEnabled,
      }, {
        nodeId: addonResponse[1].NodeId,
        parentNodeId: addonResponse[1].ParentNodeId || undefined,
          key: {
            type: addonResponse[1].Key.Type,
            pathFromRoot: addonResponse[1].Key.PathFromRoot,
            classId: addonResponse[1].Key.ECClassId,
            instanceId: (addonResponse[1].Key as addonTypes.ECInstanceNodeKey).ECInstanceId,
          } as NavNodeKey,
        label: addonResponse[1].Label,
        description: addonResponse[1].Description,
        imageId: addonResponse[1].ExpandedImageId || undefined,
        foreColor: addonResponse[1].ForeColor || undefined,
        backColor: addonResponse[1].BackColor || undefined,
        fontStyle: addonResponse[1].FontStyle || undefined,
        hasChildren: addonResponse[1].HasChildren,
        isSelectable: addonResponse[1].IsSelectable,
        isEditable: addonResponse[1].IsEditable,
        isChecked: addonResponse[1].IsChecked,
        isExpanded: addonResponse[1].IsExpanded,
        isCheckboxVisible: addonResponse[1].IsCheckboxVisible,
        isCheckboxEnabled: addonResponse[1].IsCheckboxEnabled,
      }];
      // mock
      mock.setup((x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString())).returns(() => JSON.stringify(addonResponse));
      // call
      const actualResult = await manager.getRootNodes(testData.imodelToken, testData.pageOptions, testData.extendedOptions);
      // verify the addon was called with correct params
      mock.verify((x) => x.handleRequest(moq.It.isAny(), JSON.stringify(expectedParams)), moq.Times.once());
      // verify the manager correctly used addonResponse to create its result
      assert.deepEqual(actualResult, expectedResult);
    });

    it("returns rootNodesCount", async () => {
      // what the addon receives
      const expectedParams = {
        requestId: NodeAddonRequestTypes.GetRootNodesCount,
        params: {
          options: testData.extendedOptions,
        },
      };
      // what the addon returns
      const addonResponse = 456;
      // what the manager returns using addonResponse
      const expectedResult = addonResponse;
      // mock
      mock.setup((x) => x.handleRequest(moq.It.isAny(), moq.It.isAnyString())).returns(() => JSON.stringify(addonResponse));
      // call
      const actualResult = await manager.getRootNodesCount(testData.imodelToken, testData.extendedOptions);
      // verify the addon was called with correct params
      mock.verify((x) => x.handleRequest(moq.It.isAny(), JSON.stringify(expectedParams)), moq.Times.once());
      // verify the manager correctly used addonResponse to create its result
      assert.deepEqual(actualResult, expectedResult);
    });

  });

});
