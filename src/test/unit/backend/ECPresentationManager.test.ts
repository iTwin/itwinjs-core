/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as moq from "typemoq";
import ECPresentationManager, { NodeAddonDefinition, NodeAddonRequestTypes } from "@bentley/ecpresentation-backend/lib/backend/ECPresentationManager";
import * as addonTypes from "@bentley/ecpresentation-backend/lib/backend/AddonResponses";
import { NodeAddonLoader } from "@bentley/imodeljs-nodeaddon/NodeAddonLoader";
import { NodeAddonRegistry } from "@bentley/imodeljs-backend/lib/backend/NodeAddonRegistry";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { PageOptions } from "@bentley/ecpresentation-backend/lib/common/ECPresentationManager";
import { NavNode, /*, NavNodeKeyPath, NavNodePathElement*/ NavNodeKey} from "@bentley/ecpresentation-backend/lib/common/Hierarchy";
// import { SelectionInfo, Descriptor, Content } from "@bentley/ecpresentation-backend/lib/common/Content";
// import { InstanceKeysList } from "@bentley/ecpresentation-backend/lib/common/EC";
// import { createRandomECInstanceKey } from "../../helpers/backend/random/EC";
// import { createRandomECInstanceNodeKey, createRandomECInstanceNode, createRandomNodePathElement } from "../../helpers/backend/random/Hierarchy";
// import { createRandomDescriptor } from "../../helpers/backend/random/Content";

describe("ECPresentationManager", () => {

  it("uses default addon implementation if not overridden", () => {
    NodeAddonRegistry.registerAddon(NodeAddonLoader.loadAddon());
    const manager = new ECPresentationManager();
    assert.instanceOf(manager.getAddon(), NodeAddonRegistry.getAddon().NodeAddonECPresentationManager);
  });

  describe("addon results conversion to ECPresentation objects", () => {

    const testData = {
      imodelToken: IModelToken.create("imodel id", "changeset id", OpenMode.Readonly),
      pageOptions: { pageStart: 123, pageSize: 456 } as PageOptions,
      extendedOptions: {
        rulesetId: "aaa",
        someOtherOption: 789,
      },
    };
    const manager = new ECPresentationManager();
    const mock = moq.Mock.ofType<NodeAddonDefinition>();
    beforeEach(() => {
      mock.reset();
      mock.setup((x) => x.getImodelAddon(testData.imodelToken)).verifiable(moq.Times.atLeastOnce());
      manager.setAddon(mock.object);
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
        Key: {Type: "type1"} as addonTypes.NodeKey,
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
        Key: { Type: "type2" } as addonTypes.NodeKey,
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
        parentNodeId: addonResponse[0].ParentNodeId,
        key: {type: addonResponse[0].Key.Type} as NavNodeKey,
        label: addonResponse[0].Label,
        description: addonResponse[0].Description,
        imageId: addonResponse[0].ExpandedImageId,
        foreColor: addonResponse[0].ForeColor,
        backColor: addonResponse[0].BackColor,
        fontStyle: addonResponse[0].FontStyle,
        hasChildren: addonResponse[0].HasChildren,
        isSelectable: addonResponse[0].IsSelectable,
        isEditable: addonResponse[0].IsEditable,
        isChecked: addonResponse[0].IsChecked,
        isExpanded: addonResponse[0].IsExpanded,
        isCheckboxVisible: addonResponse[0].IsCheckboxVisible,
        isCheckboxEnabled: addonResponse[0].IsCheckboxEnabled,
      }, {
        nodeId: addonResponse[1].NodeId,
        parentNodeId: addonResponse[1].ParentNodeId,
        key: { type: addonResponse[1].Key.Type } as NavNodeKey,
        label: addonResponse[1].Label,
        description: addonResponse[1].Description,
        imageId: addonResponse[1].ExpandedImageId,
        foreColor: addonResponse[1].ForeColor,
        backColor: addonResponse[1].BackColor,
        fontStyle: addonResponse[1].FontStyle,
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
