/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration, DbResult, OpenMode } from "@itwin/core-bentley";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelTestUtils } from "../IModelTestUtils";
import { SnapshotDb } from "../../IModelDb";
import { SQLiteDb } from "../../SQLiteDb";
import { SqliteChangesetReader } from "../../SqliteChangesetReader";
import "../TestUtils"; // registers the global mocha before/after hooks that start/stop the backend

describe("SQLiteDb", () => {

  it("should create new SQLiteDb", async () => {
    const fileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "db1.db");
    const db = new SQLiteDb();
    db.createDb(fileName, undefined, { rawSQLite: true, pageSize: 8 * 1024 });
    db.executeSQL("CREATE TABLE test1(id INTEGER PRIMARY KEY,val TEXT)");
    db.executeSQL(`INSERT INTO test1(id,val) VALUES (1,"val1")`);
    db.executeSQL(`INSERT INTO test1(id,val) VALUES (2,"val2")`);
    db.saveChanges();

    const testDb = () => {
      db.withSqliteStatement("SELECT id,val from test1", (stmt) => {
        stmt.step();
        expect(stmt.getValue(0).getInteger()).equal(1);
        expect(stmt.getValue(1).getString()).equal("val1");
        stmt.step();
        expect(stmt.getValue(0).getInteger()).equal(2);
        expect(stmt.getValue(1).getString()).equal("val2");
      });
      db.closeDb();
    };
    testDb();

    // now test immutable flag
    db.openDb(fileName, { openMode: OpenMode.Readonly, skipFileCheck: true, immutable: true, defaultTxn: SQLiteDb.DefaultTxnMode.None, rawSQLite: true });
    testDb();

    expect(db.isOpen).false;
    expect(() => db.vacuum()).throws("not open");

    let val = db.withOpenDb({ dbName: fileName, openMode: { openMode: OpenMode.ReadWrite, rawSQLite: true } }, () => {
      expect(db.isOpen);
      db.vacuum();
      return 22;
    });
    expect(val).equal(22);
    expect(db.isOpen).false;

    val = await db.withOpenDb({ dbName: fileName, openMode: { openMode: OpenMode.ReadWrite, rawSQLite: true } }, async () => {
      expect(db.isOpen);
      await BeDuration.fromMilliseconds(10).wait();
      return 100;
    });
    expect(val).equal(100);
    expect(db.isOpen).false;
  });

  it("should be able to open existing .bim file with SQLiteDb", () => {
    const testFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const db = new SQLiteDb();
    db.withOpenDb({ dbName: testFileName }, () => {
      db.withSqliteStatement(`SELECT StrData FROM be_Prop WHERE Namespace="ec_Db" AND Name="SchemaVersion"`, (stmt) => {
        expect(stmt.step()).equal(DbResult.BE_SQLITE_ROW);
        const val = JSON.parse(stmt.getValue(0).getString());
        expect(val.major).equal(4, "read major version");
        expect(val.minor).equal(0, "read minor version");
      });
    });
  });

  it("supports reading an iModel changeset with SQLiteDb", () => {
    const iModelFileName = IModelTestUtils.resolveAssetFile("_mocks_/ReadOnlyTest/ReadOnlyTest.bim");
    const changesetFileName = IModelTestUtils.resolveAssetFile("_mocks_/ReadOnlyTest/csets/dbe4b3824129f99e4eb485fb7cd9d2fea2354be1.cs");
    const iModel = SnapshotDb.openFile(iModelFileName);
    let tableName: string;
    let columnNames: string[];
    let expectedValues: Record<string, unknown>;
    let stage: "Old" | "New";
    try {
      using schemaReader = SqliteChangesetReader.openFile({ fileName: changesetFileName, db: iModel });
      expect(schemaReader.step()).true;
      tableName = schemaReader.tableName;
      columnNames = schemaReader.getColumnNames(tableName);
      stage = schemaReader.op === "Deleted" ? "Old" : "New";
      expectedValues = schemaReader.getChangeValuesObject(stage, { includeNullColumns: true })!;
    } finally {
      iModel.close();
    }

    const dbFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "changeset-reader.db");
    const db = new SQLiteDb();
    db.createDb(dbFileName, undefined, { rawSQLite: true });
    const declaredColumns = columnNames.slice(0, -1);

    try {
      using missingTableReader = SqliteChangesetReader.openFile({ fileName: changesetFileName, db, disableSchemaCheck: true });
      expect(missingTableReader.step()).true;
      expect(() => missingTableReader.getChangeValuesObject(stage)).throws(`changeset table ${tableName} does not exist`);

      db.executeSQL(`CREATE TABLE "${tableName}" (${declaredColumns.map((name) => `"${name}"`).join(",")})`);

      using checkedReader = SqliteChangesetReader.openFile({ fileName: changesetFileName, db });
      expect(checkedReader.step()).true;
      expect(() => checkedReader.getChangeValuesObject(stage)).throws("columns count does not match");

      using uncheckedReader = SqliteChangesetReader.openFile({ fileName: changesetFileName, db, disableSchemaCheck: true });
      expect(uncheckedReader.step()).true;
      const values = uncheckedReader.getChangeValuesObject(stage, { includeNullColumns: true });
      const expectedDeclaredValues = Object.fromEntries(declaredColumns.map((name) => [name, expectedValues[name]]));
      expect(values).deep.equal(expectedDeclaredValues);
    } finally {
      db.closeDb();
    }

    expect(() => SqliteChangesetReader.openFile({ fileName: changesetFileName, db, disableSchemaCheck: true })).throws("db must be open");
  });

  describe("applyChangeset", () => {
    const readRows = (db: SQLiteDb, tableName: string) => {
      const rows: Array<{ id: number, val: string }> = [];
      db.withSqliteStatement(`SELECT id,val FROM ${tableName} ORDER BY id`, (stmt) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW)
          rows.push({ id: stmt.getValue(0).getInteger(), val: stmt.getValue(1).getString() });
      });
      return rows;
    };

    it("should apply a changeset containing data changes", () => {
      const sourceFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-source.db");
      const targetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-target.db");
      const changesetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-1.changeset");

      // create the source db (with the table already present - raw sqlite changesets cannot capture DDL),
      // then capture a changeset that inserts some rows
      const source = new SQLiteDb();
      source.createDb(sourceFileName, undefined, { rawSQLite: true });
      source.executeSQL("CREATE TABLE test1(id INTEGER PRIMARY KEY,val TEXT)");
      source.saveChanges();
      source.startChangeTracking();
      source.executeSQL(`INSERT INTO test1(id,val) VALUES (1,'val1')`);
      source.executeSQL(`INSERT INTO test1(id,val) VALUES (2,'val2')`);
      source.saveChanges();
      source.createChangeset(changesetFileName);

      // apply the changeset (raw sqlite changesets have no header to validate) to a db with the same schema
      const target = new SQLiteDb();
      target.createDb(targetFileName, undefined, { rawSQLite: true });
      target.executeSQL("CREATE TABLE test1(id INTEGER PRIMARY KEY,val TEXT)");
      target.saveChanges();
      target.applyChangeset(changesetFileName);
      target.saveChanges();

      expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "val1" }, { id: 2, val: "val2" }]);

      source.closeDb();
      target.closeDb();
    });

    it("should throw when creating a changeset containing DDL/schema changes", () => {
      const sourceFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-ddl-source.db");
      const changesetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-ddl.changeset");

      const source = new SQLiteDb();
      source.createDb(sourceFileName, undefined, { rawSQLite: true });
      source.startChangeTracking();
      source.executeDdl("CREATE TABLE test1(id INTEGER PRIMARY KEY,val TEXT)");
      source.saveChanges();

      // raw sqlite changesets cannot represent DDL/schema changes
      expect(() => source.createChangeset(changesetFileName)).throws();

      source.closeDb();
    });

    it("should fail if applying a changeset produces a conflict, leaving it to the caller to abandon the partially-applied changes", () => {
      const baseFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-base.db");
      const sourceFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-conflict-source.db");
      const targetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-conflict-target.db");
      const changesetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "applyChangeset-2.changeset");

      // create a common base db with two rows, then clone it so source and target start out identical
      const base = new SQLiteDb();
      base.createDb(baseFileName, undefined, { rawSQLite: true });
      base.executeSQL("CREATE TABLE test1(id INTEGER PRIMARY KEY,val TEXT)");
      base.executeSQL(`INSERT INTO test1(id,val) VALUES (1,'base1')`);
      base.executeSQL(`INSERT INTO test1(id,val) VALUES (2,'base2')`);
      base.saveChanges();
      base.closeDb();

      IModelJsFs.copySync(baseFileName, sourceFileName);
      IModelJsFs.copySync(baseFileName, targetFileName);

      // diverge source: update both rows and capture that as a single changeset. Only the second row will
      // conflict with target's divergence below - the first row's change would apply cleanly on its own.
      const source = new SQLiteDb();
      source.openDb(sourceFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
      source.startChangeTracking();
      source.executeSQL(`UPDATE test1 SET val='fromSource1' WHERE id=1`);
      source.executeSQL(`UPDATE test1 SET val='fromSource2' WHERE id=2`);
      source.saveChanges();
      source.createChangeset(changesetFileName);
      source.closeDb();

      // diverge target independently - only on the second row - so applying source's changeset conflicts partway through
      const target = new SQLiteDb();
      target.openDb(targetFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
      target.executeSQL(`UPDATE test1 SET val='fromTarget2' WHERE id=2`);
      target.saveChanges();

      // confirm the pre-apply baseline: id=1 was never touched by target, id=2 diverged from source
      expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "fromTarget2" }]);

      // applyChangeset only throws on failure - it does not commit or abandon changes itself. Since the first
      // row's change didn't conflict, it may already have been applied to the current transaction by the time
      // the second row's conflict causes the throw.
      expect(() => target.applyChangeset(changesetFileName)).throws();
      expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "fromSource1" }, { id: 2, val: "fromTarget2" }]);

      // it is the caller's responsibility to abandon (or save) the partially-applied changes after catching the error
      target.abandonChanges();
      expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "fromTarget2" }]);

      target.closeDb();
    });
  });

});
