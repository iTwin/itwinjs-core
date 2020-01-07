/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, waitForElement } from "@testing-library/react";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks"; // tslint:disable-line: no-direct-imports
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { BeEvent } from "@bentley/bentleyjs-core";
import { SelectionManager, SelectionChangeEvent, Presentation, PresentationManager, RulesetManager } from "@bentley/presentation-frontend";
import { KeySet, ECInstanceNodeKey, StandardNodeTypes } from "@bentley/presentation-common";
import { ModelsTree } from "../../../ui-framework/imodel-components/visibility-tree/ModelsTree";
import { VisibilityHandler } from "../../../ui-framework/imodel-components/visibility-tree/VisibilityTree";
import TestUtils from "../../TestUtils";

describe("ModelsTree", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    Object.defineProperties(HTMLElement.prototype, {
      offsetHeight: { get: () => 200 },
      offsetWidth: { get: () => 200 },
    });
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("<ModelsTree />", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const visibilityHandlerMock = moq.Mock.ofType<VisibilityHandler>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
    let dataProvider: IPresentationTreeDataProvider;

    const createKey = (id: string): ECInstanceNodeKey => {
      return {
        type: StandardNodeTypes.ECInstanceNode,
        instanceKey: { className: "MyDomain:SomeElementType", id },
        pathFromRoot: [],
      };
    };

    beforeEach(() => {
      visibilityHandlerMock.reset();
      selectionManagerMock.reset();
      presentationManagerMock.reset();
      rulesetManagerMock.reset();

      dataProvider = {
        imodel: imodelMock.object,
        rulesetId: "",
        onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
        getFilteredNodePaths: async () => [],
        getNodeKey: (node: TreeNodeItem) => (node as any).__key,
        getNodesCount: async () => 1,
        getNodes: async () => [{ __key: createKey("1"), label: "test-node", id: "1", isCheckboxVisible: true }],
        loadHierarchy: async () => { },
      };

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.selection = selectionManagerMock.object;
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
      Presentation.presentation = presentationManagerMock.object;
    });

    after(() => {
      Presentation.terminate();
    });

    it("renders using old tree implementation", async () => {
      visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));
      const result = render(
        <ModelsTree imodel={imodelMock.object} dataProvider={dataProvider} visibilityHandler={visibilityHandlerMock.object} />,
      );
      await waitForElement(() => result.getByText("test-node"), { container: result.container });
      expect(result.baseElement).to.matchSnapshot();
    });

    it("renders using controlled tree implementation", async () => {
      visibilityHandlerMock.setup(async (x) => x.getDisplayStatus(moq.It.isAny())).returns(async () => ({ isDisplayed: false }));
      const result = render(
        <ModelsTree imodel={imodelMock.object} dataProvider={dataProvider} visibilityHandler={visibilityHandlerMock.object} useControlledTree={true} />,
      );
      await waitForElement(() => result.getByText("test-node"), { container: result.container });
      expect(result.baseElement).to.matchSnapshot();
    });

  });

});
