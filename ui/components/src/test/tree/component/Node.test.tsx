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
import TestUtils from "../../TestUtils";

describe("Node", () => {
  let tree: BeInspireTree<TreeNodeItem>;
  let node: BeInspireTreeNode<TreeNodeItem>;
  const valueRendererManager = PropertyValueRendererManager.defaultManager;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  beforeEach(async () => {
    tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: [{ id: "0", label: "0" }],
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
    });
    await tree.ready;
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

  it("renders checkbox using custom renderer", () => {
    const renderOverride = sinon.stub().returns(<div className="custom-checkbox" />);
    const renderedNode = render(
      <TreeNode
        node={node}
        valueRendererManager={valueRendererManager}
        checkboxProps={{
          onClick: sinon.spy(),
          state: CheckBoxState.On,
        }}
        renderOverrides={{
          renderCheckbox: renderOverride,
        }}
      />);
    const checkbox = renderedNode.baseElement.querySelector(".custom-checkbox");
    expect(renderOverride).to.be.calledOnce;
    expect(checkbox).to.not.be.undefined;
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
