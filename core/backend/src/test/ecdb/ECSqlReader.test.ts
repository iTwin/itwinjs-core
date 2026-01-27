import { assert } from "chai";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64String } from "@itwin/core-bentley";
import { AxisAlignedBox3d, Code, ColorDef, ECSqlReader, IModel, PhysicalElementProps, Placement3d, QueryBinder, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import { DefinitionModel, Model, PhysicalModel, PhysicalObject, SnapshotDb, SpatialCategory } from "../../core-backend";
import { ECSqlStatement, ECSqlWriteStatement } from "../../ECSqlStatement";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { Point3d, Range3d } from "@itwin/core-geometry";

describe("ECSqlReader", (() => {
  let iModel: SnapshotDb;
  let reader: ECSqlReader;

  before(async () => {
    iModel = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
  });

  after(async () => {
    iModel.close();
  });

  describe("bind Id64 enumerable", async () => {
    const outDir = KnownTestLocations.outputDir;

    it("ecsql reader simple", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "test.ecdb",
        `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`);
      assert.isTrue(ecdb.isOpen);
      ecdb.saveChanges();
      const params = new QueryBinder();
      params.bindIdSet(1, ["0x32"]);
      const optionBuilder = new QueryOptionsBuilder();
      optionBuilder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
      reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)", params, optionBuilder.getOptions());
      const rows = await reader.toArray();
      assert.equal(rows[0].id, "0x32");
      assert.equal(rows.length, 1);
    });

    it("ecsql reader simple for IdSet", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "test.ecdb",
        `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`);
        assert.isTrue(ecdb.isOpen);
        ecdb.saveChanges();
        const params = new QueryBinder();
        params.bindIdSet(1, ["0x32"]);
        const optionBuilder = new QueryOptionsBuilder();
        optionBuilder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
        reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef, IdSet(?) WHERE id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES", params, optionBuilder.getOptions());
        const rows = await reader.toArray();
        assert.equal(rows[0].id, "0x32");
        assert.equal(rows.length, 1);
    });

    it("bindIdSet not working with integer Ids", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "test.ecdb",
        `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`)
      assert.isTrue(ecdb.isOpen);
      ecdb.saveChanges();
      const params = new QueryBinder();
      params.bindIdSet(1, ["50"]);
      const optionBuilder = new QueryOptionsBuilder();
      optionBuilder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
      reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)", params, optionBuilder.getOptions());
      const rows = await reader.toArray();
      assert.equal(rows.length, 0);
    });

    it("ecsql reader simple using query reader", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "test.ecdb",
        `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`);
      assert.isTrue(ecdb.isOpen);

      const r = await ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n) VALUES(20)", async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      ecdb.saveChanges();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      assert.equal(r.id, "0x1");

      const params = new QueryBinder();
      params.bindId("firstId", r.id!);

      reader = ecdb.createQueryReader("SELECT ECInstanceId, n FROM ts.Foo WHERE ECInstanceId=:firstId", params, { limit: { count: 1 } });
      assert.isTrue(await reader.step());
      assert.equal(reader.current.id, "0x1");
      assert.equal(reader.current.ecinstanceid, "0x1");
      assert.equal(reader.current.n, 20);
      assert.equal(reader.current.ID, "0x1");
      assert.equal(reader.current.ECINSTANCEID, "0x1");
      assert.equal(reader.current[0], "0x1");
      assert.equal(reader.current[1], 20);

      const row0 = reader.current.toRow();
      assert.equal(row0.ECInstanceId, "0x1");
      assert.equal(row0.n, 20);

      assert.isFalse(await reader.step());
    });
  });

  describe("Works as iterable iterator", () => {

    it("iterable in for loop", async () => {
      let actualRowCount = 0;
      const expectedRowCount = 46; // 46 Elements in test.bim
      for await (const row of iModel.createQueryReader("SELECT * FROM bis.Element")) {
        actualRowCount++;
        assert.isDefined(row[0]);
      }
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("iterable with .next()", async () => {
      let row: any;
      let actualRowCount = 0;
      reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } });
      while ((row = await reader.next()).done === false) {
        actualRowCount++;
        assert.equal(row.value[0], `0x${actualRowCount}`);
      }
      assert.equal(actualRowCount, 5);
    });
  });

  describe("Common usages", () => {
    let actualRowCount: number;

    beforeEach(async () => {
      actualRowCount = 0;
    });

    describe("Get all rows", () => {
      const expectedRowCount = 46; // 46 Elements in test.bim

      beforeEach(async () => {
        reader = iModel.createQueryReader("SELECT * FROM bis.Element");
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

      it("Get id using iterable iterator with unspecified rowFormat", async () => {
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 } })) {
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get id using iterable iterator with UseJsPropertyNames rowFormat", async () => {
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames })) {
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get id using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get id using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes })) {
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get id using step with unspecified rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 } });
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get id using step with UseJsPropertyNames rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get id using step with UseECSqlPropertyNames rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get id using step with UseECSqlPropertyIndexes rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
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
        }
        assert.equal(actualRowCount, 5);
      });
    });

    describe("Get duplicate property names", () => {

      it("Get duplicate property names using iterable iterator with unspecified rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 } })) {
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get duplicate property names using iterable iterator with UseJsPropertyNames rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames })) {
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get duplicate property names using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get duplicate property names using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        let counter = 1;
        for await (const row of iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes })) {
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
        }
        assert.equal(actualRowCount, 5);
      });
    });

    describe("Get specific values", () => {

      it("Get only ECInstanceId with unspecified rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } });
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get only ECInstanceId with UseJsPropertyNames rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get only ECInstanceId with UseECSqlPropertyNames rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get only ECInstanceId with UseECSqlPropertyIndexes rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
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
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get one column with custom name with unspecified rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } });
        while (await reader.step()) {
          const currentExpectedId = `0x${counter}`;
          assert.equal(reader.current[0], currentExpectedId);
          assert.equal(reader.current.customColumnName, currentExpectedId);
          assert.equal(reader.current.toArray()[0], currentExpectedId);
          assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
          counter++;
          actualRowCount++;
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get one column with custom name with UseJsPropertyNames rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
        while (await reader.step()) {
          const currentExpectedId = `0x${counter}`;
          assert.equal(reader.current[0], currentExpectedId);
          assert.equal(reader.current.customColumnName, currentExpectedId);
          assert.equal(reader.current.toArray()[0], currentExpectedId);
          assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
          counter++;
          actualRowCount++;
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get one column with custom name with UseECSqlPropertyNames rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        while (await reader.step()) {
          const currentExpectedId = `0x${counter}`;
          assert.equal(reader.current[0], currentExpectedId);
          assert.equal(reader.current.customColumnName, currentExpectedId);
          assert.equal(reader.current.toArray()[0], currentExpectedId);
          assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
          counter++;
          actualRowCount++;
        }
        assert.equal(actualRowCount, 5);
      });

      it("Get one column with custom name with UseECSqlPropertyIndexes rowFormat", async () => {
        let counter = 1;
        reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        while (await reader.step()) {
          const currentExpectedId = `0x${counter}`;
          assert.equal(reader.current[0], currentExpectedId);
          assert.equal(reader.current.customColumnName, currentExpectedId);
          assert.equal(reader.current.toArray()[0], currentExpectedId);
          assert.equal(reader.current.toRow().customColumnName, currentExpectedId);
          counter++;
          actualRowCount++;
        }
        assert.equal(actualRowCount, 5);
      });
    });

    describe("Get count of results", () => {
      const expectedRowCount = 46; // 46 Elements in test.bim

      beforeEach(async () => {
        reader = iModel.createQueryReader("SELECT COUNT(*) numResults FROM (SELECT * FROM bis.Element)");
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
        reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
        const metaData = await reader.getMetaData();
        assert.equal("Id", metaData[0].extendedType);
        assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      });

      it("Id type column without alias", async () => {
        reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
        const metaData = await reader.getMetaData();
        assert.equal("Id", metaData[0].extendedType);
        assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      });

      it("ClassId type column", async () => {
        reader = iModel.createQueryReader("SELECT ECClassId FROM bis.Element ORDER BY ECClassId ASC");
        const metaData = await reader.getMetaData();
        assert.equal("ClassId", metaData[0].extendedType);
        assert.equal("ClassId", metaData[0].extendType);    // eslint-disable-line @typescript-eslint/no-deprecated
        assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      });

      it("Column without extended type", async () => {
        reader = iModel.createQueryReader("SELECT s.Name FROM meta.ECSchemaDef s ORDER BY s.Name ASC");
        const metaData = await reader.getMetaData();
        assert.equal(undefined, metaData[0].extendedType);
        assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      });

      it("Column without extended type with alias", async () => {
        reader = iModel.createQueryReader("SELECT s.Name a FROM meta.ECSchemaDef s ORDER BY a ASC");
        const metaData = await reader.getMetaData();
        assert.equal(undefined, metaData[0].extendedType);
        assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      });

      it("Geometric type column with alias", async () => {
        reader = iModel.createQueryReader("select GeometryStream A from bis.GeometricElement3d LIMIT 1");
        const metaData = await reader.getMetaData();
        assert.equal("GeometryStream", metaData[0].extendedType);
        assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      });

      it("Geometric type column without alias", async () => {
        reader = iModel.createQueryReader("select GeometryStream from bis.GeometricElement3d LIMIT 1");
        const metaData = await reader.getMetaData();
        assert.equal("GeometryStream", metaData[0].extendedType);
        assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
      });

    });
  });
  it.only("Check for query bug", async () => {
    // Copied directly from test in transformer to create the imodel showing a problem during the query
    // create source iModel
    const sourceDbFile: string = IModelTestUtils.prepareOutputFile(
      "QueryReader",
      "Query-Test-Source.bim"
    );
    const sourceDb = SnapshotDb.createEmpty(sourceDbFile, {
      rootSubject: { name: "Transform3d-Source" },
    });
    const categoryId: Id64String = SpatialCategory.insert(
      sourceDb,
      IModel.dictionaryId,
      "SpatialCategory",
      { color: ColorDef.green.toJSON() }
    );
    const sourceModelId: Id64String = PhysicalModel.insert(
      sourceDb,
      IModel.rootSubjectId,
      "Physical"
    );
    const xArray: number[] = [1, 3, 5, 7, 9];
    const yArray: number[] = [0, 2, 4, 6, 8];
    for (const x of xArray) {
      for (const y of yArray) {
        const physicalObjectProps1: PhysicalElementProps = {
          classFullName: PhysicalObject.classFullName,
          model: sourceModelId,
          category: categoryId,
          code: Code.createEmpty(),
          userLabel: `PhysicalObject(${x},${y})`,
          geom: IModelTestUtils.createBox(Point3d.create(1, 1, 1)),
          placement: Placement3d.fromJSON({ origin: { x, y }, angles: {} }),
        };
        sourceDb.elements.insertElement(physicalObjectProps1);
      }
    }
    const sourceModel: PhysicalModel =
      sourceDb.models.getModel<PhysicalModel>(sourceModelId);
    const sourceModelExtents: AxisAlignedBox3d = sourceModel.queryExtents();
    assert.deepEqual(sourceModelExtents, new Range3d(1, 0, 0, 10, 9, 1));

    // Mimic query that is causing problem during transformer.
    const parentModelId = '0x1';
    const sql = `SELECT ECInstanceId FROM ${Model.classFullName} WHERE ParentModel.Id=:parentModelId ORDER BY ECInstanceId`;

    // result that is incorrect and ends with only 2 rows being found. Resulting ids are 0xe, 0x10
    // same result can be found if you do const result = sourceDb.createQueryReader(sql), and check the contents of result
    const params = new QueryBinder().bindId("parentModelId", parentModelId);
    let queryReaderRowCount = 0;
    for await (const row of sourceDb.createQueryReader(sql, params)) {
     queryReaderRowCount++;
    }

    // correct result, ids collected are 0xe, 0x10, 0x13
    let withPreparedSqliteStatementCount = 0;
    sourceDb.withPreparedStatement(
      sql,
      (statement: ECSqlStatement): void => {
        statement.bindId("parentModelId", parentModelId);
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
         withPreparedSqliteStatementCount++;
        }
      }
    );
    assert.equal(queryReaderRowCount, withPreparedSqliteStatementCount);
  });

}));
