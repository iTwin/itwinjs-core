/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import * as sinon from "sinon";
import { StandardTypeNames } from "@itwin/appui-abstract";
import { ReactDataGridColumn, TableColumn } from "../../../components-react/table/component/TableColumn";
import { SimpleTableDataProvider } from "../../../components-react/table/SimpleTableDataProvider";
import { ColumnDescription, RowItem } from "../../../components-react/table/TableDataProvider";
import { TestFilterableTable, TestUtils } from "../../TestUtils";

const columns: ColumnDescription[] = [
  {
    key: "lorem",
    label: "Lorem",
  },
];

// cSpell:ignore lorem

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
  const loremIndex = i % 10;
  row.cells.push({
    key: columns[0].key,
    record: TestUtils.createPropertyRecord(loremIpsum[loremIndex], columns[0], StandardTypeNames.Text),
  });
  return row;
};

const numTestRows = 100;

describe("TableColumn", () => {
  let rows: RowItem[];
  let dataProvider: SimpleTableDataProvider;
  let testTable: TestFilterableTable;
  let columnDescriptions: ColumnDescription[];
  let filterableColumn0: TableColumn;
  let columnDescription0: ColumnDescription;
  const onApplyFilterSpy = sinon.spy();

  const applyFilter = async (): Promise<void> => {
    if (dataProvider.applyFilterDescriptors) {
      await dataProvider.applyFilterDescriptors(testTable.filterDescriptors);
      onApplyFilterSpy();
    }
  };

  before(async () => {
    rows = new Array<RowItem>();
    for (let i = 1; i <= numTestRows; i++) {
      const row = createRow(i);
      rows.push(row);
    }
    testTable = new TestFilterableTable(columns);
    dataProvider = new SimpleTableDataProvider(columns);
    dataProvider.setItems(rows);
    columnDescriptions = await dataProvider.getColumns();
  });

  beforeEach(async () => {
    testTable.filterDescriptors.clear();
    await applyFilter();
    onApplyFilterSpy.resetHistory();

    columnDescription0 = columnDescriptions[0];
    const reactDataGridColumn0: ReactDataGridColumn = {
      key: columnDescription0.key,
      name: columnDescription0.label,
    };
    filterableColumn0 = new TableColumn(testTable, columnDescription0, reactDataGridColumn0);
  });

  describe("Distinct Values", () => {

    it("getDistinctValues should return correct number of values", async () => {

      let distinctValues = await filterableColumn0.getDistinctValues();
      expect(distinctValues.values.length).to.eq(0);

      filterableColumn0.dataProvider = dataProvider;
      distinctValues = await filterableColumn0.getDistinctValues();
      expect(distinctValues.values.length).to.eq(loremIpsum.length);
    });

  });

});
