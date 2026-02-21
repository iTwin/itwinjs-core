/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, ECSqlReader, IModel, PhysicalElementProps, QueryBinder, QueryOptionsBuilder, QueryRowFormat, QueryRowProxy } from "@itwin/core-common";
import { DefinitionModel, ECSqlSyncReader, ElementTreeDeleter, ElementTreeWalkerScope, PhysicalModel, PhysicalObject, SnapshotDb, Subject } from "../../core-backend";
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
      const readerCallback = async (readerObj: ECSqlReader) => {
        const rows = await readerObj.toArray();
        assert.equal(rows[0].id, "0x32");
        assert.equal(rows.length, 1);
      }
      const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
        const rows = syncReader.toArray();
        assert.equal(rows[0].id, "0x32");
        assert.equal(rows.length, 1);
      }
      ecdb.withQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)", syncReaderCallback, params, optionBuilder.getOptions());
      const reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)", params, optionBuilder.getOptions());
      await readerCallback(reader);
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
      const readerCallback = async (readerObj: ECSqlReader) => {
        const rows = await readerObj.toArray();
        assert.equal(rows[0].id, "0x32");
        assert.equal(rows.length, 1);
      }
      const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
        const rows = syncReader.toArray();
        assert.equal(rows[0].id, "0x32");
        assert.equal(rows.length, 1);
      }
      ecdb.withQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef, IdSet(?) WHERE id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES", syncReaderCallback, params, optionBuilder.getOptions());
      const reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef, IdSet(?) WHERE id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES", params, optionBuilder.getOptions());
      await readerCallback(reader);
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
      const readerCallback = async (readerObj: ECSqlReader) => {
        const rows = await readerObj.toArray();
        assert.equal(rows.length, 0);
      }
      const syncreaderCallback = (syncReader: ECSqlSyncReader) => {
        const rows = syncReader.toArray();
        assert.equal(rows.length, 0);
      }
      ecdb.withQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)", syncreaderCallback, params, optionBuilder.getOptions());
      const reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)", params, optionBuilder.getOptions());
      await readerCallback(reader);
    });

    it("ecsql reader simple using query reader", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "test.ecdb",
        `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`);
      assert.isTrue(ecdb.isOpen);

      const insertResult = await ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n) VALUES(20)", async (stmt: ECSqlWriteStatement) => {
        return stmt.stepForInsert();
      });
      ecdb.saveChanges();
      assert.equal(insertResult.status, DbResult.BE_SQLITE_DONE);
      assert.equal(insertResult.id, "0x1");

      const params = new QueryBinder();
      params.bindId("firstId", insertResult.id!);
      const resultAssertCallback = (queryReader: ECSqlReader | ECSqlSyncReader) => {
        assert.equal(queryReader.current.id, "0x1");
        assert.equal(queryReader.current.ecinstanceid, "0x1");
        assert.equal(queryReader.current.n, 20);
        assert.equal(queryReader.current.ID, "0x1");
        assert.equal(queryReader.current.ECINSTANCEID, "0x1");
        assert.equal(queryReader.current[0], "0x1");
        assert.equal(queryReader.current[1], 20);

        const row0 = queryReader.current.toRow();
        assert.equal(row0.ECInstanceId, "0x1");
        assert.equal(row0.n, 20);
      }
      const readerCallback = async (readerObj: ECSqlReader) => {
        assert.isTrue(await readerObj.step());
        resultAssertCallback(readerObj);
        assert.isFalse(await readerObj.step());
      }
      const synReaderCallback = (syncReader: ECSqlSyncReader) => {
        assert.isTrue(syncReader.step());
        resultAssertCallback(syncReader);
        assert.isFalse(syncReader.step());
      }
      ecdb.withQueryReader("SELECT ECInstanceId, n FROM ts.Foo WHERE ECInstanceId=:firstId LIMIT 1", synReaderCallback, params);
      const reader = ecdb.createQueryReader("SELECT ECInstanceId, n FROM ts.Foo WHERE ECInstanceId=:firstId", params, { limit: { count: 1 } });
      await readerCallback(reader);
    });

    it("ecsql reader simple using query row reader", async () => {
      // Use existing element from test.bim
      const elementId = "0x1";
      const params = new QueryBinder();
      params.bindId("firstId", elementId);
      const resultAssertCallback = (queryReader: ECSqlReader | ECSqlSyncReader) => {
        assert.equal(queryReader.current.id, "0x1");
        assert.equal(queryReader.current.ecinstanceid, "0x1");
        assert.isDefined(queryReader.current.ecclassid);
        assert.equal(queryReader.current.ID, "0x1");
        assert.equal(queryReader.current.ECINSTANCEID, "0x1");
        assert.equal(queryReader.current[0], "0x1");
        assert.isDefined(queryReader.current[1]);

        const row0 = queryReader.current.toRow();
        assert.equal(row0.ECInstanceId, "0x1");
        assert.isDefined(row0.ECClassId);
      }
      const readerCallback = async (readerObj: ECSqlReader) => {
        assert.isTrue(await readerObj.step());
        resultAssertCallback(readerObj);
        assert.isFalse(await readerObj.step());
      }
      const synReaderCallback = (syncReader: ECSqlSyncReader) => {
        assert.isTrue(syncReader.step());
        resultAssertCallback(syncReader);
        assert.isFalse(syncReader.step());
      }
      iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element WHERE ECInstanceId=:firstId", synReaderCallback, params);
      const reader = iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element WHERE ECInstanceId=:firstId", params, { limit: { count: 1 } });
      await readerCallback(reader);
    });
  });

  describe("Works as iterable iterator", () => {

    it("iterable in for loop", async () => {
      const expectedRowCount = 46; // 46 Elements in test.bim
      const readerCallback = async (readerObj: ECSqlReader) => {
        let actualRowCount = 0;
        for await (const row of readerObj) {
          actualRowCount++;
          assert.isDefined(row[0]);
        }
        assert.equal(actualRowCount, expectedRowCount);
      }
      const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
        let actualRowCount = 0;
        for (const row of syncReader) {
          actualRowCount++;
          assert.isDefined(row[0]);
        }
        assert.equal(actualRowCount, expectedRowCount);
      }
      iModel.withQueryReader("SELECT * FROM bis.Element", syncReaderCallback);
      const reader = iModel.createQueryReader("SELECT * FROM bis.Element");
      await readerCallback(reader);
    });

    it("iterable with .next()", async () => {
      const readerCallback = async (readerObj: ECSqlReader) => {
        let row: any;
        let actualRowCount = 0;
        while ((row = await readerObj.next()).done === false) {
          actualRowCount++;
          assert.equal(row.value[0], `0x${actualRowCount}`);
        }
        assert.equal(actualRowCount, 5);
      }
      const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
        let row: any;
        let actualRowCount = 0;
        while ((row = syncReader.next()).done === false) {
          actualRowCount++;
          assert.equal(row.value[0], `0x${actualRowCount}`);
        }
        assert.equal(actualRowCount, 5);
      }
      iModel.withQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback);
      const reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } });
      await readerCallback(reader);
    });
  });

  describe("Common usages", () => {

    describe("Get all rows", () => {
      const expectedRowCount = 46; // 46 Elements in test.bim

      it("Get all rows using iterable iterator", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          let rowCount = 0;
          for await (const _row of readerObj) {
            rowCount++;
          }
          assert.equal(rowCount, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let rowCount = 0;
          for (const _row of syncReader) {
            rowCount++;
          }
          assert.equal(rowCount, expectedRowCount);
        }
        iModel.withQueryReader("SELECT * FROM bis.Element", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT * FROM bis.Element");
        await readerCallback(reader);
      });

      it("Get all rows using step", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          let rowCount = 0;
          while (await readerObj.step()) {
            rowCount++;
          }
          assert.equal(rowCount, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let rowCount = 0;
          while (syncReader.step()) {
            rowCount++;
          }
          assert.equal(rowCount, expectedRowCount);
        }
        iModel.withQueryReader("SELECT * FROM bis.Element", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT * FROM bis.Element");
        await readerCallback(reader);
      });

      it("Get all rows using toArray", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          const rows = await readerObj.toArray();
          assert.equal(rows.length, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const rows = syncReader.toArray();
          assert.equal(rows.length, expectedRowCount);
        }
        iModel.withQueryReader("SELECT * FROM bis.Element", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT * FROM bis.Element");
        await readerCallback(reader);
      });

    });

    describe("Get id from each row", () => {

      it("Get id using iterable iterator with unspecified rowFormat", async () => {
        const resultAssertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 } });
        await readerCallback(reader);
      });

      it("Get id using iterable iterator with UseJsPropertyNames rowFormat", async () => {
        const resultAssertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().id, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
        await readerCallback(reader);
      });

      it("Get id using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
        const resultAssertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        await readerCallback(reader);
      });

      it("Get id using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
        const resultAssertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncreaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", syncreaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        await readerCallback(reader);
      });

      it("Get id using step with unspecified rowFormat", async () => {
        const resultAssertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().ECInstanceId, expectedId);
        }

        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const synReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }

        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", synReaderCallback);
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 } });
        await readerCallback(reader);
      });

      it("Get id using step with UseJsPropertyNames rowFormat", async () => {
        const resultAssertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().id, expectedId);
        }

        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultAssertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
        await readerCallback(reader);
      });

      it("Get id using step with UseECSqlPropertyNames rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        await readerCallback(reader);
      });

      it("Get id using step with UseECSqlPropertyIndexes rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM meta.ECSchemaDef LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        const reader = iModel.createQueryReader("SELECT * FROM meta.ECSchemaDef", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        await readerCallback(reader);
      });
    });

    describe("Get duplicate property names", () => {

      it("Get duplicate property names using iterable iterator with unspecified rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const resultassertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 } });
        await readerCallback(reader);
      });

      it("Get duplicate property names using iterable iterator with UseJsPropertyNames rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const resultassertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().id, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
        const reader = iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
        await readerCallback(reader);
      });

      it("Get duplicate property names using iterable iterator with UseECSqlPropertyNames rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const resultassertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        const reader = iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        await readerCallback(reader);
      });

      it("Get duplicate property names using iterable iterator with UseECSqlPropertyIndexes rowFormat", async () => {
        const expectedIds = ["0x1", "0xe", "0x10", "0x11", "0x12"];
        const resultassertCallback = (row: QueryRowProxy, expectedId: string) => {
          assert.equal(row[0], expectedId);
          assert.equal(row.id, expectedId);
          assert.equal(row.ecinstanceid, expectedId);
          assert.equal(row.ECINSTANCEID, expectedId);
          assert.equal(row.ECInstanceId, expectedId);
          assert.equal(row.toArray()[0], expectedId);
          assert.equal(row.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          for await (const row of readerObj) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncreaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          for (const row of syncReader) {
            const currentExpectedId = expectedIds[counter - 1];
            resultassertCallback(row, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId LIMIT 5", syncreaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        const reader = iModel.createQueryReader("SELECT * FROM bis.Element c JOIN bis.Element p ON p.ECInstanceId = c.ECInstanceId", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        await readerCallback(reader);
      });
    });

    describe("Get specific values", () => {

      it("Get only ECInstanceId with unspecified rowFormat", async () => {
        const resuktassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().ECInstanceId, expectedId);
        }

        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resuktassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resuktassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } });
        await readerCallback(reader);
      });

      it("Get only ECInstanceId with UseJsPropertyNames rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().id, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
        const reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
        await readerCallback(reader);
      });

      it("Get only ECInstanceId with UseECSqlPropertyNames rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        const reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        await readerCallback(reader);
      });

      it("Get only ECInstanceId with UseECSqlPropertyIndexes rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.id, expectedId);
          assert.equal(queryReader.current.ecinstanceid, expectedId);
          assert.equal(queryReader.current.ECINSTANCEID, expectedId);
          assert.equal(queryReader.current.ECInstanceId, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().ECInstanceId, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        const reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        await readerCallback(reader);
      });

      it("Get one column with custom name with unspecified rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.customColumnName, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().customColumnName, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 } });
        await readerCallback(reader);
      });

      it("Get one column with custom name with UseJsPropertyNames rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.customColumnName, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().customColumnName, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
        const reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseJsPropertyNames });
        await readerCallback(reader);
      });

      it("Get one column with custom name with UseECSqlPropertyNames rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.customColumnName, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().customColumnName, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        const reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
        await readerCallback(reader);
      });

      it("Get one column with custom name with UseECSqlPropertyIndexes rowFormat", async () => {
        const resultassertCallback = (queryReader: ECSqlReader | ECSqlSyncReader, expectedId: string) => {
          assert.equal(queryReader.current[0], expectedId);
          assert.equal(queryReader.current.customColumnName, expectedId);
          assert.equal(queryReader.current.toArray()[0], expectedId);
          assert.equal(queryReader.current.toRow().customColumnName, expectedId);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          let counter = 1;
          let rowCount = 0;
          while (await readerObj.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(readerObj, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let counter = 1;
          let rowCount = 0;
          while (syncReader.step()) {
            const currentExpectedId = `0x${counter}`;
            resultassertCallback(syncReader, currentExpectedId);
            counter++;
            rowCount++;
          }
          assert.equal(rowCount, 5);
        }
        iModel.withQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC LIMIT 5", syncReaderCallback, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        const reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", undefined, { limit: { count: 5 }, rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
        await readerCallback(reader);
      });
    });

    describe("Get count of results", () => {
      const expectedRowCount = 46; // 46 Elements in test.bim
      const sql = "SELECT COUNT(*) numResults FROM (SELECT * FROM bis.Element)";

      it("Get count of rows using current index", async () => {
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          syncReader.step();
          assert.equal(syncReader.current[0] as number, expectedRowCount);
        }
        const readerCallback = async (readerObj: ECSqlReader) => {
          await readerObj.step();
          assert.equal(readerObj.current[0] as number, expectedRowCount);
        }
        iModel.withQueryReader(sql, syncReaderCallback);
        const reader = iModel.createQueryReader(sql);
        await readerCallback(reader);
      });

      it("Get count of rows using current column name", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          await readerObj.step();
          assert.equal(readerObj.current.numResults as number, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          syncReader.step();
          assert.equal(syncReader.current.numResults as number, expectedRowCount);
        }
        iModel.withQueryReader(sql, syncReaderCallback);
        const reader = iModel.createQueryReader(sql);
        await readerCallback(reader);
      });

      it("Get count of rows using current and toRow", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          await readerObj.step();
          assert.equal(readerObj.current.toRow().numResults as number, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          syncReader.step();
          assert.equal(syncReader.current.toRow().numResults as number, expectedRowCount);
        }
        iModel.withQueryReader(sql, syncReaderCallback);
        const reader = iModel.createQueryReader(sql);
        await readerCallback(reader);
      });

      it("Get count of rows using toArray result itself", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          await readerObj.step();
          assert.equal(readerObj.current.toArray()[0] as number, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          syncReader.step();
          assert.equal(syncReader.current.toArray()[0] as number, expectedRowCount);
        }
        iModel.withQueryReader(sql, syncReaderCallback);
        const reader = iModel.createQueryReader(sql);
        await readerCallback(reader);
      });

      it("Get count of rows using iterable iterator and index", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          let count = 0;
          for await (const row of readerObj) {
            count = row[0] as number;
          }
          assert.equal(count, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let count = 0;
          for (const row of syncReader) {
            count = row[0] as number;
          }
          assert.equal(count, expectedRowCount);
        }
        iModel.withQueryReader(sql, syncReaderCallback);
        const reader = iModel.createQueryReader(sql);
        await readerCallback(reader);
      });

      it("Get count of rows using iterable iterator and column name", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          let count = 0;
          for await (const row of readerObj) {
            count = row.numResults as number;
          }
          assert.equal(count, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let count = 0;
          for (const row of syncReader) {
            count = row.numResults as number;
          }
          assert.equal(count, expectedRowCount);
        }
        iModel.withQueryReader(sql, syncReaderCallback);
        const reader = iModel.createQueryReader(sql);
        await readerCallback(reader);
      });

      it("Get count of rows using iterable iterator and toRow", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          let count = 0;
          for await (const row of readerObj) {
            count = row.toRow().numResults;
          }
          assert.equal(count, expectedRowCount);
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          let count = 0;
          for (const row of syncReader) {
            count = row.toRow().numResults;
          }
          assert.equal(count, expectedRowCount);
        }
        iModel.withQueryReader(sql, syncReaderCallback);
        const reader = iModel.createQueryReader(sql);
        await readerCallback(reader);
      });

    });

    describe("Tests for extendedType and extendType property behaviour of QueryPropertyMetaData", () => {

      it("Id type column with alias", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          const metaData = await readerObj.getMetaData();
          assert.equal("Id", metaData[0].extendedType);
          assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const metaData = syncReader.getMetaData();
          assert.equal("Id", metaData[0].extendedType);
          assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        iModel.withQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT ECInstanceId customColumnName FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
        await readerCallback(reader);
      });

      it("Id type column without alias", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          const metaData = await readerObj.getMetaData();
          assert.equal("Id", metaData[0].extendedType);
          assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const metaData = syncReader.getMetaData();
          assert.equal("Id", metaData[0].extendedType);
          assert.equal("Id", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        iModel.withQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT ECInstanceId FROM meta.ECSchemaDef ORDER BY ECInstanceId ASC");
        await readerCallback(reader);
      });

      it("ClassId type column", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          const metaData = await readerObj.getMetaData();
          assert.equal("ClassId", metaData[0].extendedType);
          assert.equal("ClassId", metaData[0].extendType);    // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const metaData = syncReader.getMetaData();
          assert.equal("ClassId", metaData[0].extendedType);
          assert.equal("ClassId", metaData[0].extendType);    // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        iModel.withQueryReader("SELECT ECClassId FROM bis.Element ORDER BY ECClassId ASC", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT ECClassId FROM bis.Element ORDER BY ECClassId ASC");
        await readerCallback(reader);
      });

      it("Column without extended type", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          const metaData = await readerObj.getMetaData();
          assert.equal(undefined, metaData[0].extendedType);
          assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const metaData = syncReader.getMetaData();
          assert.equal(undefined, metaData[0].extendedType);
          assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        iModel.withQueryReader("SELECT s.Name FROM meta.ECSchemaDef s ORDER BY s.Name ASC", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT s.Name FROM meta.ECSchemaDef s ORDER BY s.Name ASC");
        await readerCallback(reader);
      });

      it("Column without extended type with alias", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          const metaData = await readerObj.getMetaData();
          assert.equal(undefined, metaData[0].extendedType);
          assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const metaData = syncReader.getMetaData();
          assert.equal(undefined, metaData[0].extendedType);
          assert.equal("", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        iModel.withQueryReader("SELECT s.Name a FROM meta.ECSchemaDef s ORDER BY a ASC", syncReaderCallback);
        const reader = iModel.createQueryReader("SELECT s.Name a FROM meta.ECSchemaDef s ORDER BY a ASC");
        await readerCallback(reader);
      });

      it("Geometric type column with alias", async () => {
        const readerCallback = async (readerObj: ECSqlReader | ECSqlSyncReader) => {
          const metaData = await readerObj.getMetaData();
          assert.equal("GeometryStream", metaData[0].extendedType);
          assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const metaData = syncReader.getMetaData();
          assert.equal("GeometryStream", metaData[0].extendedType);
          assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        iModel.withQueryReader("select GeometryStream A from bis.GeometricElement3d LIMIT 1", syncReaderCallback);
        const reader = iModel.createQueryReader("select GeometryStream A from bis.GeometricElement3d LIMIT 1");
        await readerCallback(reader);
      });

      it("Geometric type column without alias", async () => {
        const readerCallback = async (readerObj: ECSqlReader) => {
          const metaData = await readerObj.getMetaData();
          assert.equal("GeometryStream", metaData[0].extendedType);
          assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        const syncReaderCallback = (syncReader: ECSqlSyncReader) => {
          const metaData = syncReader.getMetaData();
          assert.equal("GeometryStream", metaData[0].extendedType);
          assert.equal("GeometryStream", metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
          assert.equal(metaData[0].extendedType, metaData[0].extendType);   // eslint-disable-line @typescript-eslint/no-deprecated
        }
        iModel.withQueryReader("select GeometryStream from bis.GeometricElement3d LIMIT 1", syncReaderCallback);
        const reader = iModel.createQueryReader("select GeometryStream from bis.GeometricElement3d LIMIT 1");
        await readerCallback(reader);
      });

    });
  });
}));

describe("createQueryReader vs withQueryReader ", () => {
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
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
    const reader = iModelDb.createQueryReader(sql, undefined, { usePrimaryConn: true });
    const elementTreeDeleter = new TestElementCascadingDeleter(iModelDb);
    await reader.step(); // step to initialize reader
    const firstId = reader.current[0];
    elementTreeDeleter.deleteNormalElements(firstId);
    await reader.step(); // step to initialize reader
    const secondId = reader.current[0];
    // This is because ecsqlreader built using createQueryReader caches results and so when it tries to access the second element, it is already deleted from the database and it throws "Not Found" error.
    expect(() => elementTreeDeleter.deleteNormalElements(secondId)).to.throw();
  });

  it("Passing while using withQueryReader()", async () => {
    const sql = `
    SELECT ECInstanceId
    FROM ${PhysicalObject.classFullName}
    `;
    iModelDb.withQueryReader(sql, (reader) => {
      const elementTreeDeleter = new TestElementCascadingDeleter(iModelDb);
      let cntSteps = 0;
      while (reader.step()) {
        const id = reader.current[0];
        elementTreeDeleter.deleteNormalElements(id);
        cntSteps++;
      }
      assert.equal(cntSteps, 1);
    });
  });
});

