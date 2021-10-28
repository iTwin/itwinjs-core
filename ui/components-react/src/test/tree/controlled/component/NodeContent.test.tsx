/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { CheckBoxState } from "@itwin/core-react";
import { render } from "@testing-library/react";
import { PropertyValueRendererManager } from "../../../../components-react/properties/ValueRendererManager";
import { TreeNodeContent } from "../../../../components-react/tree/controlled/component/NodeContent";
import { MutableTreeModelNode } from "../../../../components-react/tree/controlled/TreeModel";
import { HighlightableTreeNodeProps, HighlightingEngine } from "../../../../components-react/tree/HighlightingEngine";
import { TestUtils } from "../../../TestUtils";

describe("NodeContent", () => {
  const rendererManagerMock = moq.Mock.ofType<PropertyValueRendererManager>();

  let node: MutableTreeModelNode;
  let nodeLabelRecord: PropertyRecord;

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(async () => {
    nodeLabelRecord = PropertyRecord.fromString("label", "label");
    node = {
      id: "0",
      label: nodeLabelRecord,
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
        label: nodeLabelRecord,
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
    rendererManagerMock.verify((x) => x.render(nodeLabelRecord, moq.It.isAny()), moq.Times.once());
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
