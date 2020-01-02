/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, waitForElement, cleanup } from "@testing-library/react";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks"; // tslint:disable-line: no-direct-imports
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation, PresentationManager, RulesetManager, SelectionChangeEvent, SelectionManager } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { BeEvent } from "@bentley/bentleyjs-core";
import { TreeDataChangesListener, TreeNodeItem } from "@bentley/ui-components";
import { ECInstanceNodeKey, StandardNodeTypes, KeySet } from "@bentley/presentation-common";
import TestUtils from "../../TestUtils";
import { CategoryTree } from "../../../ui-framework/imodel-components/category-tree/CategoriesTree";

describe("CategoriesTree", () => {

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

  describe("<CategoriesTree />", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
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
      cleanup();

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
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.selection = selectionManagerMock.object;
      presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
      Presentation.presentation = presentationManagerMock.object;
    });

    after(() => {
      Presentation.terminate();
    });

    it("renders using old tree implementation", async () => {
      const result = render(
        <CategoryTree iModel={imodelMock.object} dataProvider={dataProvider} />,
      );
      await waitForElement(() => result.getByText("test-node"), { container: result.container });
      expect(result.baseElement).to.matchSnapshot();
    });

    it("renders using controlled tree implementation", async () => {
      const result = render(
        <CategoryTree iModel={imodelMock.object} dataProvider={dataProvider} useControlledTree={true} />,
      );
      await waitForElement(() => result.getByText("test-node"), { container: result.container });
      expect(result.baseElement).to.matchSnapshot();
    });

  });

});
