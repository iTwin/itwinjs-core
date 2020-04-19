/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { render, waitForElement, cleanup } from "@testing-library/react";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks"; // tslint:disable-line: no-direct-imports
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { Presentation, PresentationManager, RulesetManager, SelectionChangeEvent, SelectionManager } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { BeEvent } from "@bentley/bentleyjs-core";
import { TreeDataChangesListener, TreeNodeItem } from "@bentley/ui-components";
import { ECInstancesNodeKey, StandardNodeTypes, KeySet } from "@bentley/presentation-common";
import TestUtils from "../../TestUtils";
import { SpatialContainmentTree } from "../../../ui-framework/imodel-components/spatial-tree/SpatialContainmentTree";

describe("SpatialContainmentTree", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  after(() => {
    TestUtils.terminateUiFramework();
    sinon.restore();
  });

  describe("<SpatialContainmentTree />", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
    let dataProvider: IPresentationTreeDataProvider;

    const createKey = (id: string): ECInstancesNodeKey => {
      return {
        type: StandardNodeTypes.ECInstancesNode,
        instanceKeys: [{ className: "MyDomain:SomeElementType", id }],
        pathFromRoot: [],
      };
    };

    beforeEach(() => {
      cleanup();

      presentationManagerMock.reset();
      rulesetManagerMock.reset();

      dataProvider = {
        imodel: imodelMock.object,
        rulesetId: "",
        onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
        dispose: () => { },
        getFilteredNodePaths: async () => [],
        getNodeKey: (node: TreeNodeItem) => (node as any).__key,
        getNodesCount: async () => 1,
        getNodes: async () => [{ __key: createKey("1"), label: PropertyRecord.fromString("test-node"), id: "1" }],
        loadHierarchy: async () => { },
      };

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.setSelectionManager(selectionManagerMock.object);
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
      presentationManagerMock.setup((x) => x.onHierarchyUpdate).returns(() => new BeEvent());
      Presentation.setPresentationManager(presentationManagerMock.object);
    });

    after(() => {
      Presentation.terminate();
    });

    it("renders", async () => {
      const result = render(
        <SpatialContainmentTree iModel={imodelMock.object} dataProvider={dataProvider} />,
      );
      await waitForElement(() => result.getByText("test-node"), { container: result.container });
      expect(result.baseElement).to.matchSnapshot();
    });

  });

});
