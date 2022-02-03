/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import type { FieldFilterData, MultiValueFilterData, NumericExactMatchData, NumericFilterData, NumericGreaterThanData, NumericLessThanData, NumericRangeData, ReactDataGridFilter} from "../../../components-react/table/columnfiltering/DataGridFilterParser";
import {
  DataGridFilterParser, FILTER_PARSER_TIMER_TIMEOUT,
  NumericFilterType,
} from "../../../components-react/table/columnfiltering/DataGridFilterParser";
import type { ReactDataGridColumn} from "../../../components-react/table/component/TableColumn";
import { TableColumn } from "../../../components-react/table/component/TableColumn";
import { SimpleTableDataProvider } from "../../../components-react/table/SimpleTableDataProvider";
import type { ColumnDescription, RowItem } from "../../../components-react/table/TableDataProvider";
import { FilterRenderer } from "../../../components-react/table/TableDataProvider";
import { TestFilterableTable, TestUtils } from "../../TestUtils";
import type { TableDistinctValue } from "../../../components-react/table/columnfiltering/ColumnFiltering";
import { FilterCompositionLogicalOperator, FilterOperator } from "../../../components-react/table/columnfiltering/ColumnFiltering";

const columns: ColumnDescription[] = [
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
    key: "lorem1",
    label: "Lorem1",
    filterRenderer: FilterRenderer.Text,
  },
  {
    key: "lorem2",
    label: "Lorem2",
  },
  {
    key: "multi-value",
    label: "Multi-Value",
    sortable: true,
    resizable: true,
    filterRenderer: FilterRenderer.MultiValue,
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
  row.cells.push({
    key: columns[0].key,
    record: TestUtils.createPropertyRecord(i, columns[0], "int"),
  });
  row.cells.push({
    key: columns[1].key,
    record: TestUtils.createPropertyRecord(`Title ${i}`, columns[1], "text"),
  });
  row.cells.push({
    key: columns[2].key,
    record: TestUtils.createEnumProperty(columns[2].label, enumValue, columns[2]),
  });
  row.cells.push({
    key: columns[3].key,
    record: TestUtils.createPropertyRecord(loremIpsum[loremIndex], columns[3], "text"),
  });
  row.cells.push({
    key: columns[4].key,
    record: TestUtils.createPropertyRecord(loremIpsum[loremIndex], columns[4], "text"),
  });
  row.cells.push({
    key: columns[5].key,
    record: TestUtils.createPropertyRecord(`Multi-Value ${i}`, columns[5], "text"),
  });
  return row;
};

let rows: RowItem[];
let dataProvider: SimpleTableDataProvider;
let columnDescriptions: ColumnDescription[];

const numTestRows = 1000;

describe("DataGridFilterParser", () => {
  let fakeTimers: sinon.SinonFakeTimers;
  let testTable: TestFilterableTable;

  before(async () => {
    rows = new Array<RowItem>();
    for (let i = 1; i <= numTestRows; i++) {
      const row = createRow(i);
      rows.push(row);
    }
    dataProvider = new SimpleTableDataProvider(columns);
    dataProvider.setItems(rows);
    columnDescriptions = await dataProvider.getColumns();
    testTable = new TestFilterableTable(columns);
  });

  beforeEach(() => {
    fakeTimers = sinon.useFakeTimers();
  });

  afterEach(() => {
    fakeTimers.restore();
  });

  const onApplyFilterSpy = sinon.spy();

  const applyFilter = async (): Promise<void> => {
    if (dataProvider.applyFilterDescriptors) {
      await dataProvider.applyFilterDescriptors(testTable.filterDescriptors);
      onApplyFilterSpy();
    }
  };

  beforeEach(async () => {
    testTable.filterDescriptors.clear();
    await applyFilter();
    onApplyFilterSpy.resetHistory();
  });

  it("should support changing timeout period", async () => {
    expect(DataGridFilterParser.timerTimeout).to.eq(FILTER_PARSER_TIMER_TIMEOUT);
    DataGridFilterParser.timerTimeout = 10;
    expect(DataGridFilterParser.timerTimeout).to.eq(10);
  });

  it("should call onApplyFilter", async () => {
    const columnDescription = columnDescriptions[4];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: "lorem",
      column: filterableColumn,
    };

    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    await fakeTimers.tickAsync(100);
    expect(onApplyFilterSpy.called).to.be.true;
  });

  /*
  NumericFilter
  0: {type: 2, begin: 1, end: 10} // range
  1: {type: 1, value: 15} // Exact match
  2: {type: 3, value: 30} // > 30
  3: {type: 4, value: 5}  // < 5
  length: 4
  */

  it("Numeric ExactMatch", async () => {
    const columnDescription = columnDescriptions[0];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const numericFilterData: NumericFilterData[] = [
      { type: NumericFilterType.ExactMatch, value: 15 } as NumericExactMatchData,
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: numericFilterData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(1);
  });

  it("Numeric Range", async () => {
    const columnDescription = columnDescriptions[0];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const numericFilterData: NumericFilterData[] = [
      { type: NumericFilterType.Range, begin: 1, end: 10 } as NumericRangeData,
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: numericFilterData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(10);
  });

  it("Numeric GreaterThan", async () => {
    const columnDescription = columnDescriptions[0];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const numericFilterData: NumericFilterData[] = [
      { type: NumericFilterType.GreaterThan, value: 900 } as NumericGreaterThanData,
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: numericFilterData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(100);
  });

  it("Numeric LessThan", async () => {
    const columnDescription = columnDescriptions[0];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const numericFilterData: NumericFilterData[] = [
      { type: NumericFilterType.LessThan, value: 101 } as NumericLessThanData,
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: numericFilterData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(100);
  });

  it("Numeric filter with 0 entries", async () => {
    const columnDescription = columnDescriptions[0];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const numericFilterData: NumericFilterData[] = [
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: numericFilterData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
  });

  it("Numeric filter with invalid filter type", async () => {
    const columnDescription = columnDescriptions[0];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const numericFilterData: NumericFilterData[] = [
      { type: -1 },
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: numericFilterData as unknown as string,
      column: filterableColumn,
    };

    const spyLogger = sinon.spy(Logger, "logError");

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);

    spyLogger.calledOnce.should.true;
    (Logger.logError as any).restore();
  });

  /*
  MultiSelect filters
  0: {value: "Title 1", label: "Title 1"}
  1: {value: "Title 100", label: "Title 100"}
  2: {value: "Title 10000", label: "Title 10000"}
  length: 3
  */

  it("MultiSelect with 0 entries", async () => {
    const columnDescription = columnDescriptions[1];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const multiSelectData: TableDistinctValue[] = [
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: multiSelectData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
  });

  it("MultiSelect with 1 entry", async () => {
    const columnDescription = columnDescriptions[1];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const multiSelectData: TableDistinctValue[] = [
      { value: "Title 1", label: "Title 1" },
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: multiSelectData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(1);
  });

  it("MultiSelect with multiple entries", async () => {
    const columnDescription = columnDescriptions[1];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const multiSelectData: TableDistinctValue[] = [
      { value: "Title 1", label: "Title 1" },
      { value: "Title 100", label: "Title 100" },
      { value: "Title 1000", label: "Title 1000" },
    ];

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: multiSelectData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(3);
  });

  /*
  SingleSelect filters
  filter.filterTerm: {value: 1, label: "Red"}
  */

  it("SingleSelect", async () => {
    const columnDescription = columnDescriptions[2];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const singleSelectData: TableDistinctValue = { value: 1, label: "Red" };

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: singleSelectData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows / 4);
  });

  it("Text filterRenderer", async () => {
    const columnDescription = columnDescriptions[3];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: "lorem",
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows / loremIpsum.length);
  });

  it("Text filterRenderer with no filter term", async () => {
    const columnDescription = columnDescriptions[3];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: "",
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
  });

  it("columnDescriptor with no filterRenderer should filter on text", async () => {
    const columnDescription = columnDescriptions[4];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: "lorem",
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows / loremIpsum.length);
  });

  /*
  MultiValue filters
    distinctValues
      length: 3
      0: {value: "Title 1", label: "Title 1"}
      1: {value: "Title 100", label: "Title 100"}
      2: {value: "Title 10000", label: "Title 10000"}
    fieldValues
      length: 1
      0: {value: any, operator: FilterOperator, isCaseSensitive?: boolean}
    logicalOperator: FilterCompositionLogicalOperator
  */

  it("MultiValue with 0 distinct entries", async () => {
    const columnDescription = columnDescriptions[5];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const multiValueData: MultiValueFilterData = {
      distinctValues: new Array<TableDistinctValue>(),
      fieldValues: new Array<FieldFilterData>(),
      fieldLogicalOperator: FilterCompositionLogicalOperator.And,
    };

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: multiValueData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
  });

  it("MultiValue with 1 distinct entry", async () => {
    const columnDescription = columnDescriptions[5];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const multiValueData: MultiValueFilterData = {
      distinctValues: [
        { value: "Multi-Value 1", label: "Multi-Value 1" },
      ],
      fieldValues: [],
      fieldLogicalOperator: FilterCompositionLogicalOperator.And,
    };

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: multiValueData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(1);
  });

  it("MultiValue with multiple distinct entries", async () => {
    const columnDescription = columnDescriptions[5];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const multiValueData: MultiValueFilterData = {
      distinctValues: [
        { value: "Multi-Value 1", label: "Multi-Value 1" },
        { value: "Multi-Value 100", label: "Multi-Value 100" },
        { value: "Multi-Value 1000", label: "Multi-Value 1000" },
      ],
      fieldValues: [],
      fieldLogicalOperator: FilterCompositionLogicalOperator.And,
    };

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: multiValueData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(3);
  });

  it("MultiValue with multiple field entries", async () => {
    const columnDescription = columnDescriptions[5];
    const reactDataGridColumn: ReactDataGridColumn = {
      key: columnDescription.key,
      name: columnDescription.label,
    };
    const filterableColumn = new TableColumn(testTable, columnDescription, reactDataGridColumn);
    const columnFilterDescriptor = filterableColumn.columnFilterDescriptor;

    DataGridFilterParser.timerTimeout = 10;

    const multiValueData: MultiValueFilterData = {
      distinctValues: [],
      fieldValues: [
        { fieldValue: "Multi-Value 1", operator: FilterOperator.IsEqualTo },
        { fieldValue: "Multi-Value 100", operator: FilterOperator.IsEqualTo },
        { fieldValue: "Multi-Value 1000", operator: FilterOperator.IsEqualTo },
      ],
      fieldLogicalOperator: FilterCompositionLogicalOperator.Or,
    };

    const dataGridFilter: ReactDataGridFilter = {
      columnKey: columnDescription.key,
      filterTerm: multiValueData as unknown as string,
      column: filterableColumn,
    };

    expect(await dataProvider.getRowsCount()).to.eq(numTestRows);
    await DataGridFilterParser.handleFilterChange(dataGridFilter, columnFilterDescriptor, columnDescription, applyFilter);

    fakeTimers.tick(100);
    expect(await dataProvider.getRowsCount()).to.eq(3);
  });

});
