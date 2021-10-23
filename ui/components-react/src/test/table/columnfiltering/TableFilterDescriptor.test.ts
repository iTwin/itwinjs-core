/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { StandardTypeNames } from "@itwin/appui-abstract";
import { BooleanTypeConverter } from "../../../components-react/converters/BooleanTypeConverter";
import { FilterOperator, OperatorValueFilterDescriptorCollection } from "../../../components-react/table/columnfiltering/ColumnFiltering";
import { ColumnFilteringUtilities } from "../../../components-react/table/columnfiltering/ColumnFilteringUtilities";
import { NumericFilterType, NumericRangeData } from "../../../components-react/table/columnfiltering/DataGridFilterParser";
import { TableFilterDescriptor } from "../../../components-react/table/columnfiltering/TableFilterDescriptor";
import { CellItem, ColumnDescription, RowItem } from "../../../components-react/table/TableDataProvider";
import { TestFilterableTable, TestUtils } from "../../TestUtils";

const columns: ColumnDescription[] = [
  {
    key: "col0",
    label: "String",
  },
  {
    key: "col1",
    label: "Int",
  },
  {
    key: "col2",
    label: "Float",
  },
  {
    key: "col3",
    label: "DateTime",
  },
  {
    key: "col4",
    label: "Boolean",
  },
  {
    key: "col5",
    label: "Point2d",
  },
  {
    key: "col6",
    label: "Point3d",
  },
];

const columnTypes: string[] = [
  StandardTypeNames.Text,
  StandardTypeNames.Integer,
  StandardTypeNames.Float,
  StandardTypeNames.DateTime,
  StandardTypeNames.Boolean,
  StandardTypeNames.Point2d,
  StandardTypeNames.Point3d,
];

const rowItem: RowItem = {
  key: "row0",
  cells: [],
};
rowItem.getValueFromCell = (columnKey: string): any => {
  const cellItem = rowItem.cells.find((item: CellItem) => item.key === columnKey);
  return cellItem && cellItem.record ? ColumnFilteringUtilities.getPrimitiveValue(cellItem.record) : undefined;
};

describe("TableFilterDescriptor", () => {
  let testTable: TestFilterableTable;

  before(async () => {
    await TestUtils.initializeUiComponents();
    testTable = new TestFilterableTable(columns);
  });

  describe("FilterDescriptor methods", () => {

    it("should return memberKey correctly", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0]);
      expect(filterDescriptor.memberKey).to.eq(columns[0].key);
    });

    it("should determine isActive correctly for empty descriptor", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, "", columnTypes[0]);
      expect(filterDescriptor.isActive).to.be.false;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNull);
      expect(filterDescriptor.isActive).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0]);
      expect(filterDescriptor.isActive).to.be.false;
    });

    it("should determine isActive correctly for populated descriptor", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsEqualTo, 1);
      expect(filterDescriptor.isActive).to.be.true;

      filterDescriptor.clear();
      expect(filterDescriptor.isActive).to.be.false;
    });

    it("should evaluateRow correctly", () => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord("Hello", columns[0], columnTypes[0]),
      });

      let filterDescriptor = new TableFilterDescriptor(testTable, "", columnTypes[0]);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsEqualTo, "Hello");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotEqualTo, "Hello");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotEqualTo, "Goodbye");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;
    });

    it("should determine isFilterForColumn correctly", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0]);
      expect(filterDescriptor.isFilterForColumn(columns[0].key)).to.be.true;
      expect(filterDescriptor.isFilterForColumn("")).to.be.false;
    });

    it("should support type converter name", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0]);
      expect(filterDescriptor.typeConverterName).to.be.undefined;
      const name = "test";
      filterDescriptor.typeConverterName = name;
      expect(filterDescriptor.typeConverterName).to.eq(name);
    });
  });

  describe("String operators", () => {
    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord("Every good boy does fine", columns[0], columnTypes[0]),
      });
    });

    it("StartsWith", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.StartsWith, "Every");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.StartsWith, "fine");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("EndsWith", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.EndsWith, "fine");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.EndsWith, "Every");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("Contains", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.Contains, "boy");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.Contains, "girl");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("DoesNotContain", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.DoesNotContain, "girl");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.DoesNotContain, "boy");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("IsContainedIn", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsContainedIn, "Every good boy does fine, also");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsContainedIn, "Every good girl does fine, also");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("IsNotContainedIn", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotContainedIn, "Every good boy does fine, also");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotContainedIn, "Every good girl does fine, also");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;
    });

    it("IsNotEmpty", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotEmpty);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;
    });

    it("IsEmpty", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsEmpty);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;

      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord("", columns[0], columnTypes[0]),
      });

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsEmpty);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotEmpty);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("IsNull", () => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord(null, columns[0], columnTypes[0]),
      });

      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNull);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;
    });

    it("IsNotNull", () => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord(null, columns[0], columnTypes[0]),
      });

      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotNull);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

  });

  describe("Numeric operators", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord("Every good boy does fine", columns[0], columnTypes[0]),
      });
      rowItem.cells.push({
        key: columns[1].key,
        record: TestUtils.createPropertyRecord(100, columns[1], "int"),
      });
    });

    it("IsLessThan", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThan, 105);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThan, 95);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("IsLessThanOrEqualTo", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThanOrEqualTo, 105);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThanOrEqualTo, 100);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThanOrEqualTo, 95);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("IsGreaterThan", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsGreaterThan, 95);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsGreaterThan, 105);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("IsGreaterThanOrEqualTo", () => {
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsGreaterThanOrEqualTo, 95);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsGreaterThanOrEqualTo, 100);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsGreaterThanOrEqualTo, 105);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });

    it("Range", () => {
      const rangeData1: NumericRangeData = { type: NumericFilterType.Range, begin: 95, end: 105 };
      let filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.Range, rangeData1);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const rangeData2: NumericRangeData = { type: NumericFilterType.Range, begin: 195, end: 205 };
      filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.Range, rangeData2);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;
    });
  });

  describe("getFilterExpression", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord("Every good boy does fine", columns[0], columnTypes[0]),
      });
      rowItem.cells.push({
        key: columns[1].key,
        record: TestUtils.createPropertyRecord(100, columns[1], "int"),
      });
    });

    it("StartsWith", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.StartsWith, "Every");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 ~ "Every%"`);
    });

    it("StartsWith - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.StartsWith, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 ~ Null`);
    });

    it("EndsWith", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.EndsWith, "fine");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 ~ "%fine"`);
    });

    it("EndsWith - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.EndsWith, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 ~ Null`);
    });

    it("Contains", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.Contains, "boy");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 ~ "%boy%"`);
    });

    it("Contains - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.Contains, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 ~ Null`);
    });

    it("DoesNotContain", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.DoesNotContain, "girl");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT(col0 ~ "%girl%")`);
    });

    it("DoesNotContain - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.DoesNotContain, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT(col0 ~ Null)`);
    });

    it("IsContainedIn", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsContainedIn, "Every good boy does fine, also");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`"Every good boy does fine, also" ~ "%" & col0 & "%" `);
    });

    it("IsContainedIn - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsContainedIn, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`Null ~ "%" & col0 & "%" `);
    });

    it("IsNotContainedIn", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotContainedIn, "Every good girl does fine, also");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT("Every good girl does fine, also" ~ "%" & col0 & "%" )`);
    });

    it("IsNotContainedIn - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotContainedIn, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT(Null ~ "%" & col0 & "%" )`);
    });

    it("IsNotEmpty", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotEmpty);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 <> Null`);
    });

    it("IsLessThan", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThan, 105);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col1 < "105"`);
    });

    it("IsLessThan - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThan, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq("");
    });

    it("IsLessThanOrEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsLessThanOrEqualTo, 105);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col1 <= "105"`);
    });

    it("IsGreaterThan", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsGreaterThan, 95);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col1 > "95"`);
    });

    it("IsGreaterThanOrEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.IsGreaterThanOrEqualTo, 95);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col1 >= "95"`);
    });

    it("Range", () => {
      const rangeData1: NumericRangeData = { type: NumericFilterType.Range, begin: 95, end: 105 };
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1], FilterOperator.Range, rangeData1);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`(95 <= col1) AND (col1 <= 105)`);
    });

    it("IsEmpty", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsEmpty);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 = Null`);
    });

    it("IsNotEmpty", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotEmpty);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 <> Null`);
    });

    it("IsNull", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNull);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.false;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 = Null`);
    });

    it("IsNotNull", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotNull);
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 <> Null`);
    });
  });

  describe("getFilterExpression for equality - string", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[0].key,
        record: TestUtils.createPropertyRecord("Every good boy does fine", columns[0], columnTypes[0]),
      });
    });

    it("IsEqualTo string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsEqualTo, "Every good boy does fine");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 = "Every good boy does fine"`);
    });

    it("IsNotEqualTo string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsNotEqualTo, "World");
      expect(filterDescriptor.evaluateRow(rowItem)).to.be.true;

      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col0 <> "World"`);
    });
  });

  describe("getFilterExpression - dateTime", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[3].key,
        record: TestUtils.createPropertyRecord(new Date(2019, 10, 8), columns[3], columnTypes[3]),
      });
    });

    it("IsEqualTo - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[3].key, columnTypes[3], FilterOperator.IsEqualTo, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq("col3 =  Null");
    });

    it("IsNotEqualTo - null", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[3].key, columnTypes[3], FilterOperator.IsNotEqualTo, null);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq("col3 <>  Null");
    });

    it("IsEqualTo - date", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[3].key, columnTypes[3], FilterOperator.IsEqualTo, new Date(2019, 10, 8));
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq("(col3 >= 2458795.5) AND (col3 < 2458795.500011574)");
    });

    it("IsNotEqualTo - date", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[3].key, columnTypes[3], FilterOperator.IsNotEqualTo, new Date(2019, 10, 8));
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq("NOT (col3 >= 2458795.5) AND (col3 < 2458795.500011574)");
    });

    it("IsLessThan - date", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[3].key, columnTypes[3], FilterOperator.IsLessThan, new Date(2019, 10, 10));
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq("(col3 <2458797.5)");
    });

    it.skip("IsLessThan - number", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[3].key, columnTypes[3], FilterOperator.IsLessThan, 2458797.5);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq("(col3 <2440587.320115741)");
    });
  });

  describe("getFilterExpression - boolean", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[4].key,
        record: TestUtils.createPropertyRecord(true, columns[4], columnTypes[4]),
      });
      BooleanTypeConverter.getLocalizedTrueFalse();
    });

    it("IsEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[4].key, columnTypes[4], FilterOperator.IsEqualTo, true);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col4 = true`);
    });

    it("IsNotEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[4].key, columnTypes[4], FilterOperator.IsNotEqualTo, true);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col4 <> true`);
    });

    it("IsEqualTo - bool", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[4].key, StandardTypeNames.Bool, FilterOperator.IsEqualTo, true);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col4 = true`);
    });

    it("IsEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[4].key, columnTypes[4], FilterOperator.IsEqualTo, BooleanTypeConverter.sl10nTrue);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col4 = true`);
    });

    it("IsNotEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[4].key, columnTypes[4], FilterOperator.IsNotEqualTo, BooleanTypeConverter.sl10nTrue);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col4 <> true`);
    });

    it("IsEqualTo - number", () => {
      const spyLogger = sinon.spy(Logger, "logError");
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[4].key, columnTypes[4], FilterOperator.IsEqualTo, 0);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col4 = "0"`);
      spyLogger.calledOnce.should.true;
      (Logger.logError as any).restore();
    });
  });

  describe("getFilterExpression - point2d", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[5].key,
        record: TestUtils.createPropertyRecord({ x: 100, y: 200 }, columns[5], columnTypes[5]),
      });
      BooleanTypeConverter.getLocalizedTrueFalse();
    });

    it("IsEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[5].key, columnTypes[5], FilterOperator.IsEqualTo, { x: 100, y: 200 });
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(` (ArePointsEqualByValue(col5, 100, 200) = 1)`);
    });

    it("IsNotEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[5].key, columnTypes[5], FilterOperator.IsNotEqualTo, { x: 100, y: 200 });
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT  (ArePointsEqualByValue(col5, 100, 200) = 1)`);
    });

    it("IsEqualTo - number", () => {
      const spyLogger = sinon.spy(Logger, "logError");
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[5].key, columnTypes[5], FilterOperator.IsEqualTo, 0);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col5 = "0"`);
      spyLogger.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("IsEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[5].key, columnTypes[5], FilterOperator.IsEqualTo, "abc");
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col5 = "abc"`);
    });

    it("IsNotEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[5].key, columnTypes[5], FilterOperator.IsNotEqualTo, "abc");
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT col5 = "abc"`);
    });
  });

  describe("getFilterExpression - point3d", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[6].key,
        record: TestUtils.createPropertyRecord({ x: 100, y: 200, z: 300 }, columns[6], columnTypes[6]),
      });
      BooleanTypeConverter.getLocalizedTrueFalse();
    });

    it("IsEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[6].key, columnTypes[6], FilterOperator.IsEqualTo, { x: 100, y: 200, z: 300 });
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(` (ArePointsEqualByValue(col6, 100, 200, 300) = 1)`);
    });

    it("IsNotEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[6].key, columnTypes[6], FilterOperator.IsNotEqualTo, { x: 100, y: 200, z: 300 });
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT  (ArePointsEqualByValue(col6, 100, 200, 300) = 1)`);
    });

    it("IsEqualTo - number", () => {
      const spyLogger = sinon.spy(Logger, "logError");
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[6].key, columnTypes[6], FilterOperator.IsEqualTo, 0);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col6 = "0"`);
      spyLogger.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("IsEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[6].key, columnTypes[6], FilterOperator.IsEqualTo, "abc");
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col6 = "abc"`);
    });

    it("IsNotEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[6].key, columnTypes[6], FilterOperator.IsNotEqualTo, "abc");
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT col6 = "abc"`);
    });
  });

  describe("getFilterExpression - float", () => {

    before(() => {
      rowItem.cells = [];
      rowItem.cells.push({
        key: columns[2].key,
        record: TestUtils.createPropertyRecord(100.50, columns[2], columnTypes[2]),
      });
      BooleanTypeConverter.getLocalizedTrueFalse();
    });

    it("IsEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[2].key, columnTypes[2], FilterOperator.IsEqualTo, 100.50);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(` (AreDoublesEqualByValue(col2, 100.5) = 1)`);
    });

    it("IsNotEqualTo", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[2].key, columnTypes[2], FilterOperator.IsNotEqualTo, 100.50);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT  (AreDoublesEqualByValue(col2, 100.5) = 1)`);
    });

    it("IsEqualTo - double", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[2].key, StandardTypeNames.Double, FilterOperator.IsEqualTo, 100.50);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(` (AreDoublesEqualByValue(col2, 100.5) = 1)`);
    });

    it("IsEqualTo - boolean", () => {
      const spyLogger = sinon.spy(Logger, "logError");
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[2].key, columnTypes[2], FilterOperator.IsEqualTo, false);
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col2 = "false"`);
      spyLogger.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("IsEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[2].key, columnTypes[2], FilterOperator.IsEqualTo, "999");
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`col2 = "999"`);
    });

    it("IsNotEqualTo - string", () => {
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[2].key, columnTypes[2], FilterOperator.IsNotEqualTo, "999");
      const expression = filterDescriptor.getFilterExpression();
      expect(expression).to.eq(`NOT col2 = "999"`);
    });
  });

  describe("FilterDescriptorCollectionBase", () => {
    it("remove should return true if successful", () => {
      const filterDescriptorCollection = new OperatorValueFilterDescriptorCollection();
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0]);
      filterDescriptorCollection.add(filterDescriptor);
      expect(filterDescriptorCollection.remove(filterDescriptor)).to.be.true;
    });

    it("remove should return false if unsuccessful", () => {
      const filterDescriptorCollection = new OperatorValueFilterDescriptorCollection();
      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0]);
      filterDescriptorCollection.add(filterDescriptor);

      const filterDescriptor2 = new TableFilterDescriptor(testTable, columns[1].key, columnTypes[1]);
      expect(filterDescriptorCollection.remove(filterDescriptor2)).to.be.false;
    });

    it("should determine isActive & count correctly", () => {
      const filterDescriptorCollection = new OperatorValueFilterDescriptorCollection();
      expect(filterDescriptorCollection.isActive).to.be.false;
      expect(filterDescriptorCollection.count).to.eq(0);

      const filterDescriptor = new TableFilterDescriptor(testTable, columns[0].key, columnTypes[0], FilterOperator.IsEqualTo, "Hello");
      filterDescriptorCollection.add(filterDescriptor);
      expect(filterDescriptorCollection.isActive).to.be.true;
      expect(filterDescriptorCollection.count).to.eq(1);
    });

  });

});
