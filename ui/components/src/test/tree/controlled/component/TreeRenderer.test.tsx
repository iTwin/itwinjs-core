/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import sinon from "sinon";
import { render } from "@testing-library/react";
import { VariableSizeList } from "react-window";
import { TreeRenderer } from "../../../../ui-components/tree/controlled/component/TreeRenderer";
import { VisibleTreeNodes, TreeModelNodePlaceholder, TreeModelNode, TreeModel, TreeModelRootNode } from "../../../../ui-components/tree/controlled/TreeModel";
import { TreeActions } from "../../../../ui-components/tree/controlled/TreeActions";
import { ITreeNodeLoader } from "../../../../ui-components/tree/controlled/TreeNodeLoader";
import { from } from "../../../../ui-components/tree/controlled/Observable";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";
import { HighlightableTreeProps, HighlightingEngine } from "../../../../ui-components/tree/HighlightingEngine";
import { TreeNodeRendererProps } from "../../../../ui-components/tree/controlled/component/TreeNodeRenderer";

describe("TreeRenderer", () => {

  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();

  beforeEach(() => {
    visibleNodesMock.reset();
    treeActionsMock.reset();
    nodeLoaderMock.reset();
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
    const node = createRandomMutableTreeModelNode();
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { getByText } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    getByText(node.label as string);
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
    const node = createRandomMutableTreeModelNode();
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 1);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node);

    const { getByText, rerender } = render(
      <TreeRenderer
        nodeLoader={nodeLoaderMock.object}
        treeActions={treeActionsMock.object}
        visibleNodes={visibleNodesMock.object}
        nodeHeight={() => 50}
      />);

    getByText(node.label as string);

    const newNode = createRandomMutableTreeModelNode();
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

    getByText(newNode.label as string);
  });

  it("scrolls to highlighted node", () => {
    const node1 = createRandomMutableTreeModelNode();
    const node2 = createRandomMutableTreeModelNode();
    visibleNodesMock.setup((x) => x.getNumNodes()).returns(() => 2);
    visibleNodesMock.setup((x) => x.getAtIndex(0)).returns(() => node1);
    visibleNodesMock.setup((x) => x.getAtIndex(1)).returns(() => node2);
    visibleNodesMock.setup((x) => x[Symbol.iterator]()).returns(() => [node1, node2][Symbol.iterator]());

    const highlightProps: HighlightableTreeProps = {
      searchText: node2.label as string,
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
    VariableSizeList.prototype.scrollToItem = verticalScrollSpy;
    const horizontalScrollSpy = sinon.spy();
    Element.prototype.scrollIntoView = horizontalScrollSpy;

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

});
