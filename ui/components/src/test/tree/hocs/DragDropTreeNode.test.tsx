/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, cleanup } from "@testing-library/react";
import { DragDropTreeNodeComponent, DragDropTreeNode } from "../../../ui-components/tree/hocs/DragDropTreeNode";
import { DragSourceProps, DropTargetProps } from "../../../ui-components/dragdrop/DragDropDef";

describe("DragDropTreeNode", () => {

  afterEach(cleanup);

  const createBubbledEvent = (type: string, props = {}) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  };
  it("should render", () => {
    render(<DragDropTreeNodeComponent />);
  });
  it("should render with canDrop and isOver", () => {
    render(<DragDropTreeNodeComponent canDrop={true} isOver={true} />);
  });
  describe("<DragDropTreeNode />", () => {
    interface DragDropObject {
      test: boolean;
    }
    const DragDropObjectRow = DragDropTreeNode<DragDropObject>(); // tslint:disable-line:variable-name
    it("should render with drag drop props", () => {
      const dragProps: DragSourceProps = {
        onDragSourceBegin: (args: any) => args,
        onDragSourceEnd: () => undefined,
        objectType: () => "test",
      };
      const dropProps: DropTargetProps = {
        onDropTargetOver: () => undefined,
        onDropTargetDrop: (args: any) => args,
        canDropTargetDrop: () => true,
        objectTypes: ["test"],
      };
      render(<DragDropObjectRow dragProps={dragProps} dropProps={dropProps} />);
    });
  });
  it("should not change hoverMode when isOver is false", async () => {
    const component = render(<DragDropTreeNodeComponent style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={false} />);
    const dropTarget = component.getByTestId("node-drop-target");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 7.5 }));
    expect(dropTarget.className).to.not.contain("below");
    expect(dropTarget.className).to.not.contain("above");
  });
  it("should render with above classname when hovered on top third", async () => {
    const component = render(<DragDropTreeNodeComponent style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} />);
    const dropTarget = component.getByTestId("node-drop-target");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 1.66 }));
    expect(dropTarget.className).to.contain("above");
  });
  it("should not change hoverMode when dragged from above location to another above location", async () => {
    const component = render(<DragDropTreeNodeComponent style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} />);
    const dropTarget = component.getByTestId("node-drop-target");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 1.66 }));
    expect(dropTarget.className).to.contain("above");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 1.66 }));
    expect(dropTarget.className).to.contain("above");
  });
  it("should render with below classname when hovered on center third", async () => {
    const component = render(<DragDropTreeNodeComponent style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} />);
    const dropTarget = component.getByTestId("node-drop-target");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
    expect(dropTarget.className).to.contain("below");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 5 }));
    expect(dropTarget.className).to.contain("on");
  });
  it("should not change hoverMode when dragged from on location to another on location", async () => {
    const component = render(<DragDropTreeNodeComponent style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} />);
    const dropTarget = component.getByTestId("node-drop-target");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
    expect(dropTarget.className).to.contain("below");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 5 }));
    expect(dropTarget.className).to.contain("on");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 5 }));
    expect(dropTarget.className).to.contain("on");
  });
  it("should render with below classname when hovered on bottom third", async () => {
    const component = render(<DragDropTreeNodeComponent style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} />);
    const dropTarget = component.getByTestId("node-drop-target");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
    expect(dropTarget.className).to.contain("below");
  });
  it("should not change hoverMode when dragged from below location to another below location", async () => {
    const component = render(<DragDropTreeNodeComponent style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} />);
    const dropTarget = component.getByTestId("node-drop-target");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
    expect(dropTarget.className).to.contain("below");

    dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
    expect(dropTarget.className).to.contain("below");
  });
});
