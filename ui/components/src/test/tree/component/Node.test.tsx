/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render, fireEvent } from "react-testing-library";
import { expect } from "chai";
import { Tree } from "../../../ui-components/tree/component/Tree";
import { BeInspireTree, BeInspireTreeNode } from "../../../ui-components/tree/component/BeInspireTree";
import { TreeNode } from "../../../ui-components/tree/component/Node";
import { TreeNodeItem } from "../../../ui-components/tree/TreeDataProvider";
import { CheckBoxState } from "@bentley/ui-core";
import { PropertyValueRendererManager } from "../../../ui-components/properties/ValueRendererManager";

describe("Node", () => {
  let tree: BeInspireTree<TreeNodeItem>;
  let node: BeInspireTreeNode<TreeNodeItem>;
  const valueRendererManager = PropertyValueRendererManager.defaultManager;

  beforeEach(() => {
    tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: [{ id: "0", label: "0" }],
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
    });
    node = tree.nodes()[0];
  });

  it("renders content", () => {
    node.text = "Test text";
    const renderedNode = render(
      <TreeNode
        node={node}
        valueRendererManager={valueRendererManager}
      />);

    renderedNode.getByText("Test text");
  });

  it("renders checkbox", () => {
    const checkboxSpy = sinon.spy();

    const renderedNode = render(
      <TreeNode
        node={node}
        valueRendererManager={valueRendererManager}
        checkboxProps={{
          isDisabled: false,
          onClick: checkboxSpy,
          state: CheckBoxState.On,
        }}
      />);

    const checkbox = renderedNode.baseElement.querySelector(".uicore-inputs-checkbox");

    expect(checkbox).to.not.be.empty;
    fireEvent.click(checkbox!);

    expect(checkboxSpy.called).to.be.true;
  });

  it("renders icon", () => {
    node.itree = { icon: "test-icon", state: {} };

    const renderedNode = render(
      <TreeNode
        node={node}
        valueRendererManager={valueRendererManager}
      />);

    expect(renderedNode.baseElement.querySelector(".test-icon")).to.not.be.empty;
  });
});
