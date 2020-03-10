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
import { IModelConnection, Viewport, SpatialViewState, ViewManager, SubCategoriesCache } from "@bentley/imodeljs-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { TreeNodeItem, TreeDataChangesListener } from "@bentley/ui-components";
import { BeEvent, Id64String, BeUiEvent } from "@bentley/bentleyjs-core";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import {
  SelectionManager, SelectionChangeEvent, Presentation, PresentationManager,
  RulesetManager, RulesetVariablesManager,
} from "@bentley/presentation-frontend";
import { KeySet, ECInstancesNodeKey, StandardNodeTypes, NodePathElement, LabelDefinition } from "@bentley/presentation-common";
import TestUtils from "../../TestUtils";
import { CategoryTreeWithSearchBox } from "../../../ui-framework/imodel-components/category-tree/CategoriesTreeWithSearchBox";
import { CategoryVisibilityHandler } from "../../../ui-framework/imodel-components/category-tree/CategoryVisibilityHandler";

describe("CategoryTreeWithSearchBox", () => {

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
  const subcategoriesCacheMock = moq.Mock.ofType<SubCategoriesCache>();

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
      yield { id: "CategoryId" };
      return;
    }

    imodelMock.setup((x) => x.query(moq.It.isAny())).returns(() => generator());
    imodelMock.setup((x) => x.subcategories).returns(() => subcategoriesCacheMock.object);
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

  describe("<CategoryTreeWithSearchBox />", () => {
    const visibilityHandler = moq.Mock.ofType<CategoryVisibilityHandler>();
    const visibilityChangeSpy = sinon.spy();
    let enableCategoryStub: sinon.SinonStub<[ViewManager, IModelConnection, string[], boolean, boolean, (boolean | undefined)?], void>;
    let dataProvider: IPresentationTreeDataProvider;

    beforeEach(() => {
      enableCategoryStub = sinon.stub(CategoryVisibilityHandler, "enableCategory");
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

    afterEach(() => {
      enableCategoryStub.restore();
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      dataProvider.getNodesCount = async () => nodes.length;
      dataProvider.getNodes = async () => nodes.map((n) => ({ __key: createKey(n.id), ...n }));
    };

    it("should match snapshot", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const result = render(
        <CategoryTreeWithSearchBox // tslint:disable-line: deprecation
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      expect(result.baseElement).to.matchSnapshot();
    });

    it("enables all categories", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const showAll = new BeUiEvent<void>();
      const result = render(
        <CategoryTreeWithSearchBox // tslint:disable-line: deprecation
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} showAll={showAll}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      showAll.emit();
      // let event listener to complete
      await TestUtils.flushAsyncOperations();
      expect(enableCategoryStub).to.be.called;
    });

    it("disables all categories", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const hideAll = new BeUiEvent<void>();
      const result = render(
        <CategoryTreeWithSearchBox // tslint:disable-line: deprecation
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} hideAll={hideAll}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      hideAll.emit();
      // let event listener to complete
      await TestUtils.flushAsyncOperations();
      expect(enableCategoryStub).to.be.called;
    });

    describe("filtering", () => {

      beforeEach(() => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
        const getFilteredNodePathsPromise = Promise.resolve<NodePathElement[]>([{
          children: [],
          index: 0,
          node: {
            key: createKey("filter-node-id"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          },
        }]);
        dataProvider.getFilteredNodePaths = async () => getFilteredNodePathsPromise;
        dataProvider.getNodeKey = (node: TreeNodeItem) => (node as any)["__presentation-components/key"];
      });

      const applyFilter = (container: HTMLElement) => {
        const filterInput = container.querySelector(".components-filtering-input-input input");
        expect(filterInput).to.not.be.undefined;
        fireEvent.change(filterInput!, { target: { value: "test-filter" } });
        fireEvent.keyDown(filterInput!, { key: "Enter" });
      };

      it("filters tree", async () => {
        const result = render(
          <CategoryTreeWithSearchBox // tslint:disable-line: deprecation
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} showSearchBox={true}
          />,
        );
        await waitForElement(() => result.getByText("test-node"));
        applyFilter(result.container);
        await waitForElement(() => result.getByText("filtered-node"));
      });

      it("enables all filtered categories", async () => {
        const showAll = new BeUiEvent<void>();
        const result = render(
          <CategoryTreeWithSearchBox // tslint:disable-line: deprecation
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} dataProvider={dataProvider} categoryVisibilityHandler={visibilityHandler.object} showSearchBox={true} showAll={showAll}
          />,
        );
        await waitForElement(() => result.getByText("test-node"));
        applyFilter(result.container);
        await waitForElement(() => result.getByText("filtered-node"));
        showAll.emit();
        await TestUtils.flushAsyncOperations();
        expect(enableCategoryStub).to.be.calledWith(viewManagerMock.object, imodelMock.object, ["filter-node-id"], true);
      });

    });

  });

});
