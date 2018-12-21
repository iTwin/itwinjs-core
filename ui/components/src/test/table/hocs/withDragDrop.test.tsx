/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { render, cleanup } from "react-testing-library";
import ReactTestUtils from "react-dom/test-utils";
import { Table } from "../../../ui-components";
import withDragDrop from "../../../table/hocs/withDragDrop";
import { DropTargetProps, DragSourceProps, DragSourceArguments, DropEffects, DropStatus, DropTargetArguments } from "../../../dragdrop/DragDropDef";
import { TableDataProvider, ColumnDescription, RowItem, CellItem, TableDataChangeEvent } from "../../../table/TableDataProvider";
import { PropertyValue, PropertyValueFormat } from "../../../properties/Value";
import { PropertyDescription } from "../../../properties/Description";
import { PropertyRecord } from "../../../properties/Record";

describe("Table withDragDrop HOC", () => {

  const DragDropTable = withDragDrop(Table); // tslint:disable-line:variable-name

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
    const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType: "test" }} />) as any;
    const row = root.renderRow(await dataProviderMock.getRow(0), { rows: {} }); // tslint:disable-line:variable-name
    render(row);
  });
  describe("Drag callbacks", () => {
    it("should have no drag callback when no dragProps are provided", async () => {
      const dataProviderMock = createDataProvider(10);
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} />) as any;
      expect(root.createDragProps(await dataProviderMock.getRow(0))).to.be.empty;
    });
    it("should forward extendedData from tree node into DragDrop dataObject", async () => {
      const onDragSourceBegin = sinon.spy((args: DragSourceArguments) => args);
      const dataProviderMock = createDataProvider(10, { testData: true });
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ onDragSourceBegin, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceBegin).to.have.been.calledWithMatch({ dataObject: { testData: true } });
      expect(ret.dataObject).to.contain({ testData: true });
    });
    it("should forward extendedData from tree node without onDragSourceBegin input callback", async () => {
      const dataProviderMock = createDataProvider(10, { testData: true });
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType: "test" }} />) as any;
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
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ onDragSourceBegin, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret.dataObject).to.contain({ test: true });
    });
    it("should set parentObject to dataProvider when on root node", async () => {
      const onDragSourceBegin = sinon.spy((args: DragSourceArguments) => args);
      const onDragSourceEnd = sinon.spy();
      const dataProviderMock = createDataProvider(10);
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ onDragSourceBegin, onDragSourceEnd, objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = callbacks.onDragSourceBegin!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceBegin).to.be.calledWithMatch({ parentObject: dataProviderMock });
      expect(ret.parentObject).to.equal(dataProviderMock);
      callbacks.onDragSourceEnd!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(onDragSourceEnd).to.be.calledWithMatch({ parentObject: dataProviderMock });
    });
    it("should pass constant objectType through", async () => {
      const dataProviderMock = createDataProvider(10);
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType: "test" }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("test");
    });
    it("should pass data through for functional objectType", async () => {
      const dataProviderMock = createDataProvider(10, { testType: "function-test" });
      const objectType = sinon.spy((data: { testType: string }) => data.testType);
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dragProps={{ objectType }} />) as any;
      const callbacks = root.createDragProps(await dataProviderMock.getRow(0)) as DragSourceProps;
      const ret = (callbacks.objectType as any)();
      expect(ret).to.equal("function-test");
    });
  });
  describe("Drop callbacks", () => {
    it("should have no drop return when no dropProps are provided", async () => {
      const dataProviderMock = createDataProvider(10);
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} />) as any;
      expect(root.createDropProps()).to.be.empty;
    });
    it("should add dropLocation as dataProvider to dropProps callbacks", async () => {
      const onDropTargetDrop = sinon.spy();
      const onDropTargetOver = sinon.spy();
      const canDropTargetDrop = sinon.spy((_args: DropTargetArguments) => true);
      const dataProviderMock = createDataProvider(10);
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
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
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dropProps={{ onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] }} />) as any;
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
      const root = ReactTestUtils.renderIntoDocument(<DragDropTable dataProvider={dataProviderMock} dropProps={{ objectTypes: ["test"] }} />) as any;
      const callbacks = root.createDropProps() as DropTargetProps;
      const ret1 = callbacks.onDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret1.dropLocation).to.equal(dataProviderMock);

      const ret2 = callbacks.canDropTargetDrop!({ dataObject: undefined, dropEffect: DropEffects.Move, dropStatus: DropStatus.None, clientOffset: { x: 0, y: 0 }, initialClientOffset: { x: 0, y: 0 } });
      expect(ret2).to.be.true;
    });
  });
});
