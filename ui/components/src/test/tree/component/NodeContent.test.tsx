/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { render, waitForElement } from "@testing-library/react";
import { Tree } from "../../../ui-components/tree/component/Tree";
import { BeInspireTree, BeInspireTreeNode } from "../../../ui-components/tree/component/BeInspireTree";
import { TreeNodeContent } from "../../../ui-components/tree/component/NodeContent";
import { TreeNodeItem } from "../../../ui-components/tree/TreeDataProvider";
import { PropertyValueRendererManager } from "../../../ui-components/properties/ValueRendererManager";
import TestUtils from "../../TestUtils";

describe("NodeContent", () => {
  const rendererManagerMock = moq.Mock.ofType<PropertyValueRendererManager>();

  let tree: BeInspireTree<TreeNodeItem>;
  let node: BeInspireTreeNode<TreeNodeItem>;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: [{ id: "0", label: "0" }],
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
    });
    node = tree.nodes()[0];
  });

  it("renders label with synchronous function", () => {
    rendererManagerMock.reset();
    rendererManagerMock.setup((m) => m.render(moq.It.isAny(), moq.It.isAny())).returns(() => "Test label");

    const renderedNode = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />);

    renderedNode.getByText("Test label");
  });

  it("renders label with asynchronous function", async () => {
    rendererManagerMock.reset();
    rendererManagerMock.setup((m) => m.render(moq.It.isAny(), moq.It.isAny())).returns(async () => "Test label");

    const renderedNode = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />);

    renderedNode.getByTestId("node-label-placeholder");

    await waitForElement(() => renderedNode.getByText("Test label"));
  });

  it("calls onFullyRendered even if shouldComponentUpdate returns false", () => {
    rendererManagerMock.reset();
    rendererManagerMock.setup((m) => m.render(moq.It.isAny(), moq.It.isAny())).returns(() => "Test label");

    const onRenderedSpy = sinon.spy();
    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />);

    expect(onRenderedSpy.calledOnce);

    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />);

    expect(onRenderedSpy.calledTwice);
  });
});
