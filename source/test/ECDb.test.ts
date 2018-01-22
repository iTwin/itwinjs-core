/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as fs from "fs";
import * as path from "path";

import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError } from "../common/IModelError";
import { ECDb } from "../backend/ECDb";
import { ECSqlStatement } from "../backend/ECSqlStatement";

export class ECDbTestUtils {
  public static getTestAssetsPath(): string {
    return __dirname + "/assets/";
  }
}

describe("ECDb", () => {
  const ecdb = new ECDb();
  const dbPathname = path.join(ECDbTestUtils.getTestAssetsPath(), "ECDbTest.ecdb");
  const schemaPathname = path.join(ECDbTestUtils.getTestAssetsPath(), "TestSchema.ecschema.xml");

  before(async () => {
    if (fs.existsSync(dbPathname))
      fs.unlinkSync(dbPathname);

  });

  after(() => {
    if (ecdb.isOpen())
      ecdb.closeDb();
  });

  it("should be able to create new a new db", () => {
    ecdb.createDb(dbPathname);
    assert.isTrue(ecdb.isOpen());
  });

  it("should be able to close a db", () => {
    ecdb.closeDb();
    assert.isFalse(ecdb.isOpen());
  });

  it("should be able to open a db", () => {
    ecdb.openDb(dbPathname, OpenMode.ReadWrite);
    assert.isTrue(ecdb.isOpen());
  });

  it("should be able to import a schema", () => {
    ecdb.importSchema(schemaPathname);
  });

  // WIP: skip test because published Node addon is asserting?
  it.skip("should not be able to create or open a new db when the handle already holds an open db", () => {
    try {
      ecdb.createDb(dbPathname);
      assert.fail(); // expect line above to throw an Error
    } catch (error) {
      assert.isTrue(error instanceof IModelError);
      expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR_AlreadyOpen);
    }

    try {
      ecdb.openDb(dbPathname);
      assert.fail(); // expect line above to throw an Error
    } catch (error) {
      assert.isTrue(error instanceof IModelError);
      expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR_AlreadyOpen);
    }
  });

  it("should be able to insert an instance", () => {
    const stmt: ECSqlStatement = ecdb.prepareStatement("INSERT INTO TestSchema.TestClass(integerProperty,doubleProperty,booleanProperty,stringProperty) VALUES(?,?,?,?)");
    assert.isTrue(stmt.isPrepared());
    stmt.bindInt(1, 11);
    stmt.bindDouble(2, 1.23);
    stmt.bindBoolean(3, true);
    stmt.bindString(4, "Test String");
    assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    stmt.dispose();
  });

  it("should be able to read an instance", () => {
    const stmt: ECSqlStatement = ecdb.prepareStatement("SELECT integerProperty,doubleProperty,booleanProperty,stringProperty FROM TestSchema.TestClass");
    assert.isTrue(stmt.isPrepared());
    assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);

    const row = stmt.getRow();
    assert.isNotNull(row);
    assert.isObject(row);

    assert.equal(row.integerProperty, 11);
    assert.equal(row.doubleProperty, 1.23);
    assert.equal(row.booleanProperty, true);
    assert.equal(row.stringProperty, "Test String");
    stmt.dispose();
  });

  it("should be able to update an instance", () => {
    const stmt: ECSqlStatement = ecdb.prepareStatement("UPDATE TestSchema.TestClass SET integerProperty=?,doubleProperty=?,booleanProperty=?,stringProperty=?");
    assert.isTrue(stmt.isPrepared());
    stmt.bindInt(1, 332);
    stmt.bindDouble(2, 131.45);
    stmt.bindBoolean(3, false);
    stmt.bindString(4, "Modifed Test String");

    assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    stmt.dispose();
  });
  /*
    it("should be able to test that an instance exists", async () => {
      const instanceExists: boolean = await ecdb.containsInstance<TestClass>(testInstanceKey);
      assert.isTrue(instanceExists);
    });

    it("should be able to save changes", async () => {
      await ecdb.saveChanges("Inserted an instance");

      await ecdb.closeDb();
      assert.isFalse(ecdb.isDbOpen());

      await ecdb.openDb(dbPathname, OpenMode.ReadWrite);
      assert.isTrue(ecdb.isDbOpen());

      const instanceExists: boolean = await ecdb.containsInstance<TestClass>(testInstanceKey);
      assert.isTrue(instanceExists);
    });

    it("should be able to delete an instance", async () => {
      await ecdb.deleteInstance(testInstanceKey);
      const instanceExists: boolean = await ecdb.containsInstance<TestClass>(testInstanceKey);
      assert.isFalse(instanceExists);
    });

    it("should be able to abandon changes", async () => {
      await ecdb.abandonChanges();
      const instanceExists: boolean = await ecdb.containsInstance<TestClass>(testInstanceKey);
      assert.isTrue(instanceExists);
    });

    it("should be able to execute queries", async () => {
      let rows: any[] = ecdb.executeQuery("SELECT * FROM TestSchema.TestClass");
      if (rows.length === 0) {
        assert.fail();
        return;
      }

      assert.isArray(rows);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, testInstance.id);

      const testInstanceId = new Id64(testInstanceKey.id);  // NB: In the queries that follow, ECInstanceId must be strongly typed as an Id64, not a string! The ECSql binding logic will insist on that.

      rows = ecdb.executeQuery("SELECT * FROM TestSchema.TestClass WHERE ECInstanceId=?", [testInstanceId]);
      if (rows.length === 0) {
        assert.fail();
        return;
      }

      const map = new Map<string, BindingValue>([
        ["instanceId", testInstanceId],
      ]);
      rows = ecdb.executeQuery("SELECT * FROM TestSchema.TestClass WHERE ECInstanceId=:instanceId", map);
      assert.notEqual(rows.length, 0);
    });

    it("should be able to execute statements", async () => {
      // todo: need to make this test comprehensive for all types.
      const ecsql: string = `INSERT INTO TestSchema.KitchenSink(BooleanProperty, DoubleProperty, IntegerProperty, LongProperty, Point2dProperty, Point3dProperty, StringProperty)
        VALUES(:booleanProperty, :doubleProperty, :integerProperty, :longProperty, :point2dProperty, :point3dProperty, :stringProperty)`;

      const map = new Map<string, BindingValue>([
        ["booleanProperty", true],
        ["doubleProperty", 1.2],
        ["integerProperty", 123],
        ["longProperty", testInstanceKey.id],
        ["point2dProperty", { x: 1.1, y: 2.2 }],
        ["point3dProperty", { x: 3.3, y: 4.4, z: 5.5 }],
        ["stringProperty", "Test String"],
      ]);

      const instanceId: string = await ecdb.executeStatement(ecsql, true, map);
      assert.isAbove(instanceId.length, 0);

      const instanceExists: boolean = await ecdb.containsInstance<TestClass>(testInstanceKey);
      assert.isTrue(instanceExists);
    });

    it("should be able to handle invalid inputs elegantly", async () => {
      try {
        ecdb.executeQuery("");
        assert.fail(); // expect line above to throw an Error
      } catch (error) {
        assert.isTrue(error instanceof IModelError);
        expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR);
      }

      let test: any;
      try {
        ecdb.executeQuery(test);
        assert.fail(); // expect line above to throw an Error
      } catch (error) {
        assert.isTrue(error instanceof IModelError);
        expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR);
      }

      try {
        test = 3;
        ecdb.executeQuery("SELECT * FROM TestSchema.TestClass", [test]);
        assert.fail(); // expect line above to throw an Error
      } catch (error) {
        assert.isTrue(error instanceof IModelError);
        expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR);
      }

      const ecdb2 = new ECDb();
      try {
        test = undefined;
        await ecdb2.openDb(test);
        assert.fail(); // expect line above to throw an Error
      } catch (error) {
        assert.isTrue(error instanceof IModelError);
        expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR);
      }

      try {
        test = "horriblyWrongMode";
        await ecdb2.openDb(dbPathname, test);
        assert.fail(); // expect line above to throw an Error
      } catch (error) {
        assert.isTrue(error instanceof IModelError);
        expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR);
      }
    });
  */
});
