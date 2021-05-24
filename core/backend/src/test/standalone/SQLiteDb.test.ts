/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { DbResult, OpenMode } from "@bentley/bentleyjs-core";
import { SQLiteDb } from "../../SQLiteDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe("SQLiteDb", () => {

  it("should create new SQLiteDb", () => {
    const fileName = IModelTestUtils.prepareOutputFile("SQLiteDb", "db1.db");
    const db = new SQLiteDb();
    db.createDb(fileName);
    db.executeSQL("CREATE TABLE test1(id INTEGER PRIMARY KEY,val TEXT)");
    db.executeSQL(`INSERT INTO test1(id,val) VALUES (1,"val1")`);
    db.executeSQL(`INSERT INTO test1(id,val) VALUES (2,"val2")`);
    db.saveChanges();

    db.withSqliteStatement("SELECT id,val from test1", (stmt) => {
      stmt.step();
      assert.equal(stmt.getValue(0).getInteger(), 1);
      assert.equal(stmt.getValue(1).getString(), "val1");
      stmt.step();
      assert.equal(stmt.getValue(0).getInteger(), 2);
      assert.equal(stmt.getValue(1).getString(), "val2");
    });
    db.closeDb();
  });

  it("should be able to open existing .bim file with SQLiteDb", () => {
    const testFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const db = new SQLiteDb();
    db.openDb(testFileName, OpenMode.Readonly);
    db.withSqliteStatement(`SELECT StrData FROM be_Prop WHERE Namespace="ec_Db" AND Name="SchemaVersion"`, (stmt) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const val = JSON.parse(stmt.getValue(0).getString());
      assert.equal(val.major, 4, "read major version");
      assert.equal(val.minor, 0, "read minor version");
    });
    db.closeDb();
  });

});
