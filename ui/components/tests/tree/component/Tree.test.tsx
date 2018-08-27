/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as enzyme from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import Tree, { Props, OnNodesSelectedCallback, OnNodesDeselectedCallback } from "../../../src/tree/component/Tree";
import { InspireTreeNode } from "../../../src/tree/component/BeInspireTree";
import { SelectionMode } from "../../../src/common";
import { ExpansionToggle } from "@bentley/ui-core/lib/tree";
import { waitForSpy } from "../../test-helpers/Misc";

describe("Tree", () => {
  const onTreeReloaded = sinon.spy();

  const verifyNodes = (nodes: InspireTreeNode[], ids: string[]) => {
    if (nodes.length !== ids.length)
      return false;

    for (const id of ids) {
      if (!nodes.find((x) => x.id === id))
        return false;
    }
    return true;
  };

  const dataProvider = async (node: InspireTreeNode) => {
    if (!node)
      return [
        { id: "0", children: true },
        { id: "1", children: true },
        { id: "2", children: true },
        { id: "3", children: true },
      ];

    return [
      { id: node.id + "-0", children: false },
      { id: node.id + "-1", children: false },
      { id: node.id + "-2", children: false },
      { id: node.id + "-3", children: false },
    ];
  };

  const nodeContentsName = "div.nz-tree-node div.contents";
  const selectedNodeName = "div.nz-tree-node.is-selected";
  const onNodesSelectedCallbackMock = moq.Mock.ofType<OnNodesSelectedCallback>();
  const onNodesDeselectedCallbackMock = moq.Mock.ofType<OnNodesDeselectedCallback>();
  let tree: enzyme.ReactWrapper<Props, any>;

  describe("Selection", () => {

    beforeEach(async () => {
      onNodesSelectedCallbackMock.reset();
      onNodesDeselectedCallbackMock.reset();

      const onChildrenLoaded = sinon.spy();
      onTreeReloaded.resetHistory();
      tree = enzyme.mount(<Tree
        dataProvider={dataProvider}
        onNodesSelected={onNodesSelectedCallbackMock.object}
        onNodesDeselected={onNodesDeselectedCallbackMock.object}
        onTreeReloaded={onTreeReloaded}
        onChildrenLoaded={onChildrenLoaded}
      />);
      await waitForSpy(tree, onTreeReloaded);
      await waitForSpy(tree, onChildrenLoaded);
    });

    describe("Single", () => {

      it("selects a node", async () => {
        const node = tree.find(nodeContentsName).first();
        node.simulate("click");

        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(1);
      });

      it("deselects other nodes when selects a node", async () => {
        onTreeReloaded.resetHistory();
        tree.setProps({ selectedNodes: ["0", "1"] });
        await waitForSpy(tree, onTreeReloaded);
        expect(tree.find(selectedNodeName).length).to.be.equal(2);

        const node = tree.find(nodeContentsName).first();
        node.simulate("click");

        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(1);
      });

    });

    describe("Extended", () => {

      beforeEach(async () => {
        onTreeReloaded.resetHistory();
        tree.setProps({ selectionMode: SelectionMode.Extended });
        await waitForSpy(tree, onTreeReloaded);
      });

      it("deselects collapsed nodes when selects a node", async () => {
        const expansionToggle = tree.find(ExpansionToggle).first();
        expansionToggle.simulate("click");

        const node0 = tree.find(nodeContentsName).first();
        const node00 = tree.find(nodeContentsName).at(1);
        const node01 = tree.find(nodeContentsName).at(2);

        node00.simulate("click");
        node01.simulate("click", { ctrlKey: true });
        expect(tree.find(selectedNodeName).length).to.be.equal(2);
        expansionToggle.simulate("click");

        node0.simulate("click");
        expansionToggle.simulate("click");
        expect(tree.find(selectedNodeName).length).to.be.equal(1);

        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0-0"])), true), moq.Times.once());
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0-1"])), false), moq.Times.once());
        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
      });

      it("shift select nodes from top to bottom", async () => {
        const expansionToggle = tree.find(ExpansionToggle).first();
        expansionToggle.simulate("click");

        const nodes = tree.find(nodeContentsName);
        const node0 = nodes.at(0);
        const node1 = nodes.at(5);

        node0.simulate("click");
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());
        node1.simulate("click", { shiftKey: true });
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0", "0-0", "0-1", "0-2", "0-3", "1"])), true), moq.Times.once());

        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(6);
      });

      it("shift select nodes from bottom to top", async () => {
        const expansionToggle = tree.find(ExpansionToggle).first();
        expansionToggle.simulate("click");

        const nodes = tree.find(nodeContentsName);
        const node0 = nodes.at(0);
        const node1 = nodes.at(5);
        node1.simulate("click");
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["1"])), true), moq.Times.once());

        node0.simulate("click", { shiftKey: true });
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0", "0-0", "0-1", "0-2", "0-3", "1"])), true), moq.Times.once());

        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(6);
      });

      it("shift selecting nodes does not select collapsed nodes", async () => {
        const expansionToggle = tree.find(ExpansionToggle).first();
        const nodes = tree.find(nodeContentsName);
        const nodes0 = nodes.at(0);
        const nodes2 = nodes.at(2);

        expansionToggle.simulate("click");
        expansionToggle.simulate("click");

        nodes2.simulate("click");
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["2"])), true), moq.Times.once());

        nodes0.simulate("click", { shiftKey: true });
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0", "1", "2"])), true), moq.Times.once());

        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(3);
      });

      it("ctrl selects nodes", async () => {
        const nodes = tree.find(nodeContentsName);
        const node0 = nodes.at(0);
        const node2 = nodes.at(2);
        node0.simulate("click", { ctrlKey: true });
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0"])), false), moq.Times.once());

        node2.simulate("click", { ctrlKey: true });
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["2"])), false), moq.Times.once());

        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(2);
      });

    });

    describe("Multiple", () => {

      beforeEach(async () => {
        onTreeReloaded.resetHistory();
        tree.setProps({ selectionMode: SelectionMode.Multiple });
        await waitForSpy(tree, onTreeReloaded);
      });

      it("drag selects nodes", async () => {
        const expansionToggle = tree.find(ExpansionToggle).first();
        expansionToggle.simulate("click");

        const nodes = tree.find(nodeContentsName);
        const node0 = nodes.at(0);
        const node1 = nodes.at(5);
        node0.simulate("mousedown");
        node1.simulate("mousemove", { buttons: 1 });
        document.dispatchEvent(new MouseEvent("mouseup"));

        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0", "0-0", "0-1", "0-2", "0-3", "1"])), false), moq.Times.once());
        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(6);
      });

      it("drag selects and deselects nodes", async () => {
        onTreeReloaded.resetHistory();
        tree.setProps({ selectedNodes: ["0", "2"] });
        await waitForSpy(tree, onTreeReloaded);

        expect(tree.find(selectedNodeName).length).to.be.equal(2);
        const nodes = tree.find(nodeContentsName);
        const node0 = nodes.at(0);
        const node2 = nodes.at(2);
        node0.simulate("mousedown");
        node2.simulate("mousemove", { buttons: 1 });
        document.dispatchEvent(new MouseEvent("mouseup"));

        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["1"])), false), moq.Times.once());
        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0", "2"]))), moq.Times.once());
        expect(tree.find(selectedNodeName).length).to.be.equal(1);
      });

      it("drag selecting nodes does not select collapsed nodes", async () => {
        const expansionToggle = tree.find(ExpansionToggle).first();
        const nodes = tree.find(nodeContentsName);
        const nodes0 = nodes.at(0);
        const nodes2 = nodes.at(2);

        expansionToggle.simulate("click");
        expansionToggle.simulate("click");

        nodes0.simulate("mousedown");
        nodes2.simulate("mousemove", { buttons: 1 });
        document.dispatchEvent(new MouseEvent("mouseup"));

        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0", "1", "2"])), false), moq.Times.once());
        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(tree.find(selectedNodeName).length).to.be.equal(3);
      });

    });

    describe("SingleAllowDeselect", () => {

      beforeEach(async () => {
        onTreeReloaded.resetHistory();
        tree.setProps({ selectionMode: SelectionMode.SingleAllowDeselect });
        await waitForSpy(tree, onTreeReloaded);
      });

      it("deselects selected row", async () => {
        const node = tree.find(nodeContentsName).first();
        node.simulate("click");
        onNodesSelectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0"])), true), moq.Times.once());

        node.simulate("click");
        onNodesDeselectedCallbackMock.verify((x) => x(moq.It.is<InspireTreeNode[]>((items: InspireTreeNode[]): boolean => verifyNodes(items, ["0"]))), moq.Times.once());

        expect(tree.find(selectedNodeName).length).to.be.equal(0);
      });

      it("handles selection changes if callback not specified", async () => {
        onTreeReloaded.resetHistory();
        tree.setProps({
          onNodesDeselected: undefined,
          onNodesSelected: undefined,
        });
        await waitForSpy(tree, onTreeReloaded);

        const node = tree.find(nodeContentsName).first();
        node.simulate("click");
        expect(tree.find(selectedNodeName).length).to.be.equal(1);
        node.simulate("click");
        expect(tree.find(selectedNodeName).length).to.be.equal(0);
      });

    });

    it("selects nodes on mount", async () => {
      onTreeReloaded.resetHistory();
      tree = enzyme.mount(<Tree dataProvider={dataProvider} selectedNodes={["0", "1"]} onTreeReloaded={onTreeReloaded} />);
      await waitForSpy(tree, onTreeReloaded);
      expect(tree.find(selectedNodeName).length).to.be.equal(2);
    });

    it("selects nodes after expanding", async () => {
      onTreeReloaded.resetHistory();
      tree.setProps({ selectedNodes: ["0-0"] });
      await waitForSpy(tree, onTreeReloaded);

      const expansionToggle = tree.find(ExpansionToggle).first();
      expansionToggle.simulate("click");
      expect(tree.find(selectedNodeName).length).to.be.equal(1);
    });

    it("node remains selected after collapsing", async () => {
      const expansionToggle = tree.find(ExpansionToggle).first();

      // expand
      expansionToggle.simulate("click");

      const node00 = tree.find(nodeContentsName).at(1);
      node00.simulate("click");
      expect(tree.find(selectedNodeName).length).to.be.equal(1);

      // collapse
      expansionToggle.simulate("click");
      expect(tree.find(selectedNodeName).length).to.be.equal(0);

      // expand
      expansionToggle.simulate("click");
      expect(tree.find(selectedNodeName).length).to.be.equal(1);
    });

    it("updates selection if selectedNodes prop changes", async () => {
      onTreeReloaded.resetHistory();
      tree.setProps({ selectedNodes: ["0", "1"] });
      await waitForSpy(tree, onTreeReloaded);

      tree.update();
      expect(tree.find(selectedNodeName).length).to.be.equal(2);
    });

    it("does not clear selection if passes isNodeSelected undefined", async () => {
      onTreeReloaded.resetHistory();
      tree.setProps({ selectedNodes: ["0", "1"] });
      await waitForSpy(tree, onTreeReloaded);
      expect(tree.find(selectedNodeName).length).to.be.equal(2);

      onTreeReloaded.resetHistory();
      tree.setProps({ selectedNodes: undefined });
      await waitForSpy(tree, onTreeReloaded);
      expect(tree.find(selectedNodeName).length).to.be.equal(2);
    });

  });

});
