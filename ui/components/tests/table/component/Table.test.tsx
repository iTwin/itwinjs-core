/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import * as enzyme from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import {
  Table, TableDataProvider, RowItem,
  TableDataChangeEvent, TableDataChangesListener, CellItem,
  TableSelectionTarget, TableProps, ColumnDescription,
} from "../../../src/table";
import { SelectionMode } from "../../../src/common";
import { PropertyRecord, PropertyValue, PropertyValueFormat, PropertyDescription } from "../../../src";
import { waitForSpy } from "../../test-helpers/misc";

describe("Table", () => {
  const rowClassName = "div.row";
  const selectedRowClassName = "div.react-grid-Row.row-selected";
  const cellClassName = "div.cell";
  const selectedCellClassName = "div.cell.is-selected";

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

  const columns = [
    { label: "label0", key: "key0" },
    { label: "label1", key: "key1" },
    { label: "label2", key: "key2" },
  ];

  const onRowsLoaded = sinon.spy();

  const verifyRowIterator = async (expectedItemKeys: string[], iterator?: AsyncIterableIterator<RowItem>): Promise<void> => {
    expect(iterator, "row iterator").to.not.be.undefined;
    const actualItems = [];
    let iteratorResult = await iterator!.next();
    while (!iteratorResult.done) {
      actualItems.push(iteratorResult.value);
      iteratorResult = await iterator!.next();
    }
    expect(expectedItemKeys.length).to.be.equal(actualItems.length);
    for (let i = 0; i < expectedItemKeys.length; i++) {
      expect(actualItems.find((x) => x.key === expectedItemKeys[i], "expectedItemKeys[" + i + "]")).to.not.be.undefined;
    }
  };

  const verifyCellIterator = async (expectedItemKeys: Array<{ rowKey: string, columnKey: string }>, iterator?: AsyncIterableIterator<[RowItem, CellItem]>): Promise<void> => {
    expect(iterator, "cell iterator").to.not.be.undefined;
    const actualItems: Array<[RowItem, CellItem]> = [];
    let iteratorResult = await iterator!.next();
    while (!iteratorResult.done) {
      actualItems.push(iteratorResult.value);
      iteratorResult = await iterator!.next();
    }

    expect(expectedItemKeys.length).to.be.equal(actualItems.length);
    for (let i = 0; i < expectedItemKeys.length; i++) {
      expect(actualItems.find((x) => x[1].key === expectedItemKeys[i].columnKey && x[0].key === expectedItemKeys[i].rowKey), "expectedItemKeys[" + i + "]").to.not.be.undefined;
    }
  };

  const dataProviderMock = moq.Mock.ofType<TableDataProvider>();
  const tableDataChangeEventMock = moq.Mock.ofType<TableDataChangeEvent>();
  const onRowsSelectedCallbackMock = moq.Mock.ofType<(rows: AsyncIterableIterator<RowItem>, replace: boolean) => Promise<boolean>>();
  const onRowsDeselectedCallbackMock = moq.Mock.ofType<(rows: AsyncIterableIterator<RowItem>) => Promise<boolean>>();
  const onCellsSelectedCallbackMock = moq.Mock.ofType<(cells: AsyncIterableIterator<[RowItem, CellItem]>, replace: boolean) => Promise<boolean>>();
  const onCellsDeselectedCallbackMock = moq.Mock.ofType<(cells: AsyncIterableIterator<[RowItem, CellItem]>) => Promise<boolean>>();
  let selectedRowsIterator: AsyncIterableIterator<RowItem> | undefined;
  let deselectedRowsIterator: AsyncIterableIterator<RowItem> | undefined;
  let selectedCellsIterator: AsyncIterableIterator<[RowItem, CellItem]> | undefined;
  let deselectedCellsIterator: AsyncIterableIterator<[RowItem, CellItem]> | undefined;
  let table: enzyme.ReactWrapper<TableProps, any>;

  beforeEach(async () => {
    dataProviderMock.reset();
    tableDataChangeEventMock.reset();
    onRowsSelectedCallbackMock.reset();
    onRowsDeselectedCallbackMock.reset();
    onCellsSelectedCallbackMock.reset();
    onCellsDeselectedCallbackMock.reset();

    onRowsSelectedCallbackMock.setup((x) => x(moq.It.isAny(), moq.It.isAny())).callback((iterator: AsyncIterableIterator<RowItem>) => { selectedRowsIterator = iterator; });
    onRowsDeselectedCallbackMock.setup((x) => x(moq.It.isAny())).callback((iterator: AsyncIterableIterator<RowItem>) => { deselectedRowsIterator = iterator; });
    onCellsSelectedCallbackMock.setup((x) => x(moq.It.isAny(), moq.It.isAny())).callback(async (iterator: AsyncIterableIterator<[RowItem, CellItem]>) => { selectedCellsIterator = iterator; });
    onCellsDeselectedCallbackMock.setup((x) => x(moq.It.isAny())).callback(async (iterator: AsyncIterableIterator<[RowItem, CellItem]>) => { deselectedCellsIterator = iterator; });

    tableDataChangeEventMock.setup((x) => x.addListener(moq.It.isAny())).returns(() => moq.Mock.ofType<TableDataChangesListener>().object);
    dataProviderMock.setup((x) => x.onColumnsChanged).returns(() => tableDataChangeEventMock.object);
    dataProviderMock.setup((x) => x.onRowsChanged).returns(() => tableDataChangeEventMock.object);
    dataProviderMock.setup((x) => x.getRowsCount()).returns(async () => 10);
    dataProviderMock.setup((x) => x.getRow(moq.It.isAnyNumber())).returns(async (index) => createRowItem(index));
    dataProviderMock.setup((x) => x.getColumns()).returns(async () => columns);
    onRowsLoaded.resetHistory();
    table = enzyme.mount(<Table
      dataProvider={dataProviderMock.object}
      onRowsSelected={onRowsSelectedCallbackMock.object}
      onRowsDeselected={onRowsDeselectedCallbackMock.object}
      onCellsSelected={onCellsSelectedCallbackMock.object}
      onCellsDeselected={onCellsDeselectedCallbackMock.object}
      onRowsLoaded={onRowsLoaded}
    />);
    await waitForSpy(table, onRowsLoaded);
  });

  before(() => {
    // https://github.com/Microsoft/TypeScript/issues/14151#issuecomment-280812617
    // tslint:disable-next-line:no-string-literal
    if (Symbol["asyncIterator"] === undefined) ((Symbol as any)["asyncIterator"]) = Symbol.for("asyncIterator");
  });

  /**
   * A scenario:
   * A person selects 4 elements which calls loadRows method. Loading a row takes time
   * so while it's loading a new selection might be made, which could be 2 elements.
   * If the first loadRows is still going, it will eventually try accessing 4th and 4th elements
   * but will get undefined. That is because new selection will change dataProvider to contain 2 elements instead of 4
   */
  it("did not throw when dataProvider was changed while updateRows was still going", async () => {
    // Set up handlers
    const rowChangeEvent = new TableDataChangeEvent();
    const columnChangeEvent = new TableDataChangeEvent();

    // Mock data provider
    const strictDataProviderMock = moq.Mock.ofType<TableDataProvider>(undefined, moq.MockBehavior.Strict);
    strictDataProviderMock.setup((provider) => provider.onRowsChanged).returns(() => rowChangeEvent);
    strictDataProviderMock.setup((provider) => provider.onColumnsChanged).returns(() => columnChangeEvent);
    strictDataProviderMock.setup((provider) => provider.getColumns()).returns(async () => []);
    strictDataProviderMock.setup((provider) => provider.getRowsCount()).returns(async () => 0);
    strictDataProviderMock.setup((a: any) => a.getRow(moq.It.isAnyNumber())).returns(async () => undefined);

    const shallowTable = enzyme.shallow(<Table dataProvider={dataProviderMock.object} />);
    await (shallowTable.instance() as Table).update();

    let iteration = 0;
    strictDataProviderMock.reset();
    strictDataProviderMock.setup((provider) => provider.getColumns()).returns(async () => []);
    strictDataProviderMock.setup((provider) => provider.getRowsCount()).returns(async () => 1);
    strictDataProviderMock.setup((provider) => provider.getRow(moq.It.isAnyNumber())).callback(async () => {
      iteration++;
      if (iteration >= 2) {
        // Change data provider while update is still going
        strictDataProviderMock.reset();
        strictDataProviderMock.setup((provider) => provider.getColumns()).returns(async () => []);
        strictDataProviderMock.setup((provider) => provider.getRowsCount()).returns(async () => 0);
        strictDataProviderMock.setup((provider: any) => provider.getRow(moq.It.isAnyNumber())).returns(async () => undefined);
        await (shallowTable.instance() as Table).update();
      }
    }).returns(async () => ({ key: "", cells: [] }));

    await (shallowTable.instance() as Table).update();
  });

  describe("Row Selection", () => {

    describe("Single", () => {

      it("selects a row", async () => {
        table.update();
        const row = table.find(rowClassName).first();
        row.simulate("click");

        await verifyRowIterator(["0"], selectedRowsIterator);
        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        expect(table.find(selectedRowClassName).length).to.be.equal(1);
      });

      it("deselects other rows when selects a row", async () => {
        const isRowSelected = () => true;
        table.setProps({ isRowSelected });
        table.update();
        expect(table.find(selectedRowClassName).length).to.be.greaterThan(1);
        const row = table.find(rowClassName).first();
        row.simulate("click");

        await verifyRowIterator(["0"], selectedRowsIterator);
        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        onRowsDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(table.find(selectedRowClassName).length).to.be.equal(1);
      });

    });

    describe("Extended", () => {

      beforeEach(() => {
        table.setProps({ selectionMode: SelectionMode.Extended });
      });

      it("shift select rows from top to bottom", async () => {
        const rows = table.find(rowClassName);
        const row0 = rows.at(0);
        const row2 = rows.at(2);
        row0.simulate("click");
        await verifyRowIterator(["0"], selectedRowsIterator);
        row2.simulate("click", { shiftKey: true });
        await verifyRowIterator(["0", "1", "2"], selectedRowsIterator);

        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
        expect(table.find(selectedRowClassName).length).to.be.equal(3);
      });

      it("shift select rows from bottom to top", async () => {
        const rows = table.find(rowClassName);
        const row0 = rows.at(0);
        const row2 = rows.at(2);
        row2.simulate("click");
        await verifyRowIterator(["2"], selectedRowsIterator);

        row0.simulate("click", { shiftKey: true });
        await verifyRowIterator(["0", "1", "2"], selectedRowsIterator);

        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
        expect(table.find(selectedRowClassName).length).to.be.equal(3);
      });

      it("ctrl selects rows", async () => {
        const rows = table.find(rowClassName);
        const row0 = rows.at(0);
        const row2 = rows.at(2);
        row0.simulate("click", { ctrlKey: true });
        await verifyRowIterator(["0"], selectedRowsIterator);
        row2.simulate("click", { ctrlKey: true });
        await verifyRowIterator(["2"], selectedRowsIterator);

        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), false), moq.Times.exactly(2));
        expect(table.find(selectedRowClassName).length).to.be.equal(2);
      });

    });

    describe("Multiple", () => {

      beforeEach(() => {
        table.setProps({ selectionMode: SelectionMode.Multiple });
      });

      it("drag selects rows", async () => {
        const rows = table.find(rowClassName);
        const row0 = rows.at(0);
        const row2 = rows.at(2);
        row0.simulate("mousedown");
        row2.simulate("mousemove", { buttons: 1 });
        document.dispatchEvent(new MouseEvent("mouseup"));

        await verifyRowIterator(["0", "1", "2"], selectedRowsIterator);
        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), false), moq.Times.once());
        expect(table.find(selectedRowClassName).length).to.be.equal(3);
      });

      it("drag selects and deselects rows", async () => {
        const isRowSelected = (item: RowItem): boolean => item.key === "0" || item.key === "1";
        table.setProps({ isRowSelected });
        table.update();
        expect(table.find(selectedRowClassName).length).to.be.equal(2);
        const rows = table.find(rowClassName);
        const row0 = rows.at(0);
        const row2 = rows.at(2);
        row2.simulate("mousedown");
        row0.simulate("mousemove", { buttons: 1 });
        document.dispatchEvent(new MouseEvent("mouseup"));

        await verifyRowIterator(["2"], selectedRowsIterator);
        await verifyRowIterator(["0", "1"], deselectedRowsIterator);
        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), false), moq.Times.once());
        onRowsDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.once());
        expect(table.find(selectedRowClassName).length).to.be.equal(1);
      });

    });

    describe("SingleAllowDeselect", () => {

      beforeEach(() => {
        table.setProps({ selectionMode: SelectionMode.SingleAllowDeselect });
      });

      it("deselects selected row", async () => {
        const row = table.find(rowClassName).first();
        row.simulate("click");
        await verifyRowIterator(["0"], selectedRowsIterator);
        row.simulate("click");
        await verifyRowIterator(["0"], deselectedRowsIterator);

        onRowsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        onRowsDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.once());
        expect(table.find(selectedRowClassName).length).to.be.equal(0);
      });

      it("handles selection changes if callback not specified", async () => {
        table.setProps({
          onRowsDeselected: undefined,
          onRowsSelected: undefined,
          onCellsSelected: undefined,
          onCellsDeselected: undefined,
        });

        const row = table.find(rowClassName).first();
        row.simulate("click");
        expect(table.find(selectedRowClassName).length).to.be.equal(1);
        row.simulate("click");
        expect(table.find(selectedRowClassName).length).to.be.equal(0);
      });

    });

    it("selects rows as they are loaded", async () => {
      const isRowSelected = (item: RowItem): boolean => {
        return item.key === "0" || item.key === "1";
      };
      onRowsLoaded.resetHistory();
      table = enzyme.mount(<Table dataProvider={dataProviderMock.object} isRowSelected={isRowSelected} onRowsLoaded={onRowsLoaded} />);
      await waitForSpy(table, onRowsLoaded);
      table.update();

      const selectedRows = table.find(selectedRowClassName);
      expect(selectedRows.length).to.be.equal(2);
    });

    it("updates rows if isRowSelected prop changes", async () => {
      const isRowSelected = (item: RowItem): boolean => {
        return item.key === "0" || item.key === "1";
      };
      table.setProps({ isRowSelected });
      table.update();

      const selectedRows = table.find(selectedRowClassName);
      expect(selectedRows.length).to.be.equal(2);
    });

    it("clears selection if isRowSelected is undefined", async () => {
      const isRowSelected = (item: RowItem): boolean => {
        return item.key === "0" || item.key === "1";
      };
      onRowsLoaded.resetHistory();
      table = enzyme.mount(<Table dataProvider={dataProviderMock.object} isRowSelected={isRowSelected} onRowsLoaded={onRowsLoaded} />);
      await waitForSpy(table, onRowsLoaded);
      table.update();
      let selectedRows = table.find(selectedRowClassName);
      expect(selectedRows.length).to.be.equal(2);
      table.setProps({ isRowSelected: undefined });
      table.update();

      selectedRows = table.find(selectedRowClassName);
      expect(selectedRows.length).to.be.equal(0);
    });

    it("does not display selected cells if selection target is rows", async () => {
      const isCellSelected = (): boolean => true;
      table.setProps({ isCellSelected });
      table.update();
      const selectedCells = table.find("div.cell.is-selected");
      expect(selectedCells.length).to.be.equal(0);
    });

  });

  describe("Cell Selection", () => {

    beforeEach(async () => {
      table.setProps({ tableSelectionTarget: TableSelectionTarget.Cell });
    });

    describe("Single", () => {

      it("selects a cell", async () => {
        const cell = table.find(cellClassName).first();
        cell.simulate("click");
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        expect(table.find(selectedCellClassName).length).to.be.equal(1);
      });

      it("deselects other cells when selects a cell", async () => {
        const isCellSelected = () => true;
        table.setProps({ isCellSelected });
        table.update();
        expect(table.find(selectedCellClassName).length).to.be.greaterThan(1);
        const cell = table.find(cellClassName).first();
        cell.simulate("click");

        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        onCellsDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.never());
        expect(table.find(selectedCellClassName).length).to.be.equal(1);
      });

    });

    describe("Extended", () => {

      beforeEach(() => {
        table.setProps({ selectionMode: SelectionMode.Extended });
      });

      it("shift select cells from top to bottom", async () => {
        const cells = table.find(cellClassName);
        const cell10 = cells.at(3);
        const cell22 = cells.at(8);
        cell10.simulate("click");
        await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }], selectedCellsIterator);
        cell22.simulate("click", { shiftKey: true });
        await verifyCellIterator([
          { rowKey: "1", columnKey: "key0" },
          { rowKey: "1", columnKey: "key1" },
          { rowKey: "1", columnKey: "key2" },
          { rowKey: "2", columnKey: "key0" },
          { rowKey: "2", columnKey: "key1" },
          { rowKey: "2", columnKey: "key2" },
        ], selectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
        expect(table.find(selectedCellClassName).length).to.be.equal(6);
      });

      it("shift select cells from bottom to top", async () => {
        const cells = table.find(cellClassName);
        const cell10 = cells.at(3);
        const cell22 = cells.at(8);
        cell22.simulate("click");
        await verifyCellIterator([{ rowKey: "2", columnKey: "key2" }], selectedCellsIterator);
        cell10.simulate("click", { shiftKey: true });
        await verifyCellIterator([
          { rowKey: "1", columnKey: "key0" },
          { rowKey: "1", columnKey: "key1" },
          { rowKey: "1", columnKey: "key2" },
          { rowKey: "2", columnKey: "key0" },
          { rowKey: "2", columnKey: "key1" },
          { rowKey: "2", columnKey: "key2" },
        ], selectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
        expect(table.find(selectedCellClassName).length).to.be.equal(6);
      });

      it("shift select cells left to right", async () => {
        const cells = table.find(cellClassName);
        const cell00 = cells.at(0);
        const cell02 = cells.at(2);
        cell00.simulate("click");
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);
        cell02.simulate("click", { shiftKey: true });
        await verifyCellIterator([
          { rowKey: "0", columnKey: "key0" },
          { rowKey: "0", columnKey: "key1" },
          { rowKey: "0", columnKey: "key2" },
        ], selectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
        expect(table.find(selectedCellClassName).length).to.be.equal(3);
      });

      it("shift select cells right to left", async () => {
        const cells = table.find(cellClassName);
        const cell00 = cells.at(0);
        const cell02 = cells.at(2);
        cell00.simulate("click");
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);
        cell02.simulate("click", { shiftKey: true });
        await verifyCellIterator([
          { rowKey: "0", columnKey: "key0" },
          { rowKey: "0", columnKey: "key1" },
          { rowKey: "0", columnKey: "key2" },
        ], selectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
        expect(table.find(selectedCellClassName).length).to.be.equal(3);
      });

      it("ctrl shift select cells", async () => {
        const cells = table.find(cellClassName);
        const cell10 = cells.at(3);
        const cell12 = cells.at(5);
        const cell22 = cells.at(8);
        cell12.simulate("click");
        await verifyCellIterator([{ rowKey: "1", columnKey: "key2" }], selectedCellsIterator);
        cell10.simulate("click", { ctrlKey: true });
        await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }], selectedCellsIterator);
        cell22.simulate("click", { ctrlKey: true, shiftKey: true });
        await verifyCellIterator([
          { rowKey: "1", columnKey: "key1" },
          { rowKey: "2", columnKey: "key0" },
          { rowKey: "2", columnKey: "key1" },
          { rowKey: "2", columnKey: "key2" },
        ], selectedCellsIterator);

        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), false), moq.Times.exactly(2));
        expect(table.find(selectedCellClassName).length).to.be.equal(6);
      });

      it("ctrl selects cells", async () => {
        const cells = table.find(cellClassName);
        const cell11 = cells.at(0);
        const cell13 = cells.at(2);
        cell11.simulate("click");
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);
        cell13.simulate("click", { ctrlKey: true });
        await verifyCellIterator([{ rowKey: "0", columnKey: "key2" }], selectedCellsIterator);

        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), false), moq.Times.once());
        expect(table.find(selectedCellClassName).length).to.be.equal(2);
      });

    });

    describe("Multiple", () => {

      beforeEach(() => {
        table.setProps({ selectionMode: SelectionMode.Multiple });
      });

      it("drag selects cells", async () => {
        const cells = table.find(cellClassName);
        const cells11 = cells.at(0);
        const cells22 = cells.at(4);
        cells11.simulate("mousedown");
        cells22.simulate("mousemove", { buttons: 1 });
        document.dispatchEvent(new MouseEvent("mouseup"));

        await verifyCellIterator([
          { rowKey: "0", columnKey: "key0" },
          { rowKey: "0", columnKey: "key1" },
          { rowKey: "1", columnKey: "key0" },
          { rowKey: "1", columnKey: "key1" },
        ], selectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), false), moq.Times.once());
        expect(table.find(selectedCellClassName).length).to.be.equal(4);
      });

      it("drag selects and deselects cells", async () => {
        const isCellSelected = (rowIndex: number, _item: CellItem): boolean => (rowIndex === 0);
        table.setProps({ isCellSelected });
        table.update();
        const cells = table.find(cellClassName);
        const cell11 = cells.at(0);
        const cell22 = cells.at(4);
        cell22.simulate("mousedown");
        cell11.simulate("mousemove", { buttons: 1 });
        document.dispatchEvent(new MouseEvent("mouseup"));

        await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }, { rowKey: "1", columnKey: "key1" }], selectedCellsIterator);
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }, { rowKey: "0", columnKey: "key1" }], deselectedCellsIterator);
        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), false), moq.Times.once());
        onCellsDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.once());
        expect(table.find(selectedCellClassName).length).to.be.equal(3);
      });

    });

    describe("SingleAllowDeselect", () => {

      beforeEach(() => {
        table.setProps({ selectionMode: SelectionMode.SingleAllowDeselect });
      });

      it("deselects selected cell", async () => {
        const cell = table.find(cellClassName).first();
        cell.simulate("click");
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);
        cell.simulate("click");
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], deselectedCellsIterator);

        onCellsSelectedCallbackMock.verify((x) => x(moq.It.isAny(), true), moq.Times.once());
        onCellsDeselectedCallbackMock.verify((x) => x(moq.It.isAny()), moq.Times.once());
        expect(table.find(selectedCellClassName).length).to.be.equal(0);
      });

      it("handles selection changes if callback not specified", async () => {
        table.setProps({
          onRowsDeselected: undefined,
          onRowsSelected: undefined,
          onCellsSelected: undefined,
          onCellsDeselected: undefined,
        });
        const cell = table.find(cellClassName).first();
        cell.simulate("click");
        expect(table.find(selectedCellClassName).length).to.be.equal(1);
        cell.simulate("click");
        expect(table.find(selectedCellClassName).length).to.be.equal(0);
      });

    });

    it("selects cells as they are loaded", async () => {
      const isCellSelected = (rowIndex: number): boolean => {
        return rowIndex === 0 || rowIndex === 1;
      };
      onRowsLoaded.resetHistory();
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        isCellSelected={isCellSelected}
        tableSelectionTarget={TableSelectionTarget.Cell}
        onRowsLoaded={onRowsLoaded} />);
      await waitForSpy(table, onRowsLoaded);
      table.update();
      const selectedCells = table.find(selectedCellClassName);
      expect(selectedCells.length).to.be.equal(6);
    });

    it("updates cells if isCellSelected prop changes", async () => {
      const isCellSelected = (rowIndex: number): boolean => {
        return rowIndex === 0 || rowIndex === 1;
      };
      table.setProps({ isCellSelected });
      table.update();
      const selectedCells = table.find(selectedCellClassName);
      expect(selectedCells.length).to.be.equal(6);
    });

    it("clears selection if isCellSelected is set to undefined", async () => {
      const isCellSelected = (rowIndex: number): boolean => {
        return rowIndex === 0 || rowIndex === 1;
      };
      onRowsLoaded.resetHistory();
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        isCellSelected={isCellSelected}
        onRowsLoaded={onRowsLoaded}
        tableSelectionTarget={TableSelectionTarget.Cell} />);
      await waitForSpy(table, onRowsLoaded);
      table.update();
      let selectedCells = table.find(selectedCellClassName);
      expect(selectedCells.length).to.be.equal(6);
      table.setProps({ isCellSelected: undefined });
      table.update();
      selectedCells = table.find(selectedCellClassName);
      expect(selectedCells.length).to.be.equal(0);
    });

    it("does not display selected rows if selection target is cells", async () => {
      const isRowSelected = (): boolean => true;
      table.setProps({ isRowSelected });
      table.update();
      const selectedRows = table.find(selectedRowClassName);
      expect(selectedRows.length).to.be.equal(0);
    });

  });

});
