/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render, fireEvent } from "@testing-library/react";
import { expect } from "chai";
import { Tree } from "../../../ui-components/tree/component/Tree";
import { BeInspireTree, BeInspireTreeNode } from "../../../ui-components/tree/component/BeInspireTree";
import { TreeNode, TreeNodeIcon } from "../../../ui-components/tree/component/Node";
import { TreeNodeItem } from "../../../ui-components/tree/TreeDataProvider";
import { CheckBoxState } from "@bentley/ui-core";
import { PropertyValueRendererManager } from "../../../ui-components/properties/ValueRendererManager";
import TestUtils from "../../TestUtils";
import { ITreeImageLoader, TreeImageLoader } from "../../../ui-components/tree/ImageLoader";
import { LoadedImage } from "../../../ui-components/common/IImageLoader";

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

    const checkbox = renderedNode.container.querySelector(".core-checkbox > input");

    expect(checkbox).to.not.be.null;
    fireEvent.click(checkbox!);

    expect(checkboxSpy).to.have.been.called;
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
    expect(checkbox).to.not.be.null;
  });

  it("renders icon", () => {
    node.itree = { icon: "icon-test", state: {} };

    const renderedNode = render(
      <TreeNode
        node={node}
        valueRendererManager={valueRendererManager}
        imageLoader={new TreeImageLoader()}
      />);

    expect(renderedNode.baseElement.querySelector(".icon-test")).to.not.be.null;
  });
});

describe("TreeNodeIcon", () => {
  let tree: BeInspireTree<TreeNodeItem>;
  let node: BeInspireTreeNode<TreeNodeItem>;

  class ImageLoader implements ITreeImageLoader {
    public load = (): LoadedImage => ({ sourceType: "url", value: "test-location/image.png" });
  }

  const imageLoader = new ImageLoader();

  beforeEach(async () => {
    tree = new BeInspireTree<TreeNodeItem>({
      dataProvider: [{ id: "0", label: "0", icon: "icon-test-image" }],
      mapPayloadToInspireNodeConfig: Tree.inspireNodeFromTreeNodeItem,
    });
    await tree.ready;
    node = tree.nodes()[0];
  });

  it("renders", () => {
    const icon = render(<TreeNodeIcon node={node} imageLoader={new TreeImageLoader()} />);

    expect(icon.container.querySelector(".icon-test-image")).to.not.be.null;
  });

  it("renders from payload if itree has no icon", () => {
    node.itree!.icon = undefined;

    const icon = render(<TreeNodeIcon node={node} imageLoader={new TreeImageLoader()} />);

    expect(icon.container.querySelector(".icon-test-image")).to.not.be.null;
  });

  it("does not render anything if node has no icon", () => {
    node.payload!.icon = undefined;
    node.itree!.icon = undefined;

    const icon = render(<TreeNodeIcon node={node} imageLoader={new TreeImageLoader()} />);

    expect(icon.container.innerHTML).to.be.empty;
  });

  it("renders with custom loader", () => {
    const icon = render(<TreeNodeIcon node={node} imageLoader={imageLoader} />);

    const imgElement = icon.container.children[0] as HTMLImageElement;
    expect(imgElement.src).to.equal("test-location/image.png");
  });
});
