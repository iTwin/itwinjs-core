/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { render, cleanup, waitForElement, within, fireEvent } from "react-testing-library";
import { expect } from "chai";
import TestUtils from "../../TestUtils";
import { BeEvent, Id64String, using } from "@bentley/bentleyjs-core";
import { IModelConnection, ViewState, Viewport, ViewState3d, SpatialViewState } from "@bentley/imodeljs-frontend";
import { KeySet, ECInstanceNodeKey, StandardNodeTypes, BaseNodeKey } from "@bentley/presentation-common";
import { SelectionManager, Presentation, SelectionChangeEvent } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting, HierarchyBuilder } from "@bentley/presentation-testing";
import { TreeDataChangesListener, TreeNodeItem } from "@bentley/ui-components";
import { VisibilityTree } from "../../../ui-framework";
import { VisibilityHandler, RULESET } from "../../../ui-framework/imodel-components/visibility-tree/VisibilityTree";
import { isPromiseLike } from "@bentley/ui-core";

describe("VisibilityTree", () => {

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

  describe("#unit", () => {

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let dataProvider: IPresentationTreeDataProvider;

    beforeEach(() => {
      cleanup();

      imodelMock.reset();
      selectionManagerMock.reset();
      dataProvider = {
        imodel: imodelMock.object,
        rulesetId: "",
        onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
        getFilteredNodePaths: async () => [],
        getNodeKey: (n: TreeNodeItem) => n.extendedData.key,
        getNodesCount: async () => 0,
        getNodes: async () => [],
      };

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.selection = selectionManagerMock.object;
    });

    after(() => {
      Presentation.terminate();
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      dataProvider.getNodesCount = async () => nodes.length;
      dataProvider.getNodes = async () => nodes.map((n) => ({ extendedData: { key: createKey("element", n.id) }, ...n }));
    };

    const setupDataProviderForEachNodeType = () => {
      setupDataProvider([
        createSubjectNode(),
        createModelNode(),
        createCategoryNode(),
        createElementNode(),
      ]);
    };

    const createSubjectNode = () => ({
      id: "subject",
      label: "subject",
      extendedData: { key: createKey("subject", "subject_id") },
    });

    const createModelNode = () => ({
      id: "model",
      label: "model",
      extendedData: { key: createKey("model", "model_id") },
    });

    const createCategoryNode = () => ({
      id: "category",
      label: "category",
      extendedData: { key: createKey("category", "category_id") },
    });

    const createElementNode = () => ({
      id: "element",
      label: "element",
      extendedData: { key: createKey("element", "element_id") },
    });

    const createKey = (type: "subject" | "model" | "category" | "element", id: Id64String): ECInstanceNodeKey => {
      let className: string;
      switch (type) {
        case "subject": className = "BisCore:Subject"; break;
        case "model": className = "BisCore:PhysicalModel"; break;
        case "category": className = "BisCore:SpatialCategory"; break;
        default: className = "BisCore:SomeElementType";
      }
      return {
        type: StandardNodeTypes.ECInstanceNode,
        instanceKey: { className, id },
        pathFromRoot: [],
      };
    };

    describe("<VisibilityTree />", () => {

      const visibilityHandlerMock = moq.Mock.ofType<VisibilityHandler>();

      beforeEach(() => {
        visibilityHandlerMock.reset();
      });

      const isNodeChecked = (node: HTMLElement): boolean => {
        const cb = node.querySelector("input");
        return cb!.checked;
      };

      it("should match snapshot", async () => {
        setupDataProvider([{ id: "test", label: "test-node" }]);
        visibilityHandlerMock.setup(async (x) => x.isDisplayed(moq.It.isAny())).returns(async () => false);
        const result = render(<VisibilityTree imodel={imodelMock.object} dataProvider={dataProvider} visibilityHandler={visibilityHandlerMock.object} />);
        await waitForElement(() => result.getByText("test-node"), { container: result.container });
        expect(result.baseElement).to.matchSnapshot();
      });

      it("renders nodes without checkboxes when they're not instance-based", async () => {
        setupDataProvider([createElementNode()]);
        dataProvider.getNodeKey = (): BaseNodeKey => ({ type: "test", pathFromRoot: [] });

        const result = render(<VisibilityTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        const renderedNode = await waitForElement(() => result.getByText("element"));
        expect(within(renderedNode).queryAllByTestId("tree-node-checkbox").length).to.eq(0);
      });

      it("renders nodes as unchecked when they're not displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup(async (x) => x.isDisplayed(moq.It.isAny())).returns(async () => false);

        const result = render(<VisibilityTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.false);
      });

      it("renders nodes as checked when they're displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup(async (x) => x.isDisplayed(moq.It.isAny())).returns(async () => true);

        const result = render(<VisibilityTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.true);
      });

      it("re-renders nodes on `onVisibilityChange` callback", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        let cb: undefined | (() => void);
        visibilityHandlerMock.setup((x) => x.onVisibilityChange = moq.It.isAny()).callback((value) => cb = value).verifiable();
        visibilityHandlerMock.setup((x) => x.isDisplayed(moq.It.isAny())).returns(() => false).verifiable(moq.Times.exactly(2));
        const result = render(<VisibilityTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (isNodeChecked(renderedNode))
            throw new Error("expecting unchecked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();

        visibilityHandlerMock.reset();
        visibilityHandlerMock.setup((x) => x.isDisplayed(moq.It.isAny())).returns(() => true).verifiable(moq.Times.exactly(1));
        cb!();
        await waitForElement(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (!isNodeChecked(renderedNode))
            throw new Error("expecting checked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();
      });

      it("calls visibility handler's `changeVisibility` on node checkbox state changes to 'checked'", async () => {
        const node = createModelNode();
        setupDataProvider([node]);
        visibilityHandlerMock.setup(async (x) => x.isDisplayed(moq.It.isAny())).returns(async () => false);
        visibilityHandlerMock.setup(async (x) => x.changeVisibility(node.extendedData.key.instanceKey, true)).returns(async () => Promise.resolve()).verifiable();

        const result = render(<VisibilityTree imodel={imodelMock.object} visibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const renderedNode = result.getByTestId("tree-node");
        const cb = renderedNode.querySelector("input");
        fireEvent.click(cb!);

        visibilityHandlerMock.verifyAll();
      });

    });

    describe("VisibilityHandler", () => {

      interface ViewportMockProps {
        viewState?: ViewState;
        onViewedCategoriesChanged?: BeEvent<(vp: Viewport) => void>;
        onViewedModelsChanged?: BeEvent<(vp: Viewport) => void>;
        onAlwaysDrawnChanged?: BeEvent<() => void>;
        onNeverDrawnChanged?: BeEvent<() => void>;
      }
      const mockViewport = (props?: ViewportMockProps) => {
        if (!props)
          props = {};
        if (!props.viewState)
          props.viewState = moq.Mock.ofType<ViewState>().object;
        if (!props.onViewedCategoriesChanged)
          props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
        if (!props.onViewedModelsChanged)
          props.onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
        if (!props.onAlwaysDrawnChanged)
          props.onAlwaysDrawnChanged = new BeEvent<() => void>();
        if (!props.onNeverDrawnChanged)
          props.onNeverDrawnChanged = new BeEvent<() => void>();
        const vpMock = moq.Mock.ofType<Viewport>();
        vpMock.setup((x) => x.view).returns(() => props!.viewState!);
        vpMock.setup((x) => x.onViewedCategoriesChanged).returns(() => props!.onViewedCategoriesChanged!);
        vpMock.setup((x) => x.onViewedModelsChanged).returns(() => props!.onViewedModelsChanged!);
        vpMock.setup((x) => x.onAlwaysDrawnChanged).returns(() => props!.onAlwaysDrawnChanged!);
        vpMock.setup((x) => x.onNeverDrawnChanged).returns(() => props!.onNeverDrawnChanged!);
        return vpMock;
      };

      describe("constructor", () => {

        it("should subscribe for viewport change events", () => {
          const vpMock = mockViewport();
          new VisibilityHandler(vpMock.object, () => { });
          expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(1);
          expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(1);
          expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(1);
          expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(1);
        });

      });

      describe("dispose", () => {

        it("should unsubscribe from viewport change events", () => {
          const vpMock = mockViewport();
          using(new VisibilityHandler(vpMock.object, () => { }), (_) => {
          });
          expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(0);
          expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(0);
          expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(0);
          expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(0);
        });

      });

      describe("isDisplayed", () => {

        describe("subject", () => {

          it("return false when all models are not displayed", async () => {
            const key = createSubjectNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x1")).returns(() => false);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => ["0x1", "0x2"];

              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.true;
              if (isPromiseLike(result))
                expect(await result).to.be.false;
            });
          });

          it("return true when at least one model is displayed", async () => {
            const key = createSubjectNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x1")).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => ["0x1", "0x2"];

              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.true;
              if (isPromiseLike(result))
                expect(await result).to.be.true;
            });
          });

        });

        describe("model", () => {

          it("return true when displayed", async () => {
            const key = createModelNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.be.true;
            });
          });

          it("returns false when not displayed", async () => {
            const key = createModelNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.be.false;
            });
          });

        });

        describe("category", () => {

          it("return true when displayed", async () => {
            const key = createCategoryNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.be.true;
            });
          });

          it("returns false when not displayed", async () => {
            const key = createCategoryNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.be.false;
            });
          });

        });

        describe("element", () => {

          it("returns false when element is in never displayed list", async () => {
            const key = createElementNode().extendedData.key.instanceKey;

            const vpMock = mockViewport();
            const neverDrawn = new Set([key.id]);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.be.false;
            });
          });

          it("returns false when element's model is not displayed'", async () => {
            const key = createElementNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(moq.It.isAny())).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => false);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.neverDrawn).returns(() => new Set());
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              (handler as any)._elementCategoryAndModelLoader = {
                // note: need to override this private helper to avoid executing a query
                // on the imodel
                getCategoryAndModelId: async () => ({ categoryId: "0x1", modelId: "0x2" }),
              };

              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.be.false;
            });
          });

          it("returns true when element is displayed and is in always displayed list", async () => {
            const key = createElementNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(moq.It.isAny())).returns(() => false);
            viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const alwaysDrawn = new Set([key.id]);
            vpMock.setup((x) => x.neverDrawn).returns(() => new Set());
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              (handler as any)._elementCategoryAndModelLoader = {
                // note: need to override this private helper to avoid executing a query
                // on the imodel
                getCategoryAndModelId: async () => ({ categoryId: "0x1", modelId: "0x2" }),
              };

              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.be.true;
            });
          });

          it("returns true when element's model and category are displayed", async () => {
            const key = createElementNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(moq.It.isAny())).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());
            vpMock.setup((x) => x.neverDrawn).returns(() => new Set());

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              (handler as any)._elementCategoryAndModelLoader = {
                // note: need to override this private helper to avoid executing a query
                // on the imodel
                getCategoryAndModelId: async () => ({ categoryId: "0x1", modelId: "0x2" }),
              };

              const result = handler.isDisplayed(key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.be.true;
            });
          });

        });

      });

      describe("changeVisibility", () => {

        describe("subject", () => {

          it("does nothing for non-spatial views", async () => {
            const key = createSubjectNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay(moq.It.isAny(), moq.It.isAny())).verifiable(moq.Times.never());

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => ["0x1", "0x2"];

              await handler.changeVisibility(key, true);
              vpMock.verifyAll();
            });
          });

          it("makes all subject models visible", async () => {
            const key = createSubjectNode().extendedData.key.instanceKey;
            const subjectModelIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, true)).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => subjectModelIds;

              await handler.changeVisibility(key, true);
              vpMock.verifyAll();
            });
          });

          it("makes all subject models hidden", async () => {
            const key = createSubjectNode().extendedData.key.instanceKey;
            const subjectModelIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, false)).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => subjectModelIds;

              await handler.changeVisibility(key, false);
              vpMock.verifyAll();
            });
          });

        });

        describe("model", () => {

          it("does nothing for non-spatial views", async () => {
            const key = createModelNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<ViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay(moq.It.isAny(), moq.It.isAny())).verifiable(moq.Times.never());

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              await handler.changeVisibility(key, true);
              vpMock.verifyAll();
            });
          });

          it("makes model visible", async () => {
            const key = createModelNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay([key.id], true)).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              await handler.changeVisibility(key, true);
              vpMock.verifyAll();
            });
          });

          it("makes model hidden", async () => {
            const key = createModelNode().extendedData.key.instanceKey;

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay([key.id], false)).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              await handler.changeVisibility(key, false);
              vpMock.verifyAll();
            });
          });

        });

        describe("category", () => {

          it("makes category visible", async () => {
            const key = createCategoryNode().extendedData.key.instanceKey;

            const vpMock = mockViewport();
            vpMock.setup((x) => x.changeCategoryDisplay([key.id], true)).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              await handler.changeVisibility(key, true);
              vpMock.verifyAll();
            });
          });

          it("makes category hidden", async () => {
            const key = createCategoryNode().extendedData.key.instanceKey;

            const vpMock = mockViewport();
            vpMock.setup((x) => x.changeCategoryDisplay([key.id], false)).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              await handler.changeVisibility(key, false);
              vpMock.verifyAll();
            });
          });

        });

        describe("element", () => {

          it("makes element visible by removing from never displayed list and adding to always displayed list", async () => {
            const key = createElementNode().extendedData.key.instanceKey;
            const assemblyChildrenIds = ["0x1", "0x2"];

            const alwaysDisplayed = new Set();
            const neverDisplayed = new Set([key.id]);
            const vpMock = mockViewport();
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => {
              return set.size === 3
                && set.has(key.id)
                && assemblyChildrenIds.reduce((result, id) => (result && set.has(id)), true);
            }))).verifiable();
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getAssemblyElementIds = async () => assemblyChildrenIds;

              await handler.changeVisibility(key, true);
              vpMock.verifyAll();
            });
          });

          it("makes element hidden by removing from always displayed list and adding to never displayed list", async () => {
            const key = createElementNode().extendedData.key.instanceKey;
            const assemblyChildrenIds = ["0x1", "0x2"];

            const alwaysDisplayed = new Set([key.id]);
            const neverDisplayed = new Set();
            const vpMock = mockViewport();
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => {
              return set.size === 3
                && set.has(key.id)
                && assemblyChildrenIds.reduce((result, id) => (result && set.has(id)), true);
            }))).verifiable();

            await using(new VisibilityHandler(vpMock.object, () => { }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getAssemblyElementIds = async () => assemblyChildrenIds;

              await handler.changeVisibility(key, false);
              vpMock.verifyAll();
            });
          });

        });

      });

      describe("visibility change callback", () => {

        it("calls the callback on `onAlwaysDrawnChanged` event", () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onAlwaysDrawnChanged: evt });
          const spy = sinon.spy();
          using(new VisibilityHandler(vpMock.object, spy), (_) => {
            evt.raiseEvent(vpMock.object);
            expect(spy).to.be.calledOnce;
          });
        });

        it("calls the callback on `onNeverDrawnChanged` event", () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onNeverDrawnChanged: evt });
          const spy = sinon.spy();
          using(new VisibilityHandler(vpMock.object, spy), (_) => {
            evt.raiseEvent(vpMock.object);
            expect(spy).to.be.calledOnce;
          });
        });

        it("calls the callback on `onViewedCategoriesChanged` event", () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onViewedCategoriesChanged: evt });
          const spy = sinon.spy();
          using(new VisibilityHandler(vpMock.object, spy), (_) => {
            evt.raiseEvent(vpMock.object);
            expect(spy).to.be.calledOnce;
          });
        });

        it("calls the callback on `onViewedModelsChanged` event", () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onViewedModelsChanged: evt });
          const spy = sinon.spy();
          using(new VisibilityHandler(vpMock.object, spy), (_) => {
            evt.raiseEvent(vpMock.object);
            expect(spy).to.be.calledOnce;
          });
        });

      });

    });

  });

  describe("#integration", () => {

    let imodel: IModelConnection;
    const testIModelPath = "src/test/test-data/Properties_60InstancesWithUrl2.ibim";

    before(() => {
      initializePresentationTesting();
    });

    after(() => {
      terminatePresentationTesting();
    });

    beforeEach(async () => {
      imodel = await IModelConnection.openSnapshot(testIModelPath);
    });

    afterEach(async () => {
      await imodel.closeSnapshot();
    });

    it("shows correct hierarchy", async () => {
      const hierarchyBuilder = new HierarchyBuilder(imodel);
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET);
      expect(hierarchy).to.matchSnapshot();
    });

    it("renders component with real data and no active viewport", async () => {
      const result = render(<VisibilityTree imodel={imodel} />);
      await waitForElement(() => result.getByText("DgnV8Bridge"), { timeout: 60 * 1000 });
      expect(result.container).to.matchSnapshot();
    });

  });

});
