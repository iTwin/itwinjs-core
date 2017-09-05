/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as fs from "fs";
import * as path from "path";

import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { ECJsonTypeMap, ECInstance } from "@bentley/bentleyjs-core/lib/ECJsonTypeMap";
import { ECDb, BindingValue } from "../dgnplatform/ECDb";
import { DgnDbTestUtils } from "./DgnDbTestUtils";

abstract class TestAbstractBaseClass extends ECInstance {
  @ECJsonTypeMap.propertyToJson("ecdb", "AbstractBaseStringProperty")
  public abstractBaseStringProperty: string;
}

@ECJsonTypeMap.classToJson("ecdb", "TestSchema.TestBaseClass", { classKeyPropertyName: "$ECClassKey" })
class TestBaseClass extends TestAbstractBaseClass {
  @ECJsonTypeMap.propertyToJson("ecdb", "BaseStringProperty")
  public baseStringProperty: string;
}

@ECJsonTypeMap.classToJson("ecdb", "TestSchema.TestClass", { classKeyPropertyName: "$ECClassKey" })
class TestClass extends TestBaseClass {
  @ECJsonTypeMap.propertyToJson("ecdb", "IntegerProperty")
  public integerProperty: number;

  @ECJsonTypeMap.propertyToJson("ecdb", "DoubleProperty")
  public doubleProperty: number;

  @ECJsonTypeMap.propertyToJson("ecdb", "BooleanProperty")
  public booleanProperty: boolean;

  @ECJsonTypeMap.propertyToJson("ecdb", "StringProperty")
  public stringProperty: string;

  @ECJsonTypeMap.propertyToJson("ecdb", "RelatedStringProperty")
  public relatedStringProperty: string;
}

describe("ECDb", () => {
  const ecdb = new ECDb();
  const dbPathname = path.join(DgnDbTestUtils.getTestAssetsPath(), "ECDbTest.ecdb");
  const schemaPathname = path.join(DgnDbTestUtils.getTestAssetsPath(), "TestSchema.ecschema.xml");
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
    const { error, result } = await ecdb.createDb(dbPathname);
    expect(error).is.undefined;
    expect(result).is.undefined;
    assert(ecdb.isDbOpen());
  });

  it("should be able to close a db", async () => {
    const { error, result } = await ecdb.closeDb();
    expect(error).is.undefined;
    expect(result).is.undefined;
    assert(!ecdb.isDbOpen());
  });

  it("should be able to open a db", async () => {
    const { error, result } = await ecdb.openDb(dbPathname, OpenMode.ReadWrite);
    expect(error).is.undefined;
    expect(result).is.undefined;
    assert(ecdb.isDbOpen());
  });

  it("should be able to import a schema", async () => {
    const { error, result } = await ecdb.importSchema(schemaPathname);
    expect(error).is.undefined;
    expect(result).is.undefined;
  });

  it("should not be able to create or open a new db when the handle already holds an open db", async () => {
    let { error, result } = await ecdb.createDb(dbPathname);
    expect(result).is.undefined;
    if (!error)
      assert(false);
    else
      expect(error.status).equals(DbResult.BE_SQLITE_ERROR_AlreadyOpen);

    ({ error, result } = await ecdb.openDb(dbPathname));
    expect(result).is.undefined;
    if (!error)
      assert(false);
    else
      expect(error.status).equals(DbResult.BE_SQLITE_ERROR_AlreadyOpen);
  });

  it("should be able to insert an instance", async () => {
    const { error } = await ecdb.insertInstance<TestClass>(testInstance);
    expect(error).is.undefined;
    expect(testInstance.id).length.to.be.greaterThan(0);
    testInstanceKey.id = testInstance.id;
  });

  it("should be able to read an instance", async () => {
    const { error, result: readInstance } = await ecdb.readInstance<TestClass>(testInstanceKey);
    expect(error).is.undefined;
    expect(readInstance).to.deep.equal(testInstance);
  });

  it("should be able to update an instance", async () => {
    testInstance.integerProperty = 456;
    testInstance.stringProperty = "Modified Test String Property";
    testInstance.doubleProperty = 456.789;

    const { error, result } = await ecdb.updateInstance<TestClass>(testInstance);
    expect(error).is.undefined;
    expect(result).is.undefined;

    const { result: readInstance } = await ecdb.readInstance<TestClass>(testInstanceKey);
    expect(readInstance).to.deep.equal(testInstance);
  });

  it("should be able to test that an instance exists", async () => {
    const { error, result: instanceExists } = await ecdb.containsInstance<TestClass>(testInstanceKey);
    expect(error).is.undefined;
    assert(instanceExists);
  });

  it("should be able to save changes", async () => {
    const { error, result } = await ecdb.saveChanges("Inserted an instance");
    expect(error).is.undefined;
    expect(result).is.undefined;

    await ecdb.closeDb();
    assert(!ecdb.isDbOpen());

    await ecdb.openDb(dbPathname, OpenMode.ReadWrite);
    assert(ecdb.isDbOpen());

    const { result: instanceExists } = await ecdb.containsInstance<TestClass>(testInstanceKey);
    assert(instanceExists);
  });

  it("should be able to delete an instance", async () => {
    await ecdb.deleteInstance(testInstanceKey);

    const { result: instanceExists } = await ecdb.containsInstance<TestClass>(testInstanceKey);
    assert(!instanceExists);
  });

  it("should be able to abandon changes", async () => {
    const { error, result } = await ecdb.abandonChanges();
    expect(error).is.undefined;
    expect(result).is.undefined;

    const { result: instanceExists } = await ecdb.containsInstance<TestClass>(testInstanceKey);
    assert(instanceExists);
  });

  it("should be able to execute queries", async () => {
    let { error, result: strRows } = await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass");
    expect(error).is.undefined;
    if (!strRows) {
      assert(false);
      return;
    }

    const jsonRows: any = JSON.parse(strRows);
    assert.isArray(jsonRows);
    assert.equal(jsonRows.length, 1);

    assert.equal(jsonRows[0].eCInstanceId, testInstance.id);

    ({ error, result: strRows } = await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass WHERE ECInstanceId=?", [testInstanceKey.id]));
    expect(error).is.undefined;
    if (!strRows) {
      assert(false);
      return;
    }

    const map = new Map<string, BindingValue>([
      ["instanceId", testInstanceKey.id],
    ]);
    ({ error, result: strRows } = await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass WHERE ECInstanceId=:instanceId", map));
    assert(strRows);
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

    const { error, result: instanceId } = await ecdb.executeStatement(ecsql, true, map);
    expect(error).is.undefined;
    expect(instanceId).length.to.be.greaterThan(0);

    const { result: instanceExists } = await ecdb.containsInstance<TestClass>(testInstanceKey);
    assert(instanceExists);
  });

  it("should be able to handle invalid inputs elegantly", async () => {
    let { error } = await ecdb.executeQuery("");
    expect(error ? error.status : undefined).equals(DbResult.BE_SQLITE_ERROR);

    let test: any;
    ({ error } = await ecdb.executeQuery(test));
    expect(error ? error.status : undefined).equals(DbResult.BE_SQLITE_ERROR);

    test = 3;
    ({ error } = await ecdb.executeQuery("SELECT * FROM TestSchema.TestClass", [test]));
    expect(error ? error.status : undefined).equals(DbResult.BE_SQLITE_ERROR);

    const ecdb2 = new ECDb();
    test = undefined;
    ({ error } = await ecdb2.openDb(test));
    expect(error ? error.status : undefined).equals(DbResult.BE_SQLITE_ERROR);

    test = "horriblyWrongMode";
    ({ error } = await ecdb2.openDb(dbPathname, test));
    expect(error ? error.status : undefined).equals(DbResult.BE_SQLITE_ERROR);
  });

});
