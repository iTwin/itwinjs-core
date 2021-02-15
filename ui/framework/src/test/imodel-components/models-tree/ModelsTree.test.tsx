/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render, waitForElement } from "@testing-library/react";
import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { KeySet, LabelDefinition, Node, NodeKey, NodePathElement } from "@bentley/presentation-common";
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
import TestUtils from "../../TestUtils";
import { VisibilityChangeListener } from "../../../ui-framework/imodel-components/VisibilityTreeEventHandler";
import { ModelsTreeNodeType, ModelsVisibilityHandler } from "../../../ui-framework/imodel-components/models-tree/ModelsVisibilityHandler";
import { ModelsTree, RULESET_MODELS, RULESET_MODELS_GROUPED_BY_CLASS } from "../../../ui-framework/imodel-components/models-tree/ModelsTree";
import { createCategoryNode, createElementClassGroupingNode, createElementNode, createKey, createModelNode, createSubjectNode } from "./Common";

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
