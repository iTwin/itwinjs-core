/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { BeDuration, DbConflictCause, DbConflictResolution, DbOpcode, DbResult, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelTestUtils } from "../IModelTestUtils";
import { SnapshotDb } from "../../IModelDb";
import { SQLiteDb, VersionedSqliteDb } from "../../SQLiteDb";
import { SqliteChangesetReader } from "../../SqliteChangesetReader";
import { SqliteError } from "@itwin/core-common";
import { _nativeDb } from "../../internal/Symbols";
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

  it("should throw incompatible-version error when VersionedSqliteDb version is not satisfied", () => {
    class TestVersionedDb extends VersionedSqliteDb {
      public override readonly myVersion = "0.2.0";
      protected override createDDL() { }
    }
    class OldVersionDb extends VersionedSqliteDb {
      public override readonly myVersion = "0.1.0";
      protected override createDDL() { }
    }

    const fileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "versioned.db");
    TestVersionedDb.createNewDb(fileName);

    const db = new OldVersionDb();
    expect(() => db.openDb(fileName, OpenMode.Readonly)).to.throw().that.satisfies((err: unknown) => {
      return SqliteError.isError(err, "incompatible-version") && err.dbName === fileName && err.message.includes("requires newer version of OldVersionDb for read");
    });
    expect(db.isOpen).false;
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
    const applyFlags = SQLiteDb.ApplyChangesetFlags;
    const policy = SQLiteDb.ChangesetConflictPolicy;
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

      expect(() => target.applyChangeset(changesetFileName, applyFlags.None, policy.AbortOnAnyConflict)).throws();
      target.abandonChanges();
      expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "fromTarget2" }]);

      target.closeDb();
    });

    const withChangeset = (name: string, sourceSql: string[], targetSql: string[], test: (target: SQLiteDb, changesetFile: string, targetFile: string) => void) => {
      const sourceFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", `${name}-source.db`);
      const targetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", `${name}-target.db`);
      const changesetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", `${name}.changeset`);
      const source = new SQLiteDb();
      const target = new SQLiteDb();
      try {
        source.createDb(sourceFileName, undefined, { rawSQLite: true });
        source.executeSQL("CREATE TABLE test1(id INTEGER PRIMARY KEY,val TEXT NOT NULL UNIQUE)");
        source.executeSQL("INSERT INTO test1 VALUES (1,'base1'),(2,'base2')");
        source.saveChanges();
        source.closeDb();
        IModelJsFs.copySync(sourceFileName, targetFileName);

        source.openDb(sourceFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        source.startChangeTracking();
        for (const sql of sourceSql)
          source.executeSQL(sql);
        source.saveChanges();
        source.createChangeset(changesetFileName);

        target.openDb(targetFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        for (const sql of targetSql)
          target.executeSQL(sql);
        target.saveChanges();
        test(target, changesetFileName, targetFileName);
      } finally {
        if (source.isOpen)
          source.closeDb();
        if (target.isOpen)
          target.closeDb();
      }
    };

    const conflictCases = [
      {
        name: "replace primary-key insert conflicts",
        sourceSql: "INSERT INTO test1 VALUES (3,'incoming')",
        targetSql: "INSERT INTO test1 VALUES (3,'existing')",
        expected: [{ id: 1, val: "base1" }, { id: 2, val: "base2" }, { id: 3, val: "incoming" }],
      },
      {
        name: "skip deletes of missing rows",
        sourceSql: "DELETE FROM test1 WHERE id=1",
        targetSql: "DELETE FROM test1 WHERE id=1",
        expected: [{ id: 2, val: "base2" }],
      },
      {
        name: "skip updates of missing rows",
        sourceSql: "UPDATE test1 SET val='incoming' WHERE id=1",
        targetSql: "DELETE FROM test1 WHERE id=1",
        expected: [{ id: 2, val: "base2" }],
      },
      {
        name: "replace conflicting update values",
        sourceSql: "UPDATE test1 SET val='incoming' WHERE id=1",
        targetSql: "UPDATE test1 SET val='existing' WHERE id=1",
        expected: [{ id: 1, val: "incoming" }, { id: 2, val: "base2" }],
      },
      {
        name: "apply deletes despite conflicting before-values",
        sourceSql: "DELETE FROM test1 WHERE id=1",
        targetSql: "UPDATE test1 SET val='existing' WHERE id=1",
        expected: [{ id: 2, val: "base2" }],
      },
      {
        name: "skip incoming changes that violate unique constraints",
        sourceSql: "INSERT INTO test1 VALUES (3,'incoming')",
        targetSql: "UPDATE test1 SET val='incoming' WHERE id=2",
        expected: [{ id: 1, val: "base1" }, { id: 2, val: "incoming" }],
      },
    ];

    for (const [index, testCase] of conflictCases.entries()) {
      it(`should ${testCase.name} with the no-local-changes policy`, () => {
        withChangeset(`no-local-changes-${index}`, [testCase.sourceSql], [testCase.targetSql], (target, changesetFileName, targetFileName) => {
          const beforeApply = readRows(target, "test1");
          expect(() => target.applyChangeset(changesetFileName)).throws();
          target.abandonChanges();
          expect(readRows(target, "test1")).deep.equal(beforeApply);

          target.applyChangeset(changesetFileName, applyFlags.None, policy.NoLocalChanges);
          expect(readRows(target, "test1")).deep.equal(testCase.expected);
          target.abandonChanges();
          expect(readRows(target, "test1")).deep.equal(beforeApply);
          target.applyChangeset(changesetFileName, applyFlags.None, policy.NoLocalChanges);
          target.saveChanges();
          target.closeDb();
          target.openDb(targetFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
          expect(readRows(target, "test1")).deep.equal(testCase.expected);
        });
      });
    }

    it("should combine Invert and IgnoreNoop without invoking a conflict handler for no-op deletes", () => {
      withChangeset("invert-ignore-noop", ["INSERT INTO test1 VALUES (3,'incoming')"], ["INSERT INTO test1 VALUES (3,'incoming')"], (target, file) => {
        target.applyChangeset(file, applyFlags.Invert);
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "base2" }]);
        target.applyChangeset(file, applyFlags.Invert | applyFlags.IgnoreNoop, () => {
          throw new Error("No-op delete should not invoke the conflict handler");
        });
        target.applyChangeset(file);
        target.applyChangeset(file, applyFlags.IgnoreNoop, () => {
          throw new Error("No-op insert should not invoke the conflict handler");
        });
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "base2" }, { id: 3, val: "incoming" }]);
      });
    });

    for (const insert of [false, true]) {
      it(`should replace indirect ${insert ? "insert conflicts with a warning" : "update conflicts without warnings"} with the no-local-changes policy`, () => {
        const indirectSql = insert ? "INSERT INTO test1 VALUES (3,'incoming')" : "UPDATE test1 SET val='incoming' WHERE id=2";
        const targetSql = insert ? "INSERT INTO test1 VALUES (3,'existing')" : "UPDATE test1 SET val='existing' WHERE id=2";
        withChangeset(`indirect-${insert ? "insert" : "update"}`, [
          `CREATE TRIGGER indirect_change AFTER UPDATE ON test1 WHEN NEW.id=1 BEGIN ${indirectSql}; END`,
          "UPDATE test1 SET val='direct' WHERE id=1",
        ], [targetSql], (target, file, targetFile) => {
          const conflicts: SQLiteDb.ChangesetConflictArgs[] = [];
          target.applyChangeset(file, applyFlags.None, (args) => {
            conflicts.push(args);
            return DbConflictResolution.Replace;
          });
          expect(conflicts).lengthOf(1);
          expect(conflicts[0]).include({ cause: insert ? DbConflictCause.Conflict : DbConflictCause.Data, indirect: true });
          target.abandonChanges();

          const sandbox = sinon.createSandbox();
          const category = "BeSQLite";
          const levels = { ...Logger.categoryFilter, [category]: LogLevel.Warning };
          sandbox.stub(Logger, "categoryFilter").get(() => levels);
          const logWarning = sandbox.spy(Logger, "logWarning");
          Logger.onLogLevelChanged.raiseEvent();
          try {
            target.applyChangeset(file, applyFlags.None, policy.NoLocalChanges);
            expect(logWarning.calledWith(category)).equal(insert);
          } finally {
            sandbox.restore();
            Logger.onLogLevelChanged.raiseEvent();
          }
          const expected = insert
            ? [{ id: 1, val: "direct" }, { id: 2, val: "base2" }, { id: 3, val: "incoming" }]
            : [{ id: 1, val: "direct" }, { id: 2, val: "incoming" }];
          expect(readRows(target, "test1")).deep.equal(expected);
          target.saveChanges();
          target.closeDb();
          target.openDb(targetFile, { openMode: OpenMode.ReadWrite, rawSQLite: true });
          expect(readRows(target, "test1")).deep.equal(expected);
        });
      });
    }

    it("should expose NoUpdateLoop independently of conflict policy", () => {
      withChangeset("no-update-loop", [
        "UPDATE test1 SET val='temp' WHERE id=1",
        "UPDATE test1 SET val='base1' WHERE id=2",
        "UPDATE test1 SET val='base2' WHERE id=1",
      ], [], (target, file) => {
        target.applyChangeset(file);
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base2" }, { id: 2, val: "base1" }]);
        target.abandonChanges();
        expect(() => target.applyChangeset(file, applyFlags.NoUpdateLoop)).throws();
        target.abandonChanges();
        target.applyChangeset(file, applyFlags.NoUpdateLoop, policy.NoLocalChanges);
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "base2" }]);
      });
    });

    it("should let a custom handler skip a conflicting insert and retain its copied arguments", () => {
      withChangeset("custom-conflict", ["INSERT INTO test1 VALUES (3,'incoming')"], ["INSERT INTO test1 VALUES (3,'existing')"], (target, file) => {
        const conflicts: SQLiteDb.ChangesetConflictArgs[] = [];
        target.applyChangeset(file, applyFlags.None, (args) => {
          conflicts.push(args);
          return DbConflictResolution.Skip;
        });
        expect(conflicts).deep.equal([{
          cause: DbConflictCause.Conflict,
          opcode: DbOpcode.Insert,
          indirect: false,
          tableName: "test1",
          columnCount: 2,
          primaryKeyColumns: [0],
        }]);
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "base2" }, { id: 3, val: "existing" }]);
      });
    });

    it("should honor custom Replace and Abort resolutions and propagate callback exceptions", () => {
      withChangeset("custom-resolution", ["UPDATE test1 SET val='incoming' WHERE id=1"], ["UPDATE test1 SET val='existing' WHERE id=1"], (target, file) => {
        target.applyChangeset(file, applyFlags.None, (args) => {
          expect(args.cause).equal(DbConflictCause.Data);
          expect(args).deep.equal({
            cause: DbConflictCause.Data,
            opcode: DbOpcode.Update,
            indirect: false,
            tableName: "test1",
            columnCount: 2,
            primaryKeyColumns: [0],
          });
          return DbConflictResolution.Replace;
        });
        expect(readRows(target, "test1")[0]).deep.equal({ id: 1, val: "incoming" });
        target.abandonChanges();

        expect(() => target.applyChangeset(file, applyFlags.None, () => DbConflictResolution.Abort)).throws();
        target.abandonChanges();
        const error = new Error("custom conflict failure");
        expect(() => target.applyChangeset(file, applyFlags.None, () => { throw error; })).throws(error);
        target.abandonChanges();
        expect(readRows(target, "test1")[0]).deep.equal({ id: 1, val: "existing" });
        target.applyChangeset(file, applyFlags.None, () => DbConflictResolution.Replace);
        expect(readRows(target, "test1")[0]).deep.equal({ id: 1, val: "incoming" });
      });
    });

    it("should reject invalid flags, policies, and custom resolutions", () => {
      withChangeset("invalid-apply-options", ["INSERT INTO test1 VALUES (3,'incoming')"], ["INSERT INTO test1 VALUES (3,'existing')"], (target, file) => {
        const applyChangeset = target.applyChangeset.bind(target);
        for (const flags of [-1, 16, 0.5, Number.NaN, Number.POSITIVE_INFINITY, true])
          expect(() => Reflect.apply(applyChangeset, undefined, [file, flags])).throws(TypeError);
        expect(() => Reflect.apply(applyChangeset, undefined, [file, applyFlags.None, 2])).throws(TypeError);
        for (const resolution of [undefined, -1, 3, 0.5, Number.NaN, Promise.resolve(DbConflictResolution.Skip)]) {
          expect(() => Reflect.apply(applyChangeset, undefined, [file, applyFlags.None, (): unknown => resolution])).throws(TypeError);
          target.abandonChanges();
        }
      });
    });

    it("should reject reentrant lifecycle and transaction changes while allowing conflict queries", () => {
      withChangeset("reentrant-apply", ["UPDATE test1 SET val='incoming' WHERE id=1"], ["UPDATE test1 SET val='existing' WHERE id=1"], (target, file, targetFile) => {
        const nativeDb = target[_nativeDb];
        const operations = [
          () => target.saveChanges(),
          () => target.abandonChanges(),
          () => nativeDb.restartDefaultTxn(),
          () => target.closeDb(),
          () => nativeDb.dispose(),
          () => target.openDb(targetFile, OpenMode.ReadWrite),
          () => target.createDb(targetFile),
          () => target.applyChangeset(file),
          () => target.vacuum(),
          () => nativeDb.analyze(),
          () => nativeDb.enableWalMode(),
          () => nativeDb.performCheckpoint(),
          () => nativeDb.setAutoCheckpointThreshold(100),
          () => target.executeDdl("DROP TABLE test1"),
          () => target.startChangeTracking(),
          () => target.createChangeset(file),
          () => nativeDb.saveFileProperty({ namespace: "test", name: "test" }, "value"),
        ];
        let calls = 0;
        target.applyChangeset(file, applyFlags.None, () => {
          ++calls;
          expect(readRows(target, "test1")[0]).deep.equal({ id: 1, val: "existing" });
          for (const operation of operations)
            expect(operation).throws("cannot modify or close database while applying a changeset");
          expect(target.isOpen).true;
          return DbConflictResolution.Replace;
        });
        expect(calls).equal(1);
        target.saveChanges();
        target.closeDb();
        target.openDb(targetFile, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        expect(readRows(target, "test1")[0]).deep.equal({ id: 1, val: "incoming" });
      });
    });

    it("should release the apply guard after a reentrant operation aborts the callback", () => {
      withChangeset("reentrant-apply-failure", [
        "UPDATE test1 SET val='incoming1' WHERE id=1",
        "UPDATE test1 SET val='incoming2' WHERE id=2",
      ], ["UPDATE test1 SET val='existing' WHERE id=2"], (target, file) => {
        expect(() => target.applyChangeset(file, applyFlags.None, () => {
          target.saveChanges();
          return DbConflictResolution.Replace;
        })).throws("cannot modify or close database while applying a changeset");
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "incoming1" }, { id: 2, val: "existing" }]);
        target.abandonChanges();
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "base1" }, { id: 2, val: "existing" }]);
        target.applyChangeset(file, applyFlags.None, () => DbConflictResolution.Replace);
        expect(readRows(target, "test1")).deep.equal([{ id: 1, val: "incoming1" }, { id: 2, val: "incoming2" }]);
      });
    });

    for (const testCase of [conflictCases[1], conflictCases[5]]) {
      it(`should reject Replace when the handler must ${testCase.name}`, () => {
        withChangeset(`invalid-replace-${testCase.name}`, [testCase.sourceSql], [testCase.targetSql], (target, file) => {
          const beforeApply = readRows(target, "test1");
          expect(() => target.applyChangeset(file, applyFlags.None, () => DbConflictResolution.Replace))
            .throws(TypeError, "Replace is valid only for data and primary-key insert conflicts");
          target.abandonChanges();
          expect(readRows(target, "test1")).deep.equal(beforeApply);
        });
      });
    }

    const withCascadeChangeset = (name: string, test: (target: SQLiteDb, file: string, targetFile: string) => void) => {
      const sourceFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", `cascade-${name}-source.db`);
      const targetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", `cascade-${name}-target.db`);
      const changesetFileName = IModelTestUtils.prepareOutputFile("SQLiteDb", `cascade-${name}.changeset`);
      const source = new SQLiteDb();
      const target = new SQLiteDb();
      try {
        source.createDb(sourceFileName, undefined, { rawSQLite: true });
        source.executeSQL("CREATE TABLE parent(id INTEGER PRIMARY KEY,val TEXT)");
        source.executeSQL("CREATE TABLE child(id INTEGER PRIMARY KEY,val TEXT,parentId INTEGER REFERENCES parent(id) ON DELETE CASCADE)");
        source.executeSQL("INSERT INTO parent VALUES (1,'slab')");
        source.executeSQL("INSERT INTO child VALUES (1,'child1',1),(2,'child2',1)");
        source.saveChanges();
        source.closeDb();
        IModelJsFs.copySync(sourceFileName, targetFileName);

        source.openDb(sourceFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        source.startChangeTracking();
        source.executeSQL("DELETE FROM parent WHERE id=1");
        expect(readRows(source, "parent")).deep.equal([]);
        expect(readRows(source, "child")).deep.equal([]);
        source.saveChanges();
        source.createChangeset(changesetFileName);

        target.openDb(targetFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        test(target, changesetFileName, targetFileName);
      } finally {
        if (source.isOpen)
          source.closeDb();
        if (target.isOpen)
          target.closeDb();
      }
    };

    it("should apply a captured parent cascade with FkNoAction and preserve unrelated families", () => {
      withCascadeChangeset("unrelated-family", (target, file, targetFile) => {
        target.executeSQL("INSERT INTO parent VALUES (2,'other')");
        target.executeSQL("INSERT INTO child VALUES (3,'other child',2)");
        target.saveChanges();

        target.applyChangeset(file, applyFlags.FkNoAction);
        expect(readRows(target, "parent")).deep.equal([{ id: 2, val: "other" }]);
        expect(readRows(target, "child")).deep.equal([{ id: 3, val: "other child" }]);
        target.abandonChanges();
        expect(readRows(target, "parent")).deep.equal([{ id: 1, val: "slab" }, { id: 2, val: "other" }]);
        expect(readRows(target, "child")).deep.equal([{ id: 1, val: "child1" }, { id: 2, val: "child2" }, { id: 3, val: "other child" }]);

        target.applyChangeset(file, applyFlags.FkNoAction);
        target.saveChanges();
        target.closeDb();
        target.openDb(targetFile, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        expect(readRows(target, "parent")).deep.equal([{ id: 2, val: "other" }]);
        expect(readRows(target, "child")).deep.equal([{ id: 3, val: "other child" }]);
      });
    });

    it("should apply a captured parent cascade with foreign-key actions enabled", () => {
      withCascadeChangeset("actions-enabled", (target, file, targetFile) => {
        target.applyChangeset(file, applyFlags.None, policy.NoLocalChanges);
        expect(readRows(target, "parent")).deep.equal([]);
        expect(readRows(target, "child")).deep.equal([]);
        target.saveChanges();
        target.closeDb();
        target.openDb(targetFile, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        expect(readRows(target, "parent")).deep.equal([]);
        expect(readRows(target, "child")).deep.equal([]);
      });
    });

    it("should replace conflicting indirect child deletes from a captured parent cascade", () => {
      withCascadeChangeset("changed-child", (target, file, targetFile) => {
        target.executeSQL("UPDATE child SET val='changed child' WHERE id=1");
        target.saveChanges();
        expect(() => target.applyChangeset(file, applyFlags.FkNoAction)).throws();
        target.abandonChanges();
        expect(readRows(target, "parent")).deep.equal([{ id: 1, val: "slab" }]);
        expect(readRows(target, "child")).deep.equal([{ id: 1, val: "changed child" }, { id: 2, val: "child2" }]);

        const conflicts: SQLiteDb.ChangesetConflictArgs[] = [];
        target.applyChangeset(file, applyFlags.FkNoAction, (args) => {
          conflicts.push(args);
          return DbConflictResolution.Replace;
        });
        expect(conflicts).deep.equal([{
          cause: DbConflictCause.Data,
          opcode: DbOpcode.Delete,
          indirect: true,
          tableName: "child",
          columnCount: 3,
          primaryKeyColumns: [0],
        }]);
        expect(readRows(target, "parent")).deep.equal([]);
        expect(readRows(target, "child")).deep.equal([]);
        target.abandonChanges();
        expect(readRows(target, "child")).deep.equal([{ id: 1, val: "changed child" }, { id: 2, val: "child2" }]);

        target.applyChangeset(file, applyFlags.FkNoAction, policy.NoLocalChanges);
        target.saveChanges();
        target.closeDb();
        target.openDb(targetFile, { openMode: OpenMode.ReadWrite, rawSQLite: true });
        expect(readRows(target, "parent")).deep.equal([]);
        expect(readRows(target, "child")).deep.equal([]);
      });
    });

    for (const extraChild of [false, true]) {
      it(`should ${extraChild ? "reject orphaned children instead of cascading" : "apply parent and cascaded child deletions"} with FkNoAction and the no-local-changes policy`, () => {
        withCascadeChangeset(extraChild ? "orphan" : "complete", (target, changesetFileName, targetFileName) => {
          if (extraChild) {
            target.executeSQL("INSERT INTO child VALUES (3,'extra child',1)");
            target.saveChanges();
            expect(() => target.applyChangeset(changesetFileName, applyFlags.FkNoAction, policy.NoLocalChanges)).throws();
            target.abandonChanges();
            expect(readRows(target, "parent")).deep.equal([{ id: 1, val: "slab" }]);
            expect(readRows(target, "child")).deep.equal([{ id: 1, val: "child1" }, { id: 2, val: "child2" }, { id: 3, val: "extra child" }]);
            const conflicts: SQLiteDb.ChangesetConflictArgs[] = [];
            expect(() => target.applyChangeset(changesetFileName, applyFlags.FkNoAction, (args) => {
              conflicts.push(args);
              return args.cause === DbConflictCause.ForeignKey ? DbConflictResolution.Abort : DbConflictResolution.Skip;
            })).throws();
            expect(conflicts).deep.equal([{ cause: DbConflictCause.ForeignKey, foreignKeyConflicts: 1 }]);
            target.abandonChanges();
            expect(() => target.applyChangeset(changesetFileName, applyFlags.FkNoAction, () => DbConflictResolution.Replace))
              .throws(TypeError, "Replace is valid only for data and primary-key insert conflicts");
            target.abandonChanges();
            target.applyChangeset(changesetFileName, applyFlags.None, policy.NoLocalChanges);
            expect(readRows(target, "child")).deep.equal([]);
          } else {
            expect(() => target.applyChangeset(changesetFileName)).throws();
            target.abandonChanges();
            target.applyChangeset(changesetFileName, applyFlags.FkNoAction, policy.NoLocalChanges);
            expect(readRows(target, "parent")).deep.equal([]);
            expect(readRows(target, "child")).deep.equal([]);
            target.saveChanges();
            target.closeDb();
            target.openDb(targetFileName, { openMode: OpenMode.ReadWrite, rawSQLite: true });
            expect(readRows(target, "parent")).deep.equal([]);
            expect(readRows(target, "child")).deep.equal([]);
          }
        });
      });
    }
  });

});
