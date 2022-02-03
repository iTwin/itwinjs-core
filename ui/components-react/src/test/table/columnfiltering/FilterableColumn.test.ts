/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import * as sinon from "sinon";
import { StandardTypeNames } from "@itwin/appui-abstract";
import { FilterOperator } from "../../../components-react/table/columnfiltering/ColumnFiltering";
import type { TableColumnFilterDescriptor } from "../../../components-react/table/columnfiltering/TableColumnFilterDescriptor";
import type { ReactDataGridColumn} from "../../../components-react/table/component/TableColumn";
import { TableColumn } from "../../../components-react/table/component/TableColumn";
import { SimpleTableDataProvider } from "../../../components-react/table/SimpleTableDataProvider";
import type { ColumnDescription, RowItem } from "../../../components-react/table/TableDataProvider";
import { TestFilterableTable, TestUtils } from "../../TestUtils";

const columns: ColumnDescription[] = [
  {
    key: "lorem",
    label: "Lorem",
  },
  {
    key: "index",
    label: "Index",
    showDistinctValueFilters: false,
    showFieldFilters: false,
    filterCaseSensitive: true,
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
  row.cells.push({
    key: columns[1].key,
    record: TestUtils.createPropertyRecord(i + 1, columns[1], StandardTypeNames.Number),
  });
  return row;
};

const numTestRows = 100;

describe("FilterableColumn", () => {
  let rows: RowItem[];
  let dataProvider: SimpleTableDataProvider;
  let testTable: TestFilterableTable;
  let columnDescriptions: ColumnDescription[];
  let filterableColumn0: TableColumn;
  let filterableColumn1: TableColumn;
  let columnDescription0: ColumnDescription;
  let columnDescription1: ColumnDescription;
  const onApplyFilterSpy = sinon.spy();

  const applyFilter = async (): Promise<void> => {
    if (dataProvider.applyFilterDescriptors) {
      await dataProvider.applyFilterDescriptors(testTable.filterDescriptors);
      onApplyFilterSpy();
    }
  };

  before(async () => {
    rows = new Array<RowItem>();
    for (let i = 0; i < numTestRows; i++) {
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
    columnDescription1 = columnDescriptions[1];
    const reactDataGridColumn1: ReactDataGridColumn = {
      key: columnDescription0.key,
      name: columnDescription0.label,
    };
    filterableColumn1 = new TableColumn(testTable, columnDescription1, reactDataGridColumn1);
  });

  describe("properties", () => {

    it("filterableTable should get table", () => {
      expect(filterableColumn0.filterableTable).to.eq(testTable);
    });

    it("columnFilterDescriptor should get filter description", () => {
      expect(filterableColumn0.isFilterActive).to.be.false;
      expect(filterableColumn0.columnFilterDescriptor).to.not.be.undefined;
      expect(filterableColumn0.isFilterActive).to.be.false;
    });

    it("filterMemberType should get member type", () => {
      expect(filterableColumn0.filterMemberType).to.eq(StandardTypeNames.Text);
    });

    it("showDistinctValueFilters should get proper value", () => {
      expect(filterableColumn0.showDistinctValueFilters).to.be.true;
      expect(filterableColumn1.showDistinctValueFilters).to.be.false;
    });

    it("showFieldFilters should get proper value", () => {
      expect(filterableColumn0.showFieldFilters).to.be.true;
      expect(filterableColumn1.showFieldFilters).to.be.false;
    });

  });

  describe("ColumnFilterDescriptor", () => {

    beforeEach(() => {
      filterableColumn0.columnFilterDescriptor.distinctFilter.addDistinctValue("lorem");
      filterableColumn0.columnFilterDescriptor.fieldFilter.addFieldValue("ipsum", FilterOperator.IsEqualTo);
    });

    it("column property should return the FilterableColumn", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor as TableColumnFilterDescriptor;
      expect(columnFilterDescriptor).to.not.be.undefined;

      expect(columnFilterDescriptor.column).to.eq(filterableColumn0);
    });

    it("memberKey property should return the column key", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor as TableColumnFilterDescriptor;
      expect(columnFilterDescriptor.memberKey).to.eq(filterableColumn0.columnDescription.key);
    });

    it("memberType property should return the column type", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor as TableColumnFilterDescriptor;
      expect(columnFilterDescriptor.memberType).to.eq(StandardTypeNames.Text);
    });

    it("memberKey setter should set the key", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor as TableColumnFilterDescriptor;
      columnFilterDescriptor.memberKey = "lorem";
      expect(columnFilterDescriptor.memberKey).to.eq("lorem");
      columnFilterDescriptor.memberKey = "abc";
      expect(columnFilterDescriptor.memberKey).to.eq("abc");
      columnFilterDescriptor.memberKey = "lorem";
    });

    it("memberType setter should set the type", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor as TableColumnFilterDescriptor;
      columnFilterDescriptor.memberType = StandardTypeNames.Text;
      expect(columnFilterDescriptor.memberType).to.eq(StandardTypeNames.Text);
      columnFilterDescriptor.memberType = StandardTypeNames.Boolean;
      expect(columnFilterDescriptor.memberType).to.eq(StandardTypeNames.Boolean);
      columnFilterDescriptor.memberType = StandardTypeNames.Text;
    });

    it("getFilterExpression should return ECExpression for the descriptor", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor as TableColumnFilterDescriptor;
      const expression = columnFilterDescriptor.getFilterExpression();
      expect(expression).to.eq(`((lorem = "lorem")) And ((lorem = "ipsum"))`);
    });

  });

  describe("DistinctValuesFilterDescriptor", () => {
    beforeEach(() => {
      filterableColumn0.columnFilterDescriptor.distinctFilter.addDistinctValue("Lorem");
      filterableColumn0.columnFilterDescriptor.distinctFilter.addDistinctValue("ipsum");
    });

    it("distinctValues should return values", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor;
      const distinctFilter = columnFilterDescriptor.distinctFilter;
      const distinctValues = distinctFilter.distinctValues;
      expect(distinctValues.values.length).to.eq(2);
      expect(distinctValues.values[0]).to.eq("Lorem");
      expect(distinctValues.values[1]).to.eq("ipsum");
    });

    it("isFilterForColumn should return proper value", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor;
      const distinctFilter = columnFilterDescriptor.distinctFilter;
      expect(distinctFilter.isFilterForColumn("lorem")).to.be.true;
      expect(distinctFilter.isFilterForColumn("index")).to.be.false;
    });

    it("trying to add a duplicate should not allow", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor;
      const distinctFilter = columnFilterDescriptor.distinctFilter;
      expect(distinctFilter.distinctValues.values.length).to.eq(2);
      distinctFilter.addDistinctValue("Lorem");
      expect(distinctFilter.distinctValues.values.length).to.eq(2);
    });

    it("remove should take out correctly", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor;
      const distinctFilter = columnFilterDescriptor.distinctFilter;
      expect(distinctFilter.distinctValues.values.length).to.eq(2);
      distinctFilter.removeDistinctValue("Lorem");
      expect(distinctFilter.distinctValues.values.length).to.eq(1);
    });

    it("trying to remove a missing value should be handled", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor;
      const distinctFilter = columnFilterDescriptor.distinctFilter;
      expect(distinctFilter.distinctValues.values.length).to.eq(2);
      distinctFilter.removeDistinctValue(1);
      expect(distinctFilter.distinctValues.values.length).to.eq(2);
    });

    it("distinctValuesComparisonOperator should get and set", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor;
      const distinctFilter = columnFilterDescriptor.distinctFilter;
      expect(distinctFilter.distinctValuesComparisonOperator).to.eq(FilterOperator.IsEqualTo);
      distinctFilter.distinctValuesComparisonOperator = FilterOperator.IsNotEqualTo;
      expect(distinctFilter.distinctValuesComparisonOperator).to.eq(FilterOperator.IsNotEqualTo);
      distinctFilter.distinctValuesComparisonOperator = FilterOperator.IsEqualTo;
    });

    it("getFilterExpression should return ECExpression for the descriptor", () => {
      const columnFilterDescriptor = filterableColumn0.columnFilterDescriptor;
      const distinctFilter = columnFilterDescriptor.distinctFilter;
      const expression = distinctFilter.getFilterExpression();
      expect(expression).to.eq(`(lorem = "Lorem") Or (lorem = "ipsum")`);
    });

  });

  describe("FieldFilterDescriptor", () => {
    beforeEach(() => {
      filterableColumn1.columnFilterDescriptor.fieldFilter.addFieldValue(10, FilterOperator.IsLessThan);
      filterableColumn1.columnFilterDescriptor.fieldFilter.addFieldValue(15, FilterOperator.IsEqualTo);
      filterableColumn1.columnFilterDescriptor.fieldFilter.addFieldValue(90, FilterOperator.IsGreaterThanOrEqualTo);
    });

    it("isFilterForColumn should return proper value", () => {
      const columnFilterDescriptor = filterableColumn1.columnFilterDescriptor;
      const fieldFilter = columnFilterDescriptor.fieldFilter;
      expect(fieldFilter.isFilterForColumn("index")).to.be.true;
      expect(fieldFilter.isFilterForColumn("lorem")).to.be.false;
    });

    it("trying to add a duplicate should not allow", () => {
      const columnFilterDescriptor = filterableColumn1.columnFilterDescriptor;
      const fieldFilter = columnFilterDescriptor.fieldFilter;
      expect(fieldFilter.filterDescriptorCollection.count).to.eq(3);
      fieldFilter.addFieldValue(10, FilterOperator.IsLessThan);
      expect(fieldFilter.filterDescriptorCollection.count).to.eq(3);
    });

    it("remove should take out correctly", () => {
      const columnFilterDescriptor = filterableColumn1.columnFilterDescriptor;
      const fieldFilter = columnFilterDescriptor.fieldFilter;
      expect(fieldFilter.filterDescriptorCollection.count).to.eq(3);
      fieldFilter.removeFieldValue(10, FilterOperator.IsLessThan);
      expect(fieldFilter.filterDescriptorCollection.count).to.eq(2);
    });

    it("trying to remove a missing value should be handled", () => {
      const columnFilterDescriptor = filterableColumn1.columnFilterDescriptor;
      const fieldFilter = columnFilterDescriptor.fieldFilter;
      expect(fieldFilter.filterDescriptorCollection.count).to.eq(3);
      fieldFilter.removeFieldValue(150, FilterOperator.IsEqualTo);
      expect(fieldFilter.filterDescriptorCollection.count).to.eq(3);
    });

    it("getFilterExpression should return ECExpression for the descriptor", () => {
      const columnFilterDescriptor = filterableColumn1.columnFilterDescriptor;
      const fieldFilter = columnFilterDescriptor.fieldFilter;
      const expression = fieldFilter.getFilterExpression();
      expect(expression).to.eq(`(index < "10") Or (index = "15") Or (index >= "90")`);
    });

  });

});
