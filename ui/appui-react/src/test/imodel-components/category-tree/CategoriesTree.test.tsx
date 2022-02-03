/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import type { Id64String } from "@itwin/core-bentley";
import { BeEvent } from "@itwin/core-bentley";
import type { IModelConnection, ScreenViewport, SpatialViewState, SubCategoriesCache, ViewManager, Viewport } from "@itwin/core-frontend";
import type { ECInstancesNodeKey, Node, NodePathElement} from "@itwin/presentation-common";
import { KeySet, LabelDefinition, StandardNodeTypes } from "@itwin/presentation-common";
import type { IPresentationTreeDataProvider} from "@itwin/presentation-components";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { mockPresentationManager } from "@itwin/presentation-components/lib/cjs/test";
import type { PresentationManager, RulesetVariablesManager, SelectionManager } from "@itwin/presentation-frontend";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import { PropertyRecord } from "@itwin/appui-abstract";
import type { TreeDataChangesListener, TreeNodeItem } from "@itwin/components-react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CategoryTree, toggleAllCategories } from "../../../appui-react/imodel-components/category-tree/CategoriesTree";
import { CategoryVisibilityHandler } from "../../../appui-react/imodel-components/category-tree/CategoryVisibilityHandler";
import type { VisibilityChangeListener } from "../../../appui-react/imodel-components/VisibilityTreeEventHandler";
import TestUtils from "../../TestUtils";

describe("CategoryTree", () => {

  const sizeProps = { width: 200, height: 200 };

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
    Presentation.terminate();
  });

  afterEach(() => {
    sinon.restore();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  let presentationManagerMock: moq.IMock<PresentationManager>;
  let rulesetVariablesMock: moq.IMock<RulesetVariablesManager>;
  const viewportMock = moq.Mock.ofType<Viewport>();
  const viewStateMock = moq.Mock.ofType<SpatialViewState>();
  const viewManagerMock = moq.Mock.ofType<ViewManager>();

  beforeEach(() => {
    viewManagerMock.reset();
    imodelMock.reset();
    selectionManagerMock.reset();
    viewportMock.reset();
    viewStateMock.reset();

    const selectionChangeEvent = new SelectionChangeEvent();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
    selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
    selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
    Presentation.setSelectionManager(selectionManagerMock.object);

    const mocks = mockPresentationManager();
    presentationManagerMock = mocks.presentationManager;
    rulesetVariablesMock = mocks.rulesetVariablesManager;
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
      version: 0,
      instanceKeys: [{ className: "MyDomain:SpatialCategory", id }],
      pathFromRoot: [],
    };
  };

  describe("<CategoryTree />", () => {
    const visibilityHandler = moq.Mock.ofType<CategoryVisibilityHandler>();

    beforeEach(() => {
      sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
      sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
      sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
      sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake((node: any) => node.__key);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);

      resetVisibilityHandlerMock();
      visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

      (PresentationTreeDataProvider.prototype.getNodes as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
        async () => nodes.map((n) => ({ __key: createKey(n.id), ...n })),
      );
    };

    const resetVisibilityHandlerMock = () => {
      visibilityHandler.reset();
      visibilityHandler.setup((x) => x.onVisibilityChange).returns(() => new BeEvent<VisibilityChangeListener>());
    };

    it("should match snapshot", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const result = render(
        <CategoryTree
          {...sizeProps}
          viewManager={viewManagerMock.object}
          iModel={imodelMock.object}
          activeView={viewportMock.object}
          categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitFor(() => result.getByText("test-node"));
      expect(result.baseElement).to.matchSnapshot();
    });

    it("renders without viewport", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const result = render(
        <CategoryTree
          {...sizeProps}
          viewManager={viewManagerMock.object}
          iModel={imodelMock.object}
          categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitFor(() => result.getByText("test-node"));
    });

    it("takes open view from viewManager", async () => {
      const screenViewportMock = moq.Mock.ofType<ScreenViewport>();
      screenViewportMock.setup((x) => x.view).returns(() => viewStateMock.object);
      viewManagerMock.setup((x) => x.getFirstOpenView()).returns(() => screenViewportMock.object);
      render(
        <CategoryTree
          {...sizeProps}
          viewManager={viewManagerMock.object}
          iModel={imodelMock.object}
          categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      viewManagerMock.verify((x) => x.getFirstOpenView(), moq.Times.once());
    });

    it("sets ruleset variable 'ViewType' to '3d'", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => true);
      render(
        <CategoryTree
          {...sizeProps}
          viewManager={viewManagerMock.object}
          iModel={imodelMock.object}
          activeView={viewportMock.object}
          categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify(async (x) => x.setString("ViewType", "3d"), moq.Times.once());
    });

    it("sets ruleset variable 'ViewType' to '2d'", async () => {
      viewStateMock.reset();
      viewStateMock.setup((x) => x.is3d()).returns(() => false);
      render(
        <CategoryTree
          {...sizeProps}
          viewManager={viewManagerMock.object}
          iModel={imodelMock.object}
          activeView={viewportMock.object}
          categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      rulesetVariablesMock.verify(async (x) => x.setString("ViewType", "2d"), moq.Times.once());
    });

    it("renders checked checkbox if category is visible", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      resetVisibilityHandlerMock();
      visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
      const result = render(
        <CategoryTree
          {...sizeProps}
          viewManager={viewManagerMock.object}
          iModel={imodelMock.object}
          activeView={viewportMock.object}
          categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      const node = await waitFor(() => result.getByTestId("tree-node"));
      const cb = node.querySelector("input");
      expect(cb!.checked).to.be.true;
    });

    describe("categories", () => {
      it("disables category when enabled category checkbox is unchecked", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
        visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false)).returns(async () => { });
        const result = render(
          <CategoryTree
            {...sizeProps}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled category when disabled category checkbox is unchecked", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
        visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true)).returns(async () => { });
        const result = render(
          <CategoryTree
            {...sizeProps}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => result.getByTestId("tree-node"));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true), moq.Times.once());
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

        (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(1);

        (PresentationTreeDataProvider.prototype.getNodes as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
          async (parent) => parent === categoryNode ? [subcategoryNode] : [categoryNode],
        );
      });

      const getSubCategoryNode = (elements: HTMLElement[]) => {
        expect(elements.length).to.be.eq(2);
        return elements[1];
      };

      it("renders checked checkbox if subcategory is enabled", async () => {
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
        const result = render(
          <CategoryTree
            {...sizeProps}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        expect(cb!.checked).to.be.true;
      });

      it("disables subCategory when enabled subCategory checkbox is unchecked", async () => {
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
        visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), false)).returns(async () => { });
        const result = render(
          <CategoryTree
            {...sizeProps}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify(async (x) => x.changeVisibility(subcategoryNode, moq.It.isAny(), false), moq.Times.once());
      });

      it("enabled subCategory when disabled subCategory checkbox is checked", async () => {
        resetVisibilityHandlerMock();
        visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false }));
        visibilityHandler.setup(async (x) => x.changeVisibility(moq.It.isAny(), moq.It.isAny(), true)).returns(async () => { });
        const result = render(
          <CategoryTree
            {...sizeProps}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            activeView={viewportMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
          />,
        );
        const node = await waitFor(() => getSubCategoryNode(result.getAllByTestId("tree-node")));
        const cb = node.querySelector("input");
        fireEvent.click(cb!);
        visibilityHandler.verify(async (x) => x.changeVisibility(subcategoryNode, moq.It.isAny(), true), moq.Times.once());
      });

    });

    describe("filtering", () => {
      beforeEach(() => {
        resetVisibilityHandlerMock();
        (PresentationTreeDataProvider.prototype.getNodeKey as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake(
          (node) => (node as any)["__presentation-components/key"],
        );
        visibilityHandler.setup(async (x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(async () => ({ state: "hidden" }));
      });

      it("filters nodes", async () => {
        const filteredNode: Node = {
          key: createKey("filtered-node"),
          label: LabelDefinition.fromLabelString("filtered-node"),
        };
        const filterValue: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
        (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filterValue);

        const result = render(
          <CategoryTree
            {...sizeProps}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
            filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }}
          />,
        );
        await result.findByText("filtered-node");
      });

      it("invokes onFilterApplied callback", async () => {
        const filteredNode: Node = {
          key: createKey("filtered-node"),
          label: LabelDefinition.fromLabelString("filtered-node"),
        };
        const filterValue: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
        (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filterValue);
        const spy = sinon.spy();

        const result = render(
          <CategoryTree
            {...sizeProps}
            viewManager={viewManagerMock.object}
            iModel={imodelMock.object}
            categoryVisibilityHandler={visibilityHandler.object}
            filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }}
            onFilterApplied={spy}
          />,
        );
        await result.findByText("filtered-node");

        expect(spy).to.be.calledOnce;
      });

      it("renders VisibilityTreeNoFilteredData", async () => {
        const result = render(<CategoryTree
          {...sizeProps}
          viewManager={viewManagerMock.object}
          iModel={imodelMock.object}
          categoryVisibilityHandler={visibilityHandler.object}
          filterInfo={{ filter: "filtered-node1", activeMatchIndex: 0 }}
        />);

        await waitFor(() => result.getByText("categoriesTree.noCategoryFound"));
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
