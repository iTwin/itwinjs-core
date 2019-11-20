/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { render, waitForElement } from "@testing-library/react";
import { CheckBoxState } from "@bentley/ui-core";
import { MutableTreeModelNode } from "../../../../ui-components/tree/controlled/TreeModel";
import { TreeNodeContent } from "../../../../ui-components/tree/controlled/component/NodeContent";
import { PropertyValueRendererManager } from "../../../../ui-components/properties/ValueRendererManager";
import { HighlightableTreeNodeProps, HighlightingEngine } from "../../../../ui-components/tree/HighlightingEngine";
import { CellEditingEngine } from "../../../../ui-components/tree/controlled/component/CellEditingEngine";
import { TestUtils } from "../../../TestUtils";

describe("NodeContent", () => {
  const rendererManagerMock = moq.Mock.ofType<PropertyValueRendererManager>();

  let node: MutableTreeModelNode;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(async () => {
    node = {
      id: "0",
      label: "label",
      checkbox: { isVisible: false, state: CheckBoxState.Off, isDisabled: false },
      depth: 0,
      description: "Test Node Description",
      isExpanded: false,
      isLoading: false,
      numChildren: 0,
      isSelected: false,
      parentId: undefined,
      item: {
        id: "0",
        label: "label",
        description: "Test Node Description",
      },
    };

    rendererManagerMock.reset();
    rendererManagerMock.setup((m) => m.render(moq.It.isAny(), moq.It.isAny())).returns(() => "Test label");
  });

  it("renders label with synchronous function", () => {
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

  it("rerenders label with asynchronous function", async () => {
    const renderedNode = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />,
    );

    renderedNode.getByText("Test label");

    rendererManagerMock.reset();
    rendererManagerMock.setup((m) => m.render(moq.It.isAny(), moq.It.isAny())).returns(async () => "Async label");
    const newNode = { ...node };

    renderedNode.rerender(
      <TreeNodeContent
        node={newNode}
        valueRendererManager={rendererManagerMock.object}
      />,
    );

    renderedNode.getByText("Test label");

    await waitForElement(() => renderedNode.getByText("Async label"));
  });

  it("highlights label", () => {
    const highlightingProps: HighlightableTreeNodeProps = { searchText: "label" };

    const spy = sinon.spy(HighlightingEngine, "renderNodeLabel");

    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
        highlightProps={highlightingProps}
      />);

    expect(spy).to.be.called;
  });

  it("updates label", () => {
    const { getByText, rerender } = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />);

    getByText("Test label");

    const newRendererManagerMock = moq.Mock.ofType<PropertyValueRendererManager>();
    newRendererManagerMock.setup((m) => m.render(moq.It.isAny(), moq.It.isAny())).returns(() => "New label");
    rerender(
      <TreeNodeContent
        node={node}
        valueRendererManager={newRendererManagerMock.object}
      />);

    getByText("New label");
  });

  it("renders node editor", () => {
    const editingEngineMock = moq.Mock.ofType<CellEditingEngine>();
    editingEngineMock.setup((x) => x.isEditingEnabled(node)).returns(() => true);
    editingEngineMock.setup((x) => x.renderEditor(node, moq.It.isAny())).returns(() => <div data-testid="editorMock-id" />);

    const { getByTestId } = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
        cellEditing={editingEngineMock.object}
      />);

    getByTestId("editorMock-id");
  });

  it("uses node typename", () => {
    node.item.typename = "TestNodeType";

    rendererManagerMock.setup((x) => x.render(moq.It.is((r) => r.property.typename === node.item.typename), moq.It.isAny())).verifiable(moq.Times.once());

    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />);

    rendererManagerMock.verifyAll();
  });

  it("renders styled node", () => {
    rendererManagerMock.reset();
    rendererManagerMock.setup((x) => x.render(moq.It.isAny(), moq.It.is((ctx) => ctx!.style!.fontWeight === "bold"))).verifiable(moq.Times.once());

    node.item.style = {
      isBold: true,
    };

    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />);

    rendererManagerMock.verifyAll();
  });

  it("renders node with description", () => {
    const { getByText } = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
        showDescription={true}
      />);

    getByText(node.item.description!);
  });

  it("call onLabelRendered when label is rendered", () => {
    const spy = sinon.spy();
    rendererManagerMock.reset();

    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
        onLabelRendered={spy}
      />,
    );

    expect(spy).to.be.calledOnce;
  });

});
