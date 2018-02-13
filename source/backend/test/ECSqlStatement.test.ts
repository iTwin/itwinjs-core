/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { ECSqlInsertResult } from "../ECSqlStatement";
import { DateTime, Blob, NavigationBindingValue } from "../../common/ECSqlTypes";
import { ECDb } from "../ECDb";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { using } from "@bentley/bentleyjs-core/lib/Disposable";
import { KnownTestLocations } from "./KnownTestLocations";

describe("ECSqlStatement", () => {
  const _outDir = KnownTestLocations.outputDir;

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
        assert.equal(row.id.value, expectedECInstanceId.value);
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
        assert.equal(row.bl.base64, blobVal.base64);
        assert.equal(row.bo, boolVal);
        assert.equal(row.d, doubleVal);
        assert.equal(row.dt.isoString, dtVal.isoString);
        assert.equal(row.i, intVal);
        assert.equal(row.p2d.x, p2dVal.x);
        assert.equal(row.p2d.y, p2dVal.y);
        assert.equal(row.p3d.x, p3dVal.x);
        assert.equal(row.p3d.y, p3dVal.y);
        assert.equal(row.p3d.z, p3dVal.z);
        assert.equal(row.s, strVal);

        assert.equal(row.s_bl.base64, blobVal.base64);
        assert.equal(row.s_bo, boolVal);
        assert.equal(row.s_d, doubleVal);
        assert.equal(row.s_dt.isoString, dtVal.isoString);
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
          assert.equal(row.struct.bl.base64, structVal.bl.base64);
          assert.equal(row.struct.bo, structVal.bo);
          assert.equal(row.struct.d, structVal.d);
          assert.equal(row.struct.dt.isoString, structVal.dt.isoString);
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

  it.only("Bind Arrays", () => {
    using (ECDbTestHelper.createECDb(_outDir, "bindarrays.ecdb",
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
          assert.equal(row.dt_Array[i].isoString, dtArray[i].isoString);
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
      stmt.bindNavigation(2, new NavigationBindingValue(parentId, "Test.ParentHasChildren"));
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues(["Child 2", new NavigationBindingValue(parentId, "Test.ParentHasChildren")]);
      res = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);
    });

    ecdb.withPreparedStatement("INSERT INTO test.Child(Name,Parent) VALUES(:name,:parent)", (stmt) => {
      stmt.bindString("name", "Child 3");
      stmt.bindNavigation("parent", new NavigationBindingValue(parentId, "Test.ParentHasChildren"));
      let res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      childIds.push(res.id!);

      stmt.reset();
      stmt.clearBindings();

      stmt.bindValues({name: "Child 4", parent: new NavigationBindingValue(parentId, "Test.ParentHasChildren")});
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
        assert.equal(row.parent.id.value, parentId.value);
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
          assert.equal(row.id.value, id1.value);
        else
          assert.equal(row.id.value, id2.value);

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

  it("GetRow with Primitives", () => {
    using (ECDbTestHelper.createECDb(_outDir, "getprimitives.ecdb",
    `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
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

      const id: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S) VALUES(?,?,?,?,?,?,?,?)", (stmt) => {
        stmt.bindBlob(1, blobVal);
        stmt.bindBoolean(2, boolVal);
        stmt.bindDouble(3, doubleVal);
        stmt.bindDateTime(4, dtVal);
        stmt.bindInt(5, intVal);
        stmt.bindPoint2d(6, p2dVal);
        stmt.bindPoint3d(7, p3dVal);
        stmt.bindString(8, strVal);
        const res: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(res.status, DbResult.BE_SQLITE_DONE);
        return res.id!;
      });

      ecdb.withPreparedStatement("SELECT ECInstanceId, ECClassId, Bl,Bo,D,Dt,I,P2d,P3d,S FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.id.value, id.value);
          assert.equal(row.className, "Test.Foo");
          assert.equal(row.bl.base64, blobVal.base64);
          assert.equal(row.bo, boolVal);
          assert.equal(row.d, doubleVal);
          assert.equal(row.dt.isoString, dtVal.isoString);
          assert.equal(row.i, intVal);
          assert.equal(row.p2d.x, p2dVal.x);
          assert.equal(row.p2d.y, p2dVal.y);
          assert.equal(row.p3d.x, p3dVal.x);
          assert.equal(row.p3d.y, p3dVal.y);
          assert.equal(row.p3d.z, p3dVal.z);
          assert.equal(row.s, strVal);
        });

      ecdb.withPreparedStatement("SELECT Bl AS Blobby, I+10, Lower(S), Upper(S) CapitalS FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.blobby.base64, blobVal.base64);
          assert.equal(row["[I] + 10"], intVal + 10);
          assert.equal(row["lower([S])"], strVal.toLowerCase());
          assert.equal(row.capitalS, strVal.toUpperCase());
        });

      const testSchemaId: Id64 = ecdb.withPreparedStatement("SELECT ECInstanceId FROM meta.ECSchemaDef WHERE Name='Test'", (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
          return row.id;
        });

      const fooClassId: Id64 = ecdb.withPreparedStatement("SELECT ECInstanceId FROM meta.ECClassDef WHERE Name='Foo'", (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
          return row.id;
        });

      ecdb.withPreparedStatement("SELECT s.ECInstanceId, c.ECInstanceId, c.Name, s.Name FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE s.Name='Test' AND c.Name='Foo'", (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.id.value, testSchemaId.value);
          assert.equal(row.id_1.value, fooClassId.value);
        });

      ecdb.withPreparedStatement("SELECT count(*) cnt FROM meta.ECSchemaDef", (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.isDefined(row.cnt);
          assert.equal(typeof(row.cnt), "number");
          assert.equal(row.cnt, 6);
        });

      ecdb.withPreparedStatement("SELECT 1 FROM meta.ECSchemaDef LIMIT 1", (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(typeof(row["1"]), "number");
          assert.equal(row["1"], 1);
        });

      ecdb.withPreparedStatement("SELECT NULL FROM meta.ECSchemaDef LIMIT 1", (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(Object.entries(row).length, 0);
        });

      });
    });

  it("GetRow with NavigationProperties and Relationships", () => {
    using (ECDbTestHelper.createECDb(_outDir, "getnavandrels.ecdb",
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
        stmt.bindNavigation(2, new NavigationBindingValue(parentId, "Test.ParentHasChildren"));
        let res: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(res.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(res.id);
        childIds.push(res.id!);

        stmt.reset();
        stmt.clearBindings();

        stmt.bindValues(["Child 2", new NavigationBindingValue(parentId, "Test.ParentHasChildren")]);
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
          assert.equal(row.parent.id.value, parentId.value);
          assert.equal(row.parent.relClassName, "Test.ParentHasChildren");
        }
        assert.equal(rowCount, 2);
        });

      ecdb.withPreparedStatement("SELECT Name,Parent.Id,Parent.RelECClassId, Parent.Id myParentid, Parent.RelECClassId myParentRelClassId FROM test.Child ORDER BY Name", (stmt) => {
          let rowCount: number = 0;
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            rowCount++;
            const row = stmt.getRow();
            assert.equal(row.name, "Child " + rowCount);
            assert.equal(row["parent.id"].value, parentId.value);
            assert.equal(row["parent.relClassName"], "Test.ParentHasChildren");
            assert.equal(row.myParentid, parentId.value);
            assert.isTrue(row.myParentRelClassId.isValid());
          }
          assert.equal(rowCount, 2);
        });

      ecdb.withPreparedStatement("SELECT ECInstanceId,ECClassId,SourceECInstanceId,SourceECClassId,TargetECInstanceId,TargetECClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", (stmt) => {
        const childId: Id64 = childIds[0];
        stmt.bindId(1, childId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.id.value, childId.value);
        assert.equal(row.className, "Test.ParentHasChildren");
        assert.equal(row.sourceId.value, parentId.value);
        assert.equal(row.sourceClassName, "Test.Parent");
        assert.equal(row.targetId.value, childId.value);
        assert.equal(row.targetClassName, "Test.Child");
      });

      ecdb.withPreparedStatement("SELECT ECInstanceId as MyId,ECClassId as MyClassId,SourceECInstanceId As MySourceId,SourceECClassId As MySourceClassId,TargetECInstanceId As MyTargetId,TargetECClassId As MyTargetClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", (stmt) => {
        const childId: Id64 = childIds[0];
        stmt.bindId(1, childId);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.myId.value, childId.value);
        assert.isTrue(row.myClassId.isValid());
        assert.equal(row.mySourceId.value, parentId.value);
        assert.isTrue(row.mySourceClassId.isValid());
        assert.equal(row.myTargetId.value, childId.value);
        assert.isTrue(row.myTargetClassId.isValid());
      });
    });

  });

  it("getRow with Structs", () => {
    using (ECDbTestHelper.createECDb(_outDir, "getstructs.ecdb",
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

      const id: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt) => {
          stmt.bindStruct(1, structVal);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          return res.id!;
        });

      ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row.struct.bl.base64, structVal.bl.base64);
          assert.equal(row.struct.bo, structVal.bo);
          assert.equal(row.struct.d, structVal.d);
          assert.equal(row.struct.dt.isoString, structVal.dt.isoString);
          assert.equal(row.struct.i, structVal.i);
          assert.equal(row.struct.p2d.x, structVal.p2d.x);
          assert.equal(row.struct.p2d.y, structVal.p2d.y);
          assert.equal(row.struct.p3d.x, structVal.p3d.x);
          assert.equal(row.struct.p3d.y, structVal.p3d.y);
          assert.equal(row.struct.p3d.z, structVal.p3d.z);
          assert.equal(row.struct.s, structVal.s);
        });

      ecdb.withPreparedStatement("SELECT Struct.Bl, Struct.Bo, Struct.D, Struct.Dt, Struct.I, Struct.P2d, Struct.P3d, Struct.S FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row["struct.Bl"].base64, structVal.bl.base64);
          assert.equal(row["struct.Bo"], structVal.bo);
          assert.equal(row["struct.D"], structVal.d);
          assert.equal(row["struct.Dt"].isoString, structVal.dt.isoString);
          assert.equal(row["struct.I"], structVal.i);
          assert.equal(row["struct.P2d"].x, structVal.p2d.x);
          assert.equal(row["struct.P2d"].y, structVal.p2d.y);
          assert.equal(row["struct.P3d"].x, structVal.p3d.x);
          assert.equal(row["struct.P3d"].y, structVal.p3d.y);
          assert.equal(row["struct.P3d"].z, structVal.p3d.z);
          assert.equal(row["struct.S"], structVal.s);
        });

      });
  });

  it("HexStr SQL function", () => {
    using (ECDbTestHelper.createECDb(_outDir, "hexstrfunction.ecdb",
    `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
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
       </ECEntityClass>
      </ECSchema>`), (ecdb) => {
      assert.isTrue(ecdb.isOpen());

      const expectedRow = {bl: new Blob("SGVsbG8gd29ybGQNCg=="), bo : true, d : 3.5, dt: new DateTime("2018-01-23T12:24:00.000"),
                          i: 3, l: 12312312312312, p2d: new Point2d(1, 2), p3d: new Point3d(1, 2, 3), s: "Hello World"};

      const id: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,L,P2d,P3d,S) VALUES(:bl,:bo,:d,:dt,:i,:l,:p2d,:p3d,:s)", (stmt) => {
          stmt.bindValues(expectedRow);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          return res.id!;
        });

      ecdb.withPreparedStatement("SELECT I, HexStr(I) hex FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row.i,  expectedRow.i);
          assert.equal(row.hex, "0x3");
        });

      ecdb.withPreparedStatement("SELECT L, HexStr(L) hex FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row.l,  expectedRow.l);
          assert.equal(row.hex, "0xb32af0071f8");
        });

      ecdb.withPreparedStatement("SELECT Bl, HexStr(Bl) hex FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
        });

      ecdb.withPreparedStatement("SELECT Bo, HexStr(Bo) hex FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row.bo,  expectedRow.bo);
          assert.equal(row.hex, "0x1");
        });

      ecdb.withPreparedStatement("SELECT D, HexStr(D) hex FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
        });

      ecdb.withPreparedStatement("SELECT Dt, HexStr(Dt) hex FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
        });

      // SQL functions cannot take points. So here preparation already fails
      assert.throw(() => ecdb.withPreparedStatement("SELECT P2d, HexStr(P2d) hex FROM test.Foo WHERE ECInstanceId=?", () => {
        assert.fail();
      }));

      // SQL functions cannot take points. So here preparation already fails
      assert.throw(() => ecdb.withPreparedStatement("SELECT P3d, HexStr(P3d) hex FROM test.Foo WHERE ECInstanceId=?", () => {
        assert.fail();
       }));

      ecdb.withPreparedStatement("SELECT S, HexStr(S) hex FROM test.Foo WHERE ECInstanceId=?", (stmt) => {
        stmt.bindId(1, id);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
     });
    });
  });

});
