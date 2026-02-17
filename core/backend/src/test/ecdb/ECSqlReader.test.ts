/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, ECSqlReader, IModel, PhysicalElementProps, QueryBinder, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import { DefinitionModel, ElementTreeDeleter, ElementTreeWalkerScope, PhysicalModel, PhysicalObject, SnapshotDb, Subject } from "../../core-backend";
import { ECSqlWriteStatement } from "../../ECSqlStatement";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const assert = chai.assert;
const expect = chai.expect;


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
      const readers = [
        iModel.createQueryReader("SELECT * FROM bis.Element"),
        iModel.createQueryRowReader("SELECT * FROM bis.Element"),
      ];
      const expectedRowCount = 46; // 46 Elements in test.bim
      for (const r of readers) {
        let actualRowCount = 0;
        for await (const row of r) {
          actualRowCount++;
          assert.isDefined(row[0]);
        }
        assert.equal(actualRowCount, expectedRowCount);
      }
    });

    it("iterable with .next()", async () => {
      const readers = [
        iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } }),
        iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5"),
      ];
      for (const r of readers) {
        let row: any;
        let actualRowCount = 0;
        while ((row = await r.next()).done === false) {
          actualRowCount++;
          assert.equal(row.value[0], `0x${actualRowCount}`);
        }
        assert.equal(actualRowCount, 5);
      }
    });
  });

  describe("Common usages", () => {

    describe("Get all rows", () => {
      const expectedRowCount = 46; // 46 Elements in test.bim

      it("Get all rows using iterable iterator", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM bis.Element"),
          iModel.createQueryRowReader("SELECT * FROM bis.Element"),
        ];
        for (const r of readers) {
          let rowCount = 0;
          for await (const _row of r) {
            rowCount++;
          }
          assert.equal(rowCount, expectedRowCount);
        }
      });

      it("Get all rows using step", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM bis.Element"),
          iModel.createQueryRowReader("SELECT * FROM bis.Element"),
        ];
        for (const r of readers) {
          let rowCount = 0;
          while (await r.step()) {
            rowCount++;
          }
          assert.equal(rowCount, expectedRowCount);
        }
      });

      it("Get all rows using toArray", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM bis.Element"),
          iModel.createQueryRowReader("SELECT * FROM bis.Element"),
        ];
        for (const r of readers) {
          const rows = await r.toArray();
          assert.equal(rows.length, expectedRowCount);
        }
      });

    });

    describe("Get id from each row", () => {

      it("Get id using iterable iterator with unspecified rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 } }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5"),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get id using iterable iterator with UseJsPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().id, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get id using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get id using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get id using step with unspecified rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 } }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5"),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get id using step with UseJsPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().id, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get id using step with UseECSqlPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get id using step with UseECSqlPropertyIndexes rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
          iModel.createQueryRowReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });
    });

    describe("Get duplicate property names", () => {

      it("Get duplicate property names using iterable iterator with unspecified rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const readers = [
          iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 } }),
          iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5"),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = expectedIds[counter - 1];
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get duplicate property names using iterable iterator with UseJsPropertyNames rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const readers = [
          iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames }),
          iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = expectedIds[counter - 1];
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().id, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get duplicate property names using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const readers = [
          iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
          iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = expectedIds[counter - 1];
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get duplicate property names using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const readers = [
          iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
          iModel.createQueryRowReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          for await (const row of r) {
            const currentExpectedId = expectedIds[counter - 1];
            assert.equal(row[0], currentExpectedId);
            assert.equal(row.id, currentExpectedId);
            assert.equal(row.ecinstanceid, currentExpectedId);
            assert.equal(row.ECINSTANCEID, currentExpectedId);
            assert.equal(row.ECInstanceId, currentExpectedId);
            assert.equal(row.toArray()[0], currentExpectedId);
            assert.equal(row.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });
    });

    describe("Get specific values", () => {

      it("Get only ECInstanceId with unspecified rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } }),
          iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5"),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get only ECInstanceId with UseJsPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames }),
          iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().id, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get only ECInstanceId with UseECSqlPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
          iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get only ECInstanceId with UseECSqlPropertyIndexes rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
          iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.id, currentExpectedId);
            assert.equal(r.current.ecinstanceid, currentExpectedId);
            assert.equal(r.current.ECINSTANCEID, currentExpectedId);
            assert.equal(r.current.ECInstanceId, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().ECInstanceId, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get one column with custom name with unspecified rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } }),
          iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5"),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.customColumnName, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().customColumnName, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get one column with custom name with UseJsPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames }),
          iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.customColumnName, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().customColumnName, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get one column with custom name with UseECSqlPropertyNames rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
          iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.customColumnName, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().customColumnName, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });

      it("Get one column with custom name with UseECSqlPropertyIndexes rowFormat", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
          iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
        ];
        for (const r of readers) {
          let counter = 1;
          let rowCount = 0;
          while (await r.step()) {
            const currentExpectedId = `0x${counter}`;
            assert.equal(r.current[0], currentExpectedId);
            assert.equal(r.current.customColumnName, currentExpectedId);
            assert.equal(r.current.toArray()[0], currentExpectedId);
            assert.equal(r.current.toRow().customColumnName, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
      });
    });

    describe("Get count of results", () => {
      const expectedRowCount = 46; // 46 Elements in test.bim
      const sql = "SELECT COUNT(*) numResults FROM (SELECT * FROM bis.Element)";

      it("Get count of rows using current index", async () => {
        const readers = [
          iModel.createQueryReader(sql),
          iModel.createQueryRowReader(sql),
        ];
        for (const r of readers) {
          await r.step();
          assert.equal(r.current[0] as number, expectedRowCount);
        }
      });

      it("Get count of rows using current column name", async () => {
        const readers = [
          iModel.createQueryReader(sql),
          iModel.createQueryRowReader(sql),
        ];
        for (const r of readers) {
          await r.step();
          assert.equal(r.current.numResults as number, expectedRowCount);
        }
      });

      it("Get count of rows using current and toRow", async () => {
        const readers = [
          iModel.createQueryReader(sql),
          iModel.createQueryRowReader(sql),
        ];
        for (const r of readers) {
          await r.step();
          assert.equal(r.current.toRow().numResults as number, expectedRowCount);
        }
      });

      it("Get count of rows using toArray result itself", async () => {
        const readers = [
          iModel.createQueryReader(sql),
          iModel.createQueryRowReader(sql),
        ];
        for (const r of readers) {
          await r.step();
          assert.equal(r.current.toArray()[0] as number, expectedRowCount);
        }
      });

      it("Get count of rows using iterable iterator and index", async () => {
        const readers = [
          iModel.createQueryReader(sql),
          iModel.createQueryRowReader(sql),
        ];
        for (const r of readers) {
          let count = 0;
          for await (const row of r) {
            count = row[0] as number;
          }
          assert.equal(count, expectedRowCount);
        }
      });

      it("Get count of rows using iterable iterator and column name", async () => {
        const readers = [
          iModel.createQueryReader(sql),
          iModel.createQueryRowReader(sql),
        ];
        for (const r of readers) {
          let count = 0;
          for await (const row of r) {
            count = row.numResults as number;
          }
          assert.equal(count, expectedRowCount);
        }
      });

      it("Get count of rows using iterable iterator and toRow", async () => {
        const readers = [
          iModel.createQueryReader(sql),
          iModel.createQueryRowReader(sql),
        ];
        for (const r of readers) {
          let count = 0;
          for await (const row of r) {
            count = row.toRow().numResults;
          }
          assert.equal(count, expectedRowCount);
        }
      });

    });

    describe("Tests for extendedType and extendType property behaviour of QueryPropertyMetaData", () => {

      it("Id type column with alias", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC"),
          iModel.createQueryRowReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC"),
        ];
        for (const r of readers) {
          const metaData = await r.getMetaData();
          assert.equal("Id", metaData[0].extendedType);
          assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
      });

      it("Id type column without alias", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC"),
          iModel.createQueryRowReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC"),
        ];
        for (const r of readers) {
          const metaData = await r.getMetaData();
          assert.equal("Id", metaData[0].extendedType);
          assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
      });

      it("ClassId type column", async () => {
        const readers = [
          iModel.createQueryReader("SELECT ECClassId FROM bis.Element ORDER BY ECClassId ASC"),
          iModel.createQueryRowReader("SELECT ECClassId FROM bis.Element ORDER BY ECClassId ASC"),
        ];
        for (const r of readers) {
          const metaData = await r.getMetaData();
          assert.equal("ClassId", metaData[0].extendedType);
          assert.equal("ClassId", metaData[0].extendType);    // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
      });

      it("Column without extended type", async () => {
        const readers = [
          iModel.createQueryReader("SELECT s.Name FROM meta.ECSchemaDef s ORDER BY s.Name ASC"),
          iModel.createQueryRowReader("SELECT s.Name FROM meta.ECSchemaDef s ORDER BY s.Name ASC"),
        ];
        for (const r of readers) {
          const metaData = await r.getMetaData();
          assert.equal(undefined, metaData[0].extendedType);
          assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
      });

      it("Column without extended type with alias", async () => {
        const readers = [
          iModel.createQueryReader("SELECT s.Name a FROM meta.ECSchemaDef s ORDER BY a ASC"),
          iModel.createQueryRowReader("SELECT s.Name a FROM meta.ECSchemaDef s ORDER BY a ASC"),
        ];
        for (const r of readers) {
          const metaData = await r.getMetaData();
          assert.equal(undefined, metaData[0].extendedType);
          assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
      });

      it("Geometric type column with alias", async () => {
        const readers = [
          iModel.createQueryReader("select GeometryStream A from bis.GeometricElement3d LIMIT 1"),
          iModel.createQueryRowReader("select GeometryStream A from bis.GeometricElement3d LIMIT 1"),
        ];
        for (const r of readers) {
          const metaData = await r.getMetaData();
          assert.equal("GeometryStream", metaData[0].extendedType);
          assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
      });

      it("Geometric type column without alias", async () => {
        const readers = [
          iModel.createQueryReader("select GeometryStream from bis.GeometricElement3d LIMIT 1"),
          iModel.createQueryRowReader("select GeometryStream from bis.GeometricElement3d LIMIT 1"),
        ];
        for (const r of readers) {
          const metaData = await r.getMetaData();
          assert.equal("GeometryStream", metaData[0].extendedType);
          assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
      });

    });
  });

  describe("ECSql Row reader test with clearCaches", async () => {
    const expectedRowCount = 46; // 46 Elements in test.bim

    it("should work with multiple clearCaches", async () => {
      let actualRowCount = 0;
      const expectedInstanceIds = ["0x1", "0xe", "0x10", "0x11", "0x12",
        "0x13", "0x14", "0x15", "0x16", "0x17", "0x18", "0x19", "0x1a", "0x1b",
        "0x1c", "0x1d", "0x1e", "0x1f", "0x20", "0x21", "0x22", "0x23", "0x24", "0x25",
        "0x26", "0x27", "0x28", "0x29", "0x2a", "0x2b", "0x2c", "0x2d", "0x2e", "0x2f", "0x30",
        "0x31", "0x32", "0x33", "0x34", "0x35", "0x36", "0x37", "0x38", "0x39", "0x3a", "0x3b"];
      // First loop - read first 10 rows
      reader = iModel.createQueryRowReader("SELECT * FROM bis.Element");
      let loopCount = 0;
      while (loopCount < 10) {
        await reader.step()
        actualRowCount++;
        loopCount++;
        assert.isDefined(reader.current[0]);
        assert.equal(reader.current[0], expectedInstanceIds[actualRowCount - 1]);
      }
      assert.equal(loopCount, 10);
      iModel.clearCaches();

      // Second loop - read next 15 rows
      loopCount = 0;
      while (loopCount < 15) {
        await reader.step()
        actualRowCount++;
        loopCount++;
        assert.isDefined(reader.current[0]);
        assert.equal(reader.current[0], expectedInstanceIds[actualRowCount - 1]);
      }
      assert.equal(loopCount, 15);
      iModel.clearCaches();

      // Third loop - read next 10 rows
      loopCount = 0;
      while (loopCount < 10) {
        await reader.step()
        actualRowCount++;
        loopCount++;
        assert.isDefined(reader.current[0]);
        assert.equal(reader.current[0], expectedInstanceIds[actualRowCount - 1]);
      }
      assert.equal(loopCount, 10);
      iModel.clearCaches();

      // Fourth loop - read remaining rows
      loopCount = 0;
      while (await reader.step()) {
        actualRowCount++;
        loopCount++;
        assert.isDefined(reader.current[0]);
        assert.equal(reader.current[0], expectedInstanceIds[actualRowCount - 1]);
      }
      assert.equal(loopCount, 11); // 46 - 10 - 15 - 10 = 11
      assert.equal(actualRowCount, expectedRowCount);
    });

    it("should throw error if we try to step on a closed iModelDb object", async () => {
      let actualRowCount = 0;
      const imodelPath = iModel.pathName;
      // First loop - read first 10 rows
      reader = iModel.createQueryRowReader("SELECT * FROM bis.Element");
      let loopCount = 0;
      while (loopCount < 10) {
        await reader.step();
        assert.isDefined(reader.current[0]);
        actualRowCount++;
        loopCount++;
      }
      assert.equal(loopCount, 10);
      iModel.close();

      // Second loop - read next 15 rows
      iModel = SnapshotDb.openFile(imodelPath);
      await expect(reader.step()).to.be.rejectedWith("Cannot query a closed Db"); // step to initialize reader after reopening iModel
    });
  });
}));

describe("createQueryReader vs createQueryRowReader", () => {
  /** Deletes an entire element tree, including sub-models, child elements and code scope references.
   * Items are deleted in bottom-up order. Definitions and Subjects are deleted after normal elements.
   * Call deleteNormalElements on each tree. Then call deleteSpecialElements.
   */
  class TestElementCascadingDeleter extends ElementTreeDeleter {
    protected shouldVisitCodeScopes(
      _elementId: Id64String,
      _scope: ElementTreeWalkerScope
    ) {
      return true;
    }

    /** The main tree-walking function */
    protected override processElementTree(
      element: Id64String,
      scope: ElementTreeWalkerScope
    ): void {
      if (this.shouldVisitCodeScopes(element, scope)) {
        this._processCodeScopes(element, scope);
      }
      super.processElementTree(element, scope);
    }
    /** Process code scope references */
    private _processCodeScopes(
      element: Id64String,
      scope: ElementTreeWalkerScope
    ) {
      const newScope = new ElementTreeWalkerScope(scope, element);
      // eslint-disable-next-line @itwin/no-internal, deprecation/deprecation
      this._iModel.withPreparedStatement(
        `
        SELECT ECInstanceId
        FROM bis.Element
        WHERE CodeScope.id=?
          AND Parent.id IS NULL
      `,
        (stmt) => {
          stmt.bindId(1, element);
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            const elementId = stmt.getValue(0).getId();
            this.processElementTree(elementId, newScope);
          }
        }
      );
    }
  }

  // Actual test begins here
  let iModelDb: SnapshotDb;

  function createTestIModelWithScopedPhysicalObject() {
    const pathForEmpty = IModelTestUtils.prepareOutputFile(
      "ECReferenceTypesCache",
      "empty.bim"
    );
    const testIModelDb = SnapshotDb.createEmpty(pathForEmpty, {
      rootSubject: { name: "empty " },
    });

    const subjectId = Subject.insert(
      testIModelDb,
      IModel.rootSubjectId,
      "Subject",
      "Subject Description"
    );

    const physicalModelId = PhysicalModel.insert(
      testIModelDb,
          subjectId,
          "Physical"
        );

    const definitionModelId = DefinitionModel.insert(
      testIModelDb,
      subjectId,
      "Definition"
    );

    const spatialCategoryId = IModelTestUtils.insertSpatialCategory(
      testIModelDb,
      definitionModelId,
      "SpatialCategory",
      ColorDef.green
    );

    const physicalObjectProps5: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "ScopingElement",
    };

    const scopingElement =
    testIModelDb.elements.insertElement(physicalObjectProps5);

    const childElement: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: { spec: "0x1", scope: scopingElement },
      userLabel: "ScopedElement",
    };
    testIModelDb.elements.insertElement(childElement);
    testIModelDb.saveChanges();
    return testIModelDb;
  }

  beforeEach(async () => {
    iModelDb = createTestIModelWithScopedPhysicalObject();
  });

  afterEach(async () => {
    iModelDb.close();
  });

  it("Failing while using createQueryReader()", async () => {
    const sql = `
    SELECT ECInstanceId
    FROM ${PhysicalObject.classFullName}
    `;
    const reader = iModelDb.createQueryReader(sql, undefined, {usePrimaryConn: true});
    const elementTreeDeleter = new TestElementCascadingDeleter(iModelDb);
    await reader.step(); // step to initialize reader
    const firstId = reader.current[0];
    elementTreeDeleter.deleteNormalElements(firstId);
    await reader.step(); // step to initialize reader
    const secondId = reader.current[0];
    // This is because ecsqlreader built using createQueryReader caches results and so when it tries to access the second element, it is already deleted from the database and it throws "Not Found" error.
    expect(() => elementTreeDeleter.deleteNormalElements(secondId)).to.throw();
  });

  it("Passing while using withPreparedStatement()", async () => {
    const sql = `
    SELECT ECInstanceId
    FROM ${PhysicalObject.classFullName}
    `;
    const reader = iModelDb.createQueryRowReader(sql);
    const elementTreeDeleter = new TestElementCascadingDeleter(iModelDb);
    let cntSteps = 0;
    while (await reader.step()) {
      const id = reader.current[0];
      console.log(`createQueryReader: Deleting ${id}`);
      elementTreeDeleter.deleteNormalElements(id);
      cntSteps++;
    }
    assert.equal(cntSteps, 1);
  });
});

