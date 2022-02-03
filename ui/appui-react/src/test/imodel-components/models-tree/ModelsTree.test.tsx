/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import * as React from "react";
import { PropertyRecord } from "@itwin/appui-abstract";
import type { TreeNodeItem } from "@itwin/components-react";
import { SelectionMode } from "@itwin/components-react";
import { BeEvent } from "@itwin/core-bentley";
import type { IModelConnection} from "@itwin/core-frontend";
import { SnapshotConnection } from "@itwin/core-frontend";
import type { Node, NodeKey, NodePathElement } from "@itwin/presentation-common";
import { KeySet, LabelDefinition } from "@itwin/presentation-common";
import { createRandomId, deepEquals } from "@itwin/presentation-common/lib/cjs/test";
import { PresentationTreeDataProvider } from "@itwin/presentation-components";
import { mockPresentationManager } from "@itwin/presentation-components/lib/cjs/test";
import type { PresentationManager, RulesetVariablesManager, SelectionManager } from "@itwin/presentation-frontend";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import {
  HierarchyBuilder, HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting,
} from "@itwin/presentation-testing";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { ModelsTree, RULESET_MODELS, RULESET_MODELS_GROUPED_BY_CLASS } from "../../../appui-react/imodel-components/models-tree/ModelsTree";
import type { ModelsVisibilityHandler } from "../../../appui-react/imodel-components/models-tree/ModelsVisibilityHandler";
import { ModelsTreeNodeType } from "../../../appui-react/imodel-components/models-tree/ModelsVisibilityHandler";
import type { VisibilityChangeListener } from "../../../appui-react/imodel-components/VisibilityTreeEventHandler";
import TestUtils from "../../TestUtils";
import { createCategoryNode, createElementClassGroupingNode, createElementNode, createKey, createModelNode, createSubjectNode } from "../Common";

describe("ModelsTree", () => {

  const sizeProps = { width: 200, height: 200 };

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("#unit", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    let presentationManagerMock: moq.IMock<PresentationManager>;
    let rulesetVariablesManagerMock: moq.IMock<RulesetVariablesManager>;

    beforeEach(() => {
      imodelMock.reset();
      selectionManagerMock.reset();
      sinon.stub(PresentationTreeDataProvider.prototype, "imodel").get(() => imodelMock.object);
      sinon.stub(PresentationTreeDataProvider.prototype, "rulesetId").get(() => "");
      sinon.stub(PresentationTreeDataProvider.prototype, "dispose");
      sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves([]);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake((node: any) => node.__key);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(0);
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").resolves([]);

      const selectionChangeEvent = new SelectionChangeEvent();
      selectionManagerMock.setup((x) => x.selectionChange).returns(() => selectionChangeEvent);
      selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
      selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAny())).returns(() => new KeySet());
      Presentation.setSelectionManager(selectionManagerMock.object);

      const mocks = mockPresentationManager();
      presentationManagerMock = mocks.presentationManager;
      rulesetVariablesManagerMock = mocks.rulesetVariablesManager;
      Presentation.setPresentationManager(presentationManagerMock.object);
    });

    after(() => {
      Presentation.terminate();
    });

    const setupDataProvider = (nodes: TreeNodeItem[]) => {
      (PresentationTreeDataProvider.prototype.getNodesCount as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodesCount").resolves(nodes.length);

      (PresentationTreeDataProvider.prototype.getNodes as any).restore();
      sinon.stub(PresentationTreeDataProvider.prototype, "getNodes").callsFake(
        async () => nodes.map((n) => ({ __key: createKey("element", n.id), ...n })),
      );
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
        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => result.getByText("test-node"), { container: result.container });
        expect(result.baseElement).to.matchSnapshot();
      });

      it("renders nodes as unchecked when they're not displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.false);
      });

      it("renders nodes as checked when they're displayed", async () => {
        setupDataProviderForEachNodeType();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible" }));

        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => result.getByText("model"));
        const nodes = result.getAllByTestId("tree-node");
        expect(nodes.length).to.eq(4);
        nodes.forEach((node) => expect(isNodeChecked(node)).to.be.true);
      });

      it("re-renders nodes on `onVisibilityChange` event", async () => {
        const node = createModelNode();
        setupDataProvider([node]);

        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden", isDisabled: false })).verifiable(moq.Times.exactly(2));
        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await waitFor(() => {
          const renderedNode = result.getByTestId("tree-node");
          if (isNodeChecked(renderedNode))
            throw new Error("expecting unchecked node");
          return renderedNode;
        });
        visibilityHandlerMock.verifyAll();

        visibilityHandlerMock.reset();
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "visible", isDisabled: false })).verifiable(moq.Times.exactly(2));
        visibilityChangeEvent.raiseEvent();
        await waitFor(() => {
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
        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        const renderedNode = await result.findByTestId("tree-node");
        expect(renderedNode.querySelectorAll("input").length).to.eq(1);

        result.rerender(<ModelsTree {...sizeProps} iModel={imodelMock.object} />);
        const rerenderedNode = await result.findByTestId("tree-node");
        expect(rerenderedNode.querySelectorAll("input").length).to.eq(0);
      });

      it("calls visibility handler's `changeVisibility` on node checkbox state changes to 'checked'", async () => {
        const node = createModelNode();
        setupDataProvider([node]);
        visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));
        visibilityHandlerMock.setup(async (x) => x.changeVisibility(node, moq.It.isAny(), true)).returns(async () => { }).verifiable();

        const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} />);
        await result.findByText("model");
        const renderedNode = result.getByTestId("tree-node");
        const cb = renderedNode.querySelector("input");
        fireEvent.click(cb!);

        visibilityHandlerMock.verifyAll();
      });

      describe("selection", () => {
        it("adds node to unified selection", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} />);
          await result.findByText("element");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals(element.__key.instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds element node to unified selection according to `selectionPredicate`", async () => {
          const element = createElementNode();
          setupDataProvider([element]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Element;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("element");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals(element.__key.instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds multiple model nodes to unified selection according to `selectionPredicate`", async () => {
          const node1 = createModelNode();
          const node2 = createModelNode();
          node2.id = "model2";
          setupDataProvider([node1, node2]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findAllByText("model");

          const renderedNodes = result.queryAllByTestId("tree-node");
          expect(renderedNodes.length).to.be.eq(2);
          fireEvent.click(renderedNodes[0]);
          fireEvent.click(renderedNodes[1], { ctrlKey: true });

          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals(node1.__key.instanceKeys), 0, ""), moq.Times.once());
          selectionManagerMock.verify((x) => x.addToSelection(moq.It.isAny(), imodelMock.object, deepEquals(node2.__key.instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds subject node to unified selection according to `selectionPredicate`", async () => {
          const subject = createSubjectNode();
          setupDataProvider([subject]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Subject;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("subject");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals(subject.__key.instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds node without extendedData to unified selection according to `selectionPredicate`", async () => {
          const node = createElementNode();
          (node as any).extendedData = undefined;
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Unknown;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("element");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals(node.__key.instanceKeys), 0, ""), moq.Times.once());
        });

        it("adds element class grouping node to unified selection according to `selectionPredicate`", async () => {
          const node = createElementClassGroupingNode([createRandomId(), createRandomId()]);
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => (type === ModelsTreeNodeType.Grouping);

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("grouping");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), imodelMock.object, deepEquals([node.__key]), 0, ""), moq.Times.once());
        });

        it("does not add category node to unified selection according to `selectionPredicate`", async () => {
          const node = createCategoryNode();
          setupDataProvider([node]);
          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));

          const predicate = (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Model;

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} selectionMode={SelectionMode.Extended} selectionPredicate={predicate} />);
          await result.findByText("category");

          const renderedNode = result.getByTestId("tree-node");
          fireEvent.click(renderedNode);
          selectionManagerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        });

      });

      describe("filtering", () => {
        beforeEach(() => {
          (PresentationTreeDataProvider.prototype.getNodeKey as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getNodeKey").callsFake(
            (node: TreeNodeItem) => (node as any)["__presentation-components/key"],
          );

          const filteredNode: Node = {
            key: createKey("element", "filtered-element"),
            label: LabelDefinition.fromLabelString("filtered-node"),
          };
          const filter: NodePathElement[] = [{ node: filteredNode, children: [], index: 0 }];
          (PresentationTreeDataProvider.prototype.getFilteredNodePaths as any).restore();
          sinon.stub(PresentationTreeDataProvider.prototype, "getFilteredNodePaths").resolves(filter);

          visibilityHandlerMock.setup((x) => x.getVisibilityStatus(moq.It.isAny(), moq.It.isAny())).returns(() => ({ state: "hidden" }));
        });

        it("filters nodes", async () => {
          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} />);
          await result.findByText("filtered-node");
        });

        it("invokes onFilterApplied callback", async () => {
          const spy = sinon.spy();

          const result = render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} filterInfo={{ filter: "filtered-node", activeMatchIndex: 0 }} onFilterApplied={spy} />);
          await result.findByText("filtered-node");

          expect(spy).to.be.calledOnce;
        });

        it("filters nodes by element IDs", async () => {
          const elementIds = ["0x123", "0x456"];
          render(<ModelsTree {...sizeProps} iModel={imodelMock.object} modelsVisibilityHandler={visibilityHandlerMock.object} filteredElementIds={elementIds} />);
          rulesetVariablesManagerMock.verify(async (x) => x.setId64s("filtered-element-ids", elementIds), moq.Times.once());
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
          caching: {
            hierarchies: {
              mode: HierarchyCacheMode.Memory,
            },
          },
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
      const result = render(<ModelsTree {...sizeProps} iModel={imodel} />);
      await waitFor(() => result.getByText("Joe's house.bim"), { timeout: 60 * 1000 });
      expect(result.container).to.matchSnapshot();
    });
  });
});
