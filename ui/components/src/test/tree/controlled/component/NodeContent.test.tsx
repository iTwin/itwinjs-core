/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { render } from "@testing-library/react";
import { CheckBoxState } from "@bentley/ui-core";
import { MutableTreeModelNode } from "../../../../ui-components/tree/controlled/TreeModel";
import { TreeNodeContent } from "../../../../ui-components/tree/controlled/component/NodeContent";
import { PropertyValueRendererManager } from "../../../../ui-components/properties/ValueRendererManager";
import { HighlightableTreeNodeProps, HighlightingEngine } from "../../../../ui-components/tree/HighlightingEngine";
import { TestUtils } from "../../../TestUtils";
import { PropertyRecord } from "@bentley/ui-abstract";

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

  it("uses label record from item node", () => {
    const customLabelRecord = TestUtils.createPrimitiveStringProperty("node_label_record", "Custom Label Record");
    node.item.labelDefinition = customLabelRecord;

    let recordFromRendererManager: PropertyRecord;
    rendererManagerMock.reset();
    rendererManagerMock.setup((x) => x.render(moq.It.isAny(), moq.It.isAny()))
      .callback((record) => { recordFromRendererManager = record; })
      .returns(() => "Label");

    const renderedNode = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />,
    );

    renderedNode.getByText("Label");
    expect(recordFromRendererManager!).to.be.deep.eq(customLabelRecord);
  });

  it("passes highlight callback to values renderer", () => {
    const highlightingProps: HighlightableTreeNodeProps = { searchText: "label" };

    const spy = sinon.stub(HighlightingEngine, "renderNodeLabel");

    rendererManagerMock.reset();
    rendererManagerMock
      .setup((x) => x.render(moq.It.isAny(), moq.It.isAny()))
      .callback((_, context) => { context.textHighlighter(); });

    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
        highlightProps={highlightingProps}
      />);

    expect(spy).to.be.called;
    spy.restore();
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

  it("renders node editor if node editing is active", () => {
    node.editingInfo = {
      onCancel: () => { },
      onCommit: () => { },
    };

    const { getByTestId } = render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
      />,
    );

    getByTestId("editor-container");
  });

  it("uses custom tree node editor renderer", () => {
    node.editingInfo = {
      onCancel: () => { },
      onCommit: () => { },
    };
    const editorRendererSpy = sinon.spy();

    render(
      <TreeNodeContent
        node={node}
        valueRendererManager={rendererManagerMock.object}
        nodeEditorRenderer={editorRendererSpy}
      />,
    );

    expect(editorRendererSpy).to.be.calledOnce;
  });

});
