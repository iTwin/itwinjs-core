/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render, waitForElement } from "@testing-library/react";
import { BeEvent, Id64, Id64String, using } from "@bentley/bentleyjs-core";
import {
  IModelConnection, PerModelCategoryVisibility, SnapshotConnection, SpatialViewState, Viewport, ViewState, ViewState3d,
} from "@bentley/imodeljs-frontend";
import {
  ECClassGroupingNodeKey, ECInstancesNodeKey, InstanceKey, KeySet, LabelDefinition, Node, NodeKey, NodePathElement, StandardNodeTypes,
} from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { createRandomId } from "@bentley/presentation-common/lib/test/_helpers/random";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { mockPresentationManager } from "@bentley/presentation-components/lib/test/_helpers/UiComponents";
import { Presentation, PresentationManager, SelectionChangeEvent, SelectionManager } from "@bentley/presentation-frontend";
import {
  HierarchyBuilder, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@bentley/presentation-testing";
import { PropertyRecord } from "@bentley/ui-abstract";
import { SelectionMode, TreeDataChangesListener, TreeNodeItem } from "@bentley/ui-components";
import { isPromiseLike } from "@bentley/ui-core";
import {
  ModelsTree, ModelsTreeNodeType, ModelsVisibilityHandler, ModelsVisibilityHandlerProps, RULESET_MODELS, RULESET_MODELS_GROUPED_BY_CLASS,
} from "../../../ui-framework";
import TestUtils from "../../TestUtils";
import { VisibilityChangeListener } from "../../../ui-framework/imodel-components/VisibilityTreeEventHandler";

describe("ModelsTree", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  describe("#unit", () => {

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let presentationManagerMock: moq.IMock<PresentationManager>;
    let dataProvider: IPresentationTreeDataProvider;

    beforeEach(() => {
      imodelMock.reset();
      selectionManagerMock.reset();
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

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.setSelectionManager(selectionManagerMock.object);

      presentationManagerMock = mockPresentationManager().presentationManager;
      Presentation.setPresentationManager(presentationManagerMock.object);
    });

    after(() => {
      Presentation.terminate();
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      dataProvider.getNodesCount = async () => nodes.length;
      dataProvider.getNodes = async () => nodes.map((n) => ({ __key: createKey("element", n.id), ...n }));
    };

    const setupDataProviderForEachNodeType = () => {
      setupDataProvider([
        createSubjectNode(),
        createModelNode(),
        createCategoryNode(),
        createElementNode(),
      ]);
    };

    const createSubjectNode = (ids?: Id64String | Id64String[]) => ({
      __key: createKey("subject", ids ? ids : "subject_id"),
      id: "subject",
      label: PropertyRecord.fromString("subject"),
      extendedData: {
        isSubject: true,
      },
    });

    const createModelNode = () => ({
      __key: createKey("model", "model_id"),
      id: "model",
      label: PropertyRecord.fromString("model"),
      extendedData: {
        isModel: true,
      },
    });

    const createCategoryNode = (parentModelKey?: InstanceKey) => ({
      __key: createKey("category", "category_id"),
      id: "category",
      parentId: "model",
      label: PropertyRecord.fromString("category"),
      extendedData: {
        isCategory: true,
        modelId: parentModelKey ? parentModelKey.id : undefined,
      },
    });

    const createElementClassGroupingNode = (elementIds: Id64String[]) => ({
      __key: createClassGroupingKey(elementIds),
      id: "element_class_grouping",
      label: PropertyRecord.fromString("grouping"),
    });

    const createElementNode = (modelId?: Id64String, categoryId?: Id64String) => ({
      __key: createKey("element", "element_id"),
      id: "element",
      label: PropertyRecord.fromString("element"),
      extendedData: {
        modelId,
        categoryId,
      },
    });

    const createKey = (type: "subject" | "model" | "category" | "element", ids: Id64String | Id64String[]): ECInstancesNodeKey => {
      let className: string;
      switch (type) {
        case "subject": className = "MyDomain:Subject"; break;
        case "model": className = "MyDomain:PhysicalModel"; break;
        case "category": className = "MyDomain:SpatialCategory"; break;
        default: className = "MyDomain:SomeElementType";
      }
      const instanceKeys = new Array<InstanceKey>();
      Id64.forEach(ids, (id) => instanceKeys.push({ className, id }));
      return {
        type: StandardNodeTypes.ECInstancesNode,
        instanceKeys,
        pathFromRoot: [],
      };
    };

    const createClassGroupingKey = (ids: Id64String[]): ECClassGroupingNodeKey => {
      return {
        type: StandardNodeTypes.ECClassGroupingNode,
        className: "MyDomain:SomeElementType",
        groupedInstancesCount: Array.isArray(ids) ? ids.length : 1,
        pathFromRoot: [],
      };
    };

    describe("<ModelsTree />", () => {
      const visibilityChangeEvent = new BeEvent<VisibilityChangeListener>();
      const visibilityHandlerMock = moq.Mock.ofType<ModelsVisibilityHandler>();

      beforeEach(() => {
        visibilityChangeEvent.clear();
        visibilityHandlerMock.reset();
        visibilityHandlerMock.setup((x) => x.onVisibilityChange).returns(() => visibilityChangeEvent);
      });

      const isNodeChecked = (node: HTMLElement): boolean => {
        const cb = node.querySelector("input");
        return cb!.checked;
      };

      it("should match snapshot", async () => {
        setupDataProvider([{ id: "test", label: PropertyRecord.fromString("test-node"), isCheckboxVisible: true }]);
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));
        const result = render(<ModelsTree iModel={imodelMock.object} dataProvider={dataProvider} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitForElement(() => result.getByText("test-node"), { container: result.container });
        expect(result.baseElement).to.matchSnapshot();
      });

      it("requests data provider to load the hierarchy if `enablePreloading` is set in props", async () => {
        const spy = sinon.spy(dataProvider, "loadHierarchy");
        render(<ModelsTree iModel={imodelMock.object} dataProvider={dataProvider}
          modelsVisibilityHandler={visibilityHandlerMock.object} enablePreloading={true} />);
        expect(spy).to.be.calledOnce;
      });

      it("renders nodes as unchecked when they're not displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

        const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.false);
      });

      it("renders nodes as checked when they're displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible" }));

        const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.true);
      });

      it("re-renders nodes on `onVisibilityChange` event", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false })).verifiable(moq.Times.exactly(3));
        const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (isNodeChecked(renderedNode))
            throw new Error("expecting unchecked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();

        visibilityHandlerMock.reset();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false })).verifiable(moq.Times.exactly(2));
        visibilityChangeEvent.raiseEvent();
        await waitForElement(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (!isNodeChecked(renderedNode))
            throw new Error("expecting checked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();
      });

      it("re-renders nodes without checkboxes if visibility handler does not exist", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible" }));
        const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        const renderedNode = await waitForElement(() => result.getByTestId("tree-node"));
        expect(renderedNode.querySelectorAll("input").length).to.eq(1);

        result.rerender(<ModelsTree iModel={imodelMock.object} dataProvider={dataProvider} />);
        const rerenderedNode = await waitForElement(() => result.getByTestId("tree-node"));
        expect(rerenderedNode.querySelectorAll("input").length).to.eq(0);
      });

      it("calls visibility handler's `changeVisibility` on node checkbox state changes to 'checked'", async () => {
        const node = createModelNode();
        setupDataProvider([node]);
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));
        visibilityHandlerMock.setup(async (x) => x.changeVisibility(node, moq.It.isAny(), true)).returns(async () => { }).verifiable();

        const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));
        const renderedNode = result.getByTestId("tree-node");
        const cb = renderedNode.querySelector("input");
        fireEvent.click(cb!);

        visibilityHandlerMock.verifyAll();
      });

      it("rerenders when data provider changes", async () => {
        const modelNode = createModelNode();
        setupDataProvider([modelNode]);

        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

        const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} />);
        await waitForElement(() => result.getByText("model"));

        const subjectNode = createSubjectNode();
        const newDataProvider: IPresentationTreeDataProvider = {
          imodel: imodelMock.object,
          rulesetId: "",
          onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
          dispose: () => { },
          getFilteredNodePaths: async () => [],
          getNodeKey: (node: TreeNodeItem) => (node as any).__key,
          getNodesCount: async () => 1,
          getNodes: async () => [subjectNode],
          loadHierarchy: async () => { },
        };

        result.rerender(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={newDataProvider} />);
        await waitForElement(() => result.getByText("subject"));
      });

      describe("selection", () => {

        it("adds node to unified selection", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} selectionMode={SelectionMode.Extended} />);
          await waitForElement(() => result.getByText("element"));

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, moq.deepEquals(element.__key.instanceKeys), 0, dataProvider.rulesetId), moq.Times.once());
        });

        it("adds element node to unified selection according to `selectionPredicate`", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Element;

          const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await waitForElement(() => result.getByText("element"));

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, moq.deepEquals(element.__key.instanceKeys), 0, dataProvider.rulesetId), moq.Times.once());
        });

        it("adds multiple model nodes to unified selection according to `selectionPredicate`", async () => {
          const node1 = createModelNode();
          const node2 = createModelNode();
          node2.id = "model2";
          setupDataProvider([node1, node2]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await waitForElement(() => result.getAllByText("model"));

          const renderedNodes = result.queryAllByTestId("tree-node");
          expect(renderedNodes.length).to.be.eq(2);
          fireEvent.click(renderedNodes[0]);
          fireEvent.click(renderedNodes[1], { ctrlKey: true });

          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, moq.deepEquals(node1.__key.instanceKeys), 0, dataProvider.rulesetId), moq.Times.once());
          selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAny(), imodelMock.object, moq.deepEquals(node2.__key.instanceKeys), 0, dataProvider.rulesetId), moq.Times.once());
        });

        it("adds subject node to unified selection according to `selectionPredicate`", async () => {
          const subject = createSubjectNode();
          setupDataProvider([subject]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Subject;

          const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await waitForElement(() => result.getByText("subject"));

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, moq.deepEquals(subject.__key.instanceKeys), 0, dataProvider.rulesetId), moq.Times.once());
        });

        it("adds node without extendedData to unified selection according to `selectionPredicate`", async () => {
          const node = createElementNode();
          (node as any).extendedData = undefined;
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Unknown;

          const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await waitForElement(() => result.getByText("element"));

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, moq.deepEquals(node.__key.instanceKeys), 0, dataProvider.rulesetId), moq.Times.once());
        });

        it("adds element class grouping node to unified selection according to `selectionPredicate`", async () => {
          const node = createElementClassGroupingNode([createRandomId(), createRandomId()]);
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => (type === ModelsTreeNodeType.Grouping);

          const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await waitForElement(() => result.getByText("grouping"));

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, moq.deepEquals([node.__key]), 0, dataProvider.rulesetId), moq.Times.once());
        });

        it("does not add category node to unified selection according to `selectionPredicate`", async () => {
          const node = createCategoryNode();
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const result = render(<ModelsTree iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} dataProvider={dataProvider} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await waitForElement(() => result.getByText("category"));

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });

      });

      describe("filtering", () => {

        beforeEach(() => {
          dataProvider.getNodeKey = (node: TreeNodeItem) => (node as any)["__presentation-components/key"];
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));
        });

        it("filters nodes", async () => {
          const filteredNode: Node = {
            key: createKey("element", "filtered-element"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          };
          const filterPromise = Promise.resolve<NodePathElement[]>([{ node: filteredNode, children: [], index: 0 }]);
          dataProvider.getFilteredNodePaths = async () => filterPromise;

          const result = render(<ModelsTree iModel={imodelMock.object} dataProvider={dataProvider} modelsVisibilityHandler={visibilityHandlerMock.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} />);
          await waitForElement(() => result.getByText("filtered-node"));
        });

        it("invokes onFilterApplied callback", async () => {
          const filteredNode: Node = {
            key: createKey("element", "filtered-element"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          };
          const filterPromise = Promise.resolve<NodePathElement[]>([{ node: filteredNode, children: [], index: 0 }]);
          dataProvider.getFilteredNodePaths = async () => filterPromise;
          const spy = sinon.spy();

          const result = render(<ModelsTree iModel={imodelMock.object} dataProvider={dataProvider} modelsVisibilityHandler={visibilityHandlerMock.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} onFilterApplied={spy} />);
          await waitForElement(() => result.getByText("filtered-node"));

          expect(spy).to.be.calledOnce;
        });

      });

    });

    describe("VisibilityHandler", () => {

      interface ViewportMockProps {
        viewState?: ViewState;
        perModelCategoryVisibility?: PerModelCategoryVisibility.Overrides;
        onViewedCategoriesPerModelChanged?: BeEvent<(vp: Viewport) => void>;
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
        if (!props.perModelCategoryVisibility)
          props.perModelCategoryVisibility = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>().object;
        if (!props.onViewedCategoriesPerModelChanged)
          props.onViewedCategoriesPerModelChanged = new BeEvent<(vp: Viewport) => void>();
        if (!props.onViewedCategoriesChanged)
          props.onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
        if (!props.onViewedModelsChanged)
          props.onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
        if (!props.onAlwaysDrawnChanged)
          props.onAlwaysDrawnChanged = new BeEvent<() => void>();
        if (!props.onNeverDrawnChanged)
          props.onNeverDrawnChanged = new BeEvent<() => void>();
        const vpMock = moq.Mock.ofType<Viewport>();
        vpMock.setup((x) => x.iModel).returns(() => imodelMock.object);
        vpMock.setup((x) => x.view).returns(() => props!.viewState!);
        vpMock.setup((x) => x.perModelCategoryVisibility).returns(() => props!.perModelCategoryVisibility!);
        vpMock.setup((x) => x.onViewedCategoriesPerModelChanged).returns(() => props!.onViewedCategoriesPerModelChanged!);
        vpMock.setup((x) => x.onViewedCategoriesChanged).returns(() => props!.onViewedCategoriesChanged!);
        vpMock.setup((x) => x.onViewedModelsChanged).returns(() => props!.onViewedModelsChanged!);
        vpMock.setup((x) => x.onAlwaysDrawnChanged).returns(() => props!.onAlwaysDrawnChanged!);
        vpMock.setup((x) => x.onNeverDrawnChanged).returns(() => props!.onNeverDrawnChanged!);
        return vpMock;
      };

      const createHandler = (partialProps?: Partial<ModelsVisibilityHandlerProps>): ModelsVisibilityHandler => {
        if (!partialProps)
          partialProps = {};
        const props: ModelsVisibilityHandlerProps = {
          rulesetId: "test",
          viewport: partialProps.viewport || mockViewport().object,
        };
        return new ModelsVisibilityHandler(props);
      };

      interface SubjectModelIdsMockProps {
        imodelMock: moq.IMock<IModelConnection>;
        subjectsHierarchy: Map<Id64String, Id64String[]>;
        subjectModels: Map<Id64String, Array<{ id: Id64String, content?: string }>>;
      }

      const mockSubjectModelIds = (props: SubjectModelIdsMockProps) => {
        props.imodelMock.setup((x) => x.query(moq.It.is((q: string) => (-1 !== q.indexOf("FROM bis.Subject")))))
          .returns(async function* () {
            const list = new Array<{ id: Id64String, parentId: Id64String }>();
            props.subjectsHierarchy.forEach((ids, parentId) => ids.forEach((id) => list.push({ id, parentId })));
            while (list.length)
              yield list.shift();
          });
        props.imodelMock.setup((x) => x.query(moq.It.is((q: string) => (-1 !== q.indexOf("FROM bis.InformationPartitionElement")))))
          .returns(async function* () {
            const list = new Array<{ id: Id64String, subjectId: Id64String, content?: string }>();
            props.subjectModels.forEach((modelInfos, subjectId) => modelInfos.forEach((modelInfo) => list.push({ id: modelInfo.id, subjectId, content: modelInfo.content })));
            while (list.length)
              yield list.shift();
          });
      };

      describe("constructor", () => {

        it("should subscribe for viewport change events", () => {
          const vpMock = mockViewport();
          createHandler({ viewport: vpMock.object });
          expect(vpMock.object.onViewedCategoriesPerModelChanged.numberOfListeners).to.eq(1);
          expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(1);
          expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(1);
          expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(1);
          expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(1);
        });

      });

      describe("dispose", () => {

        it("should unsubscribe from viewport change events", () => {
          const vpMock = mockViewport();
          using(createHandler({ viewport: vpMock.object }), (_) => {
          });
          expect(vpMock.object.onViewedCategoriesPerModelChanged.numberOfListeners).to.eq(0);
          expect(vpMock.object.onViewedCategoriesChanged.numberOfListeners).to.eq(0);
          expect(vpMock.object.onViewedModelsChanged.numberOfListeners).to.eq(0);
          expect(vpMock.object.onAlwaysDrawnChanged.numberOfListeners).to.eq(0);
          expect(vpMock.object.onNeverDrawnChanged.numberOfListeners).to.eq(0);
        });

      });

      describe("getDisplayStatus", () => {

        it("returns disabled when node is not an instance node", async () => {
          const node = {
            __key: {
              type: "custom",
              pathFromRoot: [],
            },
            id: "custom",
            label: PropertyRecord.fromString("custom"),
          };

          const vpMock = mockViewport();

          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            const result = handler.getVisibilityStatus(node, node.__key);
            expect(isPromiseLike(result)).to.be.false;
            expect(result).to.include({ state: "hidden", isDisabled: true });
          });
        });

        describe("subject", () => {

          it("return disabled when active view is not spatial", async () => {
            const node = createSubjectNode();
            const vpMock = mockViewport();
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              if (isPromiseLike(result))
                expect(await result).to.include({ state: "hidden", isDisabled: true });
            });
          });

          it("return 'hidden' when all models are not displayed", async () => {
            const subjectIds = ["0x1", "0x2"];
            const node = createSubjectNode(subjectIds);
            mockSubjectModelIds({
              imodelMock,
              subjectsHierarchy: new Map([["0x0", subjectIds]]),
              subjectModels: new Map([
                [subjectIds[0], [{ id: "0x3" }, { id: "0x4" }]],
                [subjectIds[1], [{ id: "0x5" }, { id: "0x6" }]],
              ]),
            });

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => false);
            viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => false);
            viewStateMock.setup((x) => x.viewsModel("0x5")).returns(() => false);
            viewStateMock.setup((x) => x.viewsModel("0x6")).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              if (isPromiseLike(result))
                expect(await result).to.include({ state: "hidden" });
            });
          });

          it("return 'visible' when at least one direct model is displayed", async () => {
            const subjectIds = ["0x1", "0x2"];
            const node = createSubjectNode(subjectIds);
            mockSubjectModelIds({
              imodelMock,
              subjectsHierarchy: new Map([["0x0", subjectIds]]),
              subjectModels: new Map([
                [subjectIds[0], [{ id: "0x3" }, { id: "0x4" }]],
                [subjectIds[1], [{ id: "0x5" }, { id: "0x6" }]],
              ]),
            });

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => false);
            viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => false);
            viewStateMock.setup((x) => x.viewsModel("0x5")).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x6")).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              if (isPromiseLike(result))
                expect(await result).to.include({ state: "visible" });
            });
          });

          it("return 'visible' when at least one nested model is displayed", async () => {
            const subjectIds = ["0x1", "0x2"];
            const node = createSubjectNode(subjectIds);
            mockSubjectModelIds({
              imodelMock,
              subjectsHierarchy: new Map([
                [subjectIds[0], ["0x3"]],
                [subjectIds[1], ["0x4"]],
                ["0x3", ["0x5", "0x6"]],
                ["0x7", ["0x8"]],
              ]),
              subjectModels: new Map([
                ["0x6", [{ id: "0x10" }, { id: "0x11" }]],
              ]),
            });

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x11")).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              if (isPromiseLike(result))
                expect(await result).to.include({ state: "visible" });
            });
          });

          it("initializes subject models cache only once", async () => {
            const node = createSubjectNode();
            const key = node.__key.instanceKeys[0];

            mockSubjectModelIds({
              imodelMock,
              subjectsHierarchy: new Map([["0x0", [key.id]]]),
              subjectModels: new Map([[key.id, [{ id: "0x1" }, { id: "0x2" }]]]),
            });

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await Promise.all([handler.getVisibilityStatus(node, node.__key), handler.getVisibilityStatus(node, node.__key)]);
              // expect the `query` to be called only twice (once for subjects and once for models)
              imodelMock.verify((x) => x.query(moq.It.isAnyString()), moq.Times.exactly(2));
            });
          });

          describe("filtered", () => {

            it("return 'visible' when subject node is leaf and at least one model is visible", async () => {
              const node = createSubjectNode();
              const key = node.__key.instanceKeys[0];

              const filteredProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
              filteredProvider.setup(async (x) => x.getNodes(node)).returns(async () => []).verifiable(moq.Times.once());

              mockSubjectModelIds({
                imodelMock,
                subjectsHierarchy: new Map([["0x0", [key.id]]]),
                subjectModels: new Map([[key.id, [{ id: "0x10" }, { id: "0x20" }]]]),
              });

              const viewStateMock = moq.Mock.ofType<ViewState3d>();
              viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
              viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
              viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);

              const vpMock = mockViewport({ viewState: viewStateMock.object });

              await using(createHandler({ viewport: vpMock.object }), async (handler) => {
                handler.setFilteredDataProvider(filteredProvider.object);
                const result = handler.getVisibilityStatus(node, node.__key);
                expect(isPromiseLike(result)).to.be.true;
                if (isPromiseLike(result))
                  expect(await result).to.include({ state: "visible" });
                filteredProvider.verifyAll();
              });
            });

            it("return 'visible' when subject node has child and at least one hidden model is visible", async () => {
              const parentSubjectId = "0x1";
              const childSubjectId = "0x2";
              const node = createSubjectNode(parentSubjectId);
              const childNode = createSubjectNode(childSubjectId);

              const filteredProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
              filteredProvider.setup(async (x) => x.getNodes(node)).returns(async () => [childNode]).verifiable(moq.Times.once());
              filteredProvider.setup(async (x) => x.getNodes(childNode)).returns(async () => []).verifiable(moq.Times.never());

              mockSubjectModelIds({
                imodelMock,
                subjectsHierarchy: new Map([
                  [parentSubjectId, [childSubjectId]],
                ]),
                subjectModels: new Map([
                  [parentSubjectId, [{ id: "0x10", content: "reference" }, { id: "0x11", content: "reference" }]],
                  [childSubjectId, [{ id: "0x20" }]],
                ]),
              });

              const viewStateMock = moq.Mock.ofType<ViewState3d>();
              viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
              viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => true);
              viewStateMock.setup((x) => x.viewsModel("0x11")).returns(() => false);
              viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);

              const vpMock = mockViewport({ viewState: viewStateMock.object });

              await using(createHandler({ viewport: vpMock.object }), async (handler) => {
                handler.setFilteredDataProvider(filteredProvider.object);
                const result = handler.getVisibilityStatus(node, node.__key);
                expect(isPromiseLike(result)).to.be.true;
                if (isPromiseLike(result))
                  expect(await result).to.include({ state: "visible" });
                filteredProvider.verifyAll();
              });
            });

            it("return 'visible' when subject node has children and at least one child has visible models", async () => {
              const parentSubjectId = "0x1";
              const childSubjectIds = ["0x2", "0x3"];
              const node = createSubjectNode(parentSubjectId);
              const childNodes = [createSubjectNode(childSubjectIds[0]), createSubjectNode(childSubjectIds[1])];

              const filteredProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
              filteredProvider.setup(async (x) => x.getNodes(node)).returns(async () => childNodes).verifiable(moq.Times.once());
              filteredProvider.setup(async (x) => x.getNodes(childNodes[0])).returns(async () => []).verifiable(moq.Times.once());
              filteredProvider.setup(async (x) => x.getNodes(childNodes[1])).returns(async () => []).verifiable(moq.Times.once());
              filteredProvider.setup((x) => x.getNodeKey(childNodes[0])).returns(() => childNodes[0].__key).verifiable(moq.Times.once());
              filteredProvider.setup((x) => x.getNodeKey(childNodes[1])).returns(() => childNodes[1].__key).verifiable(moq.Times.once());

              mockSubjectModelIds({
                imodelMock,
                subjectsHierarchy: new Map([
                  [parentSubjectId, childSubjectIds],
                ]),
                subjectModels: new Map([
                  [parentSubjectId, [{ id: "0x10", content: "reference" }]],
                  [childSubjectIds[0], [{ id: "0x20" }]],
                  [childSubjectIds[1], [{ id: "0x30" }]],
                ]),
              });

              const viewStateMock = moq.Mock.ofType<ViewState3d>();
              viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
              viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => false);
              viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);
              viewStateMock.setup((x) => x.viewsModel("0x30")).returns(() => true);

              const vpMock = mockViewport({ viewState: viewStateMock.object });

              await using(createHandler({ viewport: vpMock.object }), async (handler) => {
                handler.setFilteredDataProvider(filteredProvider.object);
                const result = handler.getVisibilityStatus(node, node.__key);
                expect(isPromiseLike(result)).to.be.true;
                if (isPromiseLike(result))
                  expect(await result).to.include({ state: "visible" });
                filteredProvider.verifyAll();
              });
            });

            it("return 'hidden' when subject node has children and children models are not visible", async () => {
              const parentSubjectIds = ["0x1", "0x2"];
              const childSubjectId = "0x3";
              const node = createSubjectNode(parentSubjectIds);
              const childNode = createSubjectNode(childSubjectId);

              const filteredProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
              filteredProvider.setup(async (x) => x.getNodes(node)).returns(async () => [childNode]).verifiable(moq.Times.once());
              filteredProvider.setup(async (x) => x.getNodes(childNode)).returns(async () => []).verifiable(moq.Times.once());
              filteredProvider.setup((x) => x.getNodeKey(childNode)).returns(() => childNode.__key).verifiable(moq.Times.once());

              mockSubjectModelIds({
                imodelMock,
                subjectsHierarchy: new Map([
                  [parentSubjectIds[0], [childSubjectId]],
                  [parentSubjectIds[1], [childSubjectId]],
                ]),
                subjectModels: new Map([
                  [parentSubjectIds[0], [{ id: "0x10", content: "reference" }]],
                  [parentSubjectIds[1], [{ id: "0x20", content: "reference" }]],
                  [childSubjectId, [{ id: "0x30" }]],
                ]),
              });

              const viewStateMock = moq.Mock.ofType<ViewState3d>();
              viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
              viewStateMock.setup((x) => x.viewsModel("0x10")).returns(() => false);
              viewStateMock.setup((x) => x.viewsModel("0x20")).returns(() => false);
              viewStateMock.setup((x) => x.viewsModel("0x30")).returns(() => false);

              const vpMock = mockViewport({ viewState: viewStateMock.object });

              await using(createHandler({ viewport: vpMock.object }), async (handler) => {
                handler.setFilteredDataProvider(filteredProvider.object);
                const result = handler.getVisibilityStatus(node, node.__key);
                expect(isPromiseLike(result)).to.be.true;
                if (isPromiseLike(result))
                  expect(await result).to.include({ state: "hidden" });
                filteredProvider.verifyAll();
              });
            });

          });

        });

        describe("model", () => {

          it("return disabled when active view is not spatial", async () => {
            const node = createModelNode();
            const vpMock = mockViewport();
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden", isDisabled: true });
            });
          });

          it("return 'visible' when displayed", async () => {
            const node = createModelNode();
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "visible" });
            });
          });

          it("returns 'hidden' when not displayed", async () => {
            const node = createModelNode();
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(key.id)).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

        });

        describe("category", () => {

          it("return disabled when model not displayed", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden", isDisabled: true });
            });
          });

          it("return 'visible' when model displayed, category not displayed but per-model override says it's displayed", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

            const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();
            perModelCategoryVisibilityMock.setup((x) => x.getOverride(parentModelKey.id, categoryKey.id)).returns(() => PerModelCategoryVisibility.Override.Show);

            const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "visible" });
            });
          });

          it("return 'visible' when model displayed, category displayed and there're no per-model overrides", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const key = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "visible" });
            });
          });

          it("return 'hidden' when model displayed, category displayed but per-model override says it's not displayed", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

            const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();
            perModelCategoryVisibilityMock.setup((x) => x.getOverride(parentModelKey.id, categoryKey.id)).returns(() => PerModelCategoryVisibility.Override.Hide);

            const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

          it("return 'hidden' when model displayed, category not displayed and there're no per-model overrides", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const key = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(key.id)).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(parentModelKey.id)).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

          it("return 'hidden' when category has no parent model and category is not displayed", async () => {
            const categoryNode = createCategoryNode();
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(categoryNode, categoryNode.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

        });

        describe("element class grouping", () => {

          it("returns disabled when model not displayed", async () => {
            const groupedElementIds = ["0x11", "0x12", "0x13"];
            const node = createElementClassGroupingNode(groupedElementIds);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);
            const vpMock = mockViewport({ viewState: viewStateMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getGroupedElementIds = async () => ({ categoryId: "0x1", modelId: "0x2", elementIds: groupedElementIds });

              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.include({ state: "hidden", isDisabled: true });
            });
          });

          it("returns 'visible' when model displayed and at least one element is in always displayed list", async () => {
            const groupedElementIds = ["0x11", "0x12", "0x13"];
            const node = createElementClassGroupingNode(groupedElementIds);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const alwaysDrawn = new Set([groupedElementIds[1]]);
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getGroupedElementIds = async () => ({ categoryId: "0x1", modelId: "0x2", elementIds: groupedElementIds });

              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.include({ state: "visible" });
            });
          });

          it("returns 'hidden' when model displayed and there's at least one element in always exclusive displayed list that's not grouped under node", async () => {
            const groupedElementIds = ["0x11", "0x12", "0x13"];
            const node = createElementClassGroupingNode(groupedElementIds);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const alwaysDrawn = new Set(["0x4"]);
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getGroupedElementIds = async () => ({ categoryId: "0x1", modelId: "0x2", elementIds: groupedElementIds });

              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.include({ state: "hidden" });
            });
          });

          it("returns 'hidden' when model displayed and all elements are in never displayed list", async () => {
            const groupedElementIds = ["0x11", "0x12", "0x13"];
            const node = createElementClassGroupingNode(groupedElementIds);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const neverDrawn = new Set(groupedElementIds);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getGroupedElementIds = async () => ({ categoryId: "0x1", modelId: "0x2", elementIds: groupedElementIds });

              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.include({ state: "hidden" });
            });
          });

          it("returns 'hidden' when model displayed and category not displayed", async () => {
            const groupedElementIds = ["0x11", "0x12", "0x13"];
            const node = createElementClassGroupingNode(groupedElementIds);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const neverDrawn = new Set(["0x11"]);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getGroupedElementIds = async () => ({ categoryId: "0x1", modelId: "0x2", elementIds: groupedElementIds });

              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.include({ state: "hidden" });
            });
          });

          it("returns 'visible' when model displayed and category displayed", async () => {
            const groupedElementIds = ["0x11", "0x12", "0x13"];
            const node = createElementClassGroupingNode(groupedElementIds);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const neverDrawn = new Set(["0x11"]);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getGroupedElementIds = async () => ({ categoryId: "0x1", modelId: "0x2", elementIds: groupedElementIds });

              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.true;
              expect(await result).to.include({ state: "visible" });
            });
          });

        });

        describe("element", () => {

          it("returns disabled when modelId not set", async () => {
            const node = createElementNode(undefined, "0x1");

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel(moq.It.isAny())).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden", isDisabled: true });
            });
          });

          it("returns disabled when model not displayed", async () => {
            const node = createElementNode("0x2", "0x1");

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);
            const vpMock = mockViewport({ viewState: viewStateMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden", isDisabled: true });
            });
          });

          it("returns 'hidden' when model displayed, category displayed, but element is in never displayed list", async () => {
            const node = createElementNode("0x2", "0x1");
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const neverDrawn = new Set([key.id]);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDrawn);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

          it("returns 'visible' when model displayed and element is in always displayed list", async () => {
            const node = createElementNode("0x2", "0x1");
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            const alwaysDrawn = new Set([key.id]);
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDrawn);

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "visible" });
            });
          });

          it("returns 'visible' when model displayed, category displayed and element is in neither 'never' nor 'always' displayed", async () => {
            const node = createElementNode("0x2", "0x1");

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "visible" });
            });
          });

          it("returns 'hidden' when model displayed, category not displayed and element is in neither 'never' nor 'always' displayed", async () => {
            const node = createElementNode("0x2", "0x1");

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.alwaysDrawn).returns(() => undefined);
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

          it("returns 'hidden' when model displayed, category displayed and some other element is exclusively 'always' displayed", async () => {
            const node = createElementNode("0x2", "0x1");

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set([createRandomId()]));
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

          it("returns 'hidden' when model displayed, categoryId not set and element is in neither 'never' nor 'always' displayed", async () => {
            const node = createElementNode("0x2", undefined);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(moq.It.isAny())).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => true);
            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.alwaysDrawn).returns(() => new Set());
            vpMock.setup((x) => x.neverDrawn).returns(() => new Set());

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              const result = handler.getVisibilityStatus(node, node.__key);
              expect(isPromiseLike(result)).to.be.false;
              expect(result).to.include({ state: "hidden" });
            });
          });

        });

      });

      describe("changeVisibility", () => {

        it("does nothing when node is not an instance node", async () => {
          const node = {
            __key: {
              type: "custom",
              pathFromRoot: [],
            },
            id: "custom",
            label: PropertyRecord.fromString("custom"),
          };

          const vpMock = mockViewport();
          vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            await handler.changeVisibility(node, node.__key, true);
            vpMock.verifyAll();
          });
        });

        describe("subject", () => {

          it("does nothing for non-spatial views", async () => {
            const node = createSubjectNode();

            const viewStateMock = moq.Mock.ofType<ViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => ["0x1", "0x2"];

              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

          it("makes all subject models visible", async () => {
            const node = createSubjectNode();
            const subjectModelIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup(async (x) => x.addViewedModels(subjectModelIds)).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => subjectModelIds;

              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

          it("makes all subject models hidden", async () => {
            const node = createSubjectNode();
            const subjectModelIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, false)).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getSubjectModelIds = async () => subjectModelIds;

              await handler.changeVisibility(node, node.__key, false);
              vpMock.verifyAll();
            });
          });

          describe("filtered", () => {

            ["visible", "hidden"].map((mode) => {
              it(`makes all subject models ${mode} when subject node does not have children`, async () => {
                const node = createSubjectNode();
                const key = node.__key.instanceKeys[0];
                const subjectModelIds = ["0x1", "0x2"];

                const filteredDataProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
                filteredDataProvider.setup(async (x) => x.getNodes(node)).returns(async () => []).verifiable(moq.Times.once());

                const viewStateMock = moq.Mock.ofType<SpatialViewState>();
                viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

                mockSubjectModelIds({
                  imodelMock,
                  subjectsHierarchy: new Map([]),
                  subjectModels: new Map([
                    [key.id, [{ id: subjectModelIds[0], content: "reference" }, { id: subjectModelIds[1] }]],
                  ]),
                });

                const vpMock = mockViewport({ viewState: viewStateMock.object });
                if (mode === "visible") {
                  vpMock.setup(async (x) => x.addViewedModels(subjectModelIds)).verifiable();
                } else {
                  vpMock.setup((x) => x.changeModelDisplay(subjectModelIds, false)).verifiable();
                }

                await using(createHandler({ viewport: vpMock.object }), async (handler) => {
                  handler.setFilteredDataProvider(filteredDataProvider.object);
                  await handler.changeVisibility(node, node.__key, mode === "visible");
                  vpMock.verifyAll();
                  filteredDataProvider.verifyAll();
                });
              });

              it(`makes subject hidden models and all children models ${mode}`, async () => {
                const node = createSubjectNode("0x1");
                const childNode = createSubjectNode("0x2");
                const parentSubjectModelIds = ["0x10", "0x11"];
                const childSubjectModelIds = ["0x20"];

                const filteredDataProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
                filteredDataProvider.setup(async (x) => x.getNodes(node)).returns(async () => [childNode]).verifiable(moq.Times.once());
                filteredDataProvider.setup(async (x) => x.getNodes(childNode)).returns(async () => []).verifiable(moq.Times.once());
                filteredDataProvider.setup((x) => x.getNodeKey(childNode)).returns(() => childNode.__key).verifiable(moq.Times.once());

                const viewStateMock = moq.Mock.ofType<SpatialViewState>();
                viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

                mockSubjectModelIds({
                  imodelMock,
                  subjectsHierarchy: new Map([
                    ["0x1", ["0x2"]],
                  ]),
                  subjectModels: new Map([
                    ["0x1", [{ id: parentSubjectModelIds[0], content: "reference" }, { id: parentSubjectModelIds[1] }]],
                    ["0x2", [{ id: childSubjectModelIds[0] }]],
                  ]),
                });

                const vpMock = mockViewport({ viewState: viewStateMock.object });
                if (mode === "visible") {
                  vpMock.setup(async (x) => x.addViewedModels([parentSubjectModelIds[0]])).verifiable();
                  vpMock.setup(async (x) => x.addViewedModels(childSubjectModelIds)).verifiable();
                } else {
                  vpMock.setup((x) => x.changeModelDisplay([parentSubjectModelIds[0]], false)).verifiable();
                  vpMock.setup((x) => x.changeModelDisplay(childSubjectModelIds, false)).verifiable();
                }

                await using(createHandler({ viewport: vpMock.object }), async (handler) => {
                  handler.setFilteredDataProvider(filteredDataProvider.object);
                  await handler.changeVisibility(node, node.__key, mode === "visible");
                  vpMock.verifyAll();
                  filteredDataProvider.verifyAll();
                });

              });

            });

          });

        });

        describe("model", () => {

          it("does nothing for non-spatial views", async () => {
            const node = createModelNode();

            const viewStateMock = moq.Mock.ofType<ViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup(async (x) => x.addViewedModels(moq.It.isAny())).verifiable(moq.Times.never());

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

          it("makes model visible", async () => {
            const node = createModelNode();
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup(async (x) => x.addViewedModels([key.id])).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

          it("makes model hidden", async () => {
            const node = createModelNode();
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<SpatialViewState>();
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });
            vpMock.setup((x) => x.changeModelDisplay([key.id], false)).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(node, node.__key, false);
              vpMock.verifyAll();
            });
          });

        });

        describe("category", () => {

          it("makes category visible through per-model override when it's not visible through category selector", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

            const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

            const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(categoryNode, categoryNode.__key, true);
              perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.Show), moq.Times.once());
              vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
            });
          });

          it("makes category hidden through override when it's visible through category selector", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);

            const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

            const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(categoryNode, categoryNode.__key, false);
              perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.Hide), moq.Times.once());
              vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
            });
          });

          it("removes category override and enables all sub-categories when making visible and it's visible through category selector", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => true);

            const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

            const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(categoryNode, categoryNode.__key, true);
              perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.None), moq.Times.once());
              vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], true, true), moq.Times.once());
            });
          });

          it("removes category override when making hidden and it's hidden through category selector", async () => {
            const parentModelNode = createModelNode();
            const parentModelKey = parentModelNode.__key.instanceKeys[0];
            const categoryNode = createCategoryNode(parentModelKey);
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory(categoryKey.id)).returns(() => false);

            const perModelCategoryVisibilityMock = moq.Mock.ofType<PerModelCategoryVisibility.Overrides>();

            const vpMock = mockViewport({ viewState: viewStateMock.object, perModelCategoryVisibility: perModelCategoryVisibilityMock.object });

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(categoryNode, categoryNode.__key, false);
              perModelCategoryVisibilityMock.verify((x) => x.setOverride(parentModelKey.id, categoryKey.id, PerModelCategoryVisibility.Override.None), moq.Times.once());
              vpMock.verify((x) => x.changeCategoryDisplay(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
            });
          });

          it("makes category visible in selector and enables all sub-categories when category has no parent model", async () => {
            const categoryNode = createCategoryNode();
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const vpMock = mockViewport();
            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(categoryNode, categoryNode.__key, true);
              vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], true, true), moq.Times.once());
            });
          });

          it("makes category hidden in selector when category has no parent model", async () => {
            const categoryNode = createCategoryNode();
            const categoryKey = categoryNode.__key.instanceKeys[0];

            const vpMock = mockViewport();
            vpMock.setup((x) => x.changeCategoryDisplay([categoryKey.id], false)).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              await handler.changeVisibility(categoryNode, categoryNode.__key, false);
              vpMock.verify((x) => x.changeCategoryDisplay([categoryKey.id], false, false), moq.Times.once());
            });
          });

        });

        describe("element class grouping", () => {

          it("makes elements visible by removing from never displayed list and adding to always displayed list when category is not displayed", async () => {
            const groupedElementIds = ["0x11", "0x12", "0x13"];
            const node = createElementClassGroupingNode(groupedElementIds);

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x1")).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x2")).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            const alwaysDisplayed = new Set<string>();
            const neverDisplayed = new Set([groupedElementIds[0]]);
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => {
              return set.size === 3
                && groupedElementIds.reduce<boolean>((result, id) => (result && set.has(id)), true);
            }), false)).verifiable();
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getGroupedElementIds = async () => ({ categoryId: "0x1", modelId: "0x2", elementIds: groupedElementIds });

              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

        });

        describe("element", () => {

          it("makes element visible by only removing from never displayed list when element's category is displayed", async () => {
            const node = createElementNode("0x4", "0x3");
            const key = node.__key.instanceKeys[0];
            const assemblyChildrenIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            const alwaysDisplayed = new Set<string>();
            const neverDisplayed = new Set([key.id]);
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 0)), false)).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getAssemblyElementIds = async () => assemblyChildrenIds;

              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

          it("makes element visible by removing from never displayed list and adding to always displayed list when category is not displayed", async () => {
            const node = createElementNode("0x4", "0x3");
            const key = node.__key.instanceKeys[0];
            const assemblyChildrenIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x4")).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => false);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            const alwaysDisplayed = new Set<string>();
            const neverDisplayed = new Set([key.id]);
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => {
              return set.size === 3
                && set.has(key.id)
                && assemblyChildrenIds.reduce<boolean>((result, id) => (result && set.has(id)), true);
            }), false)).verifiable();
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getAssemblyElementIds = async () => assemblyChildrenIds;

              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

          it("makes element visible by adding to always displayed list when category is displayed, but element is hidden due to other elements exclusively always drawn", async () => {
            const node = createElementNode("0x4", "0x3");
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x4")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x3")).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            const alwaysDisplayed = new Set<Id64String>([createRandomId()]);
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => {
              return set.size === 2 && set.has(key.id);
            }), true)).verifiable();
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getAssemblyElementIds = async () => [];

              await handler.changeVisibility(node, node.__key, true);
              vpMock.verifyAll();
            });
          });

          it("makes element hidden by only removing from always displayed list when element's category is not displayed", async () => {
            const node = createElementNode("0x4", "0x3");
            const key = node.__key.instanceKeys[0];
            const assemblyChildrenIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => false);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            const alwaysDisplayed = new Set([key.id]);
            const neverDisplayed = new Set<string>();
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 0)), false)).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running queries on the imodel
              (handler as any).getAssemblyElementIds = async () => assemblyChildrenIds;

              await handler.changeVisibility(node, node.__key, false);
              vpMock.verifyAll();
            });
          });

          it("makes element hidden by removing from always displayed list and adding to never displayed list when category is displayed", async () => {
            const node = createElementNode("0x4", "0x3");
            const key = node.__key.instanceKeys[0];
            const assemblyChildrenIds = ["0x1", "0x2"];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            const alwaysDisplayed = new Set([key.id]);
            const neverDisplayed = new Set<string>();
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => false);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => neverDisplayed);
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 0)), false)).verifiable();
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => {
              return set.size === 3
                && set.has(key.id)
                && assemblyChildrenIds.reduce<boolean>((result, id) => (result && set.has(id)), true);
            }))).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getAssemblyElementIds = async () => assemblyChildrenIds;

              await handler.changeVisibility(node, node.__key, false);
              vpMock.verifyAll();
            });
          });

          it("makes element hidden by removing from always displayed list when category is displayed and there are exclusively always drawn elements", async () => {
            const node = createElementNode("0x4", "0x3");
            const key = node.__key.instanceKeys[0];

            const viewStateMock = moq.Mock.ofType<ViewState3d>();
            viewStateMock.setup((x) => x.viewsCategory("0x3")).returns(() => true);
            viewStateMock.setup((x) => x.isSpatialView()).returns(() => true);
            viewStateMock.setup((x) => x.viewsModel("0x4")).returns(() => true);

            const vpMock = mockViewport({ viewState: viewStateMock.object });

            const alwaysDisplayed = new Set([key.id, createRandomId()]);
            vpMock.setup((x) => x.isAlwaysDrawnExclusive).returns(() => true);
            vpMock.setup((x) => x.alwaysDrawn).returns(() => alwaysDisplayed);
            vpMock.setup((x) => x.neverDrawn).returns(() => undefined);
            vpMock.setup((x) => x.setAlwaysDrawn(moq.It.is((set) => (set.size === 1 && !set.has(key.id))), true)).verifiable();
            vpMock.setup((x) => x.setNeverDrawn(moq.It.is((set) => (set.size === 0)))).verifiable();

            await using(createHandler({ viewport: vpMock.object }), async (handler) => {
              // note: need to override to avoid running a query on the imodel
              (handler as any).getAssemblyElementIds = async () => [];

              await handler.changeVisibility(node, node.__key, false);
              vpMock.verifyAll();
            });
          });

        });

      });

      describe("visibility change event", () => {

        it("raises event on `onAlwaysDrawnChanged` event", async () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onAlwaysDrawnChanged: evt });
          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            const spy = sinon.spy();
            handler.onVisibilityChange.addListener(spy);
            evt.raiseEvent(vpMock.object);
            await new Promise((resolve) => setTimeout(resolve));
            expect(spy).to.be.calledOnce;
          });
        });

        it("raises event on `onNeverDrawnChanged` event", async () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onNeverDrawnChanged: evt });
          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            const spy = sinon.spy();
            handler.onVisibilityChange.addListener(spy);
            evt.raiseEvent(vpMock.object);
            await new Promise((resolve) => setTimeout(resolve));
            expect(spy).to.be.calledOnce;
          });
        });

        it("raises event on `onViewedCategoriesChanged` event", async () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onViewedCategoriesChanged: evt });
          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            const spy = sinon.spy();
            handler.onVisibilityChange.addListener(spy);
            evt.raiseEvent(vpMock.object);
            await new Promise((resolve) => setTimeout(resolve));
            expect(spy).to.be.calledOnce;
          });
        });

        it("raises event on `onViewedModelsChanged` event", async () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onViewedModelsChanged: evt });
          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            const spy = sinon.spy();
            handler.onVisibilityChange.addListener(spy);
            evt.raiseEvent(vpMock.object);
            await new Promise((resolve) => setTimeout(resolve));
            expect(spy).to.be.calledOnce;
          });
        });

        it("raises event on `onViewedCategoriesPerModelChanged` event", async () => {
          const evt = new BeEvent();
          const vpMock = mockViewport({ onViewedCategoriesPerModelChanged: evt });
          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            const spy = sinon.spy();
            handler.onVisibilityChange.addListener(spy);
            evt.raiseEvent(vpMock.object);
            await new Promise((resolve) => setTimeout(resolve));
            expect(spy).to.be.calledOnce;
          });
        });

        it("raises event once when multiple affecting events are fired", async () => {
          const evts = {
            onViewedCategoriesPerModelChanged: new BeEvent<(vp: Viewport) => void>(),
            onViewedCategoriesChanged: new BeEvent<(vp: Viewport) => void>(),
            onViewedModelsChanged: new BeEvent<(vp: Viewport) => void>(),
            onAlwaysDrawnChanged: new BeEvent<() => void>(),
            onNeverDrawnChanged: new BeEvent<() => void>(),
          };
          const vpMock = mockViewport({ ...evts });
          await using(createHandler({ viewport: vpMock.object }), async (handler) => {
            const spy = sinon.spy();
            handler.onVisibilityChange.addListener(spy);
            evts.onViewedCategoriesPerModelChanged.raiseEvent(vpMock.object);
            evts.onViewedCategoriesChanged.raiseEvent(vpMock.object);
            evts.onViewedModelsChanged.raiseEvent(vpMock.object);
            evts.onAlwaysDrawnChanged.raiseEvent();
            evts.onNeverDrawnChanged.raiseEvent();
            await new Promise((resolve) => setTimeout(resolve));
            expect(spy).to.be.calledOnce;
          });
        });

      });

    });

  });

  describe("#integration", () => {

    let imodel: IModelConnection;
    const testIModelPath = "src/test/test-data/JoesHouse.bim";

    beforeEach(async () => {
      await initializePresentationTesting({
        backendProps: {
          cacheConfig: { mode: HierarchyCacheMode.Disk, directory: path.join("lib", "test", "cache") },
        },
      });
      imodel = await SnapshotConnection.openFile(testIModelPath);
    });

    afterEach(async () => {
      await imodel.close();
      await terminatePresentationTesting();
    });

    it("shows correct hierarchy", async () => {
      const hierarchyBuilder = new HierarchyBuilder({ imodel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_MODELS);
      expect(hierarchy).to.matchSnapshot();
    });

    it("shows correct hierarchy with class grouping", async () => {
      const hierarchyBuilder = new HierarchyBuilder({ imodel });
      const hierarchy = await hierarchyBuilder.createHierarchy(RULESET_MODELS_GROUPED_BY_CLASS);
      expect(hierarchy).to.matchSnapshot();
    });

    it("renders component with real data and no active viewport", async () => {
      const result = render(<ModelsTree iModel={imodel} />);
      await waitForElement(() => result.getByText("Joe's house.bim"), { timeout: 60 * 1000 });
      expect(result.container).to.matchSnapshot();
    });

  });

});
