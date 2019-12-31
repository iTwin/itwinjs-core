/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, waitForElement, cleanup, fireEvent } from "@testing-library/react";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks"; // tslint:disable-line: no-direct-imports
import { IModelConnection, Viewport, SpatialViewState, IModelApp, NoRenderApp, ViewManager, ScreenViewport, ViewState, SubCategoriesCache } from "@bentley/imodeljs-frontend";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { BeEvent, Id64String, BeUiEvent } from "@bentley/bentleyjs-core";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { SelectionManager, SelectionChangeEvent, Presentation, PresentationManager, RulesetManager, RulesetVariablesManager } from "@bentley/presentation-frontend";
import { KeySet, ECInstanceNodeKey, StandardNodeTypes } from "@bentley/presentation-common";
import TestUtils from "../../TestUtils";
import { ControlledCategoryTree, CategoryVisibilityHandler, Category } from "../../../ui-framework/imodel-components/category-tree/ControlledCategoriesTree";

describe("ControlledCategoryTree", () => {

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
    Presentation.terminate();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const rulesetVariablesMock = moq.Mock.ofType<RulesetVariablesManager>();
  const visibilityHandler = moq.Mock.ofType<CategoryVisibilityHandler>();
  const viewportMock = moq.Mock.ofType<Viewport>();
  const viewStateMock = moq.Mock.ofType<SpatialViewState>();
  let dataProvider: IPresentationTreeDataProvider;

  beforeEach(() => {
    cleanup();

    imodelMock.reset();
    selectionManagerMock.reset();
    presentationManagerMock.reset();
    rulesetManagerMock.reset();
    rulesetVariablesMock.reset();
    visibilityHandler.reset();
    viewportMock.reset();
    viewStateMock.reset();

    dataProvider = {
      imodel: imodelMock.object,
      rulesetId: "",
      onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
    };

    const selectionChangeEvent = new SelectionChangeEvent();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
    selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
    selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
    Presentation.selection = selectionManagerMock.object;
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
    presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesMock.object);
    Presentation.presentation = presentationManagerMock.object;

    async function* generator() {
      return;
    }

    imodelMock.setup((x) => x.query(moq.It.isAny())).returns(() => generator());
    viewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
    viewStateMock.setup((x) => x.is3d()).returns(() => true);
  });

  const setupDataProvider = (nodes: TreeNodeItem[]) => {
    dataProvider.getNodesCount = async () => nodes.length;
    dataProvider.getNodes = async () => nodes.map((n) => ({ __key: createKey(n.id), ...n }));
  };

  const createKey = (id: Id64String): ECInstanceNodeKey => {
    return {
      type: StandardNodeTypes.ECInstanceNode,
      instanceKey: { className: "MyDomain:SpatialCategory", id },
      pathFromRoot: [],
    };
  };

  describe("<ControlledCategoryTree />", () => {

    it("should match snapshot", async () => {
      setupDataProvider([{ id: "test", label: "test-node" }]);
      const result = render(
        <ControlledCategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      expect(result.baseElement).to.matchSnapshot();
    });

    it("sets ruleset variable 'ViewType' to '3d'", async () => {
      render(
        <ControlledCategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify((x) => x.setString("ViewType", "3d"), moq.Times.once());
    });

    it("sets ruleset variable 'ViewType' to '2d'", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => false);
      render(
        <ControlledCategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify((x) => x.setString("ViewType", "2d"), moq.Times.once());
    });

    it("enables all categories", async () => {
      setupDataProvider([{ id: "test", label: "test-node" }]);
      visibilityHandler.setup((x) => x.setEnableAll(true)).verifiable();
      const result = render(
        <ControlledCategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} selectAll={true} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      visibilityHandler.verify((x) => x.setEnableAll(true), moq.Times.once());
    });

    it("disables all categories", async () => {
      setupDataProvider([{ id: "test", label: "test-node" }]);
      visibilityHandler.setup((x) => x.setEnableAll(false)).verifiable();
      const result = render(
        <ControlledCategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} clearAll={true} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      visibilityHandler.verify((x) => x.setEnableAll(false), moq.Times.once());
    });

    it("renders checked checkbox if category is visible", async () => {
      setupDataProvider([{ id: "test", label: "test-node" }]);
      visibilityHandler.setup((x) => x.isCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => true);
      const result = render(
        <ControlledCategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      const node = await waitForElement(() => result.getByTestId("tree-node"));
      const cb = node.querySelector("input");
      expect(cb!.checked).to.be.true;
    });

    it("renders filter input", async () => {
      const result = render(
        <ControlledCategoryTree
          iModel={imodelMock.object} showSearchBox={true} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      const node = await waitForElement(() => result.container.querySelector(".components-filtering-input"));
      expect(node).to.not.be.null;
    });

    describe("categories", () => {

      it("disables category when enabled category is selected", async () => {
        setupDataProvider([{ id: "test", label: "test-node" }]);
        visibilityHandler.setup((x) => x.isCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => true);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => result.getByTestId("tree-node"));
        fireEvent.click(node!);
        visibilityHandler.verify((x) => x.enableCategory(moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled category when disabled category is selected", async () => {
        setupDataProvider([{ id: "test", label: "test-node" }]);
        visibilityHandler.setup((x) => x.isCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => false);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => result.getByTestId("tree-node"));
        fireEvent.click(node!);
        visibilityHandler.verify((x) => x.enableCategory(moq.It.isAny(), true), moq.Times.once());
      });

      it("disables category when enabled category checkbox is unchecked", async () => {
        setupDataProvider([{ id: "test", label: "test-node" }]);
        visibilityHandler.setup((x) => x.isCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => true);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.enableCategory(moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled category when disabled category is selected", async () => {
        setupDataProvider([{ id: "test", label: "test-node" }]);
        visibilityHandler.setup((x) => x.isCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => false);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.enableCategory(moq.It.isAny(), true), moq.Times.once());
      });

    });

    describe("subcategories", () => {
      let categoryNode: TreeNodeItem;
      let subcategoryNode: TreeNodeItem;

      beforeEach(() => {
        categoryNode = { id: "categoryId", label: "category-node", autoExpand: true };
        subcategoryNode = { id: "subcategoryId", label: "subcategory-node", parentId: "categoryId" };
        (categoryNode as any).__key = createKey(categoryNode.id);
        (subcategoryNode as any).__key = createKey(subcategoryNode.id);

        dataProvider.getNodesCount = async () => 1;
        dataProvider.getNodes = async (parent) => {
          if (parent === categoryNode)
            return [subcategoryNode];
          return [categoryNode];
        };
      });

      const getSubCategoryNode = (elements: HTMLElement[]) => {
        expect(elements.length).to.be.eq(2);
        return elements[1];
      };

      it("renders checked checkbox if subcategory is enabled", async () => {
        visibilityHandler.setup((x) => x.isSubCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => true);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        expect(cb!.checked).to.be.true;
      });

      it("disables subCategory when enabled subCategory is selected", async () => {
        visibilityHandler.setup((x) => x.isSubCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => true);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        fireEvent.click(node!);
        visibilityHandler.verify((x) => x.enableSubCategory(moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled subCategory when disabled subCategory is selected", async () => {
        visibilityHandler.setup((x) => x.isSubCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => false);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        fireEvent.click(node!);
        visibilityHandler.verify((x) => x.enableSubCategory(moq.It.isAny(), true), moq.Times.once());
      });

      it("disables subCategory when enabled subCategory checkbox is unchecked", async () => {
        visibilityHandler.setup((x) => x.isSubCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => true);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.enableSubCategory(moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled subCategory when disabled subCategory is selected", async () => {
        visibilityHandler.setup((x) => x.isSubCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => false);
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.enableSubCategory(moq.It.isAny(), true), moq.Times.once());
      });

      it("enabled parent category when disabled subCategory is selected", async () => {
        visibilityHandler.setup((x) => x.isSubCategoryVisible(moq.It.isAny(), moq.It.isAny())).returns(() => false);
        visibilityHandler.setup((x) => x.getParent(moq.It.isAny())).returns(() => ({ key: "ParentCategory" }));
        const result = render(
          <ControlledCategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.enableCategory(["ParentCategory"], true, moq.It.isAny()), moq.Times.once());
        visibilityHandler.verify((x) => x.enableSubCategory(moq.It.isAny(), true), moq.Times.once());
      });

    });

  });

});

describe("CategoryVisibilityHandler", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const viewManagerMock = moq.Mock.ofType<ViewManager>();
  const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
  const selectedSpatialViewMock = moq.Mock.ofType<SpatialViewState>();
  const subCategoriesCacheMock = moq.Mock.ofType<SubCategoriesCache>();
  let visibilityHandler: CategoryVisibilityHandler;

  const categories: Category[] = [
    {
      key: "CategoryKey",
      children: ["SubCategoryKey"],
    },
    {
      key: "SecondCategoryKey",
    },
  ];

  before(() => {
    viewManagerMock.setup((x) => x.onViewOpen).returns(() => new BeUiEvent<ScreenViewport>());
    NoRenderApp.startup({ viewManager: viewManagerMock.object });
  });

  beforeEach(() => {
    imodelMock.reset();
    viewManagerMock.reset();
    selectedViewMock.reset();
    selectedSpatialViewMock.reset();
    subCategoriesCacheMock.reset();

    imodelMock.setup((x) => x.subcategories).returns(() => subCategoriesCacheMock.object);
    subCategoriesCacheMock.setup((x) => x.getSubCategories("CategoryKey")).returns(() => new Set(categories[0].children!));
    viewManagerMock.setup((x) => x.selectedView).returns(() => selectedViewMock.object);
    selectedViewMock.setup((x) => x.view).returns(() => selectedSpatialViewMock.object);
    selectedSpatialViewMock.setup((x) => x.is3d()).returns(() => true);

    visibilityHandler = new CategoryVisibilityHandler(imodelMock.object, categories);
  });

  after(() => {
    IModelApp.shutdown();
  });

  describe("setEnableAll", () => {

    it("enables categories and subCategories", () => {
      visibilityHandler.setEnableAll(true);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryKey", "SecondCategoryKey"], true, true), moq.Times.once());
    });

    it("disables categories and subCategories", () => {
      visibilityHandler.setEnableAll(false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryKey", "SecondCategoryKey"], false, true), moq.Times.once());
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryKey", false), moq.Times.once());
    });

  });

  describe("isCategoryVisible", () => {
    const activeViewMock = moq.Mock.ofType<Viewport>();
    const viewStateMock = moq.Mock.ofType<ViewState>();

    beforeEach(() => {
      activeViewMock.reset();
      viewStateMock.reset();
    });

    it("returns false if active viewport is not supplied", () => {
      expect(visibilityHandler.isCategoryVisible("CategoryKey")).to.be.false;
    });

    it("returns false if category is not visible", () => {
      activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => false);
      expect(visibilityHandler.isCategoryVisible("CategoryKey", activeViewMock.object)).to.be.false;
    });

    it("returns true if category is visible", () => {
      activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => true);
      expect(visibilityHandler.isCategoryVisible("CategoryKey", activeViewMock.object)).to.be.true;
    });

  });

  describe("isSubCategoryVisible", () => {
    const activeViewMock = moq.Mock.ofType<Viewport>();
    const viewStateMock = moq.Mock.ofType<ViewState>();

    beforeEach(() => {
      activeViewMock.reset();
      viewStateMock.reset();
    });

    it("returns false if active viewport is not supplied", () => {
      expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey")).to.be.false;
    });

    it("returns false if parent category is not found", () => {
      expect(visibilityHandler.isSubCategoryVisible("SubCategoryWithoutParent")).to.be.false;
    });

    it("returns false if parent category is not visible in view", () => {
      activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => false);
      expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey", activeViewMock.object)).to.be.false;
    });

    it("returns false if subCategory is not visible in view", () => {
      activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => true);
      activeViewMock.setup((x) => x.isSubCategoryVisible("SubCategoryKey")).returns(() => false);
      expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey", activeViewMock.object)).to.be.false;
    });

    it("returns true if subCategory and parent are visible in view", () => {
      activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => true);
      activeViewMock.setup((x) => x.isSubCategoryVisible("SubCategoryKey")).returns(() => true);
      expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey", activeViewMock.object)).to.be.true;
    });

  });

  describe("enableCategory", () => {
    const screenViewportsMock = moq.Mock.ofType<ScreenViewport>();
    const spatialViewMock = moq.Mock.ofType<SpatialViewState>();

    beforeEach(() => {
      screenViewportsMock.reset();
      screenViewportsMock.setup((x) => x.view).returns(() => spatialViewMock.object);
      spatialViewMock.setup((x) => x.is3d()).returns(() => true);
      visibilityHandler.categories = [{ key: "CategoryId" }];
      viewManagerMock
        .setup((x) => x.forEachViewport(moq.It.isAny()))
        .callback((action) => action(screenViewportsMock.object))
        .verifiable(moq.Times.once());
    });

    it("enables category", () => {
      visibilityHandler.enableCategory(["CategoryId"], true, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
    });

    it("disables category", () => {
      visibilityHandler.enableCategory(["CategoryId"], false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.once());
    });

    it("does not change category state if selectedView is undefined", () => {
      viewManagerMock.reset();
      viewManagerMock.setup((x) => x.selectedView).returns(() => undefined);
      visibilityHandler.enableCategory(["CategoryId"], false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.never());
    });

    it("enables category in all viewports", () => {
      visibilityHandler.allViewports = true;

      visibilityHandler.enableCategory(["CategoryId"], true, false);
      viewManagerMock.verifyAll();
      screenViewportsMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], true, false), moq.Times.once());
    });

    it("disables category in all viewports", () => {
      visibilityHandler.allViewports = true;

      visibilityHandler.enableCategory(["CategoryId"], false, false);
      viewManagerMock.verifyAll();
      screenViewportsMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.once());
    });

    it("does not change category if viewport and selected view has different types", () => {
      visibilityHandler.allViewports = true;

      spatialViewMock.reset();
      spatialViewMock.setup((x) => x.is3d()).returns(() => false);
      visibilityHandler.enableCategory(["CategoryId"], false, false);
      selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryId"], false, false), moq.Times.never());
    });

  });

  describe("enableSubCategory", () => {
    const screenViewportsMock = moq.Mock.ofType<ScreenViewport>();
    const spatialViewMock = moq.Mock.ofType<SpatialViewState>();

    beforeEach(() => {
      screenViewportsMock.reset();
      screenViewportsMock.setup((x) => x.view).returns(() => spatialViewMock.object);
      spatialViewMock.setup((x) => x.is3d()).returns(() => true);
      viewManagerMock
        .setup((x) => x.forEachViewport(moq.It.isAny()))
        .callback((action) => action(screenViewportsMock.object))
        .verifiable(moq.Times.once());
    });

    it("enables subCategory", () => {
      visibilityHandler.enableSubCategory("SubCategoryId", true);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", true), moq.Times.once());
    });

    it("disables subCategory", () => {
      visibilityHandler.enableSubCategory("SubCategoryId", false);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
    });

    it("does not change subCategory state if selectedView is undefined", () => {
      viewManagerMock.reset();
      viewManagerMock.setup((x) => x.selectedView).returns(() => undefined);
      visibilityHandler.enableSubCategory("SubCategoryId", false);
      selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.never());
    });

    it("enables subCategory in all viewports", () => {
      visibilityHandler.allViewports = true;

      visibilityHandler.enableSubCategory("SubCategoryId", true);
      viewManagerMock.verifyAll();
      screenViewportsMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", true), moq.Times.once());
    });

    it("disables subCategory in all viewports", () => {
      visibilityHandler.allViewports = true;

      visibilityHandler.enableSubCategory("SubCategoryId", false);
      viewManagerMock.verifyAll();
      screenViewportsMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.once());
    });

    it("does not change subCategory state if viewport and selectedView has different types", () => {
      visibilityHandler.allViewports = true;

      spatialViewMock.reset();
      spatialViewMock.setup((x) => x.is3d()).returns(() => false);

      visibilityHandler.enableSubCategory("SubCategoryId", false);
      viewManagerMock.verifyAll();
      screenViewportsMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryId", false), moq.Times.never());
    });

  });

});
