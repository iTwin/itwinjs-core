/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "react-testing-library";
import { Tree } from "../../../ui-components/tree/component/Tree";
import { BeInspireTree, BeInspireTreeNode } from "../../../ui-components/tree/component/BeInspireTree";
import { TreeNode } from "../../../ui-components/tree/component/Node";
import { waitForSpy } from "../../test-helpers/misc";
import { TreeNodeItem } from "../../../ui-components/tree/TreeDataProvider";

describe("Node", () => {

  let tree: BeInspireTree<TreeNodeItem>;
  let node: BeInspireTreeNode<TreeNodeItem>;

  beforeEach(() => {
    tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: [{ id: "0", label: "0" }],
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
    });
    node = tree.nodes()[0];
  });

  it("renders label with synchronous function", async () => {
    const renderLabelSpy = sinon.spy(() => "Test label");
    const renderedNode = render(
      <TreeNode
        renderLabel={renderLabelSpy}
        renderId=""
        node={node}
      />);

    expect(renderLabelSpy.called).to.be.true;
    renderedNode.getByText("Test label");
  });

  it("renders label with asynchronous function", async () => {
    const onRenderSpy = sinon.spy();
    const renderLabelSpy = sinon.spy(async () => "Test label");
    const renderedNode = render(
      <TreeNode
        onFinalRenderComplete={onRenderSpy}
        renderLabel={renderLabelSpy}
        renderId=""
        node={node}
      />);

    renderedNode.getByTestId("node-label-placeholder");

    await waitForSpy(onRenderSpy);

    expect(renderLabelSpy.called).to.be.true;
    renderedNode.getByText("Test label");
    expect(() => renderedNode.getByTestId("node-label-placeholder")).to.throw;
  });

  it("renders label when it's updated with asynchronous function", async () => {
    const renderLabelSpy = sinon.spy(() => "Test label");
    const renderedNode = render(
      <TreeNode
        renderLabel={renderLabelSpy}
        renderId="1"
        node={node}
      />);

    expect(renderLabelSpy.called).to.be.true;
    renderedNode.getByText("Test label");

    const asyncRenderLabelSpy = sinon.spy(async () => "Different test label");
    const onRenderSpy = sinon.spy();
    node.setDirty(true);
    renderedNode.rerender(
      <TreeNode
        onFinalRenderComplete={onRenderSpy}
        renderLabel={asyncRenderLabelSpy}
        renderId="2"
        node={node}
      />);

    await waitForSpy(onRenderSpy);

    renderedNode.getByText("Different test label");
  });

  it("calls onFullyRendered even if shouldComponentUpdate returns false", async () => {
    const renderLabelSpy = sinon.spy(() => "Test label");
    const onRenderedSpy = sinon.spy();
    const renderedNode = render(
      <TreeNode
        onFinalRenderComplete={onRenderedSpy}
        renderLabel={renderLabelSpy}
        renderId="1"
        node={node}
      />);

    expect(renderLabelSpy.called).to.be.true;
    expect(onRenderedSpy.calledOnce);

    renderedNode.rerender(
      <TreeNode
        renderLabel={renderLabelSpy}
        renderId="2"
        node={node}
      />);

    expect(onRenderedSpy.calledTwice);
  });
});
