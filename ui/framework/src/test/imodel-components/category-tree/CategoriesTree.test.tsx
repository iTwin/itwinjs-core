/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// tslint:disable: no-direct-imports
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { render, waitForElement, cleanup, fireEvent } from "@testing-library/react";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import {
  IModelConnection, Viewport, SpatialViewState, IModelApp, NoRenderApp,
  ViewManager, ScreenViewport, SubCategoriesCache,
} from "@bentley/imodeljs-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { BeEvent, Id64String, BeUiEvent } from "@bentley/bentleyjs-core";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import {
  SelectionManager, SelectionChangeEvent, Presentation, PresentationManager,
  RulesetManager, RulesetVariablesManager,
} from "@bentley/presentation-frontend";
import { KeySet, ECInstancesNodeKey, StandardNodeTypes, InstanceKey } from "@bentley/presentation-common";
import TestUtils from "../../TestUtils";
import { CategoryTree, CategoryVisibilityHandler, Category } from "../../../ui-framework/imodel-components/category-tree/CategoriesTree";

describe("CategoryTree", () => {

  before(async () => {
    viewManagerMock.setup((x) => x.onViewOpen).returns(() => new BeUiEvent<ScreenViewport>());
    NoRenderApp.startup({ viewManager: viewManagerMock.object });
    await TestUtils.initializeUiFramework();
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  after(() => {
    TestUtils.terminateUiFramework();
    Presentation.terminate();
    IModelApp.shutdown();
    sinon.restore();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const rulesetVariablesMock = moq.Mock.ofType<RulesetVariablesManager>();
  const viewportMock = moq.Mock.ofType<Viewport>();
  const viewStateMock = moq.Mock.ofType<SpatialViewState>();
  const viewManagerMock = moq.Mock.ofType<ViewManager>();

  beforeEach(() => {
    cleanup();

    viewManagerMock.reset();
    imodelMock.reset();
    selectionManagerMock.reset();
    presentationManagerMock.reset();
    rulesetManagerMock.reset();
    rulesetVariablesMock.reset();
    viewportMock.reset();
    viewStateMock.reset();

    const selectionChangeEvent = new SelectionChangeEvent();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
    selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
    selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
    Presentation.setSelectionManager(selectionManagerMock.object);
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
    presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesMock.object);
    Presentation.setPresentationManager(presentationManagerMock.object);

    async function* generator() {
      return;
    }

    imodelMock.setup((x) => x.query(moq.It.isAny())).returns(() => generator());
    viewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
    viewStateMock.setup((x) => x.is3d()).returns(() => true);

  });

  const createKey = (id: Id64String): ECInstancesNodeKey => {
    return {
      type: StandardNodeTypes.ECInstancesNode,
      instanceKeys: [{ className: "MyDomain:SpatialCategory", id }],
      pathFromRoot: [],
    };
  };

  describe("<CategoryTree />", () => {
    const visibilityHandler = moq.Mock.ofType<CategoryVisibilityHandler>();
    const visibilityChangeSpy = sinon.spy();
    let dataProvider: IPresentationTreeDataProvider;

    beforeEach(() => {
      visibilityHandler.reset();
      visibilityChangeSpy.resetHistory();
      dataProvider = {
        imodel: imodelMock.object,
        rulesetId: "",
        onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
        dispose: () => { },
        getFilteredNodePaths: async () => [],
        getNodeKey: (node: TreeNodeItem) => (node as any).__key,
        getNodesCount: async () => 0,
        getNodes: async () => [],
        loadHierarchy: async () => { },
      };

      visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: true, isDisabled: false }));
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      dataProvider.getNodesCount = async () => nodes.length;
      dataProvider.getNodes = async () => nodes.map((n) => ({ __key: createKey(n.id), ...n }));
    };

    it("should match snapshot", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const result = render(
        <CategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      expect(result.baseElement).to.matchSnapshot();
    });

    it("renders without viewport", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const result = render(
        <CategoryTree
          iModel={imodelMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
    });

    it("takes open view from viewManager", async () => {
      const screenViewportMock = moq.Mock.ofType<ScreenViewport>();
      screenViewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewManagerMock.setup((x) => x.getFirstOpenView()).returns(() => screenViewportMock.object);
      render(
        <CategoryTree
          iModel={imodelMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      viewManagerMock.verify((x) => x.getFirstOpenView(), moq.Times.once());
    });

    it("sets ruleset variable 'ViewType' to '3d'", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
      render(
        <CategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify((x) => x.setString("ViewType", "3d"), moq.Times.once());
    });

    it("sets ruleset variable 'ViewType' to '2d'", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => false);
      render(
        <CategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify((x) => x.setString("ViewType", "2d"), moq.Times.once());
    });

    it("enables all categories", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      visibilityHandler.setup((x) => x.showAll(undefined)).verifiable();
      const showAll = new BeUiEvent<void>();
      const result = render(
        <CategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} showAll={showAll}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      showAll.emit();
      visibilityHandler.verify((x) => x.showAll(undefined), moq.Times.once());
    });

    it("disables all categories", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const hideAll = new BeUiEvent<void>();
      const result = render(
        <CategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} hideAll={hideAll}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      hideAll.emit();
      visibilityHandler.verify((x) => x.hideAll(undefined), moq.Times.once());
    });

    it("renders checked checkbox if category is visible", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      visibilityHandler.reset();
      visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: true, isDisabled: false }));
      const result = render(
        <CategoryTree
          iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      const node = await waitForElement(() => result.getByTestId("tree-node"));
      const cb = node.querySelector("input");
      expect(cb!.checked).to.be.true;
    });

    describe("categories", () => {

      it("disables category when enabled category checkbox is unchecked", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        visibilityHandler.reset();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: true, isDisabled: false }));
        visibilityHandler.setup((x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false)).returns(async () => Promise.resolve());
        const result = render(
          <CategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled category when disabled category checkbox is unchecked", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        visibilityHandler.reset();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: false, isDisabled: false }));
        visibilityHandler.setup((x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true)).returns(async () => Promise.resolve());
        const result = render(
          <CategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true), moq.Times.once());
      });

    });

    describe("subcategories", () => {
      let categoryNode: TreeNodeItem;
      let subcategoryNode: TreeNodeItem;

      beforeEach(() => {
        categoryNode = { id: "categoryId", label: PropertyRecord.fromString("category-node"), autoExpand: true };
        subcategoryNode = { id: "subcategoryId", label: PropertyRecord.fromString("subcategory-node"), parentId: "categoryId" };
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
        visibilityHandler.reset();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: true, isDisabled: false }));
        const result = render(
          <CategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        expect(cb!.checked).to.be.true;
      });

      it("disables subCategory when enabled subCategory checkbox is unchecked", async () => {
        visibilityHandler.reset();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: true, isDisabled: false }));
        visibilityHandler.setup((x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false)).returns(async () => Promise.resolve());
        const result = render(
          <CategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.changeVisibility(subcategoryNode, moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled subCategory when disabled subCategory checkbox is checked", async () => {
        visibilityHandler.reset();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: false, isDisabled: false }));
        visibilityHandler.setup((x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true)).returns(async () => Promise.resolve());
        const result = render(
          <CategoryTree
            iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.changeVisibility(subcategoryNode, moq.It.isAny(), true), moq.Times.once());
      });

    });

  });

  describe("CategoryVisibilityHandler", () => {
    const selectedViewMock = moq.Mock.ofType<ScreenViewport>();
    const selectedSpatialViewMock = moq.Mock.ofType<SpatialViewState>();
    const subCategoriesCacheMock = moq.Mock.ofType<SubCategoriesCache>();
    const dataProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
    const activeViewMock = moq.Mock.ofType<Viewport>();
    let visibilityHandler: CategoryVisibilityHandler;

    const categoryNode: TreeNodeItem = { id: "CategoryKey", label: PropertyRecord.fromString("category-node"), autoExpand: true };
    const subcategoryNode: TreeNodeItem = { id: "SubCategoryKey", label: PropertyRecord.fromString("subcategory-node"), parentId: "CategoryKey" };
    let categoryKey: ECInstancesNodeKey;
    let subcategoryKey: ECInstancesNodeKey;
    (categoryNode as any).__key = categoryKey = createKey(categoryNode.id);
    (subcategoryNode as any).__key = subcategoryKey = createKey(subcategoryNode.id);

    const categories: Category[] = [
      {
        key: "CategoryKey",
        children: ["SubCategoryKey"],
      },
      {
        key: "SecondCategoryKey",
      },
    ];

    beforeEach(() => {
      imodelMock.reset();
      viewManagerMock.reset();
      selectedViewMock.reset();
      selectedSpatialViewMock.reset();
      subCategoriesCacheMock.reset();
      dataProvider.reset();

      imodelMock.setup((x) => x.subcategories).returns(() => subCategoriesCacheMock.object);
      subCategoriesCacheMock.setup((x) => x.getSubCategories("CategoryKey")).returns(() => new Set(categories[0].children!));
      viewManagerMock.setup((x) => x.selectedView).returns(() => selectedViewMock.object);
      selectedViewMock.setup((x) => x.view).returns(() => selectedSpatialViewMock.object);
      selectedSpatialViewMock.setup((x) => x.is3d()).returns(() => true);

      visibilityHandler = new CategoryVisibilityHandler({
        imodel: imodelMock.object,
        categories,
        activeView: activeViewMock.object,
      });
    });

    after(() => {
      IModelApp.shutdown();
    });

    describe("onVisibilityChange", () => {

      it("sets onVisibilityChange callback", async () => {
        const callback = () => { };
        visibilityHandler.onVisibilityChange = callback;
        expect(callback).to.be.eq(visibilityHandler.onVisibilityChange);
      });

    });

    describe("showAll", () => {

      it("calls setEnableAll", async () => {
        const spy = sinon.spy(visibilityHandler, "setEnableAll");
        await visibilityHandler.showAll();
        expect(spy).to.be.calledWithExactly(true, undefined);
      });

    });

    describe("hideAll", () => {

      it("calls setEnableAll", async () => {
        const spy = sinon.spy(visibilityHandler, "setEnableAll");
        await visibilityHandler.hideAll();
        expect(spy).to.be.calledWithExactly(false, undefined);
      });

    });

    describe("changeVisibility", () => {

      it("calls enableCategory", async () => {
        const spy = sinon.spy(visibilityHandler, "enableCategory");
        await visibilityHandler.changeVisibility(categoryNode, categoryKey, true);
        expect(spy).to.be.calledWith([categoryNode.id], true, true);
      });

      it("calls enableSubcategoryCategory", async () => {
        const spy = sinon.spy(visibilityHandler, "enableSubCategory");
        await visibilityHandler.changeVisibility(subcategoryNode, subcategoryKey, false);
        expect(spy).to.be.calledWith(subcategoryNode.id, false);
      });

      it("calls enableSubcategoryCategory and enableCategory to ensure that parent category is enabled", async () => {
        const enableCategorySpy = sinon.spy(visibilityHandler, "enableCategory");
        const enableSubCategorySpy = sinon.spy(visibilityHandler, "enableSubCategory");
        await visibilityHandler.changeVisibility(subcategoryNode, subcategoryKey, true);
        expect(enableCategorySpy).to.be.calledWith(["CategoryKey"], true, false);
        expect(enableSubCategorySpy).to.be.calledWith(subcategoryNode.id, true);
        expect(enableCategorySpy.calledBefore(enableSubCategorySpy)).to.be.true;
      });

    });

    describe("getVisibilityStatus", () => {

      it("calls isCategoryVisible", () => {
        const spy = sinon.stub(visibilityHandler, "isCategoryVisible");
        visibilityHandler.getVisibilityStatus(categoryNode, categoryKey);
        expect(spy).to.be.calledWith(categoryNode.id);
      });

      it("calls isSubCategoryVisible", () => {
        const spy = sinon.stub(visibilityHandler, "isSubCategoryVisible");
        visibilityHandler.getVisibilityStatus(subcategoryNode, subcategoryKey);
        expect(spy).to.be.calledWith(subcategoryNode.id);
      });

    });

    describe("setEnableAll", () => {

      it("enables categories and subCategories", async () => {
        await visibilityHandler.setEnableAll(true);
        selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryKey", "SecondCategoryKey"], true, true), moq.Times.once());
      });

      it("disables categories and subCategories", async () => {
        await visibilityHandler.setEnableAll(false);
        selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryKey", "SecondCategoryKey"], false, true), moq.Times.once());
        selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryKey", false), moq.Times.once());
      });

      describe("with filtered data provider", () => {
        const filteredProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

        beforeEach(() => {
          filteredProviderMock.reset();

          const node: TreeNodeItem = {
            id: "nodeId",
            label: PropertyRecord.fromString("nodeLabel"),
          };
          const instanceKey: InstanceKey = {
            className: "class name",
            id: "CategoryKey",
          };
          const key: ECInstancesNodeKey = {
            type: StandardNodeTypes.ECInstancesNode,
            instanceKeys: [instanceKey],
            pathFromRoot: [],
          };
          filteredProviderMock.setup((x) => x.getNodes()).returns(async () => [node]);
          filteredProviderMock.setup((x) => x.getNodeKey(node)).returns(() => key);
        });

        it("enables categories and subCategories", async () => {
          await visibilityHandler.setEnableAll(true, filteredProviderMock.object);
          selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryKey"], true, true), moq.Times.once()); // no SecondCategoryKey
        });

        it("disables categories and subCategories", async () => {
          await visibilityHandler.setEnableAll(false, filteredProviderMock.object);
          selectedViewMock.verify((x) => x.changeCategoryDisplay(["CategoryKey"], false, true), moq.Times.once()); // no SecondCategoryKey
          selectedViewMock.verify((x) => x.changeSubCategoryDisplay("SubCategoryKey", false), moq.Times.once());
        });

      });

    });

    describe("isCategoryVisible", () => {

      beforeEach(() => {
        activeViewMock.reset();
        viewStateMock.reset();
      });

      it("returns false if active viewport is not supplied", () => {
        visibilityHandler = new CategoryVisibilityHandler({ imodel: imodelMock.object, categories });
        expect(visibilityHandler.isCategoryVisible("CategoryKey")).to.be.false;
      });

      it("returns false if category is not visible", () => {
        activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
        viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => false);
        expect(visibilityHandler.isCategoryVisible("CategoryKey")).to.be.false;
      });

      it("returns true if category is visible", () => {
        activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
        viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => true);
        expect(visibilityHandler.isCategoryVisible("CategoryKey")).to.be.true;
      });

    });

    describe("isSubCategoryVisible", () => {

      beforeEach(() => {
        activeViewMock.reset();
        viewStateMock.reset();
      });

      it("returns false if active viewport is not supplied", () => {
        visibilityHandler = new CategoryVisibilityHandler({ imodel: imodelMock.object, categories });
        expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey")).to.be.false;
      });

      it("returns false if parent category is not found", () => {
        expect(visibilityHandler.isSubCategoryVisible("SubCategoryWithoutParent")).to.be.false;
      });

      it("returns false if parent category is not visible in view", () => {
        activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
        viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => false);
        expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey")).to.be.false;
      });

      it("returns false if subCategory is not visible in view", () => {
        activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
        viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => true);
        activeViewMock.setup((x) => x.isSubCategoryVisible("SubCategoryKey")).returns(() => false);
        expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey")).to.be.false;
      });

      it("returns true if subCategory and parent are visible in view", () => {
        activeViewMock.setup((x) => x.view).returns(() => viewStateMock.object);
        viewStateMock.setup((x) => x.viewsCategory("CategoryKey")).returns(() => true);
        activeViewMock.setup((x) => x.isSubCategoryVisible("SubCategoryKey")).returns(() => true);
        expect(visibilityHandler.isSubCategoryVisible("SubCategoryKey")).to.be.true;
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

});
