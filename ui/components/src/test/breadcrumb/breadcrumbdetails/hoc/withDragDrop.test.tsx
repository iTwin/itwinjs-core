/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { wrapInTestContext } from "react-dnd-test-utils";
import * as sinon from "sinon";
import { PropertyRecord } from "@bentley/ui-abstract";
import { cleanup, render } from "@testing-library/react";
import {
  BreadcrumbDetails, BreadcrumbPath, DragSourceArguments, DragSourceProps, DropEffects, DropStatus, DropTargetArguments,
  DropTargetProps, withBreadcrumbDetailsDragDrop,
} from "../../../../ui-components";
import { mockRawTreeDataProvider } from "../../mockTreeDataProvider";
import { createDnDRenderer } from "../../../tree/deprecated/hocs/withDragDrop.test";

/* eslint-disable deprecation/deprecation */

describe("Breadcrumb Details withDragDrop HOC", () => {

  const BreadcrumbDetailsWithDragDrop = withBreadcrumbDetailsDragDrop(BreadcrumbDetails);
  const DragDropBreadcrumbDetails = wrapInTestContext(BreadcrumbDetailsWithDragDrop);

  const renderIntoDocument = createDnDRenderer(BreadcrumbDetailsWithDragDrop);

  afterEach(cleanup);

  it("should render", () => {
    const path = new BreadcrumbPath(mockRawTreeDataProvider);
    render(<DragDropBreadcrumbDetails path={path} />);
  });
  it("should render with drag/drop props", () => {
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
    const path = new BreadcrumbPath(mockRawTreeDataProvider);
    render(<DragDropBreadcrumbDetails path={path} dragProps={dragProps} dropProps={dropProps} />);
  });
  describe("Drag callbacks", () => {
    it("should have no drag callback when no dragProps are provided", () => {
      const path = new BreadcrumbPath([]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} />) as any;
      expect(root.createDragProps([])).to.be.empty;
    });
    it("should have no drag callback when currentNode is undefined(unset)", () => {
      const path = new BreadcrumbPath([]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} />) as any;
      expect(root.createDragProps()).to.be.empty;
    });
    it("should add parentObject to args return and pass them on when dataObject is undefined and outgoing onDragSourceBegin is undefined", () => {
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const path = new BreadcrumbPath(tree);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(tree[0]) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret.parentObject).to.deep.equal(tree);
    });
    it("should add parentObject to args and pass them on when dataObject is undefined", () => {
      const onDragSourceBegin = sinon.spy((a: DragSourceArguments) => a);
      const onDragSourceEnd = sinon.spy();
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const path = new BreadcrumbPath(tree);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dragProps={{ onDragSourceBegin, onDragSourceEnd, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(tree[0]) as DragSourceProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      callbacks.onDragSourceBegin!(args);
      expect(onDragSourceBegin).to.be.calledWithMatch({ parentObject: tree });
      callbacks.onDragSourceEnd!(args);
      expect(onDragSourceEnd).to.be.calledWithMatch({ parentObject: tree });
    });
    it("should add current parentId to dataObject and parentObject to args and pass them on when dataObject is defined", () => {
      const onDragSourceBegin = sinon.spy((a: DragSourceArguments) => a);
      const onDragSourceEnd = sinon.spy();
      const objectType = sinon.spy(() => "testType");
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const path = new BreadcrumbPath(tree);
      path.setCurrentNode(tree[0]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dragProps={{ onDragSourceBegin, onDragSourceEnd, objectType }} />) as any;
      const callbacks = root.createDragProps(tree[0]) as DragSourceProps;
      const args = { dataObject: {}, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      callbacks.onDragSourceBegin!(args);
      expect(onDragSourceBegin).to.be.calledWithMatch({ dataObject: { parentId: "1" }, parentObject: tree[0] });
      callbacks.onDragSourceEnd!(args);
      expect(onDragSourceEnd).to.be.calledWithMatch({ dataObject: { parentId: "1" }, parentObject: tree[0] });
      (callbacks.objectType as any)({});
      expect(objectType).to.be.calledWithMatch({ parentId: "1" });
    });
    it("should add parentId to dataObject and pass them on when dataObject is defined", () => {
      const onDragSourceBegin = sinon.spy((a: DragSourceArguments) => a);
      const onDragSourceEnd = sinon.spy();
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const path = new BreadcrumbPath(tree);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dragProps={{ onDragSourceBegin, onDragSourceEnd, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(tree[0]) as DragSourceProps;
      const args = { dataObject: {}, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      callbacks.onDragSourceBegin!(args);
      expect(onDragSourceBegin).to.be.calledWithMatch({ dataObject: { parentId: tree }, parentObject: tree });
      callbacks.onDragSourceEnd!(args);
      expect(onDragSourceEnd).to.be.calledWithMatch({ dataObject: { parentId: tree }, parentObject: tree });
    });
    it("should pass constant objectType through", () => {
      const path = new BreadcrumbPath([]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createDragProps([]) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("test");
    });
    it("should pass object data through with parentId for functional objectType", () => {
      const objectType = sinon.spy(() => "testType");
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const path = new BreadcrumbPath(tree);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dragProps={{ objectType }} />) as any;
      const callbacks = root.createDragProps(tree[0]) as DragSourceProps;
      (callbacks.objectType as any)({});
      expect(objectType).to.be.calledWithMatch({ parentId: tree });
    });
    it("should pass non-object data through unmodified for functional objectType", () => {
      const objectType = sinon.spy(() => "testType");
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const path = new BreadcrumbPath(tree);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dragProps={{ objectType }} />) as any;
      const callbacks = root.createDragProps(tree[0]) as DragSourceProps;
      (callbacks.objectType as any)("test data");
      expect(objectType).to.be.calledWith("test data");
    });
  });
  describe("Drop callbacks", () => {
    it("should have no drop callback when no dropProps are provided", () => {
      const path = new BreadcrumbPath([]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} />) as any;
      expect(root.createDropProps([])).to.be.empty;
    });
    it("should add dropLocation as dataProvider to dropProps callbacks", () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const path = new BreadcrumbPath(tree);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps() as DropTargetProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: tree });

      callbacks.canDropTargetDrop!(args);
      expect(canDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree });
    });
    it("should add dropLocation as child of current when item is dropped on center of row", () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const tree = [
        {
          label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", children: [
            { label: PropertyRecord.fromString("Raw Child Node"), id: "1.1", description: "child node description" },
          ],
        },
      ];
      const path = new BreadcrumbPath(tree);
      path.setCurrentNode(tree[0]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(tree[0], tree[0].children) as DropTargetProps;
      const args = {
        dataObject: undefined, row: 0, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 50, y: 5 }, initialClientOffset: { x: 0, y: 0 }, dropRect: { top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 10 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree[0].children[0] });
      args.row = 0; // reset row to 0

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: tree[0].children[0] });
    });
    it("should leave dropLocation and row unmodified item is dropped off center of row", () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const tree = [
        {
          label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", children: [
            { label: PropertyRecord.fromString("Raw Child Node"), id: "1.1", description: "child node description" },
          ],
        },
      ];
      const path = new BreadcrumbPath(tree);
      path.setCurrentNode(tree[0]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(tree[0], tree[0].children) as DropTargetProps;
      const args = {
        dataObject: undefined, row: 0, dropEffect: DropEffects.Move, dropStatus: DropStatus.None,
        clientOffset: { x: 50, y: 0 }, initialClientOffset: { x: 0, y: 0 }, dropRect: { top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 10 },
      };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree[0] });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: tree[0] });
    });
    it("should add dropLocation as item to dropProps callbacks", () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const tree = [
        {
          label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", children: [
            { label: PropertyRecord.fromString("Raw Child Node"), id: "1.1", description: "child node description" },
          ],
        },
      ];
      const path = new BreadcrumbPath(tree);
      path.setCurrentNode(tree[0]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(tree[0], tree[0].children) as DropTargetProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      callbacks.onDropTargetDrop!(args);
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree[0] });

      callbacks.onDropTargetOver!(args);
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: tree[0] });

      callbacks.canDropTargetDrop!(args);
      expect(canDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree[0] });
    });
    it("should add dropLocation as item to dropProps callback returns without input callback", () => {
      const tree = [
        {
          label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", children: [
            { label: PropertyRecord.fromString("Raw Child Node"), id: "1.1", description: "child node description" },
          ],
        },
      ];
      const path = new BreadcrumbPath(tree);
      path.setCurrentNode(tree[0]);
      const root = renderIntoDocument(<DragDropBreadcrumbDetails path={path} dropProps={{ objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps(tree[0], tree[0].children) as DropTargetProps;
      const args = { dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } };
      const ret1 = callbacks.onDropTargetDrop!(args);
      expect(ret1.dropLocation).to.equal(tree[0]);
      const ret2 = callbacks.canDropTargetDrop!(args);
      expect(ret2).to.equal(true);
    });
  });

});
