/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent, BeUiEvent, Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection, SpatialViewState, SubCategoriesCache, ViewManager, Viewport } from "@bentley/imodeljs-frontend";
import { ECInstancesNodeKey, KeySet, LabelDefinition, NodePathElement, StandardNodeTypes } from "@bentley/presentation-common";
import { PresentationTreeDataProvider } from "@bentley/presentation-components";
import { mockPresentationManager } from "@bentley/presentation-components/lib/test/_helpers/UiComponents";
import { Presentation, PresentationManager, SelectionChangeEvent, SelectionManager } from "@bentley/presentation-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { TreeNodeItem } from "@bentley/ui-components";
import { fireEvent, render, waitForElement } from "@testing-library/react";
import { CategoryTreeWithSearchBox } from "../../../ui-framework/imodel-components/category-tree/CategoriesTreeWithSearchBox";
import { CategoryVisibilityHandler } from "../../../ui-framework/imodel-components/category-tree/CategoryVisibilityHandler";
import { VisibilityChangeListener } from "../../../ui-framework/imodel-components/VisibilityTreeEventHandler";
import TestUtils from "../../TestUtils";

describe("CategoryTreeWithSearchBox", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
    Presentation.terminate();
  });

  beforeEach(() => {
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  afterEach(() => {
    sinon.restore();
  });

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  let presentationManagerMock: moq.IMock<PresentationManager>;
  const viewportMock = moq.Mock.ofType<Viewport>();
  const viewStateMock = moq.Mock.ofType<SpatialViewState>();
  const viewManagerMock = moq.Mock.ofType<ViewManager>();
  const subcategoriesCacheMock = moq.Mock.ofType<SubCategoriesCache>();

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

    presentationManagerMock = mockPresentationManager().presentationManager;
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
    let enableCategoryStub: sinon.SinonStub<[ViewManager, IModelConnection, string[], boolean, boolean, (boolean | undefined)?], void>;

    beforeEach(() => {
      enableCategoryStub = sinon.stub(CategoryVisibilityHandler, "enableCategory");
      sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
      sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
      sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
      sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake((node: any) => node.__key);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);
      sinon.stub(PresentationTreeDataProvider.prototype, "loadHierarchy");

      visibilityHandler.reset();
      visibilityHandler.setup((x) => x.onVisibilityChange).returns(() => new BeEvent<VisibilityChangeListener>());
      visibilityHandler.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false }));
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

      (PresentationTreeDataProvider.prototype.getNodes as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype,"getNodes").callsFake(
        async () => nodes.map((n) => ({ __key: createKey(n.id), ...n })),
      );
    };

    it("should match snapshot", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const result = render(
        <CategoryTreeWithSearchBox // eslint-disable-line deprecation/deprecation
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} categoryVisibilityHandler={visibilityHandler.object}
        />,
      );
      await waitForElement(() => result.getByText("test-node"));
      expect(result.baseElement).to.matchSnapshot();
    });

    it("enables all categories", async () => {
      setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node") }]);
      const showAll = new BeUiEvent<void>();
      const result = render(
        <CategoryTreeWithSearchBox // eslint-disable-line deprecation/deprecation
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} categoryVisibilityHandler={visibilityHandler.object} showAll={showAll}
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
        <CategoryTreeWithSearchBox // eslint-disable-line deprecation/deprecation
          viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} categoryVisibilityHandler={visibilityHandler.object} hideAll={hideAll}
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
        const filteredNodes: NodePathElement[] = [{
          children: [],
          index: 0,
          node: {
            key: createKey("filter-node-id"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          },
        }];
        (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filteredNodes);

        (PresentationTreeDataProvider.prototype.getNodeKey as any).restore();
        sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake(
          (node: TreeNodeItem) => (node as any)["__presentation-components/key"],
        );
      });

      const applyFilter = (container: HTMLElement) => {
        const filterInput = container.querySelector(".components-filtering-input-input input");
        expect(filterInput).to.not.be.undefined;
        fireEvent.change(filterInput!, { target: { value: "test-filter" } });
        fireEvent.keyDown(filterInput!, { key: "Enter" });
      };

      it("filters tree", async () => {
        const result = render(
          <CategoryTreeWithSearchBox // eslint-disable-line deprecation/deprecation
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} categoryVisibilityHandler={visibilityHandler.object} showSearchBox={true}
          />,
        );
        await waitForElement(() => result.getByText("test-node"));
        applyFilter(result.container);
        await waitForElement(() => result.getByText("filtered-node"));
      });

      it("enables all filtered categories", async () => {
        const showAll = new BeUiEvent<void>();
        const result = render(
          <CategoryTreeWithSearchBox // eslint-disable-line deprecation/deprecation
            viewManager={viewManagerMock.object} iModel={imodelMock.object} activeView={viewportMock.object} categoryVisibilityHandler={visibilityHandler.object} showSearchBox={true} showAll={showAll}
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
