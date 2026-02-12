/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ECSqlReader, QueryBinder, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import { SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("ECSqlRowReader", (() => {
  let iModel: SnapshotDb;
  let reader: ECSqlReader;

  before(async () => {
    iModel = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
  });

  after(async () => {
    iModel.close();
  });

  describe("bind Id64 enumerable", async () => {

    it("ecsql reader simple", async () => {
      const params = new QueryBinder();
      params.bindIdSet(1, ["0x1"]);
      const optionBuilder = new QueryOptionsBuilder();
      optionBuilder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM bis.Element WHERE InVirtualSet(?, ECInstanceId)", params, optionBuilder.getOptions());
      const rows = await reader.toArray();
      assert.equal(rows[0].id, "0x1");
      assert.equal(rows.length, 1);
    });

    it("ecsql reader simple for IdSet", async () => {
      const params = new QueryBinder();
      params.bindIdSet(1, ["0x1"]);
      const optionBuilder = new QueryOptionsBuilder();
      optionBuilder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM bis.Element, IdSet(?) WHERE id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES", params, optionBuilder.getOptions());
      const rows = await reader.toArray();
      assert.equal(rows[0].id, "0x1");
      assert.equal(rows.length, 1);
    });

    it("bindIdSet not working with integer Ids", async () => {
      const params = new QueryBinder();
      params.bindIdSet(1, ["50"]);
      const optionBuilder = new QueryOptionsBuilder();
      optionBuilder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM bis.Element WHERE InVirtualSet(?, ECInstanceId)", params, optionBuilder.getOptions());
      const rows = await reader.toArray();
      assert.equal(rows.length, 0);
    });

    it("ecsql reader simple using query row reader", async () => {
      // Use existing element from test.bim
      const elementId = "0x1";
      const params = new QueryBinder();
      params.bindId("firstId", elementId);

      reader = iModel.createQueryRowReader("SELECT ECInstanceId, ECClassId FROM bis.Element WHERE ECInstanceId=:firstId", params);
      assert.isTrue(await reader.step());
      assert.equal(reader.current.id, "0x1");
      assert.equal(reader.current.ecinstanceid, "0x1");
      assert.isDefined(reader.current.ecclassid);
      assert.equal(reader.current.ID, "0x1");
      assert.equal(reader.current.ECINSTANCEID, "0x1");
      assert.equal(reader.current[0], "0x1");
      assert.isDefined(reader.current[1]);

      const row0 = reader.current.toRow();
      assert.equal(row0.ECInstanceId, "0x1");
      assert.isDefined(row0.ECClassId);

      assert.isFalse(await reader.step());
    });
  });

  describe("Works as iterable iterator", () => {

    it("iterable in for loop", async () => {
      let actualRowCount = 0;
      const expectedRowCount = 46; // 46 Elements in test.bim
      for await (const row of iModel.createQueryRowReader("SELECT * FROM bis.Element")) {
        actualRowCount++;
        assert.isDefined(row[0]);
      }
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("iterable with .next()", async () => {
      let row: any;
      let actualRowCount = 0;
      let expectedRowCount = 0;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
      while ((row = await reader.next()).done === false) {
        actualRowCount++;
        expectedRowCount++;
        assert.equal(row.value[0], `0x${actualRowCount}`);
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });
  });

  describe("Get all rows", () => {
    let actualRowCount: number;
    const expectedRowCount = 46; // 46 Elements in test.bim

    beforeEach(async () => {
      actualRowCount = 0;
      reader = iModel.createQueryRowReader("SELECT * FROM bis.Element");
    });

    it("Get all rows using iterable iterator", async () => {
      for await (const _row of reader) {
        actualRowCount++;
      }
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get all rows using step", async () => {
      while (await reader.step()) {
        actualRowCount++;
      }
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get all rows using toArray", async () => {
      const rows = await reader.toArray();
      actualRowCount = rows.length;
      assert.equal(actualRowCount, expectedRowCount);
    });
  });

  describe("Get id from each row", () => {
    let actualRowCount: number;

    beforeEach(async () => {
      actualRowCount = 0;
    });

    it("Get id using iterable iterator with unspecified rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef");
      for await (const row of reader) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get id using iterable iterator with UseJsPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
      for await (const row of reader) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().id, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get id using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
      for await (const row of reader) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get id using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
      for await (const row of reader) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get id using step with unspecified rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef");
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get id using step with UseJsPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().id, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get id using step with UseECSqlPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get id using step with UseECSqlPropertyIndexes rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });
  });

  describe("Get duplicate property names", () => {
    let actualRowCount: number;

    beforeEach(async () => {
      actualRowCount = 0;
    });

    it("Get duplicate property names using iterable iterator with unspecified rowFormat", async () => {
      const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId");
      for await (const row of reader) {
        const currentExpectedId = expectedIds[counter - 1];
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get duplicate property names using iterable iterator with UseJsPropertyNames rowFormat", async () => {
      const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
      for await (const row of reader) {
        const currentExpectedId = expectedIds[counter - 1];
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().id, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get duplicate property names using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
      const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
      for await (const row of reader) {
        const currentExpectedId = expectedIds[counter - 1];
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get duplicate property names using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
      const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
      for await (const row of reader) {
        const currentExpectedId = expectedIds[counter - 1];
        assert.equal(row[0], currentExpectedId);
        assert.equal(row.id, currentExpectedId);
        assert.equal(row.ecinstanceid, currentExpectedId);
        assert.equal(row.ECINSTANCEID, currentExpectedId);
        assert.equal(row.ECInstanceId, currentExpectedId);
        assert.equal(row.toArray()[0], currentExpectedId);
        assert.equal(row.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });
  });

  describe("Get specific values", () => {
    let actualRowCount: number;

    beforeEach(async () => {
      actualRowCount = 0;
    });

    it("Get only ECInstanceId with unspecified rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get only ECInstanceId with UseJsPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().id, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get only ECInstanceId with UseECSqlPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get only ECInstanceId with UseECSqlPropertyIndexes rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.id, currentExpectedId);
        assert.equal(reader.current.ecinstanceid, currentExpectedId);
        assert.equal(reader.current.ECINSTANCEID, currentExpectedId);
        assert.equal(reader.current.ECInstanceId, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().ECInstanceId, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get one column with custom name with unspecified rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.customColumnName, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get one column with custom name with UseJsPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.customColumnName, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get one column with custom name with UseECSqlPropertyNames rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.customColumnName, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });

    it("Get one column with custom name with UseECSqlPropertyIndexes rowFormat", async () => {
      let counter = 1;
      reader = iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
      while (await reader.step()) {
        const currentExpectedId = `0x${counter}`;
        assert.equal(reader.current[0], currentExpectedId);
        assert.equal(reader.current.customColumnName, currentExpectedId);
        assert.equal(reader.current.toArray()[0], currentExpectedId);
        assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
        counter++;
        actualRowCount++;
        // Limit manually since QueryOptionsForRowByRowReader doesn't support limit
        if (actualRowCount >= 5) break;
      }
      assert.equal(actualRowCount, 5);
    });
  });

  describe("Get count of results", () => {
    let actualRowCount: number;
    const expectedRowCount = 46; // 46 Elements in test.bim

    beforeEach(async () => {
      actualRowCount = 0;
      reader = iModel.createQueryRowReader("SELECT COUNT(*) numResults FROM (SELECT * FROM bis.Element)");
    });

    it("Get count of rows using current index", async () => {
      await reader.step();
      actualRowCount = reader.current[0] as number;
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get count of rows using current column name", async () => {
      await reader.step();
      actualRowCount = reader.current.numResults as number;
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get count of rows using current and toRow", async () => {
      await reader.step();
      actualRowCount = reader.current.toRow().numResults as number;
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get count of rows using toArray result itself", async () => {
      await reader.step();
      actualRowCount = reader.current.toArray()[0] as number;
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get count of rows using iterable iterator and index", async () => {
      for await (const row of reader) {
        actualRowCount = row[0] as number;
      }
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get count of rows using iterable iterator and column name", async () => {
      for await (const row of reader) {
        actualRowCount = row.numResults as number;
      }
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("Get count of rows using iterable iterator and toRow", async () => {
      for await (const row of reader) {
        actualRowCount = row.toRow().numResults;
      }
      assert.equal(actualRowCount, expectedRowCount);
    });
  });

  describe("Tests for extendedType and extendType property behaviour of QueryPropertyMetaData", () => {

    it("Id type column with alias", async () => {
      reader = iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
      const metaData = await reader.getMetaData();
      assert.equal("Id", metaData[0].extendedType);
      assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
    });

    it("Id type column without alias", async () => {
      reader = iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
      const metaData = await reader.getMetaData();
      assert.equal("Id", metaData[0].extendedType);
      assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
    });

    it("ClassId type column", async () => {
      reader = iModel.createQueryRowReader("SELECT ECClassId FROM bis.Element ORDER BY ECClassId ASC");
      const metaData = await reader.getMetaData();
      assert.equal("ClassId", metaData[0].extendedType);
      assert.equal("ClassId", metaData[0].extendType);    // eslint-disable-line @typescript-eslint/no-deprecated
      assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
    });

    it("Column without extended type", async () => {
      reader = iModel.createQueryRowReader("SELECT s.Name FROM meta.ECSchemaDef s ORDER BY s.Name ASC");
      const metaData = await reader.getMetaData();
      assert.equal(undefined, metaData[0].extendedType);
      assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
    });

    it("Column without extended type with alias", async () => {
      reader = iModel.createQueryRowReader("SELECT s.Name a FROM meta.ECSchemaDef s ORDER BY a ASC");
      const metaData = await reader.getMetaData();
      assert.equal(undefined, metaData[0].extendedType);
      assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
    });

    it("Geometric type column with alias", async () => {
      reader = iModel.createQueryRowReader("select GeometryStream A from bis.GeometricElement3d LIMIT 1");
      const metaData = await reader.getMetaData();
      assert.equal("GeometryStream", metaData[0].extendedType);
      assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
    });

    it("Geometric type column without alias", async () => {
      reader = iModel.createQueryRowReader("select GeometryStream from bis.GeometricElement3d LIMIT 1");
      const metaData = await reader.getMetaData();
      assert.equal("GeometryStream", metaData[0].extendedType);
      assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
    });
  });
}));
