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
import { Breadcrumb } from "../../../ui-components";
import { withBreadcrumbDragDrop } from "../../../ui-components/breadcrumb/hoc/withDragDrop";
import {
  DragSourceArguments, DragSourceProps, DropEffects, DropStatus, DropTargetArguments, DropTargetProps,
} from "../../../ui-components/dragdrop/DragDropDef";
import { createDnDRenderer } from "../../tree/deprecated/hocs/withDragDrop.test";

/* eslint-disable deprecation/deprecation */

describe("Breadcrumb withDragDrop HOC", () => {

  afterEach(cleanup);

  const BreadcrumbWithDragDrop = withBreadcrumbDragDrop(Breadcrumb);
  const DragDropBreadcrumb = wrapInTestContext(BreadcrumbWithDragDrop);

  const renderIntoDocument = createDnDRenderer(BreadcrumbWithDragDrop);

  it("should render", () => {
    const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
    render(<DragDropBreadcrumb dataProvider={tree} />);
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
    const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
    render(<DragDropBreadcrumb dataProvider={tree} dragProps={dragProps} dropProps={dropProps} />);
  });
  it("should render with drag/drop props with initialCurrent set", () => {
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
    const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
    render(<DragDropBreadcrumb dataProvider={tree} dragProps={dragProps} dropProps={dropProps} initialCurrent={tree[0]} />);
  });
  describe("Drag callbacks", () => {
    it("should have no drag callback when no dragProps are provided", () => {
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={[]} />) as any;
      expect(root.createNodeDragProps([])).to.be.empty;
    });
    it("should have no drag callback when currentNode is undefined(unset)", () => {
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={[]} />) as any;
      expect(root.createNodeDragProps()).to.be.empty;
    });
    it("should forward extendedData from tree node into DragDrop dataObject", () => {
      const onDragSourceBegin = sinon.spy((args: DragSourceArguments) => args);
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dragProps={{ onDragSourceBegin, objectType: "test" }} />) as any;
      const callbacks = root.createNodeDragProps(tree[0]) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceBegin).to.have.been.calledWithMatch({ dataObject: { testData: true } });
      expect(ret.dataObject).to.contain({ testData: true });
    });
    it("should forward extendedData from tree node without onDragSourceBegin input callback", () => {
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createNodeDragProps(tree[0]) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret.dataObject).to.contain({ testData: true });
    });
    it("should add properties to dataObject from onDragSourceBegin and pass them on", () => {
      const onDragSourceBegin = (args: DragSourceArguments) => {
        args.dataObject = { test: true };
        return args;
      };
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dragProps={{ onDragSourceBegin, objectType: "test" }} />) as any;
      const callbacks = root.createNodeDragProps(tree[0]) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret.dataObject).to.contain({ test: true });
    });
    it("should set parentObject to dataProvider when on root node", () => {
      const onDragSourceBegin = sinon.spy((args: DragSourceArguments) => args);
      const onDragSourceEnd = sinon.spy();
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description" }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dragProps={{ onDragSourceBegin, onDragSourceEnd, objectType: "test" }} />) as any;
      const callbacks = root.createNodeDragProps(tree[0]) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceBegin).to.be.calledWithMatch({ parentObject: tree });
      expect(ret.parentObject).to.equal(tree);
      callbacks.onDragSourceEnd!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceEnd).to.be.calledWithMatch({ parentObject: tree });
    });
    it("should pass constant objectType through", () => {
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={[]} dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createNodeDragProps([]) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("test");
    });
    it("should pass data through for functional objectType", () => {
      const objectType = sinon.spy((data: { testType: string } | any) => data.testType);
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testType: "function-test" } }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dragProps={{ objectType }} />) as any;
      const callbacks = root.createNodeDragProps(tree[0]) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("function-test");
    });
  });
  describe("Drop callbacks", () => {
    it("should have no drop callback when no dropProps are provided", () => {
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={[]} />) as any;
      expect(root.createNodeDropProps([])).to.be.empty;
    });
    it("should add dropLocation as dataProvider to dropProps callbacks", () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createNodeDropProps() as DropTargetProps;
      callbacks.onDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree });

      callbacks.onDropTargetOver!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: tree });

      callbacks.canDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(canDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree });
    });
    it("should add dropLocation as item to dropProps callbacks", () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createNodeDropProps(tree[0]) as DropTargetProps;
      callbacks.onDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree[0] });

      callbacks.onDropTargetOver!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: tree[0] });

      callbacks.canDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(canDropTargetDrop).to.be.calledWithMatch({ dropLocation: tree[0] });
    });
    it("should add dropLocation as item to dropProps callback returns without input callback", () => {
      const tree = [{ label: PropertyRecord.fromString("Raw Node"), id: "1", description: "node description", extendedData: { testData: true } }];
      const root = renderIntoDocument(<DragDropBreadcrumb dataProvider={tree} dropProps={{ objectTypes: ["test"] }} />) as any;
      const callbacks = root.createNodeDropProps(tree[0]) as DropTargetProps;
      const ret1 = callbacks.onDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret1.dropLocation).to.equal(tree[0]);

      const ret2 = callbacks.canDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret2).to.be.true;
    });
  });
});
