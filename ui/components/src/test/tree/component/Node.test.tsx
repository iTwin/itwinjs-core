/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "react-testing-library";
import { Tree } from "../../../tree/component/Tree";
import { BeInspireTree } from "../../../tree/component/BeInspireTree";
import { TreeNode } from "../../../tree/component/Node";
import { waitForSpy } from "../../test-helpers/misc";
import { TreeNodeItem } from "../../../tree/TreeDataProvider";

describe("Node", () => {
  const tree = new BeInspireTree<TreeNodeItem>({
    dataProvider: [{ id: "0", label: "0" }],
    renderer: () => { },
    mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
  });
  const node = tree.nodes()[0];

  beforeEach(() => node.setDirty(true));
  afterEach(() => node.setDirty(false));

  it("renders label with synchronous function", async () => {
    const renderLabelSpy = sinon.spy(() => "Test label");
    const renderedNode = render(
      <TreeNode
        renderLabel={renderLabelSpy}
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
        node={node}
      />);

    expect(renderLabelSpy.called).to.be.true;
    expect(onRenderedSpy.calledOnce);

    renderedNode.rerender(<TreeNode renderLabel={renderLabelSpy} node={node} />);

    expect(onRenderedSpy.calledTwice);
  });
});
