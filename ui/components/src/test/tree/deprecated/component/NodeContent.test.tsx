/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@bentley/ui-abstract";
import { render } from "@testing-library/react";
import { PropertyValueRendererManager } from "../../../../ui-components/properties/ValueRendererManager";
import { BeInspireTree, BeInspireTreeNode } from "../../../../ui-components/tree/deprecated/component/BeInspireTree";
import { TreeNodeContent } from "../../../../ui-components/tree/deprecated/component/NodeContent";
import { DEPRECATED_Tree as Tree } from "../../../../ui-components/tree/deprecated/component/Tree";
import { TreeNodeItem } from "../../../../ui-components/tree/TreeDataProvider";
import TestUtils from "../../../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("NodeContent", () => {
  const rendererManagerMock = moq.Mock.ofType<PropertyValueRendererManager>();

  let tree: BeInspireTree<TreeNodeItem>;
  let node: BeInspireTreeNode<TreeNodeItem>;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: [{ id: "0", label: PropertyRecord.fromString("0") }],
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
