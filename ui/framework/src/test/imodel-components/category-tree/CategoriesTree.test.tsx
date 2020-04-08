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
import { IModelConnection, Viewport, SpatialViewState, ViewManager, ScreenViewport, SubCategoriesCache } from "@bentley/imodeljs-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { BeEvent, Id64String } from "@bentley/bentleyjs-core";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import {
  SelectionManager, SelectionChangeEvent, Presentation, PresentationManager,
  RulesetManager, RulesetVariablesManager,
} from "@bentley/presentation-frontend";
import { KeySet, ECInstancesNodeKey, StandardNodeTypes, NodePathElement, LabelDefinition, Node } from "@bentley/presentation-common";
import TestUtils from "../../TestUtils";
import { CategoryTree, toggleAllCategories } from "../../../ui-framework/imodel-components/category-tree/CategoriesTree";
import { CategoryVisibilityHandler } from "../../../ui-framework/imodel-components/category-tree/CategoryVisibilityHandler";

describe("CategoryTree", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  after(() => {
    TestUtils.terminateUiFramework();
    Presentation.terminate();
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
    presentationManagerMock.setup((x) => x.onHierarchyUpdate).returns(() => new BeEvent());
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
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      expect(result.baseElement).to.matchSnapshot();
    });

    it("renders without viewport", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const result = render(
        <CategoryTree
          viewManager={viewManagerMock.object} iModel={imodelMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
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
          viewManager={viewManagerMock.object} iModel={imodelMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      viewManagerMock.verify((x) => x.getFirstOpenView(), moq.Times.once());
    });

    it("sets ruleset variable 'ViewType' to '3d'", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
      render(
        <CategoryTree
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify((x) => x.setString("ViewType", "3d"), moq.Times.once());
    });

    it("sets ruleset variable 'ViewType' to '2d'", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => false);
      render(
        <CategoryTree
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify((x) => x.setString("ViewType", "2d"), moq.Times.once());
    });

    it("renders checked checkbox if category is visible", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      visibilityHandler.reset();
      visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ isDisplayed: true, isDisabled: false }));
      const result = render(
        <CategoryTree
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
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
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
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
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
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
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
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
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
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
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitForElement(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify((x) => x.changeVisibility(subcategoryNode, moq.It.isAny(), true), moq.Times.once());
      });

    });

    describe("filtering", () => {

      beforeEach(() => {
        visibilityHandler.reset();
        dataProvider.getNodeKey = (node: TreeNodeItem) => (node as any)["__presentation-components/key"];
        visibilityHandler.setup(async (x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ isDisplayed: false }));
      });

      it("filters nodes", async () => {
        const filteredNode: Node = {
          key: createKey("filtered-node"),
          label: LabelDefinition.fromLabelString("filtered-node"),
        };
        const filterPromise = Promise.resolve<NodePathElement[]>([{ node: filteredNode, children: [], index: 0 }]);
        dataProvider.getFilteredNodePaths = async () => filterPromise;

        const result = render(<CategoryTree viewManager={viewManagerMock.object} iModel={imodelMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} />);
        await waitForElement(() => result.getByText("filtered-node"));
      });

      it("invokes onFilterApplied callback", async () => {
        const filteredNode: Node = {
          key: createKey("filtered-node"),
          label: LabelDefinition.fromLabelString("filtered-node"),
        };
        const filterPromise = Promise.resolve<NodePathElement[]>([{ node: filteredNode, children: [], index: 0 }]);
        dataProvider.getFilteredNodePaths = async () => filterPromise;
        const spy = sinon.spy();

        const result = render(<CategoryTree viewManager={viewManagerMock.object} iModel={imodelMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} onFilterApplied={spy} />);
        await waitForElement(() => result.getByText("filtered-node"));

        expect(spy).to.be.calledOnce;
      });

    });

  });

  describe("toggleAllCategories", () => {
    const subcategoriesCacheMock = moq.Mock.ofType<SubCategoriesCache>();
    let enableAllStub: sinon.SinonStub<[ViewManager, IModelConnection, string[], boolean, boolean, (boolean | undefined)?], void>;

    beforeEach(() => {
      enableAllStub = sinon.stub(CategoryVisibilityHandler, "enableCategory");
      subcategoriesCacheMock.reset();
      imodelMock.reset();
      async function* generator() {
        yield { id: "CategoryId" };
        return;
      }

      imodelMock.setup((x) => x.query(moq.It.isAny())).returns(() => generator());
      imodelMock.setup((x) => x.subcategories).returns(() => subcategoriesCacheMock.object);
    });

    afterEach(() => {
      enableAllStub.restore();
    });

    it("enables all categories", async () => {
      await toggleAllCategories(viewManagerMock.object, imodelMock.object, true, viewportMock.object);
      expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, ["CategoryId"], true);
    });

    it("disables all categories", async () => {
      await toggleAllCategories(viewManagerMock.object, imodelMock.object, false, viewportMock.object);
      expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, ["CategoryId"], false);
    });

    describe("with filtered dataProvider", () => {
      let dataProvider: IPresentationTreeDataProvider;
      let testNode: TreeNodeItem;

      beforeEach(() => {
        testNode = { id: "filteredNodeId", label: PropertyRecord.fromString("test-node") };
        dataProvider = {
          imodel: imodelMock.object,
          rulesetId: "",
          onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
          dispose: () => { },
          getFilteredNodePaths: async () => [],
          getNodeKey: (node: TreeNodeItem) => (node as any).__key,
          getNodesCount: async () => 1,
          getNodes: async () => [{ ...testNode, __key: createKey(testNode.id) }],
          loadHierarchy: async () => { },
        };
      });

      it("enables all categories", async () => {
        await toggleAllCategories(viewManagerMock.object, imodelMock.object, true, viewportMock.object, true, dataProvider);
        expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, [testNode.id], true);
      });

      it("disables all categories", async () => {
        await toggleAllCategories(viewManagerMock.object, imodelMock.object, false, viewportMock.object, true, dataProvider);
        expect(enableAllStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, [testNode.id], false);
      });

    });

  });

});
