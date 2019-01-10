/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import * as enzyme from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import TestBackend from "react-dnd-test-backend";
import { BeDuration } from "@bentley/bentleyjs-core";
import { LocalUiSettings, HorizontalAlignment } from "@bentley/ui-core";
import {
  Table, TableDataProvider, RowItem, TableDataChangeEvent, TableDataChangesListener, CellItem,
  TableSelectionTarget, TableProps, ColumnDescription, SelectionMode, PropertyRecord, PropertyValue,
  PropertyValueFormat, PropertyDescription, PropertyUpdatedArgs, EditorContainer,
} from "../../../ui-components";
import { waitForSpy, ResolvablePromise } from "../../test-helpers/misc";
import { DragDropContext } from "react-dnd";
import { DragDropHeaderWrapper } from "../../../ui-components/table/component/DragDropHeaderCell";
import TestUtils from "../../TestUtils";

describe("Table", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  const rowClassName = "div.row";
  const tableWrapper = ".react-data-grid-wrapper";
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

  const columns: ColumnDescription[] = [
    { label: "label0", key: "key0", sortable: true },
    { label: "label1", key: "key1" },
    { label: "label2", key: "key2", editable: true },
  ];
  const onRowsLoaded = sinon.spy();
  const dataProviderMock = moq.Mock.ofType<TableDataProvider>();
  const tableDataChangeEventMock = moq.Mock.ofType<TableDataChangeEvent>();
  let table: enzyme.ReactWrapper<TableProps>;

  beforeEach(async () => {
    onRowsLoaded.resetHistory();
    tableDataChangeEventMock.reset();
    tableDataChangeEventMock.setup((x) => x.addListener(moq.It.isAny())).returns(() => moq.Mock.ofType<TableDataChangesListener>().object);
    dataProviderMock.reset();
    dataProviderMock.setup((x) => x.onColumnsChanged).returns(() => tableDataChangeEventMock.object);
    dataProviderMock.setup((x) => x.onRowsChanged).returns(() => tableDataChangeEventMock.object);
    dataProviderMock.setup(async (x) => x.getRowsCount()).returns(async () => 10);
    dataProviderMock.setup(async (x) => x.getRow(moq.It.isAnyNumber())).returns(async (index) => createRowItem(index));
    dataProviderMock.setup(async (x) => x.getColumns()).returns(async () => columns);
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
    strictDataProviderMock.setup(async (provider) => provider.getColumns()).returns(async () => []);
    strictDataProviderMock.setup(async (provider) => provider.getRowsCount()).returns(async () => 0);
    strictDataProviderMock.setup((a: any) => a.getRow(moq.It.isAnyNumber())).returns(async () => undefined);

    const shallowTable = enzyme.shallow(<Table dataProvider={dataProviderMock.object} />);
    await (shallowTable.instance() as Table).update();

    let iteration = 0;
    strictDataProviderMock.reset();
    strictDataProviderMock.setup(async (provider) => provider.getColumns()).returns(async () => []);
    strictDataProviderMock.setup(async (provider) => provider.getRowsCount()).returns(async () => 1);
    strictDataProviderMock.setup(async (provider) => provider.getRow(moq.It.isAnyNumber())).callback(async () => {
      iteration++;
      if (iteration >= 2) {
        // Change data provider while update is still going
        strictDataProviderMock.reset();
        strictDataProviderMock.setup(async (provider) => provider.getColumns()).returns(async () => []);
        strictDataProviderMock.setup(async (provider) => provider.getRowsCount()).returns(async () => 0);
        strictDataProviderMock.setup((provider: any) => provider.getRow(moq.It.isAnyNumber())).returns(async () => undefined);
        await (shallowTable.instance() as Table).update();
      }
    }).returns(async () => ({ key: "", cells: [] }));

    await (shallowTable.instance() as Table).update();
  });

  it("doesn't request data for intermediate column changes", async () => {
    const columnsPromise = new ResolvablePromise<ColumnDescription[]>();
    const dataProvider: TableDataProvider = {
      onColumnsChanged: new TableDataChangeEvent(),
      onRowsChanged: new TableDataChangeEvent(),
      getColumns: sinon.fake.returns(columnsPromise),
      getRowsCount: async () => 0,
      getRow: async () => undefined as any,
      sort: async () => { },
    };

    const shallowTable = enzyme.shallow(<Table dataProvider={dataProvider} />);
    expect(dataProvider.getColumns).to.be.calledOnce;

    for (let i = 0; i < 5; ++i)
      dataProvider.onColumnsChanged.raiseEvent();

    columnsPromise.resolve([]);

    await (shallowTable.instance() as Table).update();
    expect(dataProvider.getColumns).to.be.calledTwice;
  });

  it("doesn't request data for intermediate row changes", async () => {
    const rowsCountPromise = new ResolvablePromise<number>();
    const dataProvider: TableDataProvider = {
      onColumnsChanged: new TableDataChangeEvent(),
      onRowsChanged: new TableDataChangeEvent(),
      getColumns: async () => [],
      getRowsCount: sinon.fake.returns(rowsCountPromise),
      getRow: async () => undefined as any,
      sort: async () => { },
    };

    const shallowTable = enzyme.shallow(<Table dataProvider={dataProvider} />);
    await BeDuration.wait(0); // allow pending promises to finish
    expect(dataProvider.getRowsCount).to.be.calledOnce;

    for (let i = 0; i < 5; ++i)
      dataProvider.onRowsChanged.raiseEvent();

    rowsCountPromise.resolve(0);

    await (shallowTable.instance() as Table).update();
    await BeDuration.wait(0); // allow pending promises to finish
    expect(dataProvider.getRowsCount).to.be.calledTwice;
  });

  describe("rendering", () => {

    describe("with cell styles", () => {

      const toColor = (hex: string): number => parseInt(hex, 16);
      const testRecord = (): PropertyRecord => {
        const value: PropertyValue = {
          value: 123,
          displayValue: "123",
          valueFormat: PropertyValueFormat.Primitive,
        };
        const descr: PropertyDescription = {
          name: "1",
          typename: "int",
          displayLabel: "column",
        };
        return new PropertyRecord(value, descr);
      };

      let rowData: RowItem[];

      beforeEach(async () => {
        rowData = [{
          key: "no_overrides",
          cells: [{ key: "1", record: testRecord() }],
        }, {
          key: "row_overrides",
          cells: [{ key: "1", record: testRecord() }],
          colorOverrides: {
            backColor: toColor("0xff0000"),
            backColorSelected: toColor("0xff00ff"),
            foreColor: toColor("0x00ff00"),
            foreColorSelected: toColor("0x00ffff"),
          },
        }, {
          key: "cell_overrides",
          cells: [{
            key: "1",
            record: testRecord(),
            isBold: true,
            isItalic: true,
            alignment: HorizontalAlignment.Right,
            colorOverrides: {
              backColor: toColor("0xaa0000"),
              backColorSelected: toColor("0xaa00aa"),
              foreColor: toColor("0x00aa00"),
              foreColorSelected: toColor("0x00aaaa"),
            },
          }],
        }, {
          key: "row_and_cell_overrides",
          cells: [{
            key: "1",
            record: testRecord(),
            isBold: true,
            isItalic: true,
            alignment: HorizontalAlignment.Justify,
            colorOverrides: {
              backColor: toColor("0xaa0000"),
              backColorSelected: toColor("0xaa00aa"),
              foreColor: toColor("0x00aa00"),
              foreColorSelected: toColor("0x00aaaa"),
            },
          }],
          colorOverrides: {
            backColor: toColor("0xff0000"),
            backColorSelected: toColor("0xff00ff"),
            foreColor: toColor("0x00ff00"),
            foreColorSelected: toColor("0x00ffff"),
          },
        }];
        const onColumnsChanged = new TableDataChangeEvent();
        const onRowsChanged = new TableDataChangeEvent();
        const dataProvider: TableDataProvider = {
          getColumns: async (): Promise<ColumnDescription[]> => [{ key: "1", label: "Column" }],
          getRowsCount: async () => rowData.length,
          getRow: async (index: number) => rowData[index],
          sort: async () => { },
          onColumnsChanged,
          onRowsChanged,
        };
        table = enzyme.mount(<Table
          dataProvider={dataProvider}
          onRowsLoaded={onRowsLoaded}
        />);
        await waitForSpy(onRowsLoaded);
        table.update();
      });

      it("renders cells with different style properties", async () => {
        const rows = table.find(rowClassName);
        expect(rows.length).to.eq(4);

        const cells = table.find(cellClassName);
        expect(cells.length).to.eq(4);

        const styleInfo = (index: number) => ({
          row: rows.at(index).prop("style") as React.CSSProperties,
          cell: cells.at(index).find("span").prop("style") as React.CSSProperties,
        });

        const withNoStyling = styleInfo(0);
        expect(withNoStyling.row.backgroundColor).to.be.undefined;
        expect(withNoStyling.row.color).to.be.undefined;
        expect(withNoStyling.cell.fontWeight).to.be.undefined;
        expect(withNoStyling.cell.fontStyle).to.be.undefined;
        expect(withNoStyling.cell.textAlign).to.be.undefined;
        expect(withNoStyling.cell.backgroundColor).to.be.undefined;
        expect(withNoStyling.cell.color).to.be.undefined;

        const withRowStyling = styleInfo(1);
        expect(withRowStyling.row.backgroundColor).to.eq("#ff0000");
        expect(withRowStyling.row.color).to.eq("#00ff00");
        expect(withRowStyling.cell.fontWeight).to.be.undefined;
        expect(withRowStyling.cell.fontStyle).to.be.undefined;
        expect(withRowStyling.cell.textAlign).to.be.undefined;
        expect(withRowStyling.cell.backgroundColor).to.be.undefined;
        expect(withRowStyling.cell.color).to.be.undefined;

        const withCellStyling = styleInfo(2);
        expect(withCellStyling.row.backgroundColor).to.be.undefined;
        expect(withCellStyling.row.color).to.be.undefined;
        expect(withCellStyling.cell.fontWeight).to.eq("bold");
        expect(withCellStyling.cell.fontStyle).to.eq("italic");
        expect(withCellStyling.cell.textAlign).to.eq("right");
        expect(withCellStyling.cell.backgroundColor).to.eq("#aa0000");
        expect(withCellStyling.cell.color).to.eq("#00aa00");

        const withRowAndCellStyling = styleInfo(3);
        expect(withRowAndCellStyling.row.backgroundColor).to.eq("#ff0000");
        expect(withRowAndCellStyling.row.color).to.eq("#00ff00");
        expect(withRowAndCellStyling.cell.fontWeight).to.eq("bold");
        expect(withRowAndCellStyling.cell.fontStyle).to.eq("italic");
        expect(withRowAndCellStyling.cell.textAlign).to.eq("justify");
        expect(withRowAndCellStyling.cell.backgroundColor).to.eq("#aa0000");
        expect(withRowAndCellStyling.cell.color).to.eq("#00aa00");
      });

    });

  });

  describe("selection", () => {

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

    before(() => {
      // https://github.com/Microsoft/TypeScript/issues/14151#issuecomment-280812617
      // tslint:disable-next-line:no-string-literal
      if (Symbol["asyncIterator"] === undefined) ((Symbol as any)["asyncIterator"]) = Symbol.for("asyncIterator");
    });

    describe("row", () => {

      const onRowsSelectedCallbackMock = moq.Mock.ofType<(rows: AsyncIterableIterator<RowItem>, replace: boolean) => Promise<boolean>>();
      const onRowsDeselectedCallbackMock = moq.Mock.ofType<(rows: AsyncIterableIterator<RowItem>) => Promise<boolean>>();

      let selectedRowsIterator: AsyncIterableIterator<RowItem> | undefined;
      let deselectedRowsIterator: AsyncIterableIterator<RowItem> | undefined;

      beforeEach(async () => {
        onRowsSelectedCallbackMock.reset();
        onRowsDeselectedCallbackMock.reset();

        onRowsSelectedCallbackMock.setup(async (x) => x(moq.It.isAny(), moq.It.isAny())).callback((iterator: AsyncIterableIterator<RowItem>) => { selectedRowsIterator = iterator; });
        onRowsDeselectedCallbackMock.setup(async (x) => x(moq.It.isAny())).callback((iterator: AsyncIterableIterator<RowItem>) => { deselectedRowsIterator = iterator; });

        table = enzyme.mount(<Table
          dataProvider={dataProviderMock.object}
          onRowsSelected={onRowsSelectedCallbackMock.object}
          onRowsDeselected={onRowsDeselectedCallbackMock.object}
          tableSelectionTarget={TableSelectionTarget.Row}
          onRowsLoaded={onRowsLoaded}
        />);
        await waitForSpy(onRowsLoaded);
        table.update();
      });

      describe("Single", () => {

        it("selects a row", async () => {
          table.update();
          const row = table.find(rowClassName).first();
          row.simulate("click");

          await verifyRowIterator(["0"], selectedRowsIterator);
          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          expect(table.find(selectedRowClassName).length).to.be.equal(1);
        });

        it.skip("deselects other rows when selects a row", async () => {
          const isRowSelected = () => true;
          table.setProps({ isRowSelected });
          table.update();
          expect(table.find(selectedRowClassName).length).to.be.greaterThan(1);
          const row = table.find(rowClassName).first();
          row.simulate("click");

          await verifyRowIterator(["0"], selectedRowsIterator);
          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          onRowsDeselectedCallbackMock.verify(async (x) => x(moq.It.isAny()), moq.Times.never());
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

          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
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

          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
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

          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), false), moq.Times.exactly(2));
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
          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), false), moq.Times.once());
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
          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), false), moq.Times.once());
          onRowsDeselectedCallbackMock.verify(async (x) => x(moq.It.isAny()), moq.Times.once());
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

          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          onRowsDeselectedCallbackMock.verify(async (x) => x(moq.It.isAny()), moq.Times.once());
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
        await waitForSpy(onRowsLoaded);
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
        await waitForSpy(onRowsLoaded);
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

    describe("cell", () => {

      const onCellsSelectedCallbackMock = moq.Mock.ofType<(cells: AsyncIterableIterator<[RowItem, CellItem]>, replace: boolean) => Promise<boolean>>();
      const onCellsDeselectedCallbackMock = moq.Mock.ofType<(cells: AsyncIterableIterator<[RowItem, CellItem]>) => Promise<boolean>>();

      let selectedCellsIterator: AsyncIterableIterator<[RowItem, CellItem]> | undefined;
      let deselectedCellsIterator: AsyncIterableIterator<[RowItem, CellItem]> | undefined;

      beforeEach(async () => {
        onCellsSelectedCallbackMock.reset();
        onCellsDeselectedCallbackMock.reset();

        onCellsSelectedCallbackMock.setup(async (x) => x(moq.It.isAny(), moq.It.isAny())).callback(async (iterator: AsyncIterableIterator<[RowItem, CellItem]>) => { selectedCellsIterator = iterator; });
        onCellsDeselectedCallbackMock.setup(async (x) => x(moq.It.isAny())).callback(async (iterator: AsyncIterableIterator<[RowItem, CellItem]>) => { deselectedCellsIterator = iterator; });

        table = enzyme.mount(<Table
          dataProvider={dataProviderMock.object}
          onCellsSelected={onCellsSelectedCallbackMock.object}
          onCellsDeselected={onCellsDeselectedCallbackMock.object}
          tableSelectionTarget={TableSelectionTarget.Cell}
          onRowsLoaded={onRowsLoaded}
        />);
        await waitForSpy(onRowsLoaded);
        table.update();
      });

      describe("Single", () => {

        it("selects a cell", async () => {
          const cell = table.find(cellClassName).first();
          cell.simulate("click");
          await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
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
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          onCellsDeselectedCallbackMock.verify(async (x) => x(moq.It.isAny()), moq.Times.never());
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
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
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
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
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
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
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
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
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

          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), false), moq.Times.exactly(2));
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

          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), false), moq.Times.once());
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
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), false), moq.Times.once());
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
          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), false), moq.Times.once());
          onCellsDeselectedCallbackMock.verify(async (x) => x(moq.It.isAny()), moq.Times.once());
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

          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          onCellsDeselectedCallbackMock.verify(async (x) => x(moq.It.isAny()), moq.Times.once());
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
        await waitForSpy(onRowsLoaded);
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
        await waitForSpy(onRowsLoaded);
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

  describe("sort", () => {

    it.skip("clicking on a sortable column heading should sort", async () => {
      // Simulate clicking on the header for sort
      const headerCellDiv = table.find("div.react-grid-HeaderCell-sortable");
      headerCellDiv.simulate("click");  // Ascending
      headerCellDiv.simulate("click");  // Descending
      headerCellDiv.simulate("click");  // NoSort
    });

  });

  describe("cell editing", async () => {

    const newPropertyValue = "My new value";
    const handlePropertyUpdated = async (args: PropertyUpdatedArgs): Promise<boolean> => {
      let updated = false;

      if (args.propertyRecord) {
        expect(args.newValue).to.eq(newPropertyValue);
        args.propertyRecord = args.propertyRecord.copyWithNewValue(args.newValue);
        updated = true;
      }

      return updated;
    };
    const onPropertyEditing = sinon.spy();
    const onPropertyUpdated = sinon.spy(handlePropertyUpdated);

    beforeEach(async () => {
      onPropertyEditing.resetHistory();
      onPropertyUpdated.resetHistory();
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        onPropertyEditing={onPropertyEditing}
        onPropertyUpdated={onPropertyUpdated}
      />);
      await waitForSpy(onRowsLoaded);
      table.update();
    });

    it("clicking on an editor cell after selection should start editing", async () => {
      // Simulate clicking on the cell to edit
      table.update();
      table.setState({ cellEditorState: { active: false } });

      let row = table.find(rowClassName).first();
      row.simulate("click");
      expect(table.find(selectedRowClassName).length).to.be.equal(1);

      // Click 3rd cell in row (marked as editable)
      const cellDiv = row.find(cellClassName).at(2);
      cellDiv.simulate("click");

      expect(onPropertyEditing.calledOnce).to.be.true;

      table.update();
      row = table.find(rowClassName).first();

      const editorContainer = row.find(EditorContainer);
      expect(editorContainer.length).to.equal(1);

      const inputNode = editorContainer.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.simulate("change", { target: { value: newPropertyValue } });
      inputNode.simulate("keyDown", { key: "Enter" });

      setImmediate(() => {
        expect(onPropertyUpdated.calledOnce).to.be.true;
      });
    });

  });

  describe("column drag and drop", async () => {

    beforeEach(async () => {
      const DragDropTable = DragDropContext(TestBackend)(Table); // tslint:disable-line:variable-name
      table = enzyme.mount(<DragDropTable
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        reorderableColumns={true}
      />);
      await waitForSpy(onRowsLoaded);
      table.update();
    });

    it("should begin and end drag", () => {
      const instance = table.instance() as any;
      const backend = instance.getManager().getBackend();
      const head = table.find(DragDropHeaderWrapper);
      expect(head).to.exist;
      const firstInstance = head.at(1).instance() as any;
      backend.simulateBeginDrag([firstInstance.getHandlerId()]);
      backend.simulateEndDrag();
    });

  });

  describe("columns show/hide", async () => {

    const storageMock = () => {
      const storage: { [key: string]: any } = {};
      return {
        setItem: (key: string, value: string) => {
          storage[key] = value || "";
        },
        getItem: (key: string) => {
          return key in storage ? storage[key] : null;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
        get length() {
          return Object.keys(storage).length;
        },
        key: (i: number) => {
          const keys = Object.keys(storage);
          return keys[i] || null;
        },
      };
    };

    beforeEach(async () => {
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        settingsIdentifier="test"
        showHideColumns={true}
        uiSettings={new LocalUiSettings({ localStorage: storageMock() } as Window)}
      />);
      await waitForSpy(onRowsLoaded);
      table.update();
    });

    it("should open context menu", () => {
      const t = table.find(tableWrapper);
      t.simulate("contextmenu", { currentTarget: t, clientX: -1, clientY: -1 });
    });

  });

});
