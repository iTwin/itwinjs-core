/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { ECSqlInsertResult } from "../backend/ECSqlStatement";
import { DateTime, Blob, NavigationValue } from "../common/ECSqlBindingValues";
import { ECDb } from "../backend/ECDb";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { using } from "@bentley/bentleyjs-core/lib/Disposable";

describe("ECSqlStatement", () => {
  const _outDir = __dirname + "/output/";

  it("Bind Ids", () => {
    using (ECDbTestHelper.createECDb(_outDir, "bindids.ecdb"), (ecdb) => {

    assert.isTrue(ecdb.isOpen());

    const verify = (ecdbToVerify: ECDb, actualRes: ECSqlInsertResult, expectedECInstanceId?: Id64) => {
      if (expectedECInstanceId === undefined) {
        assert.notEqual(actualRes.status, DbResult.BE_SQLITE_DONE);
        assert.isUndefined(actualRes.id);
        return;
      }

      assert.equal(actualRes.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(actualRes.id);
      assert.equal(actualRes.id!.value, expectedECInstanceId.value);

      ecdbToVerify.withPreparedStatement("SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=?", (stmt) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.id, expectedECInstanceId.toString());
        assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
        assert.equal(row.name, expectedECInstanceId.getLow().toString() + ".txt");
        });
      };

    let expectedId = new Id64([4444, 0]);
    let r: ECSqlInsertResult = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt) => {
      stmt.bindId(1, expectedId);
      stmt.bindString(2, "4444.txt");
      return stmt.stepForInsert();
      });

    verify(ecdb, r, expectedId);

    expectedId = new Id64([4445, 0]);
    r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt) => {
      stmt.bindId("id", expectedId);
      stmt.bindString("name", "4445.txt");

      return stmt.stepForInsert();
      });
    verify(ecdb, r, expectedId);

    expectedId = new Id64([4446, 0]);
    r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt) => {
      stmt.bindValues([expectedId, "4446.txt"]);
      return stmt.stepForInsert();
      });
    verify(ecdb, r, expectedId);

    expectedId = new Id64([4447, 0]);
    r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt) => {
      stmt.bindValues({id: expectedId, name: "4447.txt"});
      return stmt.stepForInsert();
      });
    verify(ecdb, r, expectedId);
  });
});

  it("Bind Primitives", () => {
  using (ECDbTestHelper.createECDb(_outDir, "bindprimitives.ecdb",
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
      <ECStructProperty propertyName="Struct" typeName="MyStruct"/>
    </ECEntityClass>
    </ECSchema>`), (ecdb) => {
    assert.isTrue(ecdb.isOpen());

    const blobVal = new Blob("SGVsbG8gd29ybGQNCg==");
    const boolVal: boolean = true;
    const doubleVal: number = 3.5;
    const dtVal = new DateTime("2018-01-23T12:24:00.000");
    const intVal: number = 3;
    const p2dVal = new Point2d(1, 2);
    const p3dVal = new Point3d(1, 2, 3);
    const strVal: string = "Hello world";

    const verify = (expectedId: Id64) => {
      ecdb.withPreparedStatement("SELECT Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl s_bl,Struct.Bo s_bo,Struct.D s_d,Struct.Dt s_dt,Struct.I s_i,Struct.P2d s_p2d,Struct.P3d s_p3d,Struct.S s_s FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.bl, blobVal.base64);
        assert.equal(row.bo, boolVal);
        assert.equal(row.d, doubleVal);
        assert.equal(row.dt, dtVal.isoString);
        assert.equal(row.i, intVal);
        assert.equal(row.p2d.x, p2dVal.x);
        assert.equal(row.p2d.y, p2dVal.y);
        assert.equal(row.p3d.x, p3dVal.x);
        assert.equal(row.p3d.y, p3dVal.y);
        assert.equal(row.p3d.z, p3dVal.z);
        assert.equal(row.s, strVal);

        assert.equal(row.s_bl, blobVal.base64);
        assert.equal(row.s_bo, boolVal);
        assert.equal(row.s_d, doubleVal);
        assert.equal(row.s_dt, dtVal.isoString);
        assert.equal(row.s_i, intVal);
        assert.equal(row.s_p2d.x, p2dVal.x);
        assert.equal(row.s_p2d.y, p2dVal.y);
        assert.equal(row.s_p3d.x, p3dVal.x);
        assert.equal(row.s_p3d.y, p3dVal.y);
        assert.equal(row.s_p3d.z, p3dVal.z);
        assert.equal(row.s_s, strVal);
      });
    };

    const ids = new Array<Id64>();
    ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl,Struct.Bo,Struct.D,Struct.Dt,Struct.I,Struct.P2d,Struct.P3d,Struct.S) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (stmt) => {
      stmt.bindBlob(1, blobVal);
      stmt.bindBoolean(2, boolVal);
      stmt.bindDouble(3, doubleVal);
      stmt.bindDateTime(4, dtVal);
      stmt.bindInt(5, intVal);
      stmt.bindPoint2d(6, p2dVal);
      stmt.bindPoint3d(7, p3dVal);
      stmt.bindString(8, strVal);
      stmt.bindBlob(9, blobVal);
      stmt.bindBoolean(10, boolVal);
      stmt.bindDouble(11, doubleVal);
      stmt.bindDateTime(12, dtVal);
      stmt.bindInt(13, intVal);
      stmt.bindPoint2d(14, p2dVal);
      stmt.bindPoint3d(15, p3dVal);
      stmt.bindString(16, strVal);

      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
      stmt.reset();
      stmt.clearBindings();
      stmt.bindValues([blobVal, boolVal, doubleVal, dtVal, intVal, p2dVal, p3dVal, strVal, blobVal, boolVal, doubleVal, dtVal, intVal, p2dVal, p3dVal, strVal]);

      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
    });

    ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl,Struct.Bo,Struct.D,Struct.Dt,Struct.I,Struct.P2d,Struct.P3d,Struct.S) VALUES(:bl,:bo,:d,:dt,:i,:p2d,:p3d,:s,:s_bl,:s_bo,:s_d,:s_dt,:s_i,:s_p2d,:s_p3d,:s_s)", (stmt) => {
      stmt.bindBlob("bl", blobVal);
      stmt.bindBoolean("bo", boolVal);
      stmt.bindDouble("d", doubleVal);
      stmt.bindDateTime("dt", dtVal);
      stmt.bindInt("i", intVal);
      stmt.bindPoint2d("p2d", p2dVal);
      stmt.bindPoint3d("p3d", p3dVal);
      stmt.bindString("s", strVal);

      stmt.bindBlob("s_bl", blobVal);
      stmt.bindBoolean("s_bo", boolVal);
      stmt.bindDouble("s_d", doubleVal);
      stmt.bindDateTime("s_dt", dtVal);
      stmt.bindInt("s_i", intVal);
      stmt.bindPoint2d("s_p2d", p2dVal);
      stmt.bindPoint3d("s_p3d", p3dVal);
      stmt.bindString("s_s", strVal);

      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
      stmt.reset();
      stmt.clearBindings();
      stmt.bindValues({bl: blobVal, bo: boolVal, d: doubleVal, dt: dtVal,
            i: intVal, p2d: p2dVal, p3d: p3dVal, s: strVal,
            s_bl: blobVal, s_bo: boolVal, s_d: doubleVal, s_dt: dtVal,
            s_i: intVal, s_p2d: p2dVal, s_p3d: p3dVal, s_s: strVal});

      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      ids.push(res.id!);
      });

    for (const id of ids) {
      verify(id);
      }
    });
  });

  it("Bind Structs", () => {
    using (ECDbTestHelper.createECDb(_outDir, "bindstructs.ecdb",
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
        <ECStructProperty propertyName="Struct" typeName="MyStruct"/>
      </ECEntityClass>
      </ECSchema>`), (ecdb) => {
      assert.isTrue(ecdb.isOpen());

      const structVal = {bl: new Blob("SGVsbG8gd29ybGQNCg=="), bo : true, d : 3.5, dt: new DateTime("2018-01-23T12:24:00.000"),
                          i: 3, p2d: new Point2d(1, 2), p3d: new Point3d(1, 2, 3), s: "Hello World"};

      const verify = (expectedId: Id64) => {
        ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, expectedId);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.struct.bl, structVal.bl.base64);
          assert.equal(row.struct.bo, structVal.bo);
          assert.equal(row.struct.d, structVal.d);
          assert.equal(row.struct.dt, structVal.dt.isoString);
          assert.equal(row.struct.i, structVal.i);
          assert.equal(row.struct.p2d.x, structVal.p2d.x);
          assert.equal(row.struct.p2d.y, structVal.p2d.y);
          assert.equal(row.struct.p3d.x, structVal.p3d.x);
          assert.equal(row.struct.p3d.y, structVal.p3d.y);
          assert.equal(row.struct.p3d.z, structVal.p3d.z);
          assert.equal(row.struct.s, structVal.s);
      });

        ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt) => {
          stmt.bindStruct(1, structVal);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

        ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt) => {
          stmt.bindValues([structVal]);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

        ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(:str)", (stmt) => {
          stmt.bindStruct("str", structVal);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

        ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(:str)", (stmt) => {
          stmt.bindValues({str: structVal});
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });
      };
    });
  });

  it("Bind Arrays", () => {
    using (ECDbTestHelper.createECDb(_outDir, "bindstructs.ecdb",
    `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECStructClass typeName="Location" modifier="Sealed">
        <ECProperty propertyName="City" typeName="string"/>
        <ECProperty propertyName="Zip" typeName="int"/>
      </ECStructClass>
      <ECEntityClass typeName="Foo" modifier="Sealed">
        <ECArrayProperty propertyName="I_Array" typeName="int"/>
        <ECArrayProperty propertyName="Dt_Array" typeName="dateTime"/>
        <ECStructArrayProperty propertyName="Addresses" typeName="Location"/>
      </ECEntityClass>
      </ECSchema>`), (ecdb) => {
      assert.isTrue(ecdb.isOpen());

      const intArray = [1, 2, 3];
      const dtArray = [new DateTime("2018-01-23T00:00:00.000"), new DateTime("2018-01-23T16:39:00.000")];
      const addressArray = [{city: "London", zip: 10000}, {city: "Manchester", zip: 20000}, {city: "Edinburgh", zip: 30000}];

      const verify = (expectedId: Id64) => {
        ecdb.withPreparedStatement("SELECT I_Array, Dt_Array, Addresses FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
        stmt.bindId(1, expectedId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();

        // don't know why assert.equal doesn't work on arrays directly
        assert.equal(row.i_Array.length, intArray.length);
        for (let i = 0; i < intArray.length; i++) {
          assert.equal(row.i_Array[i], intArray[i]);
        }

        assert.equal(row.dt_Array.length, dtArray.length);
        for (let i = 0; i < dtArray.length; i++) {
          assert.equal(row.dt_Array[i], dtArray[i].isoString);
        }

        assert.equal(row.addresses.length, addressArray.length);
        for (let i = 0; i < addressArray.length; i++) {
          assert.equal(row.addresses[i].city, addressArray[i].city);
          assert.equal(row.addresses[i].zip, addressArray[i].zip);
        }
        });
        };

      ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(?,?,?)", (stmt) => {
          stmt.bindArray(1, intArray);
          stmt.bindArray(2, dtArray);
          stmt.bindArray(3, addressArray);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

      ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(?,?,?)", (stmt) => {
          stmt.bindValues([intArray, dtArray, addressArray]);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

      ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(:iarray,:dtarray,:addresses)", (stmt) => {
          stmt.bindArray("iarray", intArray);
          stmt.bindArray("dtarray", dtArray);
          stmt.bindArray("addresses", addressArray);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

      ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(:iarray,:dtarray,:addresses)", (stmt) => {
          stmt.bindValues({iarray: intArray, dtarray: dtArray, addresses: addressArray});
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });
    });
  });

  it("Bind Navigation", () => {using (ECDbTestHelper.createECDb(_outDir, "bindnavigation.ecdb",
    `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECEntityClass typeName="Parent" modifier="Sealed">
      <ECProperty propertyName="Code" typeName="string"/>
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

    const parentId: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Parent(Code) VALUES('Parent 1')", (stmt) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });

    const childIds = new Array<Id64>();
    ecdb.withPreparedStatement("INSERT INTO test.Child(Name,Parent) VALUES(?,?)", (stmt) => {
      stmt.bindString(1, "Child 1");
      stmt.bindNavigation(2, new NavigationValue(parentId, "Test.ParentHasChildren"));
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues(["Child 2", new NavigationValue(parentId, "Test.ParentHasChildren")]);
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);
    });

    ecdb.withPreparedStatement("INSERT INTO test.Child(Name,Parent) VALUES(:name,:parent)", (stmt) => {
      stmt.bindString("name", "Child 3");
      stmt.bindNavigation("parent", new NavigationValue(parentId, "Test.ParentHasChildren"));
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues({name: "Child 4", parent: new NavigationValue(parentId, "Test.ParentHasChildren")});
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);
    });

    ecdb.withPreparedStatement("SELECT Name,Parent FROM test.Child ORDER BY Name", (stmt) => {
      let rowCount: number = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        const row = stmt.getRow();
        assert.equal(row.name, "Child " + rowCount);
        assert.equal(row.parent.id, parentId.toString());
        assert.equal(row.parent.relClassName, "Test.ParentHasChildren");
      }
      assert.equal(rowCount, 4);
      });
    });
  });

  /* This test doesn't do anything specific with the binder life time but just runs a few scenarios
     with and without statement cache to test that stuff works fine */
  it("ECSqlBinder life time", () => {
    using (ECDbTestHelper.createECDb(_outDir, "ecsqlbinderlifetime.ecdb",
    `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECStructClass typeName="Address" modifier="Sealed">
      <ECProperty propertyName="Street" typeName="string"/>
      <ECProperty propertyName="City" typeName="string"/>
      <ECProperty propertyName="Zip" typeName="int"/>
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
