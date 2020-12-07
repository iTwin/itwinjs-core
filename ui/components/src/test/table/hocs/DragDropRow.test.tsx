/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { wrapInTestContext } from "react-dnd-test-utils";
import * as sinon from "sinon";
import { cleanup, render } from "@testing-library/react";
import {
  DragSourceArguments, DragSourceProps, DropEffects, DropStatus, DropTargetArguments, DropTargetProps,
} from "../../../ui-components/dragdrop/DragDropDef";
import { DragDropRow, DragDropRowWrapper } from "../../../ui-components/table/hocs/DragDropRow";
import { createDnDRenderer } from "../../tree/deprecated/hocs/withDragDrop.test";

/* eslint-disable deprecation/deprecation */

describe("DragDropRow", () => {
  interface DragDropObject {
    test: boolean;
  }

  afterEach(cleanup);

  const RowWithDragDrop = DragDropRow<DragDropObject>();
  const DragDropObjectRow = wrapInTestContext(RowWithDragDrop);
  const renderIntoDocument = createDnDRenderer(RowWithDragDrop);

  it("should render", () => {
    render(<DragDropObjectRow />);
  });
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

  describe("DragDropRowWrapper", () => {
    const createBubbledEvent = (type: string, props = {}) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, props);
      return event;
    };
    it("should render", () => {
      render(<DragDropRowWrapper />);
    });
    it("should render with canDrop and isOver", () => {
      render(<DragDropRowWrapper canDrop={true} isOver={true} />);
    });
    it("should not change hoverMode when isOver is false", async () => {
      const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={false} canDropOn={false} />);
      const dropTarget = component.getByTestId("components-table-drop-target");

      dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 7.5 }));
      expect(dropTarget.className).to.not.contain("below");
      expect(dropTarget.className).to.not.contain("above");
    });
    describe("canDropOn = false", () => {
      it("should render with above classname when hovered on top half and canDropOn is false", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={false} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 7.5 }));
        expect(dropTarget.className).to.contain("below");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 2.5 }));
        expect(dropTarget.className).to.contain("above");
      });
      it("should not change hoverMode when dragged from above location to another above location", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={false} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 7.5 }));
        expect(dropTarget.className).to.contain("below");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 2.5 }));
        expect(dropTarget.className).to.contain("above");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 2.5 }));
        expect(dropTarget.className).to.contain("above");
      });
      it("should render with below classname when hovered on bottom half and canDropOn is false", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={false} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 7.5 }));
        expect(dropTarget.className).to.contain("below");
      });
      it("should not change hoverMode when dragged from below location to another below location", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={false} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 7.5 }));
        expect(dropTarget.className).to.contain("below");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 7.5 }));
        expect(dropTarget.className).to.contain("below");
      });
    });
    describe("canDropOn = true", () => {
      it("should render with above classname when hovered on top third and canDropOn is true", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={true} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
        expect(dropTarget.className).to.contain("below");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 1.66 }));
        expect(dropTarget.className).to.contain("above");
      });
      it("should not change hoverMode when dragged from above location to another above location", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={true} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
        expect(dropTarget.className).to.contain("below");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 1.66 }));
        expect(dropTarget.className).to.contain("above");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 1.66 }));
        expect(dropTarget.className).to.contain("above");
      });
      it("should render with below classname when hovered on center third and canDropOn is true", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={true} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 5 }));
        expect(dropTarget.className).to.contain("on");
      });
      it("should not change hoverMode when dragged from on location to another on location", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={true} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 5 }));
        expect(dropTarget.className).to.contain("on");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 5 }));
        expect(dropTarget.className).to.contain("on");
      });
      it("should render with below classname when hovered on bottom third and canDropOn is true", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={true} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
        expect(dropTarget.className).to.contain("below");
      });
      it("should not change hoverMode when dragged from below location to another below location", async () => {
        const component = render(<DragDropRowWrapper style={{ position: "absolute", top: 0, left: 0, height: 10, width: 100 }} canDrop={true} isOver={true} canDropOn={true} />);
        const dropTarget = component.getByTestId("components-table-drop-target");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
        expect(dropTarget.className).to.contain("below");

        dropTarget.dispatchEvent(createBubbledEvent("dragover", { clientY: 8.33 }));
        expect(dropTarget.className).to.contain("below");
      });
    });
  });
  describe("Drag callbacks", () => {
    it("should have no drag callback when no dragProps are provided", async () => {
      const root = renderIntoDocument(<DragDropObjectRow />) as any;
      expect(root.createDragProps()).to.be.empty;
    });
    it("should pass dataObject through onDragSourceBegin", async () => {
      const onDragSourceBegin = sinon.spy((a: DragSourceArguments) => a);
      const root = renderIntoDocument(<DragDropObjectRow dragProps={{ onDragSourceBegin, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(0) as DragSourceProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      const ret = callbacks.onDragSourceBegin!(args);
      expect(onDragSourceBegin).to.have.been.calledWithMatch(args);
      expect(ret).to.deep.equal(args);
    });
    it("should pass dataObject through onDragSourceBegin without onDragSourceBegin input callback", async () => {
      const root = renderIntoDocument(<DragDropObjectRow dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(0) as DragSourceProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      const ret = callbacks.onDragSourceBegin!(args);
      expect(ret).to.deep.equal(args);
    });
    it("should pass constant objectType through", async () => {
      const root = renderIntoDocument(<DragDropObjectRow dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(0) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("test");
    });
    it("should pass data through for functional objectType", async () => {
      const objectType = sinon.spy((data: { row: number }) => `${data.row}`);
      const root = renderIntoDocument(<DragDropObjectRow dragProps={{ objectType }} />) as any;
      const callbacks = root.createDragProps(0) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("0");
    });
  });
  describe("Drop callbacks", () => {
    it("should have no drop callback when no dropProps are provided", async () => {
      const root = renderIntoDocument(<DragDropObjectRow />) as any;
      expect(root.createDropProps()).to.be.empty;
    });
    it("should pass args through outgoing callbacks when row index is not found", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps() as DropTargetProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch(args);

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch(args);

      callbacks.canDropTargetDrop!(args);
      expect(canDropTargetDrop).to.be.calledWithMatch(args);
    });
    it("should pass args through outgoing callbacks when row index is not found and incoming callbacks are not set", async () => {
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps() as DropTargetProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      const ret1 = callbacks.onDropTargetDrop!(args);
      expect(ret1).to.deep.equal(args);

      const ret2 = callbacks.canDropTargetDrop!(args);
      expect(ret2).to.deep.equal(true);
    });
    it("should not increment row if dropped while dropRect is undefined", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, canDropOn: false, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(0) as DropTargetProps;
      const args = {
        dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ row: 0 });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ row: 0 });

      callbacks.canDropTargetDrop!(args);
      expect(canDropTargetDrop).to.be.calledWithMatch({ row: 0 });
    });
    it("should not increment row if dropped on top half and canDropOn is false", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, canDropOn: false, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(0) as DropTargetProps;
      const args = {
        dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 50, y: 2.5 }, initialClientOffset: { x: 0, y: 0 }, dropRect: { top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 10 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ row: 0 });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ row: 0 });

      callbacks.canDropTargetDrop!(args);
      expect(canDropTargetDrop).to.be.calledWithMatch({ row: 0 });
    });
    it("should not increment row if dropped on top half and canDropOn is false", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, canDropOn: false, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(0) as DropTargetProps;
      const args = {
        dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 50, y: 2.5 }, initialClientOffset: { x: 0, y: 0 }, dropRect: { top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 10 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ row: 0 });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ row: 0 });

      callbacks.canDropTargetDrop!(args);
      expect(canDropTargetDrop).to.be.calledWithMatch({ row: 0 });
    });
    it("should increment row if dropped on bottom half and canDropOn is false", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, canDropOn: false, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(0) as DropTargetProps;
      const args = {
        dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 50, y: 7.5 }, initialClientOffset: { x: 0, y: 0 }, dropRect: { top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 10 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ row: 1 });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ row: 1 });
    });
    it("should not increment row if dropped on top 2/3 and canDropOn is true", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, canDropOn: true, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(0) as DropTargetProps;
      const args = {
        dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 50, y: 3.33 }, initialClientOffset: { x: 0, y: 0 }, dropRect: { top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 10 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ row: 0 });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ row: 0 });

      callbacks.canDropTargetDrop!(args);
      expect(canDropTargetDrop).to.be.calledWithMatch({ row: 0 });
    });
    it("should increment row if dropped on bottom 1/3 and canDropOn is true", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const root = renderIntoDocument(<DragDropObjectRow dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, canDropOn: true, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(0) as DropTargetProps;
      const args = {
        dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 50, y: 8.33 }, initialClientOffset: { x: 0, y: 0 }, dropRect: { top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 10 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ row: 1 });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ row: 1 });
    });
  });
});
