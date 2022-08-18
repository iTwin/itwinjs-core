/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration, DbResult, OpenMode } from "@itwin/core-bentley";
import { SQLiteDb } from "../../SQLiteDb";
import { IModelTestUtils } from "../IModelTestUtils";

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

});
