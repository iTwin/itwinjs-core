/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { DbResult, Id64, using } from "@bentley/bentleyjs-core";
import { ECSqlInsertResult, ECDb, ECDbOpenMode, ECSqlStatement, SqliteStatement, SqliteValue, SqliteValueType } from "../../backend";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ECDb", () => {
  const _outDir = KnownTestLocations.outputDir;

  it("should be able to create a new ECDb", () => {
    using(ECDbTestHelper.createECDb(_outDir, "create.ecdb"), (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen());
    });
  });

  it("should be able to close an ECDb", () => {
    const ecdb: ECDb = ECDbTestHelper.createECDb(_outDir, "close.ecdb");
    assert.isTrue(ecdb.isOpen());
    ecdb.closeDb();
    assert.isFalse(ecdb.isOpen());
  });

  it("should be able to open an ECDb", () => {
    const fileName = "open.ecdb";
    const ecdbPath: string = path.join(_outDir, fileName);
    using(ECDbTestHelper.createECDb(_outDir, fileName), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen());
    });

    using(new ECDb(), (ecdb: ECDb) => {
      ecdb.openDb(ecdbPath, ECDbOpenMode.Readwrite);
      assert.isTrue(ecdb.isOpen());
    });
  });

  it("Open ECDb with upgrade option", () => {
    const fileName = "open.ecdb";
    const ecdbPath: string = path.join(_outDir, fileName);
    using(ECDbTestHelper.createECDb(_outDir, fileName), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen());
    });

    using(new ECDb(), (ecdb: ECDb) => {
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.Readonly));
    });

    using(new ECDb(), (ecdb: ECDb) => {
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.Readwrite));
    });

    using(new ECDb(), (ecdb: ECDb) => {
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.FileUpgrade));
    });
  });

  it("should be able to import a schema", () => {
    const fileName = "schemaimport.ecdb";
    const ecdbPath: string = path.join(_outDir, fileName);
    let id: Id64;
    using(ECDbTestHelper.createECDb(_outDir, fileName,
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Person" modifier="Sealed">
        <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
      </ECEntityClass>
      </ECSchema>`), (testECDb: ECDb) => {
        assert.isTrue(testECDb.isOpen());

        id = testECDb.withPreparedStatement("INSERT INTO test.Person(Name,Age) VALUES('Mary', 45)", (stmt: ECSqlStatement) => {
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          assert.isTrue(res.id!.isValid());
          return res.id!;
        });
      });

    using(new ECDb(), (ecdb: ECDb) => {
      ecdb.openDb(ecdbPath, ECDbOpenMode.Readonly);
      assert.isTrue(ecdb.isOpen());

      ecdb.withPreparedStatement("SELECT Name, Age FROM test.Person WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
        stmt.bindId(1, id);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.name, "Mary");
        assert.equal(row.age, 45);
      });
    });
  });

  it("Run plain SQL", () => {
    const fileName = "plainseql.ecdb";
    const ecdbPath: string = path.join(_outDir, fileName);
    using(ECDbTestHelper.createECDb(_outDir, fileName), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen());

      testECDb.withPreparedSqliteStatement("CREATE TABLE Test(Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, Code INTEGER)", (stmt: SqliteStatement) => {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValue(1, "Dummy 1");
        stmt.bindValue(2, 100);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues(["Dummy 2", 200]);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValue(":p1", "Dummy 3");
        stmt.bindValue(":p2", 300);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValues({ ":p1": "Dummy 4", ":p2": 400 });
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.saveChanges();
    });

    using(new ECDb(), (ecdb: ECDb) => {
      ecdb.openDb(ecdbPath, ECDbOpenMode.Readonly);
      assert.isTrue(ecdb.isOpen());

      ecdb.withPreparedSqliteStatement("SELECT Id,Name,Code FROM Test ORDER BY Id", (stmt: SqliteStatement) => {
        for (let i: number = 1; i <= 4; i++) {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          assert.equal(stmt.getColumnCount(), 3);
          const val0: SqliteValue = stmt.getValue(0);
          assert.equal(val0.columnName, "Id");
          assert.equal(val0.type, SqliteValueType.Integer);
          assert.isFalse(val0.isNull());
          assert.equal(val0.getInteger(), i);

          const val1: SqliteValue = stmt.getValue(1);
          assert.equal(val1.columnName, "Name");
          assert.equal(val1.type, SqliteValueType.String);
          assert.isFalse(val1.isNull());
          assert.equal(val1.getString(), `Dummy ${i}`);

          const val2: SqliteValue = stmt.getValue(2);
          assert.equal(val2.columnName, "Code");
          assert.equal(val2.type, SqliteValueType.Integer);
          assert.isFalse(val2.isNull());
          assert.equal(val2.getInteger(), i * 100);

          const row: any = stmt.getRow();
          assert.equal(row.id, i);
          assert.equal(row.name, `Dummy ${i}`);
          assert.equal(row.code, i * 100);
        }
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });
    });
  });
});
