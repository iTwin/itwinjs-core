/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import { render, fireEvent } from "@testing-library/react";
import { CheckBoxState } from "@bentley/ui-core";
import { TreeActions } from "../../../../ui-components/tree/controlled/TreeActions";
import { TreeNodeRenderer } from "../../../../ui-components/tree/controlled/component/TreeNodeRenderer";
import { MutableTreeModelNode } from "../../../../ui-components/tree/controlled/TreeModel";
import { createRandomMutableTreeModelNode } from "../RandomTreeNodesHelpers";
import { ITreeImageLoader } from "../../../../ui-components/tree/ImageLoader";

describe("TreeNodeRenderer", () => {

  const treeActionsMock = moq.Mock.ofType<TreeActions>();
  let node: MutableTreeModelNode;

  beforeEach(() => {
    treeActionsMock.reset();
    node = createRandomMutableTreeModelNode();
    node.isLoading = false;
  });

  it("renders tree node", () => {

    const renderedNode = render(
      <TreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
      />);

    renderedNode.getByText(node.label);
  });

  it("renders tree node with checkbox", () => {
    node.checkbox.isVisible = true;

    const { container } = render(
      <TreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
      />);

    const inputNode = container.querySelector("input");
    expect(inputNode).to.not.be.undefined;
  });

  it("renders tree node with icon", () => {
    const imageLoaderMock = moq.Mock.ofType<ITreeImageLoader>();
    imageLoaderMock.setup((x) => x.load(moq.It.isAny())).returns(() => ({ sourceType: "core-icon", value: "test-icon" }));
    const { container } = render(
      <TreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        imageLoader={imageLoaderMock.object}
      />);

    const inputNode = container.querySelector(".test-icon");
    expect(inputNode).to.not.be.undefined;
  });

  it("renders tree node without loaded icon", () => {
    const imageLoaderMock = moq.Mock.ofType<ITreeImageLoader>();
    imageLoaderMock.setup((x) => x.load(moq.It.isAny())).returns(() => undefined);
    const { getByText } = render(
      <TreeNodeRenderer
        treeActions={treeActionsMock.object}
        node={node}
        imageLoader={imageLoaderMock.object}
      />);

    getByText(node.label);
  });

  describe("events", () => {

    it("fires tree event when checkbox is clicked", () => {
      node.checkbox.isVisible = true;
      node.checkbox.isDisabled = false;
      node.checkbox.state = CheckBoxState.Off;

      treeActionsMock.setup((x) => x.onNodeCheckboxClicked(node.id, CheckBoxState.On)).verifiable(moq.Times.once());

      const { container } = render(
        <TreeNodeRenderer
          treeActions={treeActionsMock.object}
          node={node}
        />);

      const inputNode: HTMLElement = container.querySelector("input")!;
      inputNode.click();

      treeActionsMock.verifyAll();
    });

    it("fires tree event when node is expanded", () => {
      node.isLoading = false;
      node.isExpanded = false;

      treeActionsMock.setup((x) => x.onNodeExpanded(node.id)).verifiable(moq.Times.once());

      const { container } = render(
        <TreeNodeRenderer
          treeActions={treeActionsMock.object}
          node={node}
        />);

      const expansionToggle: HTMLElement = container.querySelector(".core-tree-expansionToggle")! as HTMLElement;
      expansionToggle.click();

      treeActionsMock.verifyAll();
    });

    it("fires tree event when node is collapsed", () => {
      node.isLoading = false;
      node.isExpanded = true;

      treeActionsMock.setup((x) => x.onNodeCollapsed(node.id)).verifiable(moq.Times.once());

      const { container } = render(
        <TreeNodeRenderer
          treeActions={treeActionsMock.object}
          node={node}
        />);

      const expansionToggle: HTMLElement = container.querySelector(".core-tree-expansionToggle")! as HTMLElement;
      expansionToggle.click();

      treeActionsMock.verifyAll();
    });

    it("fires tree event when node is clicked", () => {
      treeActionsMock.setup((x) => x.onNodeClicked(node.id, moq.It.isAny())).verifiable(moq.Times.once());

      const { container } = render(
        <TreeNodeRenderer
          treeActions={treeActionsMock.object}
          node={node}
        />);

      const treeNode: HTMLElement = container.querySelector(".core-tree-node")! as HTMLElement;
      treeNode.click();

      treeActionsMock.verifyAll();
    });

    it("fires tree event on mouse down", () => {
      treeActionsMock.setup((x) => x.onNodeMouseDown(node.id)).verifiable(moq.Times.once());

      const { container } = render(
        <TreeNodeRenderer
          treeActions={treeActionsMock.object}
          node={node}
        />);

      const treeNode: HTMLElement = container.querySelector(".core-tree-node")! as HTMLElement;
      fireEvent.mouseDown(treeNode);

      treeActionsMock.verifyAll();
    });

    it("fires tree event mouse move", () => {
      treeActionsMock.setup((x) => x.onNodeMouseMove(node.id)).verifiable(moq.Times.once());

      const { container } = render(
        <TreeNodeRenderer
          treeActions={treeActionsMock.object}
          node={node}
        />);

      const treeNode: HTMLElement = container.querySelector(".core-tree-node")! as HTMLElement;
      fireEvent.mouseMove(treeNode);

      treeActionsMock.verifyAll();
    });

  });

});
