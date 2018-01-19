/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ECSqlInsertResult, DateTime, Blob } from "../backend/ECSqlStatement";
import { ECDb } from "../backend/ECDb";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { using } from "@bentley/bentleyjs-core/lib/Disposable";
import * as fs from "fs-extra";

describe("ECSqlStatement", () => {
  const _outDir = __dirname + "/output/";

  const setupECDb = (fileName: string, schemaXml?: string) => {
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

  it("Bind Ids", () => {
    using (setupECDb("bindids.ecdb"), (ecdb) => {

    assert.isTrue(ecdb.isOpen());

    const verify = (ecdb: ECDb, actualRes: ECSqlInsertResult, expectedId?: Id64) => {
      if (expectedId === undefined) {
        assert.notEqual(actualRes.status, DbResult.BE_SQLITE_DONE);
        assert.isUndefined(actualRes.id);
        return;
      }

      assert.equal(actualRes.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(actualRes.id);
      assert.equal(actualRes.id!.value, expectedId.value);

      ecdb.withPreparedStatement("SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=?", (stmt) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.id, expectedId.toString());
        assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
        assert.equal(row.name, expectedId.getLow().toString() + ".txt");
        });
      };

    let expectedId = new Id64([4444,0]);
    let r: ECSqlInsertResult = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt) => {
      stmt.bindId(1, expectedId);
      stmt.bindString(2,"4444.txt");
      return stmt.stepForInsert();
      });

    verify(ecdb, r, expectedId);

    expectedId = new Id64([4445,0]);
    r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt) => {
      stmt.bindId("id", expectedId);
      stmt.bindString("name","4445.txt");

      return stmt.stepForInsert();
      });
    verify(ecdb, r, expectedId);

    expectedId = new Id64([4446,0]);
    r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt) => {
      stmt.bindValues2([expectedId, "4446.txt"]);
      return stmt.stepForInsert();
      });
    verify(ecdb, r, expectedId);

    expectedId = new Id64([4447,0]);
    r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt) => {
      const values = new Map<string, any>([["id", expectedId],["name", "4447.txt"]]);
      stmt.bindValues2(values);
      return stmt.stepForInsert();
      });
    verify(ecdb, r, expectedId);
  });
});

it("Bind Scenarios", () => {using (setupECDb("bindscenarios.ecdb",
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
    <ECEntityClass typeName="Parent" modifier="Sealed">
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
    <ECEntityClass typeName="Child" modifier="Sealed">
      <ECProperty propertyName="Name" typeName="string"/>
      <ECNavigationProperty propertyName="Parent" relationshipName="ParentHasChildren" direction="backward"/>
    </ECEntityClass>
    <ECRelationshipClass typeName="ParentHasChildren" modifier="None" strength="embedding">
      <Source multiplicity="(0..1)" roleLabel="has" polymorphic="false">
          <Class class="Parent"/>
      </Source>
      <Target multiplicity="(0..*)" roleLabel="has" polymorphic="false">
          <Class class="Child"/>
      </Target>
    </ECRelationshipClass>
    </ECSchema>`), (ecdb) => {

    assert.isTrue(ecdb.isOpen());

    const stat: DbResult = ecdb.withPreparedStatement("INSERT INTO test.Parent(Bo,Dt) VALUES(?,?)", (stmt) => {
      stmt.bindBoolean(1, true);
      stmt.bindDateTime(2, new DateTime("2018-01-18"));

      return stmt.step();
    });
    assert.equal(stat, DbResult.BE_SQLITE_DONE);

    // Scenario Bind Id
    ecdb.withPreparedStatement("SELECT * FROM test.Parent WHERE ECInstanceId=:id AND ECClassId=:classid", (stmt) => {
      stmt.bindId("id", new Id64("0x1"));
      stmt.bindId("classid", new Id64("0x4443434"));
    });

    // Scenario Bind primitives
    ecdb.withPreparedStatement("INSERT INTO test.Parent(Bl,Bo,D,Dt,I,P2d,P3d,S) VALUES(?,?,?,?,?,?,?,?)", (stmt) => {

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
    ecdb.withPreparedStatement("INSERT INTO test.Parent(Struct) VALUES(?)", (stmt) => {
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
    ecdb.withPreparedStatement("INSERT INTO test.Parent(Struct_Array) VALUES(?)", (stmt) => {
      // same scenarios apply as for structs
      stmt.bindArray(1, [{S: "Hello World", D: 3.14, Dt: new DateTime("2018-01-01")},
                         {I: 123, P2d: Point2d.create(1, 2), P3d: Point3d.create(1, 2, 3)}]);
    });

    // Scenario Int Array
    ecdb.withPreparedStatement("INSERT INTO test.Parent(I_Array) VALUES(?)", (stmt) => {
          stmt.bindArray(1, [10, 20]);
        });

    // Scenario DateTime Array
    ecdb.withPreparedStatement("INSERT INTO test.Parent(Dt_Array) VALUES(?)", (stmt) => {
      stmt.bindArray(1, [new DateTime("2018-01-01"), new DateTime("2018-01-02")]);
    });

  });

  });

  /* This test doesn't do anything specific with the binder life time but just runs a few scenarios
     with and without statement cache to test that stuff works fine */
  it("ECSqlBinder life time", () => {
    using (setupECDb("ecsqlbinderlifetime.ecdb",
    `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECStructClass typeName="Address" modifier="Sealed">
      <ECProperty propertyName="Street" typeName="string"/>
      <ECProperty propertyName="City" typeName="string"/>
      <ECProperty propertyName="Zip" typeName="integer"/>
    </ECStructClass>
    <ECEntityClass typeName="Person" modifier="Sealed">
      <ECProperty propertyName="Name" typeName="string"/>
      <ECProperty propertyName="Age" typeName="int"/>
      <ECStructProperty propertyName="Location" typeName="Address"/>
    </ECEntityClass>
    </ECSchema>`), (ecdb) => {

    assert.isTrue(ecdb.isOpen());

    let id1: Id64, id2: Id64;

    // *** test without statement cache
    using (ecdb.prepareStatement("INSERT INTO test.Person(Name,Age,Location) VALUES(?,?,?)"), (stmt) => {
      stmt.bindString(1, "Mary Miller");
      stmt.bindInt(2, 30);
      stmt.bindStruct(3, {Street: "2000 Main Street", City: "New York", Zip: 12311});
    
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isTrue(res.id !== undefined);
      id1 = res.id!;
      assert.isTrue(id1.isValid());
    });

    // *** test withstatement cache
    ecdb.withPreparedStatement("INSERT INTO test.Person(Name,Age,Location) VALUES(?,?,?)", (stmt) => {
      stmt.bindString(1, "Mary Miller");
      stmt.bindInt(2, 30);
      stmt.bindStruct(3, {Street: "2000 Main Street", City: "New York", Zip: 12311});
    
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isTrue(res.id !== undefined);
      id2 = res.id!;
      assert.isTrue(id2.isValid());
    });

    using (ecdb.prepareStatement("SELECT ECInstanceId,ECClassId,Name,Age,Location FROM test.Person ORDER BY ECInstanceId"), (stmt) => {
      let rowCount = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        const row = stmt.getRow();
        if (rowCount === 1)
          assert.equal(row.id, id1.value);
        else
          assert.equal(row.id, id2.value);
        
        assert.equal(row.className, "Test.Person");
        assert.equal(row.name, "Mary Miller");
        assert.equal(row.age, 30);
        assert.equal(row.location.street, "2000 Main Street");
        assert.equal(row.location.city, "New York");
        assert.equal(row.location.zip, 12311);
      }
      assert.equal(rowCount, 2); });
    });
  });
});
