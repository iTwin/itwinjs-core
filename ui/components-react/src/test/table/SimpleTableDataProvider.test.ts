/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { PrimitiveValue, PropertyConverterInfo, PropertyValueFormat } from "@itwin/appui-abstract";
import { SortDirection } from "@itwin/core-react";
import { ColumnDescription, RowItem, SimpleTableDataProvider } from "../../components-react";
import { TableFilterDescriptorCollection } from "../../components-react/table/columnfiltering/TableFilterDescriptorCollection";
import { TestUtils } from "../TestUtils";

const columns: ColumnDescription[] = [
  {
    key: "id",
    label: "ID",
    resizable: true,
    sortable: true,
    secondarySortColumn: 1,
  },
  {
    key: "title",
    label: "Title",
    sortable: true,
    resizable: true,
  },
  {
    key: "more",
    label: "More Data",
    sortable: true,
    resizable: false,
    editable: true,
  },
];

const createRow = (i: number) => {
  const enumValue = i % 4;
  const row: RowItem = { key: i.toString(), cells: [] };
  const convertInfo: PropertyConverterInfo = { name: "" };

  const propertyRecord = TestUtils.createPropertyRecord(i, columns[0], "int");
  propertyRecord.property.converter = convertInfo;
  row.cells.push({
    key: columns[0].key,
    record: propertyRecord,
  });
  row.cells.push({
    key: columns[1].key,
    record: TestUtils.createPropertyRecord(`Title ${i}`, columns[1], "text"),
  });
  row.cells.push({
    key: columns[2].key,
    record: TestUtils.createEnumProperty(columns[2].label, enumValue, columns[2]),
  });
  return row;
};

const createSecondarySortColumnTestRow = (i: number) => {
  const enumValue = i % 4;
  const row: RowItem = { key: i.toString(), cells: [] };
  row.cells.push({
    key: columns[0].key,
    record: TestUtils.createPropertyRecord(1, columns[0], "int"),   /* Always 1 */
  });
  row.cells.push({
    key: columns[1].key,
    record: TestUtils.createPropertyRecord(`Title ${i}`, columns[1], "text"),
  });
  row.cells.push({
    key: columns[2].key,
    record: TestUtils.createEnumProperty(columns[2].label, enumValue, columns[2]),
  });
  return row;
};

let rows: RowItem[];
let dataProvider: SimpleTableDataProvider;

describe("SimpleTableDataProvider", () => {

  before(() => {
    rows = new Array<RowItem>();
    for (let i = 1; i <= 1000; i++) {
      const row = createRow(i);
      rows.push(row);
    }
  });

  describe("constructor", () => {

    it("should set up columns", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      const columnDescriptions = await dataProvider.getColumns();
      expect(columnDescriptions.length).to.eq(3);
      expect(columnDescriptions[0].key).to.eq("id");
      expect(columnDescriptions[1].key).to.eq("title");
      expect(columnDescriptions[2].key).to.eq("more");
    });

    it("should throw Error if invalid row requested", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      expect(await dataProvider.getRowsCount()).to.eq(0);
      await expect(dataProvider.getRow(0)).to.be.rejected; // eslint-disable-line @typescript-eslint/await-thenable
    });
  });

  describe("setItems", () => {

    it("should set up correct number rows", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      expect(await dataProvider.getRowsCount()).to.eq(1000);
    });

    it("should set up 3 cells per rows", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      const testRow: RowItem = await dataProvider.getRow(0);
      expect(testRow.cells.length).to.eq(3);
    });

    it("should set up cells correctly per row", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      const testRow: RowItem = await dataProvider.getRow(0);
      expect(testRow.cells[0].key).to.eq("id");
      expect(testRow.cells[1].key).to.eq("title");
      expect(testRow.cells[2].key).to.eq("more");
    });

    it("properties & descriptions in cells should be set up correctly", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      const testRow: RowItem = await dataProvider.getRow(0);

      let testRecord = testRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyDescription = testRecord.property;
        expect(propertyDescription.displayLabel).to.equal("ID");
      }

      testRecord = testRow.cells[1].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyDescription = testRecord.property;
        expect(propertyDescription.displayLabel).to.equal("Title");
      }

      testRecord = testRow.cells[2].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyDescription = testRecord.property;
        expect(propertyDescription.displayLabel).to.equal("More Data");
      }
    });

    it("property values should be set up correctly", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      const testRow: RowItem = await dataProvider.getRow(0);
      let testRecord = testRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(1);
      }

      testRecord = testRow.cells[1].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal("Title 1");
      }

      testRecord = testRow.cells[2].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(1);
      }
    });

  });

  describe("sort", () => {

    it("sort numeric column descending", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      await dataProvider.sort(0, SortDirection.Descending);
      const testRow: RowItem = await dataProvider.getRow(0);
      const testRecord = testRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(1000);
      }
    });

    it("sort numeric column ascending", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      await dataProvider.sort(0, SortDirection.Descending);
      await dataProvider.sort(0, SortDirection.Ascending);

      const testRow: RowItem = await dataProvider.getRow(0);
      const testRecord = testRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(1);
      }
    });

    it("sort text column descending", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      await dataProvider.sort(1, SortDirection.Descending);
      const testRow: RowItem = await dataProvider.getRow(0);
      const testRecord = testRow.cells[1].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal("Title 999");
      }
    });

    it("sort text column ascending", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      await dataProvider.sort(1, SortDirection.Descending);
      await dataProvider.sort(1, SortDirection.Ascending);

      const testRow: RowItem = await dataProvider.getRow(0);
      const testRecord = testRow.cells[1].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal("Title 1");
      }
    });

    it("sort column with SortDirection.NoSort", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      await dataProvider.sort(0, SortDirection.NoSort);
      const testRow: RowItem = await dataProvider.getRow(0);
      const testRecord = testRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(1);
      }
    });

  });

  describe("getRow", () => {

    it("getRow unfiltered should ignore sort", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      await dataProvider.sort(1, SortDirection.Descending);

      const testRow: RowItem = await dataProvider.getRow(0, true);
      const testRecord = testRow.cells[1].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal("Title 1");
      }
    });

  });

  describe("secondarySortColumn ", () => {

    let secondarySortColumnRows: RowItem[];

    before(() => {
      secondarySortColumnRows = new Array<RowItem>();
      for (let i = 1; i <= 1000; i++) {
        const row = createSecondarySortColumnTestRow(i);
        secondarySortColumnRows.push(row);
      }
    });

    it("sorting column with secondarySortColumn", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(secondarySortColumnRows);

      // Sort on column 0
      await dataProvider.sort(0, SortDirection.Descending);
      const testRow: RowItem = await dataProvider.getRow(0);

      // But test column 1, since it's the secondarySortColumn for column 0
      const testRecord = testRow.cells[1].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal("Title 999");
      }
    });

  });

  describe("MutableTableDataProvider methods", () => {

    let smallTestRows: RowItem[];
    const SMALL_NUM_ROWS = 10;

    beforeEach(() => {
      smallTestRows = new Array<RowItem>();
      for (let i = 1; i <= SMALL_NUM_ROWS; i++) {
        const row = createRow(i);
        smallTestRows.push(row);
      }
    });

    it("addRow should add a single row", async () => {
      dataProvider = new SimpleTableDataProvider(columns);

      let row = createRow(1);
      dataProvider.addRow(row);
      expect(await dataProvider.getRowsCount()).to.eq(1);

      for (let i = 2; i <= 10; i++) {
        row = createRow(i);
        dataProvider.addRow(row);
      }

      expect(await dataProvider.getRowsCount()).to.eq(10);
    });

    it("deleteRow should delete a single row & raise onRowsChanged", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(smallTestRows);

      const spyMethod = sinon.spy();
      dataProvider.onRowsChanged.addListener(spyMethod);

      const testRow: RowItem = await dataProvider.getRow(0);
      dataProvider.deleteRow(testRow, true);

      expect(await dataProvider.getRowsCount()).to.eq(SMALL_NUM_ROWS - 1);
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("deleteRow cannot delete a row that is not in the table", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      const spyMethod = sinon.spy();
      dataProvider.onRowsChanged.addListener(spyMethod);
      const testRow = smallTestRows[0];
      dataProvider.deleteRow(testRow);
      expect(spyMethod.called).to.be.false;
    });

    it("moveRow should move a row to the end", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(smallTestRows);

      const testRow: RowItem = await dataProvider.getRow(0);
      dataProvider.moveRow(testRow, -1);
      expect(await dataProvider.getRowsCount()).to.eq(SMALL_NUM_ROWS);

      const movedRow: RowItem = await dataProvider.getRow(SMALL_NUM_ROWS - 1);
      const testRecord = movedRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(1);
      }

      const oldRow: RowItem = await dataProvider.getRow(0);
      const testRecord2 = oldRow.cells[0].record;
      expect(testRecord2).to.not.be.undefined;
      if (testRecord2) {
        const propertyValue = testRecord2.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(2);
      }
    });

    it("moveRow should move a row to a certain location below current", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(smallTestRows);

      const testRow: RowItem = await dataProvider.getRow(SMALL_NUM_ROWS - 1);
      dataProvider.moveRow(testRow, 5);
      expect(await dataProvider.getRowsCount()).to.eq(SMALL_NUM_ROWS);

      const movedRow: RowItem = await dataProvider.getRow(5);
      const testRecord = movedRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(SMALL_NUM_ROWS);
      }
    });

    it("moveRow should move a row to a certain location above current", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(smallTestRows);

      const testRow: RowItem = await dataProvider.getRow(0);
      dataProvider.moveRow(testRow, 5);
      expect(await dataProvider.getRowsCount()).to.eq(SMALL_NUM_ROWS);

      const movedRow: RowItem = await dataProvider.getRow(4);
      const testRecord = movedRow.cells[0].record;
      expect(testRecord).to.not.be.undefined;
      if (testRecord) {
        const propertyValue = testRecord.value;
        expect(propertyValue.valueFormat).to.equal(PropertyValueFormat.Primitive);
        const primitiveValue = propertyValue as PrimitiveValue;
        expect(primitiveValue.value).to.equal(1);
      }
    });

    it("moveRow cannot move a row that is not in the table", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      const spyMethod = sinon.spy();
      dataProvider.onRowsChanged.addListener(spyMethod);
      const testRow = smallTestRows[0];
      const newIndex = dataProvider.moveRow(testRow, 0);
      expect(spyMethod.called).to.be.false;
      expect(newIndex).to.eq(-1);
    });

  });

  describe("Filtering methods", async () => {

    it("getDistinctValues should return correct number of values", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      let distinctValues = await dataProvider.getDistinctValues("");
      expect(distinctValues.values.length).to.eq(0);
      distinctValues = await dataProvider.getDistinctValues("id");
      expect(distinctValues.values.length).to.eq(1000);
      distinctValues = await dataProvider.getDistinctValues("title", 500);
      expect(distinctValues.values.length).to.eq(500);
      distinctValues = await dataProvider.getDistinctValues("more");
      expect(distinctValues.values.length).to.eq(4);
    });

    it("applyFilterDescriptors with clean filter should filter no rows", async () => {
      dataProvider = new SimpleTableDataProvider(columns);
      dataProvider.setItems(rows);

      const filterDescriptors = new TableFilterDescriptorCollection();

      await dataProvider.applyFilterDescriptors(filterDescriptors);
      const count = await dataProvider.getRowsCount();
      expect(count).to.eq(1000);
    });
  });

});
