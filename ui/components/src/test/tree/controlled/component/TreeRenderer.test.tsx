/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import { render } from "@testing-library/react";
import { TreeRenderer } from "../../../../ui-components/tree/controlled/component/TreeRenderer";
import { VisibleTreeNodes, TreeModel, TreeModelNodePlaceholder } from "../../../../ui-components/tree/controlled/TreeModel";
import { TreeActions } from "../../../../ui-components/tree/controlled/TreeActions";
import { TreeNodeLoader } from "../../../../ui-components/tree/controlled/TreeModelSource";
import { from } from "../../../../ui-components/tree/controlled/Observable";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";

describe("TreeRenderer", () => {

  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();
  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  const nodeLoaderMock = moq.Mock.ofType<TreeNodeLoader>();
  const modelMock = moq.Mock.ofType<TreeModel>();

  beforeEach(() => {
    visibleNodesMock.reset();
    treeActionsMock.reset();
    nodeLoaderMock.reset();

    nodeLoaderMock.setup((x) => x.loadNode(undefined, moq.It.isAny())).returns(() => from([{ loadedNodes: [], model: modelMock.object }]));
  });

  it("renders without nodes", () => {
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

    getByText(node.label);
  });

  it("renders with placeholder node", () => {
    const node: TreeModelNodePlaceholder = {
      childIndex: 0,
      depth: 0,
    };
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

    getByText(node.label);

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

    getByText(newNode.label);
  });

});
