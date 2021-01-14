/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { wrapInTestContext } from "react-dnd-test-utils";
import * as sinon from "sinon";
import { PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat } from "@bentley/ui-abstract";
import { cleanup, render } from "@testing-library/react";
import { Table } from "../../../ui-components";
import {
  DragSourceArguments, DragSourceProps, DropEffects, DropStatus, DropTargetArguments, DropTargetProps,
} from "../../../ui-components/dragdrop/DragDropDef";
import { withTableDragDrop } from "../../../ui-components/table/hocs/withDragDrop";
import { CellItem, ColumnDescription, RowItem, TableDataChangeEvent, TableDataProvider } from "../../../ui-components/table/TableDataProvider";
import { createDnDRenderer } from "../../tree/deprecated/hocs/withDragDrop.test";

/* eslint-disable deprecation/deprecation */

describe("Table withDragDrop HOC", () => {

  const TableWithDragDrop = withTableDragDrop(Table); // eslint-disable-line @typescript-eslint/naming-convention
  const DragDropTable = wrapInTestContext(TableWithDragDrop);

  const renderIntoDocument = createDnDRenderer(TableWithDragDrop);

  afterEach(cleanup);

  const createRowItem = (index: number) => {
    const rowItem: RowItem = { key: index.toString(), cells: [] };
    for (const column of columns) {
      rowItem.cells.push(createCellItem(column));
    }
    return rowItem;
  };

  const createCellItem = (column: ColumnDescription, value?: string): CellItem => {
    return {
      key: column.key,
      record: createPropertyRecord(column, value),
    };
  };

  const createPropertyRecord = (column: ColumnDescription, value?: string) => {
    const v: PropertyValue = {
      valueFormat: PropertyValueFormat.Primitive,
      displayValue: value ? value : "",
      value,
    };
    const pd: PropertyDescription = {
      typename: "text",
      name: column.key,
      displayLabel: column.label,
    };
    return new PropertyRecord(v, pd);
  };

  const columns: ColumnDescription[] = [{ label: "label0", key: "key0" }, { label: "label1", key: "key1" }, { label: "label2", key: "key2" }];

  const createDataProvider = (rows: number, extendedData?: { [key: string]: any }): TableDataProvider => ({
    onColumnsChanged: new TableDataChangeEvent(),
    onRowsChanged: new TableDataChangeEvent(),
    getRowsCount: async () => rows,
    getRow: async (index: number) => extendedData ? { ...createRowItem(index), extendedData } : createRowItem(index),
    getColumns: async () => columns,
    sort: async () => undefined,
  });
  it("should render", () => {
    const dataProviderMock = createDataProvider(10);
    render(<DragDropTable dataProvider={dataProviderMock} />);
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
    const dataProviderMock = createDataProvider(10);
    render(<DragDropTable dataProvider={dataProviderMock} dragProps={dragProps} dropProps={dropProps} />);
  });
  it("should return DragDrop row when renderRow is called", async () => {
    const dataProviderMock = createDataProvider(10);
    const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType: "test" }} />) as any;
    const row = root.renderRow(await dataProviderMock.getRow(0), { rows: {} }); // eslint-disable-line @typescript-eslint/naming-convention
    expect(row).to.exist;
  });
  describe("Drag callbacks", () => {
    it("should have no drag callback when no dragProps are provided", async () => {
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} />) as any;
      expect(root.createDragProps(await dataProviderMock.getRow(0))).to.be.empty;
    });
    it("should forward extendedData from tree node into DragDrop dataObject", async () => {
      const onDragSourceBegin = sinon.spy((args: DragSourceArguments) => args);
      const dataProviderMock = createDataProvider(10, { testData: true });
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ onDragSourceBegin, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceBegin).to.have.been.calledWithMatch({ dataObject: { testData: true } });
      expect(ret.dataObject).to.contain({ testData: true });
    });
    it("should forward extendedData from tree node without onDragSourceBegin input callback", async () => {
      const dataProviderMock = createDataProvider(10, { testData: true });
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret.dataObject).to.contain({ testData: true });
    });
    it("should add properties to dataObject from onDragSourceBegin and pass them on", async () => {
      const onDragSourceBegin = (args: DragSourceArguments) => {
        args.dataObject = { test: true };
        return args;
      };
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ onDragSourceBegin, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret.dataObject).to.contain({ test: true });
    });
    it("should set parentObject to dataProvider when on root node", async () => {
      const onDragSourceBegin = sinon.spy((args: DragSourceArguments) => args);
      const onDragSourceEnd = sinon.spy();
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ onDragSourceBegin, onDragSourceEnd, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceBegin).to.be.calledWithMatch({ parentObject: dataProviderMock });
      expect(ret.parentObject).to.equal(dataProviderMock);
      callbacks.onDragSourceEnd!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceEnd).to.be.calledWithMatch({ parentObject: dataProviderMock });
    });
    it("should pass constant objectType through", async () => {
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("test");
    });
    it("should pass data through for functional objectType", async () => {
      const dataProviderMock = createDataProvider(10, { testType: "function-test" });
      const objectType = sinon.spy((data: { testType: string } | any) => data?.testType);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("function-test");
    });
  });
  describe("Drop callbacks", () => {
    it("should have no drop return when no dropProps are provided", async () => {
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} />) as any;
      expect(root.createDropProps()).to.be.empty;
    });
    it("should add dropLocation as dataProvider to dropProps callbacks", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps() as DropTargetProps;
      callbacks.onDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: dataProviderMock });

      callbacks.onDropTargetOver!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: dataProviderMock });

      callbacks.canDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(canDropTargetDrop).to.be.calledWithMatch({ dropLocation: dataProviderMock });
    });
    it("should add dropLocation as item to dropProps callbacks", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps() as DropTargetProps;
      callbacks.onDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetDrop).to.be.calledWithMatch({ dropLocation: dataProviderMock });

      callbacks.onDropTargetOver!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDropTargetOver).to.be.calledWithMatch({ dropLocation: dataProviderMock });

      callbacks.canDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(canDropTargetDrop).to.be.calledWithMatch({ dropLocation: dataProviderMock });
    });
    it("should add dropLocation as item to dropProps callback returns without input callback", async () => {
      const dataProviderMock = createDataProvider(10);
      const root = renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dropProps={{ objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps() as DropTargetProps;
      const ret1 = callbacks.onDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret1.dropLocation).to.equal(dataProviderMock);

      const ret2 = callbacks.canDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret2).to.be.true;
    });
  });
});
