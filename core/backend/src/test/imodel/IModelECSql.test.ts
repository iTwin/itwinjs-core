/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { withEditTxn } from "../../EditTxn";
import { Category, ECSqlStatement, Element, SnapshotDb, SqliteStatement, SqliteValue, SqliteValueType } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { createIModelFromSeed, generateTestSnapshot } from "./IModelTestFixtures";


describe("iModel ECSQL and SQL", () => {
  let testBimReadonly: SnapshotDb;
  let compatibilityReadonly: SnapshotDb;

  before(async () => {
    await TestUtils.startBackend();
    IModelTestUtils.registerTestBimSchema();

    const testBimWritable = await generateTestSnapshot("ecsql-test.bim", "test.bim");
    const testBimPath = testBimWritable.pathName;
    testBimWritable.close();
    testBimReadonly = SnapshotDb.openFile(testBimPath);

    const compatibilityWritable = createIModelFromSeed("ecsql-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim");
    const compatibilityPath = compatibilityWritable.pathName;
    compatibilityWritable.close();
    compatibilityReadonly = SnapshotDb.openFile(compatibilityPath);
  });

  after(async () => {
    if (testBimReadonly !== undefined && testBimReadonly.isOpen)
      testBimReadonly.close();
    if (compatibilityReadonly !== undefined && compatibilityReadonly.isOpen)
      compatibilityReadonly.close();
  });

  // NOTE: this test can be removed when the deprecated executeQuery method is removed
  it("should produce an array of rows", () => {
    const imodel1 = testBimReadonly;
    const rows: any[] = IModelTestUtils.executeQuery(imodel1, `SELECT * FROM ${Category.classFullName}`);
    assert.exists(rows);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].id);
    assert.notEqual(rows[0].id.value, "");
  });

  it("queryEntityIds should skip undefined and null bindings", () => {
    const imodel2 = compatibilityReadonly;
    // Callers commonly build the WHERE clause conditionally but pass the bindings object
    // unconditionally, relying on undefined entries being skipped (legacy bindValues semantics).
    const baseline = imodel2.queryEntityIds({ from: "generic.PhysicalObject", where: "codevalue is null" });
    assert.isAtLeast(baseline.size, 1);

    const parent: string | undefined = undefined;
    const where = "codevalue is null";
    const withUnusedUndefined = imodel2.queryEntityIds({ from: "generic.PhysicalObject", where, bindings: { parent } });
    assert.deepEqual(withUnusedUndefined, baseline);

    const withUnusedNull = imodel2.queryEntityIds({ from: "generic.PhysicalObject", where: "codevalue is null", bindings: { parent: null } });
    assert.deepEqual(withUnusedNull, baseline);

    const someId = imodel2.queryEntityIds({ from: "bis.element", where: "CodeValue IS NOT NULL", limit: 1 }).values().next().value as string;
    assert.isDefined(someId);
    const codeValue = imodel2.elements.getElement(someId).code.value;
    const mixed = imodel2.queryEntityIds({ from: "bis.element", where: "CodeValue=:cv", bindings: { cv: codeValue, parent: undefined } });
    assert.isTrue(mixed.has(someId));

    // positional form: trailing undefined beyond the parameter count must be skipped, not bound
    const positional = imodel2.queryEntityIds({ from: "bis.element", where: "CodeValue=?", bindings: [codeValue, undefined] });
    assert.isTrue(positional.has(someId));
  });

  it("should exercise ECSqlStatement (backend only)", () => {
    const imodel2 = compatibilityReadonly;
    // Reject an invalid statement
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      imodel2.prepareStatement("select no_such_property, codeValue from bis.element", false);
      assert.fail("prepare should have failed with an exception");
    } catch (err: any) {
      assert.isTrue(err.constructor.name === "IModelError");
      assert.notEqual(err.status, DbResult.BE_SQLITE_OK);
    }
    let lastId: string = "";
    let firstCodeValue: string = "";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element", (stmt: ECSqlStatement) => {
      assert.isNotNull(stmt);
      // Reject an attempt to bind when there are no placeholders in the statement
      try {
        stmt.bindStruct(1, { foo: 1 });
        assert.fail("bindStruct should have failed with an exception");
      } catch (err2: any) {
        assert.isTrue(err2.constructor.name === "IModelError");
        assert.notEqual(err2.status, DbResult.BE_SQLITE_OK);
      }

      // Verify that we get a bunch of rows with the expected shape
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const row = stmt.getRow();
        assert.isNotNull(row);
        assert.isObject(row);
        assert.isTrue(row.id !== undefined);
        assert.isTrue(Id64.isValid(Id64.fromJSON(row.id)));
        lastId = row.id;
        if (row.codeValue !== undefined)
          firstCodeValue = row.codeValue;
        count = count + 1;
      }
      assert.isTrue(count > 1);
      assert.notEqual(lastId, "");
      assert.notEqual(firstCodeValue, "");

      // Try iterator style
      let firstCodeValueIter: string = "";
      let iteratorCount = 0;
      let lastIterId: string = "";
      stmt.reset();
      for (const row of stmt) {
        assert.isNotNull(row);
        assert.isObject(row);
        assert.isTrue(row.id !== undefined);
        assert.isTrue(Id64.isValid(Id64.fromJSON(row.id)));
        lastIterId = row.id;
        iteratorCount = iteratorCount + 1;
        if (row.codeValue !== undefined)
          firstCodeValueIter = row.codeValue;
      }
      assert.equal(iteratorCount, count, "iterator loop should find the same number of rows as the step loop");
      assert.equal(lastIterId, lastId, "iterator loop should see the same last row as the step loop");
      assert.equal(firstCodeValueIter, firstCodeValue, "iterator loop should find the first non-null code value as the step loop");
    });

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element WHERE (ecinstanceid=?)", (stmt3: ECSqlStatement) => {
      // Now try a statement with a placeholder
      const idToFind = Id64.fromJSON(lastId);
      stmt3.bindId(1, idToFind);
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt3.step()) {
        count = count + 1;
        const row = stmt3.getRow();
        // Verify that we got the row that we asked for
        assert.isTrue(idToFind === Id64.fromJSON(row.id));
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

    let firstCodeValueId: Id64String | undefined;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element WHERE (codeValue = :codevalue)", (stmt4: ECSqlStatement) => {
      // Try a named placeholder
      const codeValueToFind = firstCodeValue;
      stmt4.bindString("codeValue", codeValueToFind);
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt4.step()) {
        count = count + 1;
        const row = stmt4.getRow();
        // Verify that we got the row that we asked for
        assert.equal(row.codeValue, codeValueToFind);
        firstCodeValueId = row.id;
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

    // make sure we can use parameterized values for queryEnityId (test on parameterized codevalue)
    const ids = imodel2.queryEntityIds({ from: "bis.element", where: "codevalue=:cv", bindings: { cv: firstCodeValue } });
    assert.equal(ids.values().next().value, firstCodeValueId);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel2.withPreparedStatement("select ecinstanceid as id, codevalue from bis.element", (stmt5: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === stmt5.step()) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        imodel2.withPreparedStatement("select codevalue from bis.element where ecinstanceid=?", (stmt6: ECSqlStatement) => {
          stmt6.bindId(1, stmt5.getRow().id);
          while (DbResult.BE_SQLITE_ROW === stmt6.step()) {
            assert.equal(stmt6.getRow().codevalue, stmt5.getRow().codevalue);
          }
        });
      }
    });

    // make sure queryEnityIds works fine when all params are specified
    const physicalObjectIds = imodel2.queryEntityIds({ from: "generic.PhysicalObject", where: "codevalue is null", limit: 1, offset: 1, only: true, orderBy: "ecinstanceid desc" });
    assert.equal(physicalObjectIds.size, 1);
  });

  describe("with a writable test.bim seed", () => {
    let imodel1: SnapshotDb;

    beforeEach(async () => {
      imodel1 = await generateTestSnapshot("ecsql-plain-sql.bim", "test.bim");
    });

    afterEach(() => {
      if (imodel1 !== undefined && imodel1.isOpen)
        imodel1.close();
    });

    it("Run plain SQL", () => {
      withEditTxn(imodel1, () => {
        imodel1.withPreparedSqliteStatement("CREATE TABLE Test(Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, Code INTEGER)", (stmt: SqliteStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

        imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
          stmt.bindValue(1, "Dummy 1");
          stmt.bindValue(2, 100);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

        imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
          stmt.bindValues(["Dummy 2", 200]);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

        imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
          stmt.bindValue(":p1", "Dummy 3");
          stmt.bindValue(":p2", 300);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

        imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
          stmt.bindValues({ ":p1": "Dummy 4", ":p2": 400 });
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });
      });

      imodel1.withPreparedSqliteStatement("SELECT Id,Name,Code FROM Test ORDER BY Id", (stmt: SqliteStatement) => {
        for (let i: number = 1; i <= 4; i++) {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          assert.equal(stmt.getColumnCount(), 3);
          const val0: SqliteValue = stmt.getValue(0);
          assert.equal(val0.columnName, "Id");
          assert.equal(val0.type, SqliteValueType.Integer);
          assert.isFalse(val0.isNull);
          assert.equal(val0.getInteger(), i);

          const val1: SqliteValue = stmt.getValue(1);
          assert.equal(val1.columnName, "Name");
          assert.equal(val1.type, SqliteValueType.String);
          assert.isFalse(val1.isNull);
          assert.equal(val1.getString(), `Dummy ${i}`);

          const val2: SqliteValue = stmt.getValue(2);
          assert.equal(val2.columnName, "Code");
          assert.equal(val2.type, SqliteValueType.Integer);
          assert.isFalse(val2.isNull);
          assert.equal(val2.getInteger(), i * 100);

          const row: any = stmt.getRow();
          assert.equal(row.id, i);
          assert.equal(row.name, `Dummy ${i}`);
          assert.equal(row.code, i * 100);
        }
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      imodel1.withPreparedSqliteStatement("SELECT 1 FROM ec_CustomAttribute WHERE ContainerId=? AND Instance LIKE '<IsMixin%' COLLATE NOCASE", (stmt: SqliteStatement) => {
        stmt.bindValue(1, "0x1f");
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });
    });
  });

  it("Run plain SQL against readonly connection", () => {
    let iModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IModel", "sqlitesqlreadonlyconnection.bim"), { rootSubject: { name: "test" } });
    const iModelPath = iModel.pathName;
    iModel.close();
    iModel = SnapshotDb.openFile(iModelPath);

    try {
      iModel.withPreparedSqliteStatement("SELECT Name,StrData FROM be_Prop WHERE Namespace='ec_Db'", (stmt: SqliteStatement) => {
        let rowCount: number = 0;
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          assert.equal(stmt.getColumnCount(), 2);
          const nameVal: SqliteValue = stmt.getValue(0);
          assert.equal(nameVal.columnName, "Name");
          assert.equal(nameVal.type, SqliteValueType.String);
          assert.isFalse(nameVal.isNull);
          const name: string = nameVal.getString();

          const versionVal: SqliteValue = stmt.getValue(1);
          assert.equal(versionVal.columnName, "StrData");
          assert.equal(versionVal.type, SqliteValueType.String);
          assert.isFalse(versionVal.isNull);
          const profileVersion: any = JSON.parse(versionVal.getString());

          assert.isTrue(name === "SchemaVersion" || name === "InitialSchemaVersion");
          if (name === "SchemaVersion") {
            assert.equal(profileVersion.major, 4);
            assert.equal(profileVersion.minor, 0);
            assert.equal(profileVersion.sub1, 0);
            assert.isAtLeast(profileVersion.sub2, 1);
          } else if (name === "InitialSchemaVersion") {
            assert.equal(profileVersion.major, 4);
            assert.equal(profileVersion.minor, 0);
            assert.equal(profileVersion.sub1, 0);
            assert.isAtLeast(profileVersion.sub2, 1);
          }
        }
        assert.equal(rowCount, 2);
      });
    } finally {
      iModel.close();
    }
  });

  it("tryPrepareStatement", () => {
    const imodel1 = testBimReadonly;
    const sql = `SELECT * FROM ${Element.classFullName} LIMIT 1`;
    const invalidSql = "SELECT * FROM InvalidSchemaName:InvalidClassName LIMIT 1";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.throws(() => imodel1.prepareStatement(invalidSql, false));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.isUndefined(imodel1.tryPrepareStatement(invalidSql));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    using statement: ECSqlStatement | undefined = imodel1.tryPrepareStatement(sql);
    assert.isDefined(statement);
    assert.isTrue(statement?.isPrepared);
  });

  it("containsClass", () => {
    const imodel1 = testBimReadonly;
    assert.isTrue(imodel1.containsClass(Element.classFullName));
    assert.isTrue(imodel1.containsClass("BisCore:Element"));
    assert.isTrue(imodel1.containsClass("BisCore.Element"));
    assert.isTrue(imodel1.containsClass("biscore:element"));
    assert.isTrue(imodel1.containsClass("biscore.element"));
    assert.isTrue(imodel1.containsClass("bis:Element"));
    assert.isTrue(imodel1.containsClass("bis.Element"));
    assert.isTrue(imodel1.containsClass("bis:element"));
    assert.isTrue(imodel1.containsClass("bis.element"));
    assert.isFalse(imodel1.containsClass("BisCore:Element:InvalidExtra"));
    assert.isFalse(imodel1.containsClass("BisCore"));
    assert.isFalse(imodel1.containsClass(":Element"));
    assert.isFalse(imodel1.containsClass("BisCore:InvalidClassName"));
    assert.isFalse(imodel1.containsClass("InvalidSchemaName:Element"));
  });
});
