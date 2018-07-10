/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { SqliteStatement, SqliteValue, SqliteValueType } from "../../SqliteStatement";
import { ECDb } from "../../ECDb";
import { DbResult, using } from "@bentley/bentleyjs-core";
import { Range3d } from "@bentley/geometry-core";
import { KnownTestLocations } from "../KnownTestLocations";

describe("SqliteStatement", () => {
  const _outDir = KnownTestLocations.outputDir;
  const stringVal: string = "Hello world";
  const intVal: number = 12345;
  const doubleVal: number = -2.5;
  const blobVal = new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7).toFloat64Array().buffer;

  it("Create Table, Insert, Select with ECDb", () => {
    using(ECDbTestHelper.createECDb(_outDir, "sqlitestatement.ecdb"), (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen());

      ecdb.withPreparedSqliteStatement("CREATE TABLE MyTable(id INTEGER PRIMARY KEY, stringcol TEXT, intcol INTEGER, doublecol REAL, blobcol)", (stmt: SqliteStatement) => {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(?,?,?,?)", (stmt: SqliteStatement) => {
        stmt.bindValue(1, stringVal);
        stmt.bindValue(2, intVal);
        stmt.bindValue(3, doubleVal);
        stmt.bindValue(4, blobVal);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(?,?,?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues([stringVal, intVal, doubleVal, blobVal]);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(:string,:int,:double,:blob)", (stmt: SqliteStatement) => {
        stmt.bindValue(":string", stringVal);
        stmt.bindValue(":int", intVal);
        stmt.bindValue(":double", doubleVal);
        stmt.bindValue(":blob", blobVal);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(:string,:int,:double,:blob)", (stmt: SqliteStatement) => {
        stmt.bindValues({ ":string": stringVal, ":int": intVal, ":double": doubleVal, ":blob": blobVal });
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.saveChanges();

      ecdb.withPreparedSqliteStatement("SELECT id,stringcol,intcol,doublecol,blobcol FROM MyTable", (stmt: SqliteStatement) => {
        let rowCount: number = 0;
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          assert.equal(stmt.getColumnCount(), 5);
          const idSqlVal: SqliteValue = stmt.getValue(0);
          assert.isFalse(idSqlVal.isNull());
          assert.equal(idSqlVal.type, SqliteValueType.Integer);
          assert.isDefined(idSqlVal.value);
          assert.equal(idSqlVal.value, rowCount);
          assert.equal(idSqlVal.getInteger(), rowCount);
          assert.equal(idSqlVal.columnName, "id");

          const stringSqlVal: SqliteValue = stmt.getValue(1);
          assert.isFalse(stringSqlVal.isNull());
          assert.equal(stringSqlVal.type, SqliteValueType.String);
          assert.isDefined(stringSqlVal.value);
          assert.equal(stringSqlVal.value, stringVal);
          assert.equal(stringSqlVal.getString(), stringVal);
          assert.equal(stringSqlVal.columnName, "stringcol");

          const intSqlVal: SqliteValue = stmt.getValue(2);
          assert.isFalse(intSqlVal.isNull());
          assert.equal(intSqlVal.type, SqliteValueType.Integer);
          assert.isDefined(intSqlVal.value);
          assert.equal(intSqlVal.value, intVal);
          assert.equal(intSqlVal.getInteger(), intVal);
          assert.equal(intSqlVal.columnName, "intcol");

          const doubleSqlVal: SqliteValue = stmt.getValue(3);
          assert.isFalse(doubleSqlVal.isNull());
          assert.equal(doubleSqlVal.type, SqliteValueType.Double);
          assert.isDefined(doubleSqlVal.value);
          assert.equal(doubleSqlVal.value, doubleVal);
          assert.equal(doubleSqlVal.getDouble(), doubleVal);
          assert.equal(doubleSqlVal.columnName, "doublecol");

          const blobSqlVal: SqliteValue = stmt.getValue(4);
          assert.isFalse(blobSqlVal.isNull());
          assert.equal(blobSqlVal.type, SqliteValueType.Blob);
          assert.isDefined(blobSqlVal.value);
          assert.equal(blobSqlVal.value.byteLength, blobVal.byteLength);
          assert.equal(blobSqlVal.getBlob().byteLength, blobVal.byteLength);
          assert.equal(blobSqlVal.columnName, "blobcol");
        }
        assert.equal(rowCount, 4);
      });

      ecdb.withPreparedSqliteStatement("SELECT id,stringcol,intcol,doublecol,blobcol FROM MyTable", (stmt: SqliteStatement) => {
        let rowCount: number = 0;
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          const row = stmt.getRow();
          assert.isDefined(row.id);
          assert.equal(row.id, rowCount);

          assert.isDefined(row.stringcol);
          assert.equal(row.stringcol, stringVal);

          assert.isDefined(row.intcol);
          assert.equal(row.intcol, intVal);

          assert.isDefined(row.doublecol);
          assert.equal(row.doublecol, doubleVal);

          assert.isDefined(row.blobcol);
          assert.equal(row.blobcol.byteLength, blobVal.byteLength);
        }
        assert.equal(rowCount, 4);
      });

      ecdb.withPreparedSqliteStatement("SELECT id,stringcol,intcol,doublecol,blobcol FROM MyTable", (stmt: SqliteStatement) => {
        let rowCount: number = 0;
        for (const row of stmt) {
          rowCount++;
          assert.isDefined(row.id);
          assert.equal(row.id, rowCount);

          assert.isDefined(row.stringcol);
          assert.equal(row.stringcol, stringVal);

          assert.isDefined(row.intcol);
          assert.equal(row.intcol, intVal);

          assert.isDefined(row.doublecol);
          assert.equal(row.doublecol, doubleVal);

          assert.isDefined(row.blobcol);
          assert.equal(row.blobcol.byteLength, blobVal.byteLength);
        }
        assert.equal(rowCount, 4);
      });
    });
  });

  it("Null values", () => {
    using(ECDbTestHelper.createECDb(_outDir, "bindnull.ecdb"), (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen());

      ecdb.withPreparedSqliteStatement("CREATE TABLE MyTable(id INTEGER PRIMARY KEY, stringcol TEXT, intcol INTEGER, doublecol REAL, blobcol)", (stmt: SqliteStatement) => {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(?,?,?,?)", (stmt: SqliteStatement) => {
        stmt.bindValue(1, undefined);
        stmt.bindValue(2, undefined);
        stmt.bindValue(3, undefined);
        stmt.bindValue(4, undefined);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(?,?,?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues([]);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(?,?,?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues([undefined, undefined]);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(:string,:int,:double,:blob)", (stmt: SqliteStatement) => {
        stmt.bindValue(":string", undefined);
        stmt.bindValue(":int", undefined);
        stmt.bindValue(":double", undefined);
        stmt.bindValue(":blob", undefined);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(?,?,?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues({});
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.withPreparedSqliteStatement("INSERT INTO MyTable(stringcol,intcol,doublecol,blobcol) VALUES(?,?,?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues({ ":string": undefined, ":int": undefined });
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      ecdb.saveChanges();

      ecdb.withPreparedSqliteStatement("SELECT id,stringcol,intcol,doublecol,blobcol FROM MyTable", (stmt: SqliteStatement) => {
        let rowCount: number = 0;
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          rowCount++;
          for (let i = 0; i < stmt.getColumnCount(); i++) {
            const sqlVal: SqliteValue = stmt.getValue(i);
            if (i === 0) {
              assert.isFalse(sqlVal.isNull());
              assert.equal(sqlVal.type, SqliteValueType.Integer);
              assert.equal(sqlVal.getInteger(), rowCount);
            } else {
              assert.isTrue(sqlVal.isNull());
              assert.equal(sqlVal.type, SqliteValueType.Null);
            }
          }
        }

        assert.equal(rowCount, 6);
      });
    });
  });
});
