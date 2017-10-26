/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as fs from "fs";
import * as path from "path";

import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { ECJsonTypeMap, ECInstance } from "@bentley/bentleyjs-core/lib/ECJsonTypeMap";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { IModelError } from "../IModelError";
import { ECDb } from "../backend/ECDb";
import { BindingValue } from "../backend/BindingUtility";

export class ECDbTestUtils {
  public static getTestAssetsPath(): string {
    return __dirname + "/assets/";
  }
}

abstract class TestAbstractBaseClass extends ECInstance {
  @ECJsonTypeMap.propertyToJson("ecdb", "abstractBaseStringProperty")
  public abstractBaseStringProperty: string;
}

@ECJsonTypeMap.classToJson("ecdb", "TestSchema.TestBaseClass", { classKeyPropertyName: "className" })
class TestBaseClass extends TestAbstractBaseClass {
  @ECJsonTypeMap.propertyToJson("ecdb", "baseStringProperty")
  public baseStringProperty: string;
}

@ECJsonTypeMap.classToJson("ecdb", "TestSchema.TestClass", { classKeyPropertyName: "className" })
class TestClass extends TestBaseClass {
  @ECJsonTypeMap.propertyToJson("ecdb", "integerProperty")
  public integerProperty: number;

  @ECJsonTypeMap.propertyToJson("ecdb", "doubleProperty")
  public doubleProperty: number;

  @ECJsonTypeMap.propertyToJson("ecdb", "booleanProperty")
  public booleanProperty: boolean;

  @ECJsonTypeMap.propertyToJson("ecdb", "stringProperty")
  public stringProperty: string;

  @ECJsonTypeMap.propertyToJson("ecdb", "relatedStringProperty")
  public relatedStringProperty: string;
}

describe("ECDb", () => {
  const ecdb = new ECDb();
  const dbPathname = path.join(ECDbTestUtils.getTestAssetsPath(), "ECDbTest.ecdb");
  const schemaPathname = path.join(ECDbTestUtils.getTestAssetsPath(), "TestSchema.ecschema.xml");
  const testInstance = new TestClass();
  const testInstanceKey = new TestClass();

  before(async () => {
    if (fs.existsSync(dbPathname))
      fs.unlinkSync(dbPathname);

    testInstance.integerProperty = 123;
    testInstance.doubleProperty = 123.456;
    testInstance.booleanProperty = true;
    testInstance.stringProperty = "Test String Property";
    testInstance.relatedStringProperty = "Test Related String Property";
    testInstance.abstractBaseStringProperty = "Test Abstract Base String Property";
    testInstance.baseStringProperty = "Test Base String Property";
  });

  after(async () => {
    if (ecdb.isDbOpen())
      await ecdb.closeDb();
  });

  it("should be able to create new a new db", async () => {
    await ecdb.createDb(dbPathname);
    assert.isTrue(ecdb.isDbOpen());
  });

  it("should be able to close a db", async () => {
    await ecdb.closeDb();
    assert.isFalse(ecdb.isDbOpen());
  });

  it("should be able to open a db", async () => {
    await ecdb.openDb(dbPathname, OpenMode.ReadWrite);
    assert.isTrue(ecdb.isDbOpen());
  });

  it("should be able to import a schema", async () => {
    await ecdb.importSchema(schemaPathname);
  });

  // WIP: skip test because published Node addon is asserting?
  it.skip("should not be able to create or open a new db when the handle already holds an open db", async () => {
    try {
      await ecdb.createDb(dbPathname);
      assert.fail(); // expect line above to throw an Error
    } catch (error) {
      assert.isTrue(error instanceof IModelError);
      expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR_AlreadyOpen);
    }

    try {
      await ecdb.openDb(dbPathname);
      assert.fail(); // expect line above to throw an Error
    } catch (error) {
      assert.isTrue(error instanceof IModelError);
      expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR_AlreadyOpen);
    }
  });

  it("should be able to insert an instance", async () => {
    await ecdb.insertInstance<TestClass>(testInstance);
    assert.isAbove(testInstance.id.length, 0);
    testInstanceKey.id = testInstance.id;
  });

  it("should be able to read an instance", async () => {
    const readInstance: TestClass = await ecdb.readInstance<TestClass>(testInstanceKey);
    expect(readInstance).to.deep.equal(testInstance);
  });

  it("should be able to update an instance", async () => {
    testInstance.integerProperty = 456;
    testInstance.stringProperty = "Modified Test String Property";
    testInstance.doubleProperty = 456.789;

    await ecdb.updateInstance<TestClass>(testInstance);
    const readInstance: TestClass = await ecdb.readInstance<TestClass>(testInstanceKey);
    expect(readInstance).to.deep.equal(testInstance);
  });

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
    let rows: any[] = await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass");
    if (rows.length === 0) {
      assert.fail();
      return;
    }

    assert.isArray(rows);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, testInstance.id);

    const testInstanceId = new Id64(testInstanceKey.id);  // NB: In the queries that follow, ECInstanceId must be strongly typed as an Id64, not a string! The ECSql binding logic will insist on that.

    rows = await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass WHERE ECInstanceId=?", [testInstanceId]);
    if (rows.length === 0) {
      assert.fail();
      return;
    }

    const map = new Map<string, BindingValue>([
      ["instanceId", testInstanceId],
    ]);
    rows = await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass WHERE ECInstanceId=:instanceId", map);
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
      await ecdb.executeQuery("");
      assert.fail(); // expect line above to throw an Error
    } catch (error) {
      assert.isTrue(error instanceof IModelError);
      expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR);
    }

    let test: any;
    try {
      await ecdb.executeQuery(test);
      assert.fail(); // expect line above to throw an Error
    } catch (error) {
      assert.isTrue(error instanceof IModelError);
      expect(error.errorNumber).equals(DbResult.BE_SQLITE_ERROR);
    }

    try {
      test = 3;
      await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass", [test]);
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

});
