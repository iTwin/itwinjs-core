/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "@bentley/ui-abstract";
import { CheckBoxState } from "@bentley/ui-core";
import { cleanup, fireEvent, render, RenderResult, wait, waitForElement, within } from "@testing-library/react";
import {
  DelayLoadedTreeNodeItem, ImmediatelyLoadedTreeNodeItem, ITreeDataProvider, PageOptions, SelectionMode, TreeCellUpdatedArgs, TreeDataChangesListener,
  TreeDataProviderMethod, TreeDataProviderRaw, TreeNodeItem,
} from "../../../../ui-components";
import { getPropertyRecordAsString } from "../../../../ui-components/common/getPropertyRecordAsString";
import { LoadedImage } from "../../../../ui-components/common/IImageLoader";
import { BeInspireTreeNode, BeInspireTreeNodeConfig } from "../../../../ui-components/tree/deprecated/component/BeInspireTree";
import { TreeNodeProps } from "../../../../ui-components/tree/deprecated/component/Node";
import {
  NodesDeselectedCallback, NodesSelectedCallback, DEPRECATED_Tree as Tree, TreeProps,
} from "../../../../ui-components/tree/deprecated/component/Tree";
import { HighlightableTreeProps, HighlightingEngine } from "../../../../ui-components/tree/HighlightingEngine";
import { ITreeImageLoader } from "../../../../ui-components/tree/ImageLoader";
import { TreeComponentTestId } from "../../../../ui-components/tree/TreeComponentTestId";
import { ResolvablePromise, waitForUpdate } from "../../../test-helpers/misc";
import TestUtils from "../../../TestUtils";
import { TestTreeDataProvider } from "../../TestDataFactories";
import { PropertyValueRendererManager } from "../../../../ui-components/properties/ValueRendererManager";

/* eslint-disable deprecation/deprecation */

describe("Tree", () => {

  const verifyNodes = (nodes: TreeNodeItem[], ids: string[]) => {
    if (nodes.length !== ids.length)
      return false;

    for (const id of ids) {
      if (!nodes.find((x) => x.id === id))
        return false;
    }
    return true;
  };

  type NodeElement = HTMLElement & {
    contentArea: HTMLElement;
    expansionToggle: HTMLElement | undefined;
    checkbox: HTMLInputElement | undefined;
  };
  const getNode = (label: string): NodeElement => {
    const result = renderedTree.getAllByTestId(TreeComponentTestId.Node).reduce<NodeElement[]>((list: NodeElement[], node) => {
      const nodeContents = within(node).getByTestId(TreeComponentTestId.NodeContents);
      if (nodeContents.textContent === label || within(nodeContents).queryByText(label)) {
        list.push(Object.assign(node, {
          contentArea: nodeContents,
          expansionToggle: within(node).queryByTestId(TreeComponentTestId.NodeExpansionToggle) || undefined,
          checkbox: within(node).queryByTestId(TreeComponentTestId.NodeCheckbox) as HTMLInputElement || undefined,
        }));
      }
      return list;
    }, []);
    if (!result || !result.length)
      throw new Error(`Node with label "${label}" not found`);
    if (result.length > 1)
      throw new Error(`Found more than one node with label "${label}"`);
    return result[0];
  };
  const getNodeLabel = (node: HTMLElement): string => {
    const contents = within(node).getByTestId(TreeComponentTestId.NodeContents);
    const labelSpan = contents.querySelector("div.components-tree-node-content span");
    return labelSpan!.innerHTML;
  };

  const createDataProvider = (expandedNodes?: string[]): TreeDataProviderMethod => {
    const isExpanded = (id: string) => (undefined === expandedNodes) || expandedNodes.includes(id);
    return async (parent?: TreeNodeItem) => {
      if (!parent)
        return [
          { id: "0", label: PropertyRecord.fromString("0"), hasChildren: true, autoExpand: isExpanded("0"), isEditable: true },
          { id: "1", label: PropertyRecord.fromString("1"), hasChildren: true, autoExpand: isExpanded("1") },
        ];
      return [
        { id: `${parent.id}-a`, label: PropertyRecord.fromString(`${getPropertyRecordAsString(parent.label)}-a`) },
        { id: `${parent.id}-b`, label: PropertyRecord.fromString(`${getPropertyRecordAsString(parent.label)}-b`) },
      ];
    };
  };

  let renderedTree: RenderResult;
  let renderSpy: sinon.SinonSpy;
  let renderNodesSpy: sinon.SinonSpy;
  let defaultProps: Partial<TreeProps>;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
    sinon.restore();
    renderSpy = sinon.spy();
    renderNodesSpy = sinon.spy();
    defaultProps = {
      onRender: renderSpy,
      onNodesRender: renderNodesSpy,
    };

    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  afterEach(() => {
    sinon.restore();
  });

  const getSelectedNodes = (): Array<HTMLElement & { label: string }> => {
    return renderedTree.getAllByTestId(TreeComponentTestId.Node as any)
      .filter((node) => node.classList.contains("is-selected"))
      .map((node) => Object.assign(node, { label: getNodeLabel(node) }));
  };

  describe("selection", () => {

    let defaultSelectionProps: TreeProps;
    const nodesSelectedCallbackMock = moq.Mock.ofType<NodesSelectedCallback>();
    const nodesDeselectedCallbackMock = moq.Mock.ofType<NodesDeselectedCallback>();

    beforeEach(async () => {
      nodesSelectedCallbackMock.reset();
      nodesDeselectedCallbackMock.reset();

      defaultSelectionProps = {
        ...defaultProps,
        dataProvider: createDataProvider(),
        onNodesSelected: nodesSelectedCallbackMock.object,
        onNodesDeselected: nodesDeselectedCallbackMock.object,
        selectionMode: SelectionMode.SingleAllowDeselect,
        propertyValueRendererManager: PropertyValueRendererManager.defaultManager,
      };
    });

    it("marks selected node wrappers", async () => {
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectedNodes={["0"]} />), renderSpy, 2);
      const selectedNodes = getSelectedNodes();
      expect(selectedNodes.length).to.eq(1);

      const selectedNode = selectedNodes[0];
      expect(getNodeLabel(selectedNode)).to.eq("0");
      expect(selectedNode.parentElement!.classList.contains("is-selected")).to.be.true;
    });

    describe("with Single selection mode", () => {

      beforeEach(async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectionMode={SelectionMode.Single} />), renderSpy, 2);
      });

      it("selects a node", async () => {
        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);

        // verify
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.eq(1);
      });

      it("deselects other nodes when selects a node", async () => {
        // render tree with nodes 0 and 1 selected
        await waitForUpdate(() => renderedTree.rerender(<Tree {...defaultSelectionProps} selectionMode={SelectionMode.Single} selectedNodes={["0", "1"]} />), renderSpy);
        expect(getSelectedNodes().length).to.eq(2);

        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy, 1);

        // verify node 0 replaced multi-selection
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.eq(1);
      });

    });

    describe("with Extended selection mode", () => {

      let extendedSelectionProps: TreeProps;

      beforeEach(async () => {
        extendedSelectionProps = {
          ...defaultSelectionProps,
          selectionMode: SelectionMode.Extended,
        };
      });

      const createDefaultTreeForExtendedSelection = async () => {
        return waitForUpdate(() => renderedTree = render(<Tree {...extendedSelectionProps} />), renderSpy, 2);
      };

      it("deselects collapsed nodes when selects a node", async () => {
        await createDefaultTreeForExtendedSelection();

        // select node 0a
        await waitForUpdate(() => fireEvent.click(getNode("0-a").contentArea), renderSpy);
        expect(getSelectedNodes().length).to.equal(1);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0-a"])), true), moq.Times.once());

        // ctrl-select node 0b
        await waitForUpdate(() => fireEvent.click(getNode("0-b").contentArea, { ctrlKey: true }), renderSpy);
        expect(getSelectedNodes().length).to.equal(2);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0-b"])), false), moq.Times.once());

        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
        expect(getSelectedNodes().length).to.equal(1);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
      });

      it("shift select nodes from top to bottom", async () => {
        await createDefaultTreeForExtendedSelection();

        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());

        // shift-select node 1
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "0-a", "0-b", "1"])), true), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(4);
      });

      it("shift select nodes from bottom to top", async () => {
        await createDefaultTreeForExtendedSelection();

        // select node 1
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["1"])), true), moq.Times.once());

        // shift-select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea, { shiftKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "0-a", "0-b", "1"])), true), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(4);
      });

      it("shift select nodes from node index 10 to 2", async () => {
        const nodeIds = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
        extendedSelectionProps.dataProvider = nodeIds.map((id) => ({ id, label: PropertyRecord.fromString(id) }));

        await createDefaultTreeForExtendedSelection();

        // select node 10
        await waitForUpdate(() => fireEvent.click(getNode("10").contentArea), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["10"])), true), moq.Times.once());

        // shift-select node 2
        await waitForUpdate(() => fireEvent.click(getNode("2").contentArea, { shiftKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["2", "3", "4", "5", "6", "7", "8", "9", "10"])), true), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(9);
      });

      it("shift selecting nodes does not select collapsed nodes", async () => {
        await createDefaultTreeForExtendedSelection();

        // collapse node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderSpy);

        // select node 1
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["1"])), true), moq.Times.once());

        // shift-select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea, { shiftKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "1"])), true), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(2);
      });

      it("ctrl selects nodes", async () => {
        await createDefaultTreeForExtendedSelection();

        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea, { ctrlKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), false), moq.Times.once());

        // ctrl-select node 1
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { ctrlKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["1"])), false), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(2);
      });

      describe("shift selecting not loaded nodes", () => {
        const selectionLoadProgressListener = sinon.stub();
        const selectionLoadCanceledListener = sinon.spy();
        const selectionLoadFinishedListener = sinon.spy();
        let dataProvider: TestTreeDataProvider;

        beforeEach(async () => {
          dataProvider = new TestTreeDataProvider([
            {
              id: "0",
              autoExpand: true,
              children: [
                { id: "a" },
                {
                  id: "b",
                  delayedLoad: true,
                  children: [
                    { id: "y" },
                    { id: "z", delayedLoad: true },
                  ],
                },
                { id: "c", delayedLoad: true },
              ],
            },
            { id: "1" },
            { id: "2" },
          ]);

          selectionLoadProgressListener.reset();
          selectionLoadCanceledListener.resetHistory();
          selectionLoadFinishedListener.resetHistory();
          renderSpy.resetHistory();
          cleanup();
        });

        const createPropsForDelayLoadedShiftSelection = () => {
          return {
            ...defaultSelectionProps,
            dataProvider,
            pageSize: 1,
            selectionMode: SelectionMode.Extended,
            onSelectionLoadProgress: selectionLoadProgressListener,
            onSelectionLoadCanceled: selectionLoadCanceledListener,
            onSelectionLoadFinished: selectionLoadFinishedListener,
          };
        };

        const createDefaultTreeForDelayLoadedShiftSelection = async (props: TreeProps = createPropsForDelayLoadedShiftSelection()) => {
          // need to wait 3 renders:
          // - initial display
          // - first load of node 0
          // - second load of node 1 & 2
          await waitForUpdate(() => renderedTree = render(<Tree {...props} />), renderSpy, 3);

          // make sure "a" is loaded and "b" and "c" are not loaded
          expect(getNode("a")).to.not.be.undefined;
          expect(() => getNode("b")).throws;
          expect(() => getNode("c")).throws;
        };

        it("loads intermediate nodes", async () => {
          await createDefaultTreeForDelayLoadedShiftSelection();

          // select node 0
          await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
          expect(selectionLoadProgressListener).to.not.be.called;
          expect(selectionLoadFinishedListener).to.not.be.called;

          // shift-select node 1
          await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "a", "1"])), true), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(0, 2, sinon.match.func);
          expect(selectionLoadFinishedListener).to.not.be.called;

          // resolve the 'b' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("b"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for second intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["b"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(1, 2, sinon.match.func);
          expect(selectionLoadFinishedListener).to.not.be.called;

          // resolve the 'c' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("c"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for the final selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["c"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(2, 2, sinon.match.func);
          expect(selectionLoadFinishedListener).to.be.calledOnce;

          expect(selectionLoadCanceledListener).to.not.be.called;
          nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
          expect(getSelectedNodes().length).to.equal(5);
        });

        it("loads auto-expanded child nodes", async () => {
          dataProvider = new TestTreeDataProvider([
            {
              id: "0",
              autoExpand: true,
              children: [
                { id: "a" },
                {
                  id: "b",
                  autoExpand: true,
                  delayedLoad: true,
                  children: [
                    { id: "y" },
                    { id: "z", delayedLoad: true },
                  ],
                },
                { id: "c", delayedLoad: true },
              ],
            },
            { id: "1" },
            { id: "2" },
          ]);
          await createDefaultTreeForDelayLoadedShiftSelection();

          // select node 0
          await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
          expect(selectionLoadProgressListener).to.not.be.called;
          expect(selectionLoadFinishedListener).to.not.be.called;

          // shift-select node 1
          await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "a", "1"])), true), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(0, 2, sinon.match.func);
          expect(selectionLoadFinishedListener).to.not.be.called;

          // resolve the 'b' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("b"), renderSpy, 3); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["b", "y"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(1, 3, sinon.match.func);
          expect(selectionLoadFinishedListener).to.not.be.called;

          // resolve the 'c' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("c"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["c"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(2, 3, sinon.match.func);
          expect(selectionLoadFinishedListener).to.not.be.called;

          // resolve the 'z' grandchild promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("z"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for the final selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["z"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(3, 3, sinon.match.func);
          expect(selectionLoadFinishedListener).to.be.calledOnce;

          expect(selectionLoadCanceledListener).to.not.be.called;
          nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
          expect(getSelectedNodes().length).to.equal(7);
        });

        it("cancels nodes' load from progress callback", async () => {
          await createDefaultTreeForDelayLoadedShiftSelection();

          // set up the progress listener to cancel nodes loading after the second
          // call (when "b" node is loaded)
          selectionLoadProgressListener.onThirdCall().callsArg(2);

          // select node 0
          await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
          expect(selectionLoadProgressListener).to.not.be.called;
          expect(selectionLoadCanceledListener).to.not.be.called;

          // shift-select node 1
          await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "a", "1"])), true), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(0, 2, sinon.match.func);
          expect(selectionLoadCanceledListener).to.not.be.called;

          // resolve the 'b' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("b"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for second intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["b"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(1, 2, sinon.match.func);
          expect(selectionLoadCanceledListener).to.be.calledOnce;

          // resolve the 'c' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("c"), renderSpy); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to NOT be called for the final selection as the operation was canceled
          nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.exactly(3));
          expect(selectionLoadProgressListener.callCount).to.eq(3);
          expect(selectionLoadCanceledListener).to.be.calledOnce;

          expect(selectionLoadFinishedListener).to.not.be.called;
          nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
          expect(getSelectedNodes().length).to.equal(4);
        });

        it("cancels nodes' load when selection changes on node click", async () => {
          await createDefaultTreeForDelayLoadedShiftSelection();

          // select node 0
          await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
          expect(selectionLoadProgressListener).to.not.be.called;
          expect(selectionLoadCanceledListener).to.not.be.called;

          // shift-select node 1
          await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "a", "1"])), true), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(0, 2, sinon.match.func);
          expect(selectionLoadCanceledListener).to.not.be.called;

          // resolve the 'b' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("b"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for second intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["b"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(1, 2, sinon.match.func);

          // click on node "1" and expect that to cancel the load
          await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["1"])), true), moq.Times.once());
          expect(selectionLoadCanceledListener).to.be.calledOnce;

          // resolve the 'c' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("c"), renderSpy); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to NOT be called for the final selection as the operation was canceled
          nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.exactly(4));
          expect(selectionLoadProgressListener.callCount).to.eq(3);

          expect(selectionLoadFinishedListener).to.not.be.called;
          nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
          expect(getSelectedNodes().length).to.equal(1);
        });

        it("cancels nodes' load when selection changes to another delay loaded selection", async () => {
          await createDefaultTreeForDelayLoadedShiftSelection();

          // select node 0
          await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
          expect(selectionLoadProgressListener).to.not.be.called;
          expect(selectionLoadCanceledListener).to.not.be.called;

          // shift-select node 1
          await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "a", "1"])), true), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(0, 2, sinon.match.func);
          expect(selectionLoadCanceledListener).to.not.be.called;

          // resolve the 'b' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("b"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for the intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["b"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(1, 2, sinon.match.func);

          // click on node "2" and expect that to cancel the load and initiate a new one
          await waitForUpdate(() => fireEvent.click(getNode("2").contentArea, { shiftKey: true }), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "a", "b", "1", "2"])), true), moq.Times.once());
          expect(selectionLoadCanceledListener).to.be.calledOnce;
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(0, 1, sinon.match.func);

          // resolve the 'c' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("c"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for the final selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["c"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(1, 1, sinon.match.func);
          expect(selectionLoadFinishedListener).to.be.calledOnce;

          nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
          expect(getSelectedNodes().length).to.equal(6);
        });

        it("cancels nodes' load when selection changes after `selectedNodes` prop change", async () => {
          const props = createPropsForDelayLoadedShiftSelection();
          await createDefaultTreeForDelayLoadedShiftSelection(props);

          // select node 0
          await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
          expect(selectionLoadProgressListener).to.not.be.called;
          expect(selectionLoadCanceledListener).to.not.be.called;

          // shift-select node 1
          await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);
          // expect the callback to be called for intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "a", "1"])), true), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(0, 2, sinon.match.func);
          expect(selectionLoadCanceledListener).to.not.be.called;

          // resolve the 'b' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("b"), renderSpy, 2); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to be called for second intermediate selection
          nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["b"])), false), moq.Times.once());
          expect(selectionLoadProgressListener.lastCall).to.be.calledWith(1, 2, sinon.match.func);

          // change the `selectedNodes` prop
          await waitForUpdate(() => renderedTree.rerender(
            <Tree
              {...props} selectedNodes={["a"]}
            />), renderSpy);
          expect(selectionLoadCanceledListener).to.be.calledOnce;

          // resolve the 'c' child promise and wait for re-render
          await waitForUpdate(() => dataProvider.resolveDelayedLoad("c"), renderSpy); // eslint-disable-line @typescript-eslint/promise-function-async
          // expect the callback to NOT be called for the final selection as the operation was canceled
          nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.exactly(3));
          expect(selectionLoadProgressListener.callCount).to.eq(3);

          expect(selectionLoadFinishedListener).to.not.be.called;
          nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
          expect(getSelectedNodes().length).to.equal(1);
        });

      });

    });

    describe("with Multiple selection mode", () => {

      beforeEach(async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectionMode={SelectionMode.Multiple} />), renderSpy, 2);
      });

      it("drag selects nodes", async () => {
        // press
        fireEvent.mouseDown(getNode("0").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(0);

        const expectSelectAll = ["0", "0-a", "0-b", "1"];

        // drag
        // note: dragging re-renders to update selection
        await waitForUpdate(() => fireEvent.mouseMove(getNode("1").contentArea, { buttons: 1 }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(expectSelectAll);

        // release
        fireEvent.mouseUp(getNode("1").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "0-a", "0-b", "1"])), false), moq.Times.once());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(expectSelectAll);

        // reset mocks
        nodesSelectedCallbackMock.reset();
        nodesDeselectedCallbackMock.reset();

        // press again
        fireEvent.mouseDown(getNode("1").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(expectSelectAll);

        // drag
        // note: dragging re-renders to update selection
        await waitForUpdate(() => fireEvent.mouseMove(getNode("0-b").contentArea, { buttons: 1 }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "0-a"]);

        // release
        fireEvent.mouseUp(getNode("0-b").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0-b", "1"]))), moq.Times.once());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "0-a"]);
      });

      it("dragging with multiple buttons pressed doesn't select nodes", async () => {
        // press
        fireEvent.mouseDown(getNode("0").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(0);

        // invalid drag with multiple buttons pressed
        // note: dragging re-renders to update selection
        fireEvent.mouseMove(getNode("1").contentArea, { buttons: 2 });
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(0);

        // release
        fireEvent.mouseUp(getNode("1").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(0);
      });

      it("drag selects and deselects nodes", async () => {
        // render with 0 and 0b selected
        await waitForUpdate(() => {
          renderedTree.rerender(<Tree {...defaultSelectionProps} selectionMode={SelectionMode.Multiple} selectedNodes={["0", "0-b"]} />);
        }, renderSpy);

        // press
        fireEvent.mouseDown(getNode("0").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "0-b"]);

        // drag
        // note: dragging re-renders to update selection
        await waitForUpdate(() => fireEvent.mouseMove(getNode("1").contentArea, { buttons: 1 }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0-a", "1"]);

        // release
        fireEvent.mouseUp(getNode("1").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0-a", "1"])), false), moq.Times.once());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "0-b"]))), moq.Times.once());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0-a", "1"]);
      });

      it("drag selecting nodes does not select collapsed nodes", async () => {
        // collapse node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderSpy);

        // press
        fireEvent.mouseDown(getNode("0").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(0);

        // drag
        // note: dragging re-renders to update selection
        await waitForUpdate(() => fireEvent.mouseMove(getNode("1").contentArea, { buttons: 1 }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "1"]);

        // release
        fireEvent.mouseUp(getNode("1").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "1"])), false), moq.Times.once());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "1"]);
      });

    });

    describe("with SingleAllowDeselect selection mode", () => {

      beforeEach(async () => {
        await waitForUpdate(() => {
          renderedTree = render(<Tree {...defaultSelectionProps} selectionMode={SelectionMode.SingleAllowDeselect} />);
        }, renderSpy, 2);
      });

      it("deselects selected row", async () => {
        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());

        // deselect node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"]))), moq.Times.once());

        expect(getSelectedNodes().length).to.equal(0);
      });

    });

    describe("general", () => {

      it("selects nodes on mount", async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectedNodes={["0", "1"]} />), renderSpy, 2);

        expect(getNode("0").classList.contains("is-selected")).to.be.true;
        expect(getNode("1").classList.contains("is-selected")).to.be.true;
      });

      it("selects nodes after expanding with delay loading data provider", async () => {
        // select a node in a collapsed branch
        await waitForUpdate(() => {
          renderedTree = render(<Tree {...defaultSelectionProps} dataProvider={createDataProvider([])} selectedNodes={["0-a"]} />);
        }, renderSpy, 2);

        // expand node 0
        // note: need to wait for 2 renders:
        // 1. after click
        // 2. after children are loaded
        await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderSpy, 2);

        // expect one of the nodes to be selected
        expect(getNode("0-a").classList.contains("is-selected")).to.be.true;
        expect(getSelectedNodes().length).to.eq(1);
      });

      it("selects nodes after expanding with immediately loading data provider", async () => {
        const dp: TreeDataProviderRaw = [{
          id: "0",
          label: PropertyRecord.fromString("0"),
          children: [{
            id: "1",
            label: PropertyRecord.fromString("1"),
          }],
        }];

        // select a node in a collapsed branch
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} dataProvider={dp} selectedNodes={["1"]} />), renderSpy, 2);

        // expand node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderSpy);

        // expect node 1 to be selected
        expect(getNode("1").classList.contains("is-selected")).to.be.true;
        expect(getSelectedNodes().length).to.eq(1);
      });

      it("node remains selected after collapsing", async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} />), renderSpy, 2);

        // select a node
        const node0a = getNode("0-a");
        await waitForUpdate(() => fireEvent.click(node0a.contentArea), renderSpy);
        expect(getSelectedNodes().length).to.eq(1);

        // collapse its parent
        const node0 = getNode("0");
        await waitForUpdate(() => fireEvent.click(node0.expansionToggle!), renderSpy);
        expect(getSelectedNodes().length).to.eq(0);

        // expand the parent
        await waitForUpdate(() => fireEvent.click(node0.expansionToggle!), renderSpy);
        expect(getSelectedNodes().length).to.eq(1);
      });

      it("updates selection if selectedNodes prop changes", async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectedNodes={["0", "1"]} />), renderSpy, 2);
        expect(getNode("0").classList.contains("is-selected")).to.be.true;
        expect(getNode("1").classList.contains("is-selected")).to.be.true;
      });

      it("does not clear selection if passes undefined `isNodeSelected` callback", async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectedNodes={["0", "1"]} />), renderSpy, 2);
        await waitForUpdate(() => renderedTree.rerender(<Tree {...defaultSelectionProps} selectedNodes={undefined} />), renderSpy);
        expect(getNode("0").classList.contains("is-selected")).to.be.true;
        expect(getNode("1").classList.contains("is-selected")).to.be.true;
      });

      it("handles selection changes if callback not specified", async () => {
        await waitForUpdate(() => renderedTree = render(<Tree
          {...defaultSelectionProps}
          selectionMode={SelectionMode.SingleAllowDeselect}
          onNodesSelected={undefined}
          onNodesDeselected={undefined}
        />), renderSpy, 2);

        const node = getNode("0");

        await waitForUpdate(() => fireEvent.click(node.contentArea), renderSpy);
        expect(getSelectedNodes().length).to.equal(1);

        await waitForUpdate(() => fireEvent.click(node.contentArea), renderSpy);
        expect(getSelectedNodes().length).to.equal(0);
      });

    });

  });

  describe("checkboxes", () => {

    let defaultCheckboxTestsProps: TreeProps;
    const checkboxClickSpy = sinon.spy();

    beforeEach(() => {
      checkboxClickSpy.resetHistory();
      defaultCheckboxTestsProps = {
        ...defaultProps,
        dataProvider: createDataProvider([]),
        onCheckboxClick: checkboxClickSpy,
      };
    });

    it("renders checkboxes when attributes are supplied through TreeNodeItem", async () => {
      const dataProvider: TreeNodeItem[] = [{
        id: "0",
        label: PropertyRecord.fromString("0"),
        isCheckboxVisible: true,
        isCheckboxDisabled: true,
        checkBoxState: CheckBoxState.On,
      }];
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} dataProvider={dataProvider} />), renderNodesSpy, 1);
      const node = getNode("0");
      expect(node.checkbox).to.not.be.undefined;
      expect(node.checkbox!.disabled).to.not.be.undefined;
      expect(node.checkbox!.checked).to.be.true;
    });

    it("renders checkboxes when attributes supplied through `checkboxInfo` callback", async () => {
      const checkboxInfo = () => ({ isVisible: true, isDisabled: true, state: CheckBoxState.On });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo} />), renderNodesSpy, 1);
      const node = getNode("0");
      expect(node.checkbox).to.not.be.undefined;
      expect(node.checkbox!.disabled).to.be.true;
      expect(node.checkbox!.checked).to.be.true;
    });

    it("renders checkboxes using callback when attributes supplied through both TreeNodeItem and `checkboxInfo` callback", async () => {
      const dataProvider: TreeNodeItem[] = [{
        id: "0",
        label: PropertyRecord.fromString("0"),
        isCheckboxVisible: true,
        isCheckboxDisabled: true,
        checkBoxState: CheckBoxState.On,
      }];
      const checkboxInfo = () => ({ isVisible: true, state: CheckBoxState.Off });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} dataProvider={dataProvider} checkboxInfo={checkboxInfo} />), renderNodesSpy, 1);
      const node = getNode("0");
      expect(node.checkbox).to.not.be.undefined;
      expect(node.checkbox!.disabled).to.not.be.true;
      expect(node.checkbox!.checked).to.be.false;
    });

    it("renders children checkboxes when parent is expanded with delay-loading data provider", async () => {
      const checkboxInfo = (n: TreeNodeItem) => ({ isVisible: (n.id === "0-a") });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo} />), renderNodesSpy, 1);
      const parentNode = getNode("0");
      // expect 2 updates:
      // - after click
      // - after children are loaded
      await waitForUpdate(() => fireEvent.click(parentNode.expansionToggle!), renderNodesSpy, 2);
      const childNodes = { a: getNode("0-a"), b: getNode("0-b") };
      expect(childNodes.a.checkbox).to.not.be.undefined;
      expect(childNodes.b.checkbox).to.be.undefined;
    });

    it("renders children checkboxes when parent is expanded with immediately-loading data provider", async () => {
      const dataProvider: ImmediatelyLoadedTreeNodeItem[] = [{
        id: "0",
        label: PropertyRecord.fromString("0"),
        children: [{
          id: "0-a",
          label: PropertyRecord.fromString("0-a"),
        }, {
          id: "0-b",
          label: PropertyRecord.fromString("0-b"),
        }],
      }];
      const checkboxInfo = (n: TreeNodeItem) => ({ isVisible: (n.id === "0-a") });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} dataProvider={dataProvider} checkboxInfo={checkboxInfo} />), renderNodesSpy, 1);
      const parentNode = getNode("0");
      await waitForUpdate(() => fireEvent.click(parentNode.expansionToggle!), renderNodesSpy, 1);
      const childNodes = { a: getNode("0-a"), b: getNode("0-b") };
      expect(childNodes.a.checkbox).to.not.be.undefined;
      expect(childNodes.b.checkbox).to.be.undefined;
    });

    it("re-renders checkboxes when `checkboxInfo` callback changes", async () => {
      const checkboxInfo1 = async () => ({ isVisible: true, isDisabled: true, state: CheckBoxState.On });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo1} />), renderNodesSpy, 1);
      let node = getNode("0");
      expect(node.checkbox).to.not.be.undefined;
      expect(node.checkbox!.disabled).to.be.true;
      expect(node.checkbox!.checked).to.be.true;

      const checkboxInfo2 = async () => ({ isVisible: true, isDisabled: false, state: CheckBoxState.Off });
      await waitForUpdate(() => renderedTree.rerender(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo2} />), renderNodesSpy, 2);
      node = getNode("0");
      expect(node.checkbox).to.not.be.undefined;
      expect(node.checkbox!.disabled).to.be.false;
      expect(node.checkbox!.checked).to.be.false;
    });

    it("re-renders checkboxes when `checkboxInfo` callback and `selectedNodes` change", async () => {
      const checkboxInfo1 = async () => ({ isVisible: true, isDisabled: true, state: CheckBoxState.On });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo1} selectedNodes={[]} />), renderNodesSpy, 1);
      let node = getNode("0");
      expect(node.checkbox).to.not.be.undefined;
      expect(node.checkbox!.disabled).to.be.true;
      expect(node.checkbox!.checked).to.be.true;
      expect(node.classList.contains("is-selected")).to.be.false;

      const checkboxInfo2 = async () => ({ isVisible: true, isDisabled: false, state: CheckBoxState.Off });
      await waitForUpdate(() => renderedTree.rerender(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo2} selectedNodes={["0"]} />), renderNodesSpy, 2);
      node = getNode("0");
      expect(node.checkbox).to.not.be.undefined;
      expect(node.checkbox!.disabled).to.be.false;
      expect(node.checkbox!.checked).to.be.false;
      expect(node.classList.contains("is-selected")).to.be.true;
    });

    it("checks and unchecks a node", async () => {
      const checkboxInfo = (n: TreeNodeItem) => ({ isVisible: true, state: (n.id === "0") ? CheckBoxState.On : CheckBoxState.Off });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo} />), renderNodesSpy, 1);

      fireEvent.click(getNode("0").checkbox!);
      expect(checkboxClickSpy).to.be.calledOnce;
      expect(checkboxClickSpy.firstCall).to.be.calledWith(sinon.match([sinon.match({ node: { id: "0" }, newState: CheckBoxState.Off })]));

      fireEvent.click(getNode("1").checkbox!);
      expect(checkboxClickSpy).to.be.calledTwice;
      expect(checkboxClickSpy.secondCall).to.be.calledWith(sinon.match([sinon.match({ node: { id: "1" }, newState: CheckBoxState.On })]));
    });

    describe("bulk checkbox actions", () => {
      const dataProvider = new TestTreeDataProvider([{ id: "0" }, { id: "1" }, { id: "2" }, { id: "3" }]);
      const checkboxInfo = () => ({ isVisible: true, state: CheckBoxState.Off });
      let defaultBulkCheckboxActionsProps: TreeProps;

      beforeEach(() => {
        defaultBulkCheckboxActionsProps = {
          ...defaultCheckboxTestsProps,
          pageSize: 4,
          selectionMode: SelectionMode.Extended,
          dataProvider,
          checkboxInfo,
        };
      });

      it("checks and unchecks multiple selected loaded nodes by default", async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultBulkCheckboxActionsProps} />), renderSpy, 2);
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
        await waitForUpdate(() => fireEvent.click(getNode("2").contentArea, { shiftKey: true }), renderSpy);

        fireEvent.click(getNode("1").checkbox!);
        expect(checkboxClickSpy.firstCall).to.have.been.calledWithExactly(
          sinon.match([
            sinon.match({ node: { id: "1" }, newState: CheckBoxState.On }),
            sinon.match({ node: { id: "2" }, newState: CheckBoxState.On }),
          ]));

        fireEvent.click(getNode("2").checkbox!);
        expect(checkboxClickSpy.secondCall).to.have.been.calledWithExactly(
          sinon.match([
            sinon.match({ node: { id: "1" }, newState: CheckBoxState.Off }),
            sinon.match({ node: { id: "2" }, newState: CheckBoxState.Off }),
          ]));

        expect(checkboxClickSpy).to.have.been.calledTwice;
      });

      it("checks only one node when multiple nodes are selected and bulk checkbox actions are disabled", async () => {
        const props = {
          ...defaultBulkCheckboxActionsProps,
          bulkCheckboxActionsDisabled: true,
        };
        await waitForUpdate(() => renderedTree = render(<Tree {...props} />), renderSpy, 2);
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
        await waitForUpdate(() => fireEvent.click(getNode("2").contentArea, { shiftKey: true }), renderSpy);

        fireEvent.click(getNode("1").checkbox!);
        expect(checkboxClickSpy).to.have.been.calledOnceWithExactly(
          sinon.match([sinon.match({ node: { id: "1" }, newState: CheckBoxState.On })]),
        );
      });

      it("disables bulk checkbox actions when re-rendered with `bulkCheckboxActionsDisabled` set to `true`", async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultBulkCheckboxActionsProps} />), renderSpy, 2);
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
        await waitForUpdate(() => fireEvent.click(getNode("2").contentArea, { shiftKey: true }), renderSpy);

        fireEvent.click(getNode("1").checkbox!);
        expect(checkboxClickSpy).to.have.been.calledOnceWithExactly(sinon.match([
          sinon.match({ node: { id: "1" }, newState: CheckBoxState.On }),
          sinon.match({ node: { id: "2" }, newState: CheckBoxState.On }),
        ]));
        checkboxClickSpy.resetHistory();

        const props = {
          ...defaultBulkCheckboxActionsProps,
          bulkCheckboxActionsDisabled: true,
        };
        await waitForUpdate(() => renderedTree.rerender(<Tree {...props} />), renderSpy, 0);
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["1", "2"]);

        fireEvent.click(getNode("1").checkbox!);
        expect(checkboxClickSpy).to.have.been.calledOnceWithExactly(
          sinon.match([sinon.match({ node: { id: "1" }, newState: CheckBoxState.Off })]),
        );
      });
    });

    it("checking child node doesn't affect the parent", async () => {
      // all nodes checked by default
      const checkboxInfo = () => ({ isVisible: true, state: CheckBoxState.On });
      const props = {
        ...defaultCheckboxTestsProps,
        dataProvider: createDataProvider(["0"]),
        checkboxInfo,
      };
      await waitForUpdate(() => renderedTree = render(<Tree {...props} />), renderSpy, 2);

      // uncheck the checkbox and verify parent node is still checked
      await waitForUpdate(() => fireEvent.click(getNode("0-a").checkbox!), renderSpy);
      expect(getNode("0-a").checkbox!.checked).to.be.false;
      expect(getNode("0").checkbox!.checked).to.be.true;
    });

    it("checks auto-expanded child nodes", async () => {
      const dataProvider = new TestTreeDataProvider([
        {
          id: "0",
          autoExpand: true,
          children: [
            { id: "0-0" },
            {
              id: "0-1",
              autoExpand: true,
              delayedLoad: true,
              children: [{ id: "0-1-0" }],
            },
          ],
        },
        { id: "1" },
        { id: "2" },
      ]);
      const checkboxInfo = () => ({ isVisible: true, state: CheckBoxState.Off });
      const props = {
        ...defaultCheckboxTestsProps,
        pageSize: 1,
        selectionMode: SelectionMode.Extended,
        dataProvider,
        checkboxInfo,
      };
      await waitForUpdate(() => renderedTree = render(<Tree {...props} />), renderSpy, 3);
      await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
      await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { shiftKey: true }), renderSpy);

      fireEvent.click(getNode("1").checkbox!);
      expect(checkboxClickSpy.firstCall).to.have.been.calledWithExactly(
        sinon.match([
          sinon.match({ node: { id: "0" }, newState: CheckBoxState.On }),
          sinon.match({ node: { id: "0-0" }, newState: CheckBoxState.On }),
          sinon.match({ node: { id: "1" }, newState: CheckBoxState.On }),
        ]));

      await waitForUpdate(() => dataProvider.resolveDelayedLoad("0-1"), renderSpy, 5); // eslint-disable-line @typescript-eslint/promise-function-async
      expect(checkboxClickSpy.secondCall).to.have.been.calledWithExactly(
        sinon.match([
          sinon.match({ node: { id: "0-1" }, newState: CheckBoxState.On }),
          sinon.match({ node: { id: "0-1-0" }, newState: CheckBoxState.On }),
        ]));

      expect(checkboxClickSpy).to.have.been.calledTwice;
    });

    it("doesn't fire check event if checkbox is disabled", async () => {
      const checkboxInfo = () => ({ isVisible: true, isDisabled: true });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} checkboxInfo={checkboxInfo} />), renderNodesSpy, 1);

      fireEvent.click(getNode("0").checkbox!);
      expect(checkboxClickSpy).to.not.be.called;
    });

    it("renders checkbox state change", async () => {
      const nodes: TreeNodeItem[] = [{
        id: "0",
        label: PropertyRecord.fromString("0"),
        isCheckboxVisible: true,
        checkBoxState: CheckBoxState.Off,
      }];

      class TestDataProvider implements ITreeDataProvider {
        public onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();

        public getNodes = async () => nodes;
        public getNodesCount = async () => 1;
      }

      const dataProvider = new TestDataProvider();

      const onClick = (stateChanges: Array<{ node: TreeNodeItem, newState: CheckBoxState }>) => {
        // Assumes that exactly one node will have its checkbox state changed
        const node = stateChanges[0].node;
        if (node.checkBoxState === CheckBoxState.Off)
          node.checkBoxState = CheckBoxState.On;
        else
          node.checkBoxState = CheckBoxState.Off;

        dataProvider.onTreeNodeChanged.raiseEvent(nodes);
      };

      const onRender = sinon.spy();

      await waitForUpdate(() => renderedTree = render(<Tree {...defaultCheckboxTestsProps} dataProvider={dataProvider} onCheckboxClick={onClick} onRender={onRender} />), renderNodesSpy);

      const checkbox = getNode("0").checkbox;
      onRender.resetHistory();

      expect(checkbox).to.not.be.undefined;
      expect(checkbox!.checked, "Initial checkbox state is wrong").to.be.false;

      fireEvent.click(getNode("0").checkbox!);
      await wait(() => expect(onRender.called).to.be.true);
      expect(checkbox!.checked, "Checkbox did not get checked").to.be.true;
      onRender.resetHistory();

      fireEvent.click(getNode("0").checkbox!);
      await wait(() => expect(onRender.called).to.be.true);
      expect(checkbox!.checked, "Checkbox did not get unchecked").to.be.false;
    });
  });

  describe("expand & collapse", () => {

    let dataProvider: TreeDataProviderMethod = async (parent?: TreeNodeItem) => {
      if (!parent)
        return [
          { id: "0", label: PropertyRecord.fromString("0"), hasChildren: true },
          { id: "1", label: PropertyRecord.fromString("1"), hasChildren: true },
        ];
      return [
        { id: `${parent.id}-a`, label: PropertyRecord.fromString(`${parent.label}-a`) },
        { id: `${parent.id}-b`, label: PropertyRecord.fromString(`${parent.label}-b`) },
      ];
    };

    const getExpandedNodes = () => {
      return renderedTree.queryAllByTestId(TreeComponentTestId.Node as any).filter((node) => {
        const expansionToggle = within(node).queryByTestId(TreeComponentTestId.NodeExpansionToggle as any);
        return (expansionToggle && expansionToggle.classList.contains("is-expanded"));
      });
    };

    let defaultExpandCollapseProps: TreeProps;

    beforeEach(async () => {
      defaultExpandCollapseProps = {
        ...defaultProps,
        dataProvider,
        selectionMode: SelectionMode.SingleAllowDeselect,
      };
    });

    it("auto-expands nodes", async () => {
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultExpandCollapseProps} dataProvider={createDataProvider(["0"])} />), renderSpy, 2);
      expect(getNode("0").expansionToggle!.classList.contains("is-expanded")).to.be.true;
      expect(getExpandedNodes().length).to.eq(1);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);
    });

    afterEach(function () {
      if (this.currentTest!.state === "failed")
        renderedTree.debug();
    });

    it("expands and collapses node when clicked on expansion toggle", async () => {
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultExpandCollapseProps} />), renderSpy, 2);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(2);

      // expand node 0
      await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderNodesSpy, 2);
      expect(getExpandedNodes().length).to.eq(1);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);

      await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderNodesSpy);
      expect(getExpandedNodes().length).to.eq(0);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(2);
    });

    it("calls onNodeExpanded callback", async () => {
      const callbackMock = moq.Mock.ofInstance((_item: TreeNodeItem) => { });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultExpandCollapseProps} onNodeExpanded={callbackMock.object} />), renderSpy, 2);

      // expand node 0
      await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderNodesSpy, 2);

      const nodeItem = (await dataProvider())[0];
      callbackMock.verify((x) => x(nodeItem), moq.Times.once());
    });

    it("calls onNodeCollapsed callback", async () => {
      const callbackMock = moq.Mock.ofInstance((_item: TreeNodeItem) => { });
      dataProvider = createDataProvider(["0"]);
      await waitForUpdate(() => renderedTree = render(<Tree
        {...defaultExpandCollapseProps}
        dataProvider={dataProvider}
        selectionMode={SelectionMode.SingleAllowDeselect}
        onNodeCollapsed={callbackMock.object}
      />), renderSpy, 2);

      const node = getNode("0");
      const nodeItem = (await dataProvider())[0];

      await waitForUpdate(() => fireEvent.click(node.expansionToggle!), renderSpy);
      callbackMock.verify((x) => x(nodeItem), moq.Times.once());
    });

  });

  describe("rendering", () => {
    it("renders 'The tree is empty' when tree is empty", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={[]} />);
      }, renderSpy, 2);
      const expectedContent = TestUtils.i18n.translate("Components:general.noData");
      expect(renderedTree.getByText(expectedContent)).to.not.not.undefined;
    });

    it("renders '0 matches found for x' when tree is empty and highlighting props contain a search word", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[]}
          nodeHighlightingProps={{ activeMatch: { nodeId: "", matchIndex: 0 }, searchText: "test" }}
        />);
      }, renderSpy, 2);
      const expectedContent = TestUtils.i18n.translate("Components:tree.noResultsForFilter", { test: "test" });
      expect(renderedTree.getByText(expectedContent)).to.not.not.undefined;
    });

    it("rerenders on data provider change", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[{ id: "0", label: PropertyRecord.fromString("0") }]}
        />);
      }, renderSpy, 2);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree
          {...defaultProps}
          dataProvider={[{ id: "1", label: PropertyRecord.fromString("1") }]}
        />);
      }, renderSpy, 2);
      expect(getNode("1")).to.not.be.undefined;
    });

    it("rerenders on data provider change without waiting for initial update with immediate data provider", async () => {
      renderedTree = render(<Tree {...defaultProps} dataProvider={[{ id: "0", label: PropertyRecord.fromString("0") }]} />);
      expect(renderedTree.queryAllByTestId(TreeComponentTestId.Node).length).to.eq(0);

      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={[{ id: "1", label: PropertyRecord.fromString("1") }]} />);
      }, renderSpy, 2);
      expect(getNode("1")).to.not.be.undefined;
    });

    it("rerenders on data provider change without waiting for initial update with delay loaded data provider", async () => {
      const p1 = new ResolvablePromise<TreeNodeItem[]>();
      const p2 = new ResolvablePromise<TreeNodeItem[]>();

      renderedTree = render(<Tree {...defaultProps} dataProvider={async () => p1} />);
      expect(renderedTree.queryAllByTestId(TreeComponentTestId.Node).length).to.eq(0);

      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={async () => p2} />);
      }, renderSpy);
      expect(renderedTree.queryAllByTestId(TreeComponentTestId.Node).length).to.eq(0);
      renderSpy.resetHistory();

      await p1.resolve([{ id: "0", label: PropertyRecord.fromString("0") }]);
      expect(renderSpy).to.not.be.called;
      expect(renderedTree.queryAllByTestId(TreeComponentTestId.Node).length).to.eq(0);

      await p2.resolve([{ id: "1", label: PropertyRecord.fromString("1") }]);
      expect(renderSpy).to.be.calledOnce;
      expect(getNode("1")).to.not.be.undefined;
    });

    it("renders with icons", async () => {
      await waitForUpdate(() => {
        renderedTree = render(
          <Tree
            {...defaultProps}
            dataProvider={[{ id: "0", label: PropertyRecord.fromString("0"), icon: "icon-placeholder" }]}
            showIcons={true}
          />);
      }, renderSpy, 2);
      expect(getNode("0").querySelector(".icon-placeholder")).to.not.be.null;
    });

    it("renders icons with custom image loader when provided", async () => {
      class ImageLoader implements ITreeImageLoader {
        public load = () => ({ sourceType: "core-icon", value: "icon-overriden" } as LoadedImage);
        public loadPlaceholder = this.load;
      }

      const loader = new ImageLoader();

      await waitForUpdate(() => {
        renderedTree = render(
          <Tree
            {...defaultProps}
            dataProvider={[{ id: "0", label: PropertyRecord.fromString("0"), icon: "icon-placeholder" }]}
            showIcons={true}
            imageLoader={loader}
          />);
      }, renderSpy, 2);
      expect(getNode("0").querySelector(".icon-overriden")).to.not.be.null;
    });

    it("renders with custom node renderer", async () => {
      const renderMock = moq.Mock.ofInstance((node: BeInspireTreeNode<TreeNodeItem>, _props: TreeNodeProps): React.ReactNode => {
        return <div key={node.id}>{node.text}</div>;
      });
      renderMock.callBase = true;
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[{ id: "0", label: PropertyRecord.fromString("0") }, { id: "1", label: PropertyRecord.fromString("1") }]}
          renderOverrides={{ renderNode: renderMock.object }}
        />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByText("0").length).to.eq(1);
      expect(renderedTree.getAllByText("1").length).to.eq(1);
      // note: node renderer called only 2 times, because the first render doesn't render nodes
      // and the second one renders each node once
      renderMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.exactly(2));
    });

    it("renders with custom node checkbox renderer", async () => {
      const checkboxRenderer = sinon.stub().returns(<div data-testid="custom-checkbox" />);
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[{ id: "0", label: PropertyRecord.fromString("0"), isCheckboxVisible: true }]}
          renderOverrides={{ renderCheckbox: checkboxRenderer }}
        />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByText("0").length).to.eq(1);
      expect(checkboxRenderer).to.be.calledOnce;
      expect(() => renderedTree.getByTestId("custom-checkbox")).to.not.throw;
    });

    it.skip("renders placeholder when node has no payload", async () => {
      const provider: ITreeDataProvider = {
        getNodesCount: async () => 2,
        getNodes: async (_parent, page: PageOptions) => {
          if (page.start === 0)
            return [{ id: "0", label: PropertyRecord.fromString("0") }];
          return [{ id: "1", label: PropertyRecord.fromString("1") }];
        },
      };

      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={provider}
          pageSize={1}
        />);
      }, renderSpy, 2);

      expect(renderedTree.baseElement.getElementsByClassName("core-tree-node").length).to.eq(1);
      expect(renderedTree.baseElement.getElementsByClassName("core-tree-placeholder").length).to.eq(1);
    });

    it("renders rows with a different height when rowHeight prop is set to number", async () => {
      const provider: ITreeDataProvider = {
        getNodesCount: async () => 2,
        getNodes: async () => [{ id: "0", label: PropertyRecord.fromString("0") }],
      };

      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={provider}
          rowHeight={76}
        />);
      }, renderSpy, 2);

      const node = renderedTree.container.getElementsByClassName("node-wrapper")[0] as HTMLElement;

      expect(node.style.height).is.not.null;

      expect(+node.style.height.replace("px", "")).to.equal(76);
    });

    it("renders rows with a different height when rowHeight prop is set to function", async () => {
      const provider: ITreeDataProvider = {
        getNodesCount: async () => 2,
        getNodes: async () => [{ id: "0", label: PropertyRecord.fromString("without-description") }, { id: "1", label: PropertyRecord.fromString("with-description"), description: "desc" }],
      };

      const rowHeight = (n?: TreeNodeItem) => n && n.description ? 40 : 20;

      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={provider}
          rowHeight={rowHeight}
        />);
      }, renderSpy, 2);

      const nodes = renderedTree.container.getElementsByClassName("node-wrapper") as HTMLCollectionOf<HTMLDivElement>;

      expect(nodes[0].style.height).is.not.null;
      expect(nodes[0].innerHTML.includes("without-description")).is.not.null;

      expect(nodes[1].style.height).is.not.null;
      expect(nodes[1].innerHTML.includes("with-description")).is.not.null;

      expect(+nodes[0].style.height.replace("px", "")).to.equal(20);
      expect(+nodes[1].style.height.replace("px", "")).to.equal(40);
    });

    it("renders row heights with default function if rowHeight prop is not provided", async () => {
      const provider: ITreeDataProvider = {
        getNodesCount: async () => 2,
        getNodes: async () => [{ id: "0", label: PropertyRecord.fromString("without-description") }, { id: "1", label: PropertyRecord.fromString("with-description"), description: "desc" }],
      };

      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={provider}
          showDescriptions={true}
        />);
      }, renderSpy, 2);

      const nodes = renderedTree.container.getElementsByClassName("node-wrapper") as HTMLCollectionOf<HTMLDivElement>;

      expect(nodes[0].style.height).is.not.null;
      expect(nodes[0].innerHTML.includes("without-description")).is.not.null;

      expect(nodes[1].style.height).is.not.null;
      expect(nodes[1].innerHTML.includes("with-description")).is.not.null;

      expect(+nodes[0].style.height.replace("px", "")).to.equal(25);
      expect(+nodes[1].style.height.replace("px", "")).to.equal(44);
    });
  });

  describe("node label rendering", () => {

    it("renders with HighlightingEngine when nodeHighlightingProps set", async () => {
      const renderLabelSpy = sinon.spy(HighlightingEngine, "renderNodeLabel");
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[{ id: "0", label: PropertyRecord.fromString("0"), icon: "test-icon" }]}
          nodeHighlightingProps={{ searchText: "test" }}
        />);
      }, renderSpy, 2);
      expect(renderLabelSpy.calledWith("0", { searchText: "test", activeMatchIndex: undefined })).to.be.true;
    });

    it("rerenders without HighlightingEngine when nodeHighlightingProps are reset to undefined", async () => {
      const renderLabelSpy = sinon.spy(HighlightingEngine, "renderNodeLabel");
      const dp: TreeDataProviderRaw = [{ id: "0", label: PropertyRecord.fromString("0"), icon: "test-icon", children: [] }];

      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={dp}
          nodeHighlightingProps={{ searchText: "test" }}
        />);
      }, renderNodesSpy);

      expect(renderLabelSpy.called).to.be.true;
      renderLabelSpy.resetHistory();

      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={dp} />);
      }, renderNodesSpy);

      expect(renderLabelSpy.called).to.be.false;
    });

    it("renders description when showDescriptions prop is set to true", async () => {
      const dp: TreeDataProviderRaw = [{ id: "0", label: PropertyRecord.fromString("0"), icon: "test-icon", description: "Test label", children: [] }];
      const tree = render(
        <Tree
          {...defaultProps}
          dataProvider={dp}
          showDescriptions={true}
        />);

      await waitForElement(() => tree.getByText("Test label"));
    });

    it("does not render description when showDescriptions prop is set to false", async () => {
      const dp: TreeDataProviderRaw = [{ id: "0", label: PropertyRecord.fromString("0"), icon: "test-icon", description: "Test label", children: [] }];
      const tree = render(
        <Tree
          {...defaultProps}
          dataProvider={dp}
          showDescriptions={false}
        />);

      await expect(waitForElement(() => tree.getByText("Test label"), { timeout: 500 })).to.be.rejected;
    });
  });

  describe("listening to `ITreeDataProvider.onTreeNodeChanged` events", () => {

    let methodProvider: TreeDataProviderMethod;
    let interfaceProvider: ITreeDataProvider;
    let reverseNodesOrder: boolean;

    beforeEach(() => {
      reverseNodesOrder = false;
      methodProvider = createDataProvider(["0"]);
      const onTreeNodeChangedEvent = new BeEvent<TreeDataChangesListener>();
      const getNodes = async (parent?: TreeNodeItem) => {
        const result = methodProvider(parent);
        return reverseNodesOrder ? (await result).reverse() : result;
      };
      interfaceProvider = {
        getNodes,
        getNodesCount: async (parent?: TreeNodeItem) => (await methodProvider(parent)).length,
        onTreeNodeChanged: onTreeNodeChangedEvent,
      };
    });

    const setReverseOrder = (reverse: boolean) => {
      reverseNodesOrder = reverse;
    };

    it("rerenders when `onTreeNodeChanged` is broadcasted with collapsed node", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);

      const node = (await interfaceProvider.getNodes())[1];
      await waitForUpdate(() => {
        node.label = PropertyRecord.fromString("test");
        interfaceProvider.onTreeNodeChanged?.raiseEvent([node]);
      }, renderNodesSpy);
      expect(renderedTree.getByText("test")).to.not.be.undefined;
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);

      // verify the node is collapsed
      const toggle = within(getNode("test")).queryByTestId(TreeComponentTestId.NodeExpansionToggle);
      expect(toggle!.classList.contains("is-expanded")).to.be.false;
    });

    it("rerenders when `onTreeNodeChanged` is broadcasted with expanded node", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);

      const node = (await interfaceProvider.getNodes())[0];
      await waitForUpdate(() => {
        node.label = PropertyRecord.fromString("test");
        interfaceProvider.onTreeNodeChanged?.raiseEvent([node]);
      }, renderNodesSpy);
      expect(renderedTree.getByText("test")).to.not.be.undefined;
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);

      // verify the node is expanded
      const toggle = within(getNode("test")).queryByTestId(TreeComponentTestId.NodeExpansionToggle);
      expect(toggle!.classList.contains("is-expanded")).to.be.true;
    });

    it("rerenders when `onTreeNodeChanged` is broadcasted with undefined node", async () => {
      const getFlatList = () => renderedTree.getAllByTestId(TreeComponentTestId.Node as any).map(getNodeLabel);

      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);
      expect(getFlatList()).to.deep.eq(["0", "0-a", "0-b", "1"]);

      setReverseOrder(true);

      await waitForUpdate(() => {
        interfaceProvider.onTreeNodeChanged?.raiseEvent([undefined]);
      }, renderSpy, 1);
      expect(renderedTree.getAllByTestId(TreeComponentTestId.Node as any).length).to.eq(4);
      expect(getFlatList()).to.deep.eq(["1", "0", "0-b", "0-a"]);
    });

    it("subscribes to `onTreeNodeChanged` on mount", () => {
      renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      expect(interfaceProvider.onTreeNodeChanged?.numberOfListeners).to.eq(1);
    });

    it("unsubscribes from `onTreeNodeChanged` on unmount", () => {
      renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      renderedTree.unmount();
      expect(interfaceProvider.onTreeNodeChanged?.numberOfListeners).to.eq(0);
    });

    it("subscribes to `onTreeNodeChanged` on provider change", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={methodProvider} />);
      }, renderSpy, 2);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy);
      expect(interfaceProvider.onTreeNodeChanged?.numberOfListeners).to.eq(1);
    });

    it("unsubscribes from `onTreeNodeChanged` on provider change", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={methodProvider} />);
      }, renderSpy);
      expect(interfaceProvider.onTreeNodeChanged?.numberOfListeners).to.eq(0);
    });

  });

  describe("scrolling to highlighted nodes", () => {

    const methodOverrides = {
      scrollTo: Element.prototype.scrollTo, // eslint-disable-line @typescript-eslint/unbound-method
      getComputedStyle: window.getComputedStyle,
    };
    const scrollToSpy = sinon.spy();

    beforeEach(() => {
      scrollToSpy.resetHistory();
      Element.prototype.scrollTo = scrollToSpy; // eslint-disable-line @typescript-eslint/unbound-method
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      window.getComputedStyle = function (elt: Element, pseudoElt?: string | null | undefined) {
        const result = methodOverrides.getComputedStyle.call(window, elt, pseudoElt);
        result.overflow = "auto";
        return result;
      };
    });

    afterEach(() => {
      Element.prototype.scrollTo = methodOverrides.scrollTo; // eslint-disable-line @typescript-eslint/unbound-method
      window.getComputedStyle = methodOverrides.getComputedStyle;
    });

    it("scrolls to highlighted node when highlighting props change", async () => {
      const dp = [{ id: "0", label: PropertyRecord.fromString("zero"), icon: "test-icon" }];

      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={dp} />);
      }, renderNodesSpy);

      const highlightProps: HighlightableTreeProps = {
        searchText: "er",
        activeMatch: {
          nodeId: "0",
          matchIndex: 0,
        },
      };

      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={dp} nodeHighlightingProps={highlightProps} />);
      }, renderSpy);

      expect(scrollToSpy).to.be.calledOnce;
    });

    it("does nothing when there's no active match", async () => {
      const dp = [{ id: "0", label: PropertyRecord.fromString("zero"), icon: "test-icon" }];
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={dp} />);
      }, renderSpy, 2);
      const highlightProps: HighlightableTreeProps = {
        searchText: "er",
        activeMatch: undefined,
      };
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={dp} nodeHighlightingProps={highlightProps} />);
      }, renderSpy, 1);
      expect(scrollToSpy).to.not.be.called;
    });

    it("does nothing when there's active match element is not found", async () => {
      const dp = [{ id: "0", label: PropertyRecord.fromString("zero"), icon: "test-icon" }];
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={dp} />);
      }, renderSpy, 2);
      const highlightProps: HighlightableTreeProps = {
        searchText: "er",
        activeMatch: {
          nodeId: "1",
          matchIndex: 0,
        },
      };
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={dp} nodeHighlightingProps={highlightProps} />);
      }, renderSpy, 1);
      expect(scrollToSpy).to.not.be.called;
    });

    it("does nothing when unrelated props change", async () => {
      const dp = [{ id: "0", label: PropertyRecord.fromString("zero"), icon: "test-icon" }];
      const highlightProps: HighlightableTreeProps = {
        searchText: "er",
        activeMatch: {
          nodeId: "0",
          matchIndex: 0,
        },
      };
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={dp} nodeHighlightingProps={highlightProps} />);
      }, renderSpy, 2);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={dp} nodeHighlightingProps={highlightProps} selectedNodes={[]} />);
      }, renderSpy, 1);
      expect(scrollToSpy).to.not.be.called;
    });

  });

  describe("cell editing", () => {

    let defaultSelectionProps: TreeProps;
    const onCellEditingSpy = sinon.spy();
    const onCellUpdatedSpy = sinon.spy();

    const handleCellUpdated = async (_args: TreeCellUpdatedArgs): Promise<boolean> => {
      onCellUpdatedSpy();
      return true;
    };

    beforeEach(async () => {
      onCellEditingSpy.resetHistory();
      onCellUpdatedSpy.resetHistory();

      defaultSelectionProps = {
        ...defaultProps,
        dataProvider: createDataProvider(),
        cellEditing: {
          onCellEditing: onCellEditingSpy,
          onCellUpdated: handleCellUpdated,
          ignoreEditorBlur: true,
        },
      };
    });

    describe("with Single selection mode", () => {

      beforeEach(async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectionMode={SelectionMode.Single} />), renderSpy, 2);
      });

      it("activates the editor when clicking a selected mode", async () => {
        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
        // click node 0 again
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);

        // verify
        expect(getSelectedNodes().length).to.eq(1);
        expect(onCellEditingSpy.calledOnce).to.be.true;
      });

      it("does not activate the editor when isEditable is false", async () => {
        // select node 1
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
        // click node 1 again
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);

        // verify
        expect(getSelectedNodes().length).to.eq(1);
        expect(onCellEditingSpy.called).to.be.false;
      });

      it("commits the change on Enter", async () => {
        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
        // click node 0 again
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);

        // verify
        expect(onCellEditingSpy.calledOnce).to.be.true;

        // Get editor input element & press Enter
        const inputNode = renderedTree.queryByTestId("components-text-editor");
        expect(inputNode).to.exist;

        if (inputNode) {
          await waitForUpdate(() => fireEvent.keyDown(inputNode, { key: "Enter" }), renderSpy);
          expect(onCellUpdatedSpy.calledOnce).to.be.true;
          const inputNode2 = renderedTree.queryByTestId("components-text-editor");
          expect(inputNode2).to.not.exist;
        }

      });

      it("cancels the change on Escape", async () => {
        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);
        // click node 0 again
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy);

        // verify
        expect(onCellEditingSpy.calledOnce).to.be.true;

        // Get editor input element & press Enter
        const inputNode = renderedTree.queryByTestId("components-text-editor");
        expect(inputNode).to.exist;

        if (inputNode) {
          await waitForUpdate(() => fireEvent.keyDown(inputNode, { key: "Escape" }), renderSpy);
          expect(onCellUpdatedSpy.called).to.be.false;
          const inputNode2 = renderedTree.queryByTestId("components-text-editor");
          expect(inputNode2).to.not.exist;
        }

      });

    });
  });

  it("calls `onRootNodesLoaded` props callback", async () => {
    const spy = sinon.spy();
    const data: TreeNodeItem[] = [{ id: "0", label: PropertyRecord.fromString("0") }];
    await waitForUpdate(() => {
      renderedTree = render(<Tree
        {...defaultProps}
        dataProvider={data}
        onRootNodesLoaded={spy}
      />);
    }, renderSpy, 2);
    expect(spy.calledWith(data)).to.be.true;
  });

  it("calls `onChildrenLoaded` props callback", async () => {
    const spy = sinon.spy();
    const rootNode: DelayLoadedTreeNodeItem = { id: "0", label: PropertyRecord.fromString("0"), autoExpand: true, hasChildren: true };
    const childNode: DelayLoadedTreeNodeItem = { id: "1", label: PropertyRecord.fromString("1") };
    const data = async (parent?: TreeNodeItem) => parent ? [childNode] : [rootNode];
    await waitForUpdate(() => {
      renderedTree = render(<Tree
        {...defaultProps}
        dataProvider={data}
        onChildrenLoaded={spy}
      />);
    }, renderSpy, 2);
    expect(spy.calledWith(rootNode, [childNode])).to.be.true;
  });

  it("calls `onRootNodesLoaded` props callback once per page", async () => {
    const spy = sinon.spy();
    const data: TreeNodeItem[] = [{ id: "0", label: PropertyRecord.fromString("0") }, { id: "1", label: PropertyRecord.fromString("1") }];
    const provider: ITreeDataProvider = {
      getNodesCount: async () => 2,
      getNodes: async (_parent, page: PageOptions) => {
        return (page.start === 0) ? [data[0]] : [data[1]];
      },
    };
    await waitForUpdate(() => {
      renderedTree = render(<Tree
        {...defaultProps}
        dataProvider={provider}
        pageSize={1}
        onRootNodesLoaded={spy}
      />);
    }, renderSpy, 3);
    expect(spy.firstCall.calledWith([data[0]])).to.be.true;
    expect(spy.secondCall.calledWith(data)).to.be.true;
  });

  it("calls `onChildrenLoaded` props callback once per page", async () => {
    const spy = sinon.spy();
    const rootNode: DelayLoadedTreeNodeItem = { id: "0", label: PropertyRecord.fromString("0"), autoExpand: true, hasChildren: true };
    const childNodes: TreeNodeItem[] = [{ id: "1", label: PropertyRecord.fromString("1") }, { id: "2", label: PropertyRecord.fromString("2") }];
    const provider: ITreeDataProvider = {
      getNodesCount: async (parent?: TreeNodeItem) => (parent ? 2 : 1),
      getNodes: async (parent: TreeNodeItem | undefined, page: PageOptions) => {
        if (!parent)
          return [rootNode];
        return (page.start === 0) ? [childNodes[0]] : [childNodes[1]];
      },
    };
    await waitForUpdate(() => {
      renderedTree = render(<Tree
        {...defaultProps}
        dataProvider={provider}
        pageSize={1}
        onChildrenLoaded={spy}
      />);
    }, renderSpy, 2);
    expect(spy.firstCall.calledWith(rootNode, [childNodes[0]])).to.be.true;
    expect(spy.secondCall.calledWith(rootNode, childNodes)).to.be.true;
  });

  describe("inspireNodeFromTreeNodeItem", () => {
    let item: TreeNodeItem;
    let nodeConfig: BeInspireTreeNodeConfig;

    beforeEach(async () => {
      item = {
        id: "0",
        label: PropertyRecord.fromString("0"),
      };

      nodeConfig = {
        text: "",
        itree: {
          state: {},
        },
      };
    });

    it("changes checkbox state from on to off", () => {
      // Old state
      nodeConfig.itree!.state!.checked = true;
      // New state
      item.checkBoxState = CheckBoxState.Off;

      const newConfig = Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem, nodeConfig);

      expect(newConfig.itree!.state!).to.not.have.key("checked");
    });

    it("changes checkbox state from on to partial", () => {
      // Old state
      nodeConfig.itree!.state!.checked = true;
      // New state
      item.checkBoxState = CheckBoxState.Partial;

      const newConfig = Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem, nodeConfig);

      expect(newConfig.itree!.state!).to.not.have.key("checked");
      expect(newConfig.itree!.state!.indeterminate).to.be.true;
    });

    it("changes checkbox state from partial to off", () => {
      // Old state
      nodeConfig.itree!.state!.indeterminate = true;
      // New state
      item.checkBoxState = CheckBoxState.Off;

      const newConfig = Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem, nodeConfig);

      expect(newConfig.itree!.state!).to.not.have.key("indeterminate");
    });

    it("changes checkbox state from partial to on", () => {
      // Old state
      nodeConfig.itree!.state!.indeterminate = true;
      // New state
      item.checkBoxState = CheckBoxState.On;

      const newConfig = Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem, nodeConfig);

      expect(newConfig.itree!.state!).to.not.have.key("indeterminate");
      expect(newConfig.itree!.state!.checked).to.be.true;
    });

    it("changes checkbox state from off to partial", () => {
      // New state
      item.checkBoxState = CheckBoxState.Partial;

      const newConfig = Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem, nodeConfig);

      expect(newConfig.itree!.state!).to.not.have.key("checked");
      expect(newConfig.itree!.state!.indeterminate).to.be.true;
    });

    it("changes checkbox state from off to on", () => {
      // New state
      item.checkBoxState = CheckBoxState.On;

      const newConfig = Tree.inspireNodeFromTreeNodeItem(item, Tree.inspireNodeFromTreeNodeItem, nodeConfig);

      expect(newConfig.itree!.state!).to.not.have.key("indeterminate");
      expect(newConfig.itree!.state!.checked).to.be.true;
    });
  });
});
