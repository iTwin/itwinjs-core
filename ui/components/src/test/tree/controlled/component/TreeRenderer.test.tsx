/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { VariableSizeList } from "react-window";
import sinon from "sinon";
import * as moq from "typemoq";
import { PrimitiveValue, SpecialKey } from "@bentley/ui-abstract";
import { fireEvent, render } from "@testing-library/react";
import { TreeNodeRendererProps } from "../../../../ui-components/tree/controlled/component/TreeNodeRenderer";
import { TreeRenderer } from "../../../../ui-components/tree/controlled/component/TreeRenderer";
import { from } from "../../../../ui-components/tree/controlled/Observable";
import { TreeActions } from "../../../../ui-components/tree/controlled/TreeActions";
import {
  TreeModel, TreeModelNode, TreeModelNodePlaceholder, TreeModelRootNode, VisibleTreeNodes,
} from "../../../../ui-components/tree/controlled/TreeModel";
import { ITreeNodeLoader } from "../../../../ui-components/tree/controlled/TreeNodeLoader";
import { HighlightableTreeProps, HighlightingEngine } from "../../../../ui-components/tree/HighlightingEngine";
import TestUtils from "../../../TestUtils";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";

describe("TreeRenderer", () => {

  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();

  before(async () => {
    await TestUtils.initializeUiComponents();
    Element.prototype.scrollIntoView = () => { };
  });

  after(() => {
    TestUtils.terminateUiComponents();
    delete (Element.prototype as any).scrollIntoView;
  });

  beforeEach(() => {
    // note: this is needed for AutoSizer used by the Tree to
    // have non-zero size and render the virtualized list
    sinon.stub(HTMLElement.prototype, "offsetHeight").get(() => 200);
    sinon.stub(HTMLElement.prototype, "offsetWidth").get(() => 200);
  });

  afterEach(() => {
    visibleNodesMock.reset();
    treeActionsMock.reset();
    nodeLoaderMock.reset();
    sinon.restore();
  });

  it("renders without nodes", () => {
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 0);
    const renderNode = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    expect(renderNode).to.not.be.undefined;
  });

  it("renders with loaded node", () => {
    const label = "test node";
    const node = createRandomMutableTreeModelNode(undefined, undefined, label);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { getByText } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    getByText(label);
  });

  it("renders placeholder and starts loading root node", () => {
    const treeRoot: TreeModelRootNode = { depth: -1, id: undefined, numChildren: 1 };
    const node: TreeModelNodePlaceholder = {
      childIndex: 0,
      depth: 0,
    };
    const modelMock = moq.Mock.ofType<TreeModel>();
    modelMock.setup((x) => x.getRootNode()).returns(() => treeRoot);
    nodeLoaderMock.setup((x) => x.loadNode(treeRoot, 0)).returns(() => from([]));
    visibleNodesMock.setup((x) => x.getModel()).returns(() => modelMock.object);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { container } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    expect(container).to.not.be.null;
    nodeLoaderMock.verify((x) => x.loadNode(treeRoot, 0), moq.Times.once());
  });

  it("renders placeholder and starts loading node with parent", () => {
    const parentNode = createRandomMutableTreeModelNode();
    const node: TreeModelNodePlaceholder = {
      parentId: parentNode.id,
      childIndex: 0,
      depth: 0,
    };
    const modelMock = moq.Mock.ofType<TreeModel>();
    modelMock.setup((x) => x.getNode(parentNode.id)).returns(() => parentNode);
    nodeLoaderMock.setup((x) => x.loadNode(parentNode, 0)).returns(() => from([]));
    visibleNodesMock.setup((x) => x.getModel()).returns(() => modelMock.object);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { container } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    expect(container).to.not.be.null;
    nodeLoaderMock.verify((x) => x.loadNode(parentNode, 0), moq.Times.once());
  });

  it("renders placeholder node but does not start loading if parent node is not found", () => {
    const parentNode = createRandomMutableTreeModelNode();
    const node: TreeModelNodePlaceholder = {
      parentId: parentNode.id,
      childIndex: 0,
      depth: 0,
    };
    const modelMock = moq.Mock.ofType<TreeModel>();
    modelMock.setup((x) => x.getNode(parentNode.id)).returns(() => undefined);
    visibleNodesMock.setup((x) => x.getModel()).returns(() => modelMock.object);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { container } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    expect(container).to.not.be.null;
    nodeLoaderMock.verify((x) => x.loadNode(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
  });

  it("rerenders with loaded node", () => {
    const label = "test node";
    const node = createRandomMutableTreeModelNode(undefined, undefined, label);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { getByText, rerender } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    getByText(label);

    const newLabel = "test node";
    const newNode = createRandomMutableTreeModelNode(undefined, undefined, newLabel);
    const newVisibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
    newVisibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    newVisibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => newNode);

    rerender(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={newVisibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    getByText(newLabel);
  });

  it("rerenders when node height changes", () => {
    const node1 = createRandomMutableTreeModelNode(undefined, undefined, "test_node_1");
    const node2 = createRandomMutableTreeModelNode(undefined, undefined, "test_node_2");
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 2);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node1);
    visibleNodesMock.setup((x) => x.getAtIndex(1)).returns(() => node2);

    const NodeRenderer: React.FC<TreeNodeRendererProps> = (props) => {
      return <>{(props.node.label.value as PrimitiveValue).value}</>;
    };

    const { rerender, getByText } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
        nodeRenderer={NodeRenderer}
      />);

    const nodeBefore = getByText("test_node_2");
    expect(nodeBefore.style.height).to.be.equal("50px");
    expect(nodeBefore.style.top).to.be.equal("50px");

    rerender(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 20}
        nodeRenderer={NodeRenderer}
      />);

    const nodeAfter = getByText("test_node_2");
    expect(nodeAfter.style.height).to.be.equal("20px");
    expect(nodeAfter.style.top).to.be.equal("20px");
  });

  it("scrolls to highlighted node", () => {
    const node2label = "Node 2";
    const node1 = createRandomMutableTreeModelNode();
    const node2 = createRandomMutableTreeModelNode(undefined, undefined, node2label);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 2);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node1);
    visibleNodesMock.setup((x) => x.getAtIndex(1)).returns(() => node2);
    visibleNodesMock.setup((x) => x[Symbol.iterator]()).returns(() => [node1, node2][Symbol.iterator]());

    const highlightProps: HighlightableTreeProps = {
      searchText: node2label,
      activeMatch: {
        matchIndex: 0,
        nodeId: node2.id,
      },
    };

    let onLabelRendered: ((node: TreeModelNode) => void) | undefined;
    const nodeRenderer = (props: TreeNodeRendererProps) => {
      onLabelRendered = props.onLabelRendered;
      return <div className={HighlightingEngine.ACTIVE_CLASS_NAME} />;
    };

    const verticalScrollSpy = sinon.spy();
    sinon.replace(VariableSizeList.prototype, "scrollToItem", verticalScrollSpy);
    const horizontalScrollSpy = sinon.spy();
    sinon.replace(Element.prototype, "scrollIntoView", horizontalScrollSpy);

    const { rerender } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />,
    );

    // need to rerender because after first render VariableSizeList ref is not set
    rerender(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
        nodeHighlightingProps={highlightProps}
        nodeRenderer={nodeRenderer}
      />,
    );
    onLabelRendered!(node2);

    expect(verticalScrollSpy).to.be.calledWith(1);
    expect(horizontalScrollSpy).to.be.called;
  });

  it("calls treeActions.onTreeKeyDown & onTreeKeyUp", () => {
    const label = "test node";
    const node = createRandomMutableTreeModelNode(undefined, undefined, label);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const spyKeyDown = sinon.spy();
    const spyKeyUp = sinon.spy();
    treeActionsMock.setup((x) => x.onTreeKeyDown).returns(() => spyKeyDown);
    treeActionsMock.setup((x) => x.onTreeKeyUp).returns(() => spyKeyUp);

    const renderNode = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    expect(renderNode).to.not.be.undefined;

    const treeNode: HTMLElement = renderNode.container.querySelector(".core-tree-node")! as HTMLElement;
    fireEvent.keyDown(treeNode, { key: SpecialKey.Space });
    fireEvent.keyUp(treeNode, { key: SpecialKey.Space });
    expect(spyKeyDown).to.be.called;
    expect(spyKeyUp).to.be.called;
  });

  it("calls onNodeEditorClosed when node.editingInfo changes to undefined", () => {
    const spy = sinon.spy();
    const label = "test node";
    const node = createRandomMutableTreeModelNode(undefined, undefined, label);
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { rerender } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        onNodeEditorClosed={spy}
        nodeHeight={() => 50}
      />);

    expect(spy).to.not.be.called;
    node.editingInfo = { onCommit: () => { }, onCancel: () => { } };

    const nodeRenderer = (_props: TreeNodeRendererProps) => {
      return <div className={HighlightingEngine.ACTIVE_CLASS_NAME} />;
    };

    rerender(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
        onNodeEditorClosed={spy}
        nodeRenderer={nodeRenderer}
      />);

    expect(spy).to.not.be.called;
    node.editingInfo = undefined;

    rerender(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
        onNodeEditorClosed={spy}
      />);

    expect(spy).to.be.called;
  });

  describe("scrollToNode", () => {
    let scrollToItemFake: sinon.SinonSpy;

    beforeEach(() => {
      visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 20);
      visibleNodesMock.setup((x) => x.getAtIndex(moq.It.isAnyNumber()))
        .returns((index) => createRandomMutableTreeModelNode(undefined, false, `Node ${index}`));
      visibleNodesMock.setup((x) => x.getIndexOfNode("test_id")).returns(() => 15);

      scrollToItemFake = sinon.fake();
      sinon.replace(VariableSizeList.prototype, "scrollToItem", scrollToItemFake);
    });

    it("scrolls to the specified node", () => {
      const treeRendererRef: React.RefObject<TreeRenderer> = { current: null };
      render(React.createElement(() => {
        return (
          <TreeRenderer
            ref={treeRendererRef}
            nodeLoader={nodeLoaderMock.object}
            treeActions={treeActionsMock.object}
            visibleNodes={visibleNodesMock.object}
            nodeHeight={() => 50}
          />
        );
      }));

      treeRendererRef.current!.scrollToNode("test_id", "smart");
      expect(scrollToItemFake).to.have.been.calledOnceWithExactly(15, "smart");
    });

    it("does not throw if called early", () => {
      render(React.createElement(() => {
        const treeRendererRef = React.useRef<TreeRenderer>(null);

        React.useEffect(() => {
          treeRendererRef.current?.scrollToNode("test_id", "smart");
        }, []);

        return (
          <TreeRenderer
            ref={treeRendererRef}
            nodeLoader={nodeLoaderMock.object}
            treeActions={treeActionsMock.object}
            visibleNodes={visibleNodesMock.object}
            nodeHeight={() => 50}
          />
        );
      }));

      expect(scrollToItemFake).to.have.been.calledOnceWithExactly(15, "smart");
    });
  });
});
