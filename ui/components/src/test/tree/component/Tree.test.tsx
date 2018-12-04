/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as React from "react";
import * as sinon from "sinon";
import { RenderResult, render, within, fireEvent } from "react-testing-library";
import { waitForUpdate } from "../../test-helpers/misc";
import TestUtils from "../../TestUtils";
import {
  Tree, TreeProps,
  NodesSelectedCallback, NodesDeselectedCallback, TreeNodeProps, TreeCellUpdatedArgs,
} from "../../../tree/component/Tree";
import { SelectionMode, PageOptions } from "../../../ui-components";
import { TreeDataProviderMethod, TreeNodeItem, TreeDataProviderRaw, DelayLoadedTreeNodeItem, ITreeDataProvider, TreeDataChangesListener } from "../../../ui-components";
import { BeInspireTreeNode } from "../../../tree/component/BeInspireTree";
import HighlightingEngine, { HighlightableTreeProps } from "../../../tree/HighlightingEngine";
import { BeEvent } from "@bentley/bentleyjs-core";

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

  type NodeElement = HTMLElement & { contentArea: HTMLElement, expansionToggle: HTMLElement | undefined };
  const getNode = (label: string): NodeElement => {
    const result = renderedTree.getAllByTestId(Tree.TestId.Node as any).reduce<NodeElement[]>((list: NodeElement[], node) => {
      const nodeContents = within(node).getByTestId(Tree.TestId.NodeContents);
      if (nodeContents.textContent === label || within(nodeContents).queryByText(label as any)) {
        list.push(Object.assign(node, {
          contentArea: nodeContents,
          expansionToggle: within(node).queryByTestId(Tree.TestId.NodeExpansionToggle as any) || undefined,
        }));
      }
      return list;
    }, []);
    if (!result || !result.length)
      throw new Error(`Node with label "${label}" not found`);
    return result[0];
  };

  const createDataProvider = (expandedNodes?: string[]): TreeDataProviderMethod => {
    const isExpanded = (id: string) => (undefined === expandedNodes) || expandedNodes.includes(id);
    return async (parent?: TreeNodeItem) => {
      if (!parent)
        return [
          { id: "0", label: "0", hasChildren: true, autoExpand: isExpanded("0"), isEditable: true },
          { id: "1", label: "1", hasChildren: true, autoExpand: isExpanded("1") },
        ];
      return [
        { id: parent.id + "-a", label: parent.label + "-a" },
        { id: parent.id + "-b", label: parent.label + "-b" },
      ];
    };
  };

  let renderedTree: RenderResult;
  let renderSpy: sinon.SinonSpy;
  let defaultProps: Partial<TreeProps>;

  before(() => {
    TestUtils.initializeUiComponents(); // tslint:disable-line:no-floating-promises
  });

  beforeEach(() => {
    sinon.restore();
    renderSpy = sinon.spy();
    defaultProps = {
      onRender: renderSpy,
    };

    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    Object.defineProperties(HTMLElement.prototype, {
      offsetHeight: { get: () => 200 },
      offsetWidth: { get: () => 200 },
    });
  });

  describe("selection", () => {

    const getSelectedNodes = (): Array<HTMLElement & { label: string }> => {
      return renderedTree.getAllByTestId(Tree.TestId.Node as any)
        .filter((node) => node.classList.contains("is-selected"))
        .map((node) => Object.assign(node, { label: within(node).getByTestId(Tree.TestId.NodeContents).innerHTML }));
    };

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
      };
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
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea), renderSpy, 2);

        // verify node 0 replaced multi-selection
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.eq(1);
      });

    });

    describe("with Extended selection mode", () => {

      beforeEach(async () => {
        await waitForUpdate(() => renderedTree = render(<Tree {...defaultSelectionProps} selectionMode={SelectionMode.Extended} />), renderSpy, 2);
      });

      it("deselects collapsed nodes when selects a node", async () => {
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
        // select node 1
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["1"])), true), moq.Times.once());

        // shift-select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea, { shiftKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "0-a", "0-b", "1"])), true), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(4);
      });

      it("shift selecting nodes does not select collapsed nodes", async () => {
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
        // select node 0
        await waitForUpdate(() => fireEvent.click(getNode("0").contentArea, { ctrlKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0"])), false), moq.Times.once());

        // ctrl-select node 1
        await waitForUpdate(() => fireEvent.click(getNode("1").contentArea, { ctrlKey: true }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["1"])), false), moq.Times.once());

        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().length).to.equal(2);
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

        // drag
        // note: dragging re-renders to update selection
        await waitForUpdate(() => fireEvent.mouseMove(getNode("1").contentArea, { buttons: 1 }), renderSpy);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "0-a", "0-b", "1"]);

        // release
        fireEvent.mouseUp(getNode("1").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.is<TreeNodeItem[]>((items: TreeNodeItem[]): boolean => verifyNodes(items, ["0", "0-a", "0-b", "1"])), false), moq.Times.once());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "0-a", "0-b", "1"]);

        // reset mocks
        nodesSelectedCallbackMock.reset();
        nodesDeselectedCallbackMock.reset();

        // press again
        fireEvent.mouseDown(getNode("1").contentArea);
        nodesSelectedCallbackMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        nodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(getSelectedNodes().map((n) => n.label)).to.deep.eq(["0", "0-a", "0-b", "1"]);

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
          label: "0",
          children: [{
            id: "1",
            label: "1",
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
        await waitForUpdate(() => fireEvent.click(node0a!.contentArea), renderSpy);
        expect(getSelectedNodes().length).to.eq(1);

        // collapse its parent
        const node0 = getNode("0");
        await waitForUpdate(() => fireEvent.click(node0!.expansionToggle!), renderSpy);
        expect(getSelectedNodes().length).to.eq(0);

        // expand the parent
        await waitForUpdate(() => fireEvent.click(node0!.expansionToggle!), renderSpy);
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

  describe("expand & collapse", () => {

    let dataProvider: TreeDataProviderMethod = async (parent?: TreeNodeItem) => {
      if (!parent)
        return [
          { id: "0", label: "0", hasChildren: true },
          { id: "1", label: "1", hasChildren: true },
        ];
      return [
        { id: parent.id + "-a", label: parent.label + "-a" },
        { id: parent.id + "-b", label: parent.label + "-b" },
      ];
    };

    const getExpandedNodes = () => {
      return renderedTree.queryAllByTestId(Tree.TestId.Node as any).filter((node) => {
        const expansionToggle = within(node).queryByTestId(Tree.TestId.NodeExpansionToggle as any);
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
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);
    });

    afterEach(function () {
      if (this.currentTest!.state === "failed")
        renderedTree.debug();
    });

    it("expands and collapses node when clicked on expansion toggle", async () => {
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultExpandCollapseProps} />), renderSpy, 2);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(2);

      // expand node 0
      // note: need to wait for 2 renders:
      // 1. after click
      // 2. after children are loaded
      await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderSpy, 2);
      expect(getExpandedNodes().length).to.eq(1);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);

      await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderSpy);
      expect(getExpandedNodes().length).to.eq(0);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(2);
    });

    it("calls onNodeExpanded callback", async () => {
      const callbackMock = moq.Mock.ofInstance((_item: TreeNodeItem) => { });
      await waitForUpdate(() => renderedTree = render(<Tree {...defaultExpandCollapseProps} onNodeExpanded={callbackMock.object} />), renderSpy, 2);

      // expand node 0
      // note: need to wait for 2 renders:
      // 1. after click
      // 2. after children are loaded
      await waitForUpdate(() => fireEvent.click(getNode("0").expansionToggle!), renderSpy, 2);

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
          dataProvider={[{ id: "0", label: "0" }]}
        />);
      }, renderSpy, 2);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree
          {...defaultProps}
          dataProvider={[{ id: "1", label: "1" }]}
        />);
      }, renderSpy, 2);
      expect(getNode("1")).to.not.be.undefined;
    });

    // TODO: The test reveals an issue where data provider is not changed if we don't wait
    // for initial update. This happens because we skip the update from `shouldComponentUpdate`
    // because `modelReady = false` and later on we don't detect changed data provider.
    it.skip("rerenders on data provider change without waiting for initial update", async () => {
      renderedTree = render(<Tree {...defaultProps} dataProvider={[{ id: "0", label: "0" }]} />);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={[{ id: "1", label: "1" }]} />);
      }, renderSpy);
      expect(getNode("1")).to.not.be.undefined;
    });

    it("renders with icons", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[{ id: "0", label: "0", icon: "test-icon" }]}
        />);
      }, renderSpy, 2);
      expect(getNode("0").getElementsByClassName("test-icon").length).to.eq(1);
    });

    it("renders with HighlightingEngine when nodeHighlightingProps set", async () => {
      const renderLabelSpy = sinon.spy(HighlightingEngine, "renderNodeLabel");
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[{ id: "0", label: "0", icon: "test-icon" }]}
          nodeHighlightingProps={{ searchText: "test" }}
        />);
      }, renderSpy, 2);
      expect(renderLabelSpy.calledWith("0", { searchText: "test", activeMatchIndex: undefined })).to.be.true;
    });

    it("rerenders without HighlightingEngine when nodeHighlightingProps are reset to undefined", async () => {
      const renderLabelSpy = sinon.spy(HighlightingEngine, "renderNodeLabel");
      const dp: TreeDataProviderRaw = [{ id: "0", label: "0", icon: "test-icon", children: [] }];
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={dp}
          nodeHighlightingProps={{ searchText: "test" }}
        />);
      }, renderSpy, 2);
      expect(renderLabelSpy.calledOnce).to.be.true;
      renderLabelSpy.resetHistory();
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={dp} />);
      }, renderSpy, 1);
      expect(renderLabelSpy.called).to.be.false;
    });

    it("renders with custom renderer", async () => {
      const renderMock = moq.Mock.ofInstance((node: BeInspireTreeNode<TreeNodeItem>, _props: TreeNodeProps): React.ReactNode => {
        return <div key={node.id}>{node.text}</div>;
      });
      renderMock.callBase = true;
      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={[{ id: "0", label: "0" }, { id: "1", label: "1" }]}
          renderNode={renderMock.object}
        />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByText("0").length).to.eq(1);
      expect(renderedTree.getAllByText("1").length).to.eq(1);
      // note: node renderer called only 2 times, because the first render doesn't render nodes
      // and the second one renders each node once
      renderMock.verify((x) => x(moq.It.isAny(), moq.It.isAny()), moq.Times.exactly(2));
    });

    it("renders placeholder when node has no payload", async () => {
      const provider: ITreeDataProvider = {
        getNodesCount: async () => 2,
        getNodes: async (_parent, page: PageOptions) => {
          if (page.start === 0)
            return [{ id: "0", label: "0" }];
          return [{ id: "1", label: "1" }];
        },
      };

      await waitForUpdate(() => {
        renderedTree = render(<Tree
          {...defaultProps}
          dataProvider={provider}
          pageSize={1}
        />);
      }, renderSpy, 2);

      expect(renderedTree.baseElement.getElementsByClassName("nz-tree-node").length).to.eq(1);
      expect(renderedTree.baseElement.getElementsByClassName("nz-tree-placeholder").length).to.eq(1);
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
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);

      const node = (await interfaceProvider.getNodes())[1];
      await waitForUpdate(() => {
        node.label = "test";
        interfaceProvider.onTreeNodeChanged!.raiseEvent([node]);
      }, renderSpy, 1);
      expect(renderedTree.getByText("test")).to.not.be.undefined;
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);

      // verify the node is collapsed
      const toggle = within(getNode("test")).queryByTestId(Tree.TestId.NodeExpansionToggle);
      expect(toggle!.classList.contains("is-expanded")).to.be.false;
    });

    it("rerenders when `onTreeNodeChanged` is broadcasted with expanded node", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);

      const node = (await interfaceProvider.getNodes())[0];
      await waitForUpdate(() => {
        node.label = "test";
        interfaceProvider.onTreeNodeChanged!.raiseEvent([node]);
      }, renderSpy, 1);
      expect(renderedTree.getByText("test")).to.not.be.undefined;
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);

      // verify the node is expanded
      const toggle = within(getNode("test")).queryByTestId(Tree.TestId.NodeExpansionToggle);
      expect(toggle!.classList.contains("is-expanded")).to.be.true;
    });

    it("rerenders when `onTreeNodeChanged` is broadcasted with undefined node", async () => {
      const getFlatList = () => renderedTree.getAllByTestId(Tree.TestId.Node as any)
        .map((node) => within(node).getByTestId(Tree.TestId.NodeContents).innerHTML);

      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);
      expect(getFlatList()).to.deep.eq(["0", "0-a", "0-b", "1"]);

      setReverseOrder(true);

      await waitForUpdate(() => {
        interfaceProvider.onTreeNodeChanged!.raiseEvent([undefined]);
      }, renderSpy, 1);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);
      expect(getFlatList()).to.deep.eq(["1", "0", "0-b", "0-a"]);
    });

    it("handles case when `onTreeNodeChanged` is broadcasted with invalid node", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);

      const node: TreeNodeItem = {
        id: "test",
        label: "test",
      };
      interfaceProvider.onTreeNodeChanged!.raiseEvent(node);
      expect(renderedTree.getAllByTestId(Tree.TestId.Node as any).length).to.eq(4);
    });

    it("subscribes to `onTreeNodeChanged` on mount", () => {
      renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      expect(interfaceProvider.onTreeNodeChanged!.numberOfListeners).to.eq(1);
    });

    it("unsubscribes from `onTreeNodeChanged` on unmount", () => {
      renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      renderedTree.unmount();
      expect(interfaceProvider.onTreeNodeChanged!.numberOfListeners).to.eq(0);
    });

    it("subscribes to `onTreeNodeChanged` on provider change", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={methodProvider} />);
      }, renderSpy, 2);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy);
      expect(interfaceProvider.onTreeNodeChanged!.numberOfListeners).to.eq(1);
    });

    it("unsubscribes from `onTreeNodeChanged` on provider change", async () => {
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={interfaceProvider} />);
      }, renderSpy, 2);
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={methodProvider} />);
      }, renderSpy);
      expect(interfaceProvider.onTreeNodeChanged!.numberOfListeners).to.eq(0);
    });

  });

  describe("scrolling to highlighted nodes", () => {

    const methodOverrides = {
      scrollTo: Element.prototype.scrollTo,
      getComputedStyle: window.getComputedStyle,
    };
    const scrollToSpy = sinon.spy();

    beforeEach(() => {
      scrollToSpy.resetHistory();
      Element.prototype.scrollTo = scrollToSpy;
      // tslint:disable-next-line:only-arrow-functions
      window.getComputedStyle = function () {
        const result = methodOverrides.getComputedStyle.apply(window, arguments);
        result.overflow = "auto";
        return result;
      };
    });

    afterEach(() => {
      Element.prototype.scrollTo = methodOverrides.scrollTo;
      window.getComputedStyle = methodOverrides.getComputedStyle;
    });

    it("scrolls to highlighted node when highlighting props change", async () => {
      const dp = [{ id: "0", label: "zero", icon: "test-icon" }];
      await waitForUpdate(() => {
        renderedTree = render(<Tree {...defaultProps} dataProvider={dp} />);
      }, renderSpy, 2);
      const highlightProps: HighlightableTreeProps = {
        searchText: "er",
        activeMatch: {
          nodeId: "0",
          matchIndex: 0,
        },
      };
      await waitForUpdate(() => {
        renderedTree.rerender(<Tree {...defaultProps} dataProvider={dp} nodeHighlightingProps={highlightProps} />);
      }, renderSpy, 1);
      expect(scrollToSpy).to.be.calledOnce;
    });

    it("does nothing when there's no active match", async () => {
      const dp = [{ id: "0", label: "zero", icon: "test-icon" }];
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
      const dp = [{ id: "0", label: "zero", icon: "test-icon" }];
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
      const dp = [{ id: "0", label: "zero", icon: "test-icon" }];
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

  it("calls `onRootNodesLoaded` props callback", async () => {
    const spy = sinon.spy();
    const data: TreeNodeItem[] = [{ id: "0", label: "0" }];
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
    const rootNode: DelayLoadedTreeNodeItem = { id: "0", label: "0", autoExpand: true, hasChildren: true };
    const childNode: DelayLoadedTreeNodeItem = { id: "1", label: "1" };
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

  describe("cell editing", () => {

    const getSelectedNodes = (): Array<HTMLElement & { label: string }> => {
      return renderedTree.getAllByTestId(Tree.TestId.Node as any)
        .filter((node) => node.classList.contains("is-selected"))
        .map((node) => Object.assign(node, { label: within(node).getByTestId(Tree.TestId.NodeContents).innerHTML }));
    };

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
        onCellEditing: onCellEditingSpy,
        onCellUpdated: handleCellUpdated,
        ignoreEditorBlur: true,
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

});
