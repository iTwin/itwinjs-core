/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import * as enzyme from "enzyme";
import * as React from "react";
import { wrapInTestContext } from "react-dnd-test-utils";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import * as moq from "typemoq";
import { BeDuration } from "@itwin/core-bentley";
import { PrimitiveValue, PropertyConverterInfo, PropertyDescription, PropertyRecord, PropertyValue, PropertyValueFormat, SpecialKey } from "@itwin/appui-abstract";
import { HorizontalAlignment, LocalStateStorage } from "@itwin/core-react";
import {
  CellItem, ColumnDescription, PropertyUpdatedArgs, PropertyValueRendererManager, RowItem, SelectionMode, Table, TableDataChangeEvent,
  TableDataChangesListener, TableDataProvider, TableProps, TableSelectionTarget,
} from "../../../components-react";
import { DragDropHeaderWrapper } from "../../../components-react/table/component/DragDropHeaderCell";
import { SimpleTableDataProvider } from "../../../components-react/table/SimpleTableDataProvider";
import { FilterRenderer } from "../../../components-react/table/TableDataProvider";
import { ResolvablePromise, waitForSpy } from "../../test-helpers/misc";
import TestUtils from "../../TestUtils";
let columnIndex = 0;
let useSmallWidth = false;

describe("Table", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();

  });

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  beforeEach(() => {
    sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
      if (this.classList.contains("react-grid-Container")) {
        const totalTableWidth = useSmallWidth ? 160 : 250;
        return DOMRect.fromRect({ width: totalTableWidth, height: 500 });
      } else if (this.classList.contains("react-grid-Cell") || this.classList.contains("react-grid-HeaderCell")) {
        columnIndex = columnIndex + 1;
        switch (columnIndex) {
          case 1:
            return DOMRect.fromRect({ width: 80 });
          case 2:
            return DOMRect.fromRect({ width: 90 });
          case 3:
            return DOMRect.fromRect({ width: 80 });
          default:
            return DOMRect.fromRect({ width: 80 });
        }
      }
      return new DOMRect();
    });
  });

  const rowClassName = "div.components-table-row";
  const tableWrapper = ".components-table";
  const selectedRowClassName = "div.react-grid-Row.row-selected";
  const cellClassName = "div.components-table-cell";
  const selectedCellClassName = "div.components-table-cell.is-selected";
  const gridCellClassName = "div.react-grid-Cell";

  const borderTopClassName = "border-top";
  const borderRightClassName = "border-right";
  const borderBottomClassName = "border-bottom";
  const borderLeftClassName = "border-left";

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
    { label: "label0", key: "key0", sortable: true, editable: true },
    { label: "label1", key: "key1", resizable: true },
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

    enzyme.shallow(<Table dataProvider={dataProvider} />);
    expect(dataProvider.getColumns).to.be.calledOnce;

    for (let i = 0; i < 5; ++i)
      dataProvider.onColumnsChanged.raiseEvent();

    await columnsPromise.resolve([]);

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

    enzyme.shallow(<Table dataProvider={dataProvider} />);
    await BeDuration.wait(0); // allow pending promises to finish
    expect(dataProvider.getRowsCount).to.be.calledOnce;

    for (let i = 0; i < 5; ++i)
      dataProvider.onRowsChanged.raiseEvent();

    await rowsCountPromise.resolve(0);

    expect(dataProvider.getRowsCount).to.be.calledTwice;
  });

  describe("rendering", () => {
    const testRecord = (): PropertyRecord => {
      const value: PropertyValue = {
        value: 123,
        displayValue: "123",
        valueFormat: PropertyValueFormat.Primitive,
      };
      const description: PropertyDescription = {
        name: "1",
        typename: "int",
        displayLabel: "column",
      };
      return new PropertyRecord(value, description);
    };

    let rowData: RowItem[];

    describe("with cell styles", () => {

      const toColor = (hex: string): number => parseInt(hex, 16);

      beforeEach(async () => {
        rowData = [{
          key: "no_overrides",
          cells: [{ key: "1", record: testRecord() }],
        }, {
          key: "row_overrides",
          cells: [{ key: "1", record: testRecord() }],
          colorOverrides: {
            backgroundColor: toColor("0xff0000"),
            backgroundColorSelected: toColor("0xff00ff"),
            color: toColor("0x00ff00"),
            colorSelected: toColor("0x00ffff"),
          },
        }, {
          key: "cell_overrides",
          cells: [{
            key: "1",
            record: testRecord(),
            alignment: HorizontalAlignment.Right,
            style: {
              isBold: true,
              isItalic: true,
              colorOverrides: {
                backgroundColor: toColor("0xaa0000"),
                backgroundColorSelected: toColor("0xaa00aa"),
                color: toColor("0x00aa00"),
                colorSelected: toColor("0x00aaaa"),
              },
            },
          }],
        }, {
          key: "row_and_cell_overrides",
          cells: [{
            key: "1",
            record: testRecord(),
            alignment: HorizontalAlignment.Justify,
            style: {
              isBold: true,
              isItalic: true,

              colorOverrides: {
                backgroundColor: toColor("0xaa0000"),
                backgroundColorSelected: toColor("0xaa00aa"),
                color: toColor("0x00aa00"),
                colorSelected: toColor("0x00aaaa"),
              },
            },
          }],
          colorOverrides: {
            backgroundColor: toColor("0xff0000"),
            backgroundColorSelected: toColor("0xff00ff"),
            color: toColor("0x00ff00"),
            colorSelected: toColor("0x00ffff"),
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

    describe("without cell styles (three column)", () => {

      beforeEach(async () => {
        columnIndex = 0;
        rowData = [{
          key: "no_overrides",
          cells: [
            { key: "1", record: testRecord(), mergedCellsCount: 3 },
            { key: "2", record: testRecord() },
            { key: "3", record: testRecord() }],
        }];
        const onColumnsChanged = new TableDataChangeEvent();
        const onRowsChanged = new TableDataChangeEvent();
        const dataProvider: TableDataProvider = {
          getColumns: async (): Promise<ColumnDescription[]> => [
            { key: "1", label: "Column1" },
            { key: "2", label: "Column2", width: 90, resizable: true },
            { key: "3", label: "Column3" }],
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

      afterEach(() => {
        columnIndex = 0;
      });

      const cellWidth = (cellContainer: enzyme.ReactWrapper<enzyme.HTMLAttributes, any, React.Component<{}, {}, any>>, index: number) => (cellContainer.at(index).prop("style")?.width as number);

      it("renders cells which have mergedCells specified", async () => {
        useSmallWidth = false;
        const rows = table.find(rowClassName);
        expect(rows.length).to.eq(1);

        const cells = table.find(cellClassName);
        const gridCells = table.find(gridCellClassName);
        expect(cells.length).to.eq(3);
        expect(gridCells.length).to.eq(3);

        expect(cellWidth(gridCells, 0)).to.eq(80);
        expect(cellWidth(gridCells, 1)).to.eq(90);
        expect(cellWidth(gridCells, 2)).to.eq(80);

        expect(cellWidth(cells, 0)).to.be.eq(cellWidth(gridCells, 0) + cellWidth(gridCells, 1) + cellWidth(gridCells, 2));
        expect(cells.at(0).prop("title")).to.be.eq("123");
        expect(cells.at(1).prop("title")).to.be.eq("empty-cell");
        expect(cells.at(2).prop("title")).to.be.eq("empty-cell");
      });
    });

    describe("without cell styles (two column)", () => {

      beforeEach(async () => {
        useSmallWidth = true;
        columnIndex = 0;
        rowData = [{
          key: "no_overrides",
          cells: [
            { key: "1", record: testRecord(), mergedCellsCount: 3 },
            { key: "2", record: testRecord() },
            { key: "3", record: testRecord() }],
        }];
        const onColumnsChanged = new TableDataChangeEvent();
        const onRowsChanged = new TableDataChangeEvent();
        const dataProvider: TableDataProvider = {
          getColumns: async (): Promise<ColumnDescription[]> => [
            { key: "1", label: "Column1" },
            { key: "2", label: "Column2", width: 90, resizable: true },
            { key: "3", label: "Column3" }],
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

      afterEach(() => {
        columnIndex = 0;
      });

      const cellWidth = (cellContainer: enzyme.ReactWrapper<enzyme.HTMLAttributes, any, React.Component<{}, {}, any>>, index: number) => (cellContainer.at(index).prop("style")?.width as number);

      it("renders cells which have mergedCells specified and doesn't count cells, which are hidden", async () => {

        table.setState({ hiddenColumns: ["2"] });

        const rows = table.find(rowClassName);
        expect(rows.length).to.eq(1);

        const cells = table.find(cellClassName);
        const gridCells = table.find(gridCellClassName);
        expect(cells.length).to.eq(2);
        expect(gridCells.length).to.eq(2);

        expect(cellWidth(cells, 0)).to.be.eq(cellWidth(gridCells, 0) + cellWidth(gridCells, 1));

        expect(cells.at(0).prop("title")).to.be.eq("123");
        expect(cells.at(1).prop("title")).to.be.eq("empty-cell");
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
      expect(actualItems.length).to.be.equal(expectedItemKeys.length);
      for (let i = 0; i < expectedItemKeys.length; i++) {
        expect(actualItems.find((x) => x.key === expectedItemKeys[i], `expectedItemKeys[${i}]`)).to.not.be.undefined;
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
        expect(actualItems.find((x) => x[1].key === expectedItemKeys[i].columnKey && x[0].key === expectedItemKeys[i].rowKey), `expectedItemKeys[${i}]`).to.not.be.undefined;
      }
    };

    function expectCellBorders(cell: enzyme.ReactWrapper<enzyme.HTMLAttributes>, expectedBorders: string[]) {
      const remainingBorders = new Set([borderTopClassName, borderRightClassName, borderBottomClassName, borderLeftClassName]);
      for (const border of expectedBorders) {
        expect(cell.hasClass(border)).to.be.true;
        remainingBorders.delete(border);
      }

      for (const border of remainingBorders) {
        expect(cell.hasClass(border)).to.be.false;
      }
    }

    const onRowsSelectedCallbackMock = moq.Mock.ofType<(rows: AsyncIterableIterator<RowItem>, replace: boolean) => Promise<boolean>>();
    const onRowsDeselectedCallbackMock = moq.Mock.ofType<(rows: AsyncIterableIterator<RowItem>) => Promise<boolean>>();
    let selectedRowsIterator: AsyncIterableIterator<RowItem> | undefined;
    let deselectedRowsIterator: AsyncIterableIterator<RowItem> | undefined;

    const onCellsSelectedCallbackMock = moq.Mock.ofType<(cells: AsyncIterableIterator<[RowItem, CellItem]>, replace: boolean) => Promise<boolean>>();
    const onCellsDeselectedCallbackMock = moq.Mock.ofType<(cells: AsyncIterableIterator<[RowItem, CellItem]>) => Promise<boolean>>();
    let selectedCellsIterator: AsyncIterableIterator<[RowItem, CellItem]> | undefined;
    let deselectedCellsIterator: AsyncIterableIterator<[RowItem, CellItem]> | undefined;

    beforeEach(() => {
      onRowsSelectedCallbackMock.reset();
      onRowsDeselectedCallbackMock.reset();
      onRowsSelectedCallbackMock.setup(async (x) => x(moq.It.isAny(), moq.It.isAny())).callback((iterator: AsyncIterableIterator<RowItem>) => { selectedRowsIterator = iterator; });
      onRowsDeselectedCallbackMock.setup(async (x) => x(moq.It.isAny())).callback((iterator: AsyncIterableIterator<RowItem>) => { deselectedRowsIterator = iterator; });

      onCellsSelectedCallbackMock.reset();
      onCellsDeselectedCallbackMock.reset();
      onCellsSelectedCallbackMock.setup(async (x) => x(moq.It.isAny(), moq.It.isAny())).callback(async (iterator: AsyncIterableIterator<[RowItem, CellItem]>) => { selectedCellsIterator = iterator; });
      onCellsDeselectedCallbackMock.setup(async (x) => x(moq.It.isAny())).callback(async (iterator: AsyncIterableIterator<[RowItem, CellItem]>) => { deselectedCellsIterator = iterator; });
    });

    describe("row", () => {
      const onPropertyEditing = sinon.spy();

      beforeEach(async () => {
        onPropertyEditing.resetHistory();

        table = enzyme.mount(<Table
          dataProvider={dataProviderMock.object}
          onRowsSelected={onRowsSelectedCallbackMock.object}
          onRowsDeselected={onRowsDeselectedCallbackMock.object}
          onCellsSelected={onCellsSelectedCallbackMock.object}
          onCellsDeselected={onCellsDeselectedCallbackMock.object}
          onPropertyEditing={onPropertyEditing}
          tableSelectionTarget={TableSelectionTarget.Row}
          onRowsLoaded={onRowsLoaded}
        />);
        await waitForSpy(onRowsLoaded);
        table.update();
      });

      describe("Single", () => {

        it("selects a row", async () => {
          const row = table.find(rowClassName).first();
          row.simulate("click");

          await verifyRowIterator(["0"], selectedRowsIterator);
          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.once());
          expect(table.find(selectedRowClassName).length).to.be.equal(1);
        });

        it("selects a row with keys", async () => {
          const tableInstance = table.instance() as Table;
          const row = table.find(rowClassName).first();
          row.simulate("click");
          await verifyRowIterator(["0"], selectedRowsIterator);
          expect(tableInstance.state.keyboardEditorCellKey).to.eq("key0");

          const t = table.find(tableWrapper);
          t.simulate("keyDown", { key: SpecialKey.ArrowDown });
          t.simulate("keyUp", { key: SpecialKey.ArrowDown });
          await verifyRowIterator(["1"], selectedRowsIterator);
          expect(tableInstance.state.keyboardEditorCellKey).to.eq("key0");

          t.simulate("keyDown", { key: SpecialKey.ArrowRight });
          t.simulate("keyUp", { key: SpecialKey.ArrowRight });
          expect(tableInstance.state.keyboardEditorCellKey).to.eq("key2");

          t.simulate("keyDown", { key: SpecialKey.ArrowLeft });
          t.simulate("keyUp", { key: SpecialKey.ArrowLeft });
          expect(tableInstance.state.keyboardEditorCellKey).to.eq("key0");

          t.simulate("keyDown", { key: SpecialKey.ArrowLeft });
          t.simulate("keyUp", { key: SpecialKey.ArrowLeft });
          expect(tableInstance.state.keyboardEditorCellKey).to.eq("key2");

          t.simulate("keyDown", { key: SpecialKey.ArrowRight });
          t.simulate("keyUp", { key: SpecialKey.ArrowRight });
          expect(tableInstance.state.keyboardEditorCellKey).to.eq("key0");

          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(2));
          expect(table.find(selectedRowClassName).length).to.be.equal(1);
        });

        it("activates a cell editor with keys", async () => {
          const row = table.find(rowClassName).first();
          row.simulate("click");
          await verifyRowIterator(["0"], selectedRowsIterator);

          const tableInstance = table.instance() as Table;
          expect(tableInstance.state.keyboardEditorCellKey).to.eq("key0");

          const t = table.find(tableWrapper);
          t.simulate("keyDown", { key: SpecialKey.Space });
          t.simulate("keyUp", { key: SpecialKey.Space });

          expect(onPropertyEditing.calledOnce).to.be.true;
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
        let buttonElement: HTMLElement;

        beforeEach(() => {
          table.setProps({ selectionMode: SelectionMode.Extended });

          buttonElement = document.createElement("button");
          document.body.appendChild(buttonElement);
          buttonElement.focus();
        });

        afterEach(() => {
          document.body.removeChild(buttonElement);
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

        it("shift select rows from top to bottom with keys", async () => {
          const rows = table.find(rowClassName);
          const row0 = rows.at(0);
          row0.simulate("click");
          await verifyRowIterator(["0"], selectedRowsIterator);

          const t = table.find(tableWrapper);
          t.simulate("keyDown", { key: SpecialKey.ArrowDown, shiftKey: true });
          t.simulate("keyUp", { key: SpecialKey.ArrowDown, shiftKey: true });
          t.simulate("keyDown", { key: SpecialKey.ArrowDown, shiftKey: true });
          t.simulate("keyUp", { key: SpecialKey.ArrowDown, shiftKey: true });
          await verifyRowIterator(["0", "1", "2"], selectedRowsIterator);

          onRowsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(3));
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
        table = enzyme.mount(<Table dataProvider={dataProviderMock.object} isRowSelected={isRowSelected} onRowsLoaded={onRowsLoaded}
          selectionMode={SelectionMode.SingleAllowDeselect} />);
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
        const selectedCells = table.find("div.components-table-cell.is-selected");
        expect(selectedCells.length).to.be.equal(0);
      });

      it("does not restore row selection when switching back from cell selection mode", async () => {
        // Select a row while in row selection mode
        const row = table.find(rowClassName).first();
        row.simulate("click");
        await verifyRowIterator(["0"], selectedRowsIterator);

        // Switch to cell selection mode and select a cell
        table.setProps({ tableSelectionTarget: TableSelectionTarget.Cell });
        const cell = table.find(cellClassName).at(3);
        cell.simulate("click");
        await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }], selectedCellsIterator);
        expect(table.find(selectedRowClassName).length).to.equal(0);

        // Switch back to row selection mode and check selections
        table.setProps({ tableSelectionTarget: TableSelectionTarget.Row });
        expect(table.find(selectedRowClassName).length).to.be.equal(0);
      });

      describe("border styles", () => {

        it("adds outer borders", async () => {
          // Select a middle row
          table.find(rowClassName).at(1).simulate("click");
          await verifyRowIterator(["1"], selectedRowsIterator);

          const row = table.find(selectedRowClassName).first();
          // Bottom border is not drawn here - it is drawn as top border on the row below
          expectCellBorders(row.find(cellClassName).at(0), [borderTopClassName, borderLeftClassName]);
          expectCellBorders(row.find(cellClassName).at(1), [borderTopClassName]);
          expectCellBorders(row.find(cellClassName).at(2), [borderTopClassName, borderRightClassName]);

          const rowBelow = table.find(rowClassName).at(2);
          rowBelow.find(cellClassName).forEach((cell) => expectCellBorders(cell, [borderTopClassName]));
        });

        it("adds top border styles when the first row is selected", async () => {
          // Select the first row
          table.find(rowClassName).first().simulate("click");
          await verifyRowIterator(["0"], selectedRowsIterator);

          const firstRow = table.find(rowClassName).first();
          firstRow.find(cellClassName).forEach((cell) => expect(cell.hasClass(borderTopClassName)).to.be.true);
        });

        it("adds bottom border styles when the last row is selected", async () => {
          // Select the last row
          table.find(rowClassName).last().simulate("click");
          await verifyRowIterator(["9"], selectedRowsIterator);

          const lastRow = table.find(rowClassName).last();
          lastRow.find(cellClassName).forEach((cell) => expect(cell.hasClass(borderBottomClassName)).to.be.true);
        });

        it("does not add borders in between consecutively selected rows ", async () => {
          table.setProps({ selectionMode: SelectionMode.Multiple });

          // Select the first and the second rows
          table.find(rowClassName).at(0).simulate("click");
          await verifyRowIterator(["0"], selectedRowsIterator);
          table.find(rowClassName).at(1).simulate("click");
          await verifyRowIterator(["1"], selectedRowsIterator);

          const rows = table.find(rowClassName);
          rows.at(0).find(cellClassName).forEach((cell) => expect(cell.hasClass(borderBottomClassName)).to.be.false);
          rows.at(1).find(cellClassName).forEach((cell) => expect(cell.hasClass(borderTopClassName)).to.be.false);
        });
      });
    });

    describe("cell", () => {
      const onPropertyEditing = sinon.spy();

      beforeEach(async () => {
        onPropertyEditing.resetHistory();

        table = enzyme.mount(<Table
          dataProvider={dataProviderMock.object}
          onRowsSelected={onRowsSelectedCallbackMock.object}
          onRowsDeselected={onRowsDeselectedCallbackMock.object}
          onCellsSelected={onCellsSelectedCallbackMock.object}
          onCellsDeselected={onCellsDeselectedCallbackMock.object}
          onPropertyEditing={onPropertyEditing}
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

        it("selects a cell with keys", async () => {
          const cell = table.find(cellClassName).first();
          cell.simulate("click");
          await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);

          const t = table.find(tableWrapper);
          t.simulate("keyDown", { key: SpecialKey.ArrowDown });
          t.simulate("keyUp", { key: SpecialKey.ArrowDown });
          await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }], selectedCellsIterator);

          t.simulate("keyDown", { key: SpecialKey.ArrowRight });
          t.simulate("keyUp", { key: SpecialKey.ArrowRight });
          await verifyCellIterator([{ rowKey: "1", columnKey: "key1" }], selectedCellsIterator);

          t.simulate("keyDown", { key: SpecialKey.ArrowLeft });
          t.simulate("keyUp", { key: SpecialKey.ArrowLeft });
          await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }], selectedCellsIterator);

          t.simulate("keyDown", { key: SpecialKey.ArrowLeft });
          t.simulate("keyUp", { key: SpecialKey.ArrowLeft });
          await verifyCellIterator([{ rowKey: "1", columnKey: "key2" }], selectedCellsIterator);

          t.simulate("keyDown", { key: SpecialKey.ArrowRight });
          t.simulate("keyUp", { key: SpecialKey.ArrowRight });
          await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }], selectedCellsIterator);

          onCellsSelectedCallbackMock.verify(async (x) => x(moq.It.isAny(), true), moq.Times.exactly(6));
          expect(table.find(selectedCellClassName).length).to.be.equal(1);
        });

        it("activates a cell editor with keys", async () => {
          // Click 3rd cell in row (marked as editable)
          const cell = table.find(cellClassName).at(2);

          cell.simulate("click");
          await verifyCellIterator([{ rowKey: "0", columnKey: "key2" }], selectedCellsIterator);

          const t = table.find(tableWrapper);
          t.simulate("keyDown", { key: SpecialKey.Space });
          t.simulate("keyUp", { key: SpecialKey.Space });

          expect(onPropertyEditing.calledOnce).to.be.true;
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

      it("does not restore cell selection when switching back from row selection mode", async () => {
        // Select a cell while in cell selection mode
        const cell = table.find(cellClassName).first();
        cell.simulate("click");
        await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);

        // Switch to row selection mode and select a row
        table.setProps({ tableSelectionTarget: TableSelectionTarget.Row });
        const row = table.find(rowClassName).at(1);
        row.simulate("click");
        await verifyRowIterator(["1"], selectedRowsIterator);
        expect(table.find(selectedCellClassName).length).to.be.equal(0);

        // Switch back to cell selection mode and check selections
        table.setProps({ tableSelectionTarget: TableSelectionTarget.Cell });
        expect(table.find(selectedCellClassName).length).to.be.equal(0);
      });

      describe("border styles", () => {

        it("adds outer borders", async () => {
          // Select a middle cell
          table.find(cellClassName).at(4).simulate("click");
          await verifyCellIterator([{ rowKey: "1", columnKey: "key1" }], selectedCellsIterator);

          const selectedCell = table.find(selectedCellClassName).first();
          // Bottom border is not drawn here - it is drawn as top border on the cell below
          expectCellBorders(selectedCell, [borderTopClassName, borderRightClassName, borderLeftClassName]);

          const cellBelow = table.find(cellClassName).at(7);
          expectCellBorders(cellBelow, [borderTopClassName]);
        });

        it("adds top border style when cell in the first row is selected", async () => {
          // Select the first cell in the first row
          table.find(cellClassName).first().simulate("click");
          await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);

          const cell = table.find(selectedCellClassName).first();
          expect(cell.hasClass(borderTopClassName)).to.be.true;
        });

        it("adds right border style when cell in the last column is selected", async () => {
          // Select the last cell in the first row
          table.find(cellClassName).at(2).simulate("click");
          await verifyCellIterator([{ rowKey: "0", columnKey: "key2" }], selectedCellsIterator);

          const cell = table.find(selectedCellClassName).first();
          expect(cell.hasClass(borderRightClassName)).to.be.true;
        });

        it("adds bottom border style when cell in the last row is selected", async () => {
          // Select the first cell the last row
          table.find(cellClassName).at(27).simulate("click");
          await verifyCellIterator([{ rowKey: "9", columnKey: "key0" }], selectedCellsIterator);

          const cell = table.find(selectedCellClassName).first();
          expect(cell.hasClass(borderBottomClassName)).to.be.true;
        });

        it("adds left border style when cell in the first column is selected", async () => {
          // Select the first cell in the first row
          table.find(cellClassName).first().simulate("click");
          await verifyCellIterator([{ rowKey: "0", columnKey: "key0" }], selectedCellsIterator);

          const cell = table.find(selectedCellClassName).first();
          expect(cell.hasClass(borderLeftClassName)).to.be.true;
        });

        it("does not add borders in between consecutively selected cells ", async () => {
          table.setProps({ selectionMode: SelectionMode.Multiple });

          // Select nodes in a "+" pattern
          table.find(cellClassName).at(1).simulate("click");
          await verifyCellIterator([{ rowKey: "0", columnKey: "key1" }], selectedCellsIterator);
          table.find(cellClassName).at(3).simulate("click");
          await verifyCellIterator([{ rowKey: "1", columnKey: "key0" }], selectedCellsIterator);
          table.find(cellClassName).at(4).simulate("click");
          await verifyCellIterator([{ rowKey: "1", columnKey: "key1" }], selectedCellsIterator);
          table.find(cellClassName).at(5).simulate("click");
          await verifyCellIterator([{ rowKey: "1", columnKey: "key2" }], selectedCellsIterator);
          table.find(cellClassName).at(7).simulate("click");
          await verifyCellIterator([{ rowKey: "2", columnKey: "key1" }], selectedCellsIterator);

          // Note: bottom borders are drawn as top borders on nodes below

          // Expect border on three sides on node 1
          expectCellBorders(table.find(cellClassName).at(1), [borderTopClassName, borderRightClassName, borderLeftClassName]);

          // Expect border on three sides on node 3
          expectCellBorders(table.find(cellClassName).at(3), [borderTopClassName, borderLeftClassName]);
          expectCellBorders(table.find(cellClassName).at(6), [borderTopClassName]);

          // Expect no border on node 4
          expectCellBorders(table.find(cellClassName).at(4), []);

          // Expect border on three sides on node 5
          expectCellBorders(table.find(cellClassName).at(5), [borderTopClassName, borderRightClassName]);
          expectCellBorders(table.find(cellClassName).at(8), [borderTopClassName]);

          // Expect border on three sides on node 7
          expectCellBorders(table.find(cellClassName).at(7), [borderRightClassName, borderLeftClassName]);
          expectCellBorders(table.find(cellClassName).at(10), [borderTopClassName]);
        });

      });

    });

  });

  describe("sort", () => {

    beforeEach(async () => {
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
      />);
      await waitForSpy(onRowsLoaded);
      table.setProps({ scrollToRow: 1 });
      table.update();
    });

    it("clicking on a sortable column heading should sort", async () => {
      // Simulate clicking on the header for sort
      let header = table.find("div.react-grid-Header");
      let tEl = header.find("t[sortDirection=\"NONE\"]");
      expect(tEl.length).to.eq(1);

      let headerCellDiv = header.find("div.react-grid-HeaderCell-sortable");
      headerCellDiv.simulate("click");  // Ascending
      table.update();
      header = table.find("div.react-grid-Header");
      tEl = header.find("t[sortDirection=\"ASC\"]");
      expect(tEl.length).to.eq(1);

      headerCellDiv = header.find("div.react-grid-HeaderCell-sortable");
      headerCellDiv.simulate("click");  // Descending
      table.update();
      header = table.find("div.react-grid-Header");
      tEl = header.find("t[sortDirection=\"DESC\"]");
      expect(tEl.length).to.eq(1);

      headerCellDiv = header.find("div.react-grid-HeaderCell-sortable");
      headerCellDiv.simulate("click");  // NoSort
      table.update();
      header = table.find("div.react-grid-Header");
      tEl = header.find("t[sortDirection=\"NONE\"]");
      expect(tEl.length).to.eq(1);
    });

  });

  describe("cell editing", async () => {

    const newPropertyValue = "My new value";
    const handlePropertyUpdated = async (args: PropertyUpdatedArgs): Promise<boolean> => {
      let updated = false;

      if (args.propertyRecord) {
        expect((args.newValue as PrimitiveValue).value).to.eq(newPropertyValue);
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

    before(async () => {
      await TestUtils.initializeUiComponents();
    });

    after(() => {
      TestUtils.terminateUiComponents();
    });

    it("clicking on an editor cell after selection should start editing", async () => {
      const renderedTable = render(<Table
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        onPropertyEditing={onPropertyEditing}
        onPropertyUpdated={onPropertyUpdated}
      />);
      await waitForSpy(onRowsLoaded);

      // Simulate clicking on the cell to edit
      // renderedTable.debug();
      const row = renderedTable.container.querySelector(rowClassName);
      expect(row).not.to.be.null;
      fireEvent.click(row as HTMLElement);
      const selectedRow = renderedTable.container.querySelector(selectedRowClassName);
      expect(selectedRow).not.to.be.null;

      // Click 3rd cell in row (marked as editable)
      const rowCells = selectedRow!.querySelectorAll(cellClassName);
      expect(rowCells).not.to.be.null;
      expect(rowCells.length).to.eq(3);
      const cellDiv = rowCells[2] as HTMLElement;
      expect(cellDiv).not.to.be.null;
      fireEvent.click(cellDiv);
      expect(onPropertyEditing.calledOnce).to.be.true;

      const editorContainerNode = cellDiv.querySelector("span.components-editor-container") as HTMLSpanElement;
      expect(editorContainerNode).not.to.be.null;

      const inputNode = editorContainerNode.querySelector("input") as HTMLInputElement;
      expect(inputNode).not.to.be.null;

      fireEvent.click(inputNode);
      fireEvent.change(inputNode, { target: { value: newPropertyValue } });
      fireEvent.keyDown(inputNode, { key: "Enter" });

      await TestUtils.flushAsyncOperations();
      expect(onPropertyUpdated.calledOnce).to.be.true;
    });

  });

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

  describe("column drag and drop", () => {
    it("should begin and end drag", async () => {
      const ref = React.createRef<any>();
      const DragDropTable = wrapInTestContext(Table);
      table = enzyme.mount(<DragDropTable
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        reorderableColumns={true}
        ref={ref}
        settingsIdentifier="test"
        settingsStorage={new LocalStateStorage({ localStorage: storageMock() } as Window)}
      />);
      await waitForSpy(onRowsLoaded);
      table.update();

      const backend = ref.current.getManager().getBackend();
      const head = table.find(DragDropHeaderWrapper);
      expect(head).to.exist;
      const firstInstance = head.at(1).instance() as any;
      backend.simulateBeginDrag([firstInstance.getHandlerId()]);
      backend.simulateEndDrag();
      table.update();
    });
  });

  describe("columns show/hide", async () => {

    beforeEach(async () => {
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        settingsIdentifier="test"
        showHideColumns={true}
        settingsStorage={new LocalStateStorage({ localStorage: storageMock() } as Window)}
      />);
      await waitForSpy(onRowsLoaded);
      table.update();
    });

    it("should open context menu", () => {
      const t = table.find(tableWrapper);
      t.simulate("contextmenu", { currentTarget: t, clientX: -1, clientY: -1 });
    });

  });

  describe("scrollToRow", async () => {
    const onScrollToRow = sinon.spy();

    beforeEach(async () => {
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        onScrollToRow={onScrollToRow}
        scrollToRow={0}
      />);
      await waitForSpy(onRowsLoaded);
      table.update();
    });

    it("should scroll to a specific row", async () => {
      expect(onScrollToRow.calledOnceWith(0)).to.be.true;
      onScrollToRow.resetHistory();

      table.setProps({ scrollToRow: 50 });
      table.update();
      await TestUtils.flushAsyncOperations();
      expect(onScrollToRow.calledOnceWith(50)).to.be.true;
    });

  });

  describe("Table Filtering", () => {

    const filteringColumns: ColumnDescription[] = [
      {
        key: "id",
        label: "ID",
        resizable: true,
        sortable: true,
        secondarySortColumn: 1,
        filterable: true,
        filterRenderer: FilterRenderer.Numeric,
      },
      {
        key: "title",
        label: "Title",
        sortable: true,
        resizable: true,
        filterRenderer: FilterRenderer.MultiSelect,
      },
      {
        key: "color",
        label: "Color",
        sortable: true,
        resizable: false,
        filterRenderer: FilterRenderer.SingleSelect,
      },
      {
        key: "lorem",
        label: "Lorem",
        filterRenderer: FilterRenderer.Text,
      },
      {
        key: "multi-value",
        label: "Multi-Value",
        filterable: true,
        filterRenderer: FilterRenderer.MultiValue,
        showDistinctValueFilters: true,
        showFieldFilters: true,
      },
    ];

    // cSpell:disable
    const loremIpsum = [
      "Lorem",
      "ipsum",
      "dolor",
      "sit",
      "amet,",
      "consectetur",
      "adipiscing",
      "elit,",
      "sed",
      "do",
    ];
    // cSpell:enable

    const createRow = (i: number) => {
      const row: RowItem = { key: i.toString(), cells: [] };
      const enumValue = i % 4;
      const loremIndex = i % 10;
      const convertInfo: PropertyConverterInfo = { name: "" };

      const propertyRecord = TestUtils.createPropertyRecord(i, filteringColumns[0], "int");
      propertyRecord.property.converter = convertInfo;

      row.cells.push({
        key: filteringColumns[0].key,
        record: propertyRecord,
      });
      row.cells.push({
        key: filteringColumns[1].key,
        record: TestUtils.createPropertyRecord(`Title ${i}`, filteringColumns[1], "text"),
      });
      row.cells.push({
        key: filteringColumns[2].key,
        record: TestUtils.createEnumProperty(filteringColumns[2].label, enumValue, filteringColumns[2]),
      });
      row.cells.push({
        key: filteringColumns[3].key,
        record: TestUtils.createPropertyRecord(loremIpsum[loremIndex], filteringColumns[3], "text"),
      });
      row.cells.push({
        key: filteringColumns[4].key,
        record: TestUtils.createPropertyRecord(`Multi-Value ${i}`, filteringColumns[4], "text"),
      });
      return row;
    };

    let rows: RowItem[];
    let dataProvider: SimpleTableDataProvider;
    let filterTable: enzyme.ReactWrapper<TableProps>;

    const numTestRows = 10;
    const onApplyFilter = sinon.spy();

    before(async () => {
      rows = new Array<RowItem>();
      for (let i = 1; i <= numTestRows; i++) {
        const row = createRow(i);
        rows.push(row);
      }
    });

    beforeEach(async () => {
      dataProvider = new SimpleTableDataProvider(filteringColumns);
      dataProvider.setItems(rows);

      onRowsLoaded.resetHistory();

      filterTable = enzyme.mount(<Table
        dataProvider={dataProvider}
        onRowsLoaded={onRowsLoaded}
        onApplyFilter={onApplyFilter}
      />);
      await waitForSpy(onRowsLoaded);
      await TestUtils.flushAsyncOperations();
      filterTable.update();
    });

    it("should create two row headers", async () => {
      expect(filterTable.find("div.react-grid-HeaderRow").length).to.eq(2);
      expect(filterTable.find("div.react-grid-HeaderCell").length).to.eq(10);
      // expect(filterTable.find("input.input-sm").length).to.eq(2);
      // expect(filterTable.find("div.Select").length).to.eq(2);

      // TODO - figure out why NumericRenderer is the only filterRenderer displaying in unit test DOM
    });

    it("number in numeric filter should filter", async () => {
      expect(await dataProvider.getRowsCount()).to.eq(10);
      expect(filterTable.find("input.input-sm").length).to.be.greaterThan(0);
      const inputSm = filterTable.find("input.input-sm").at(0);

      onApplyFilter.resetHistory();
      inputSm.simulate("change", { target: { value: "1" } });
      await waitForSpy(onApplyFilter);
      expect(await dataProvider.getRowsCount()).to.eq(1);

      onApplyFilter.resetHistory();
      inputSm.simulate("change", { target: { value: "" } });
      await waitForSpy(onApplyFilter);
      expect(await dataProvider.getRowsCount()).to.eq(10);
    });

  });

  describe("context menu", async () => {
    const onCellContextMenuSpy = sinon.spy();

    beforeEach(async () => {
      table = enzyme.mount(<Table
        dataProvider={dataProviderMock.object}
        onRowsLoaded={onRowsLoaded}
        onCellContextMenu={onCellContextMenuSpy}
        pageAmount={50}
        propertyValueRendererManager={PropertyValueRendererManager.defaultManager}
      />);
      await waitForSpy(onRowsLoaded);
      table.update();

      onCellContextMenuSpy.resetHistory();
    });

    it("should open context menu", () => {
      const cells = table.find(cellClassName);
      expect(cells.length).to.be.greaterThan(0);
      cells.at(0).simulate("contextmenu", { currentTarget: cells.at(0), clientX: 1, clientY: 1 });
      expect(onCellContextMenuSpy.calledOnce).to.be.true;
    });

  });
});
