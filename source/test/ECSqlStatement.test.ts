/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DateTime, Blob } from "../backend/ECSqlStatement";
import { ECDb } from "../backend/ECDb";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import * as fs from "fs-extra";

describe("ECSqlStatement", () => {
  const _outDir = __dirname + "/output/";

  const setupECDb = (fileName: string, schemaXml: string | undefined) => {
    if (!fs.existsSync(_outDir))
      fs.mkdirSync(_outDir);

    const path = _outDir + fileName;
    if (fs.existsSync(path))
      fs.removeSync(path);

    const ecdb = new ECDb();
    ecdb.createDb(path);

    if (schemaXml == null)
      return ecdb;

    const schemaPath = _outDir + Guid.createValue() + ".ecschema.xml";
    if (fs.existsSync(schemaPath))
      fs.removeSync(schemaPath);

    fs.writeFileSync(schemaPath, schemaXml);

    ecdb.importSchema(schemaPath);
    return ecdb;
  };

  it("Bind Scenarios", () => {
    const ecdb: ECDb = setupECDb("bindscenarios.ecdb",
    `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECStructClass typeName="MyStruct" modifier="Sealed">
      <ECProperty propertyName="Bl" typeName="binary"/>
      <ECProperty propertyName="Bo" typeName="boolean"/>
      <ECProperty propertyName="D" typeName="double"/>
      <ECProperty propertyName="Dt" typeName="dateTime"/>
      <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
      <ECProperty propertyName="I" typeName="int"/>
      <ECProperty propertyName="L" typeName="long"/>
      <ECProperty propertyName="P2d" typeName="Point2d"/>
      <ECProperty propertyName="P3d" typeName="Point3d"/>
      <ECProperty propertyName="S" typeName="string"/>
    </ECStructClass>
    <ECEntityClass typeName="Foo" modifier="Sealed">
      <ECProperty propertyName="Bl" typeName="binary"/>
      <ECProperty propertyName="Bo" typeName="boolean"/>
      <ECProperty propertyName="D" typeName="double"/>
      <ECProperty propertyName="Dt" typeName="dateTime"/>
      <ECProperty propertyName="G" typeName="Bentley.Geometry.Common.IGeometry"/>
      <ECProperty propertyName="I" typeName="int"/>
      <ECProperty propertyName="L" typeName="long"/>
      <ECProperty propertyName="P2d" typeName="Point2d"/>
      <ECProperty propertyName="P3d" typeName="Point3d"/>
      <ECProperty propertyName="S" typeName="string"/>
      <ECArrayProperty propertyName="I_Array" typeName="int"/>
      <ECArrayProperty propertyName="Dt_Array" typeName="dateTime"/>
      <ECStructProperty propertyName="Struct" typeName="MyStruct"/>
      <ECStructArrayProperty propertyName="Struct_Array" typeName="MyStruct"/>
    </ECEntityClass>
    </ECSchema>`);

    assert.isTrue(ecdb.isOpen());

    const stat: DbResult = ecdb.withPreparedStatement("INSERT INTO test.Foo(Bo,Dt) VALUES(?,?)", (stmt) => {
      stmt.bindBoolean(1, true);
      stmt.bindDateTime(2, new DateTime("2018-01-18"));

      return stmt.step();
    });
    assert.equal(stat, DbResult.BE_SQLITE_DONE);

    // Scenario Bind Id
    ecdb.withPreparedStatement("SELECT * FROM test.Foo WHERE ECInstanceId=:id AND ECClassId=:classid", (stmt) => {
      stmt.bindId(1, new Id64("0x1"));
    });

    // Scenario Bind primitives
    ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S) VALUES(?,?,?,?,?,?,?,?)", (stmt) => {

      stmt.bindBlob(1, new Blob("jA0EAwMCxamDR=="));
      stmt.bindBoolean(2, true);
      stmt.bindDouble(3, 3.14);
      stmt.bindDateTime(4, new DateTime("2018-01-01"));
      stmt.bindInt(5, 100);
      stmt.bindPoint2d(6, Point2d.create(1, 2));
      stmt.bindPoint3d(7, Point3d.create(1, 2, 3));
      stmt.bindString(8, "Hello");

      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });
    // Scenario Struct
    ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt) => {
        stmt.bindStruct(1, {
        Bl: new Blob("jA0EAwMCxamDR=="),
        Bo: true,
        Dt: new DateTime("2018-01-01"),
        D: 3.14,
        I: 100,
        P2d: Point2d.create(1, 2), P3d: Point3d.create(1, 2, 3),
        S: "Hello World"});
      });

    // Scenario Struct Array
    ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct_Array) VALUES(?)", (stmt) => {
      // same scenarios apply as for structs
      stmt.bindArray(1, [{S: "Hello World", D: 3.14, Dt: new DateTime("2018-01-01")},
                         {I: 123, P2d: Point2d.create(1, 2), P3d: Point3d.create(1, 2, 3)}]);
    });

    // Scenario Int Array
    ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array) VALUES(?)", (stmt) => {
          stmt.bindArray(1, [10, 20]);
        });

    // Scenario DateTime Array
    ecdb.withPreparedStatement("INSERT INTO test.Foo(Dt_Array) VALUES(?)", (stmt) => {
      stmt.bindArray(1, [new DateTime("2018-01-01"), new DateTime("2018-01-02")]);
    });

  });

});
