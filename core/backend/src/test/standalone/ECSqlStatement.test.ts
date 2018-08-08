/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { IModelTestUtils } from "../IModelTestUtils";
import { ECSqlStatement, ECSqlInsertResult } from "../../ECSqlStatement";
import { ECSqlStringType, ECSqlTypedString, NavigationValue } from "@bentley/imodeljs-common";
import { ECDb } from "../../ECDb";
import { IModelDb } from "../../IModelDb";
import { DbResult, Id64, using } from "@bentley/bentleyjs-core";
import { XAndY, XYAndZ, Point2d, Point3d, Range3d } from "@bentley/geometry-core";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ECSqlStatement", () => {
  const _outDir = KnownTestLocations.outputDir;
  const testRange = new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7);
  const blobVal = testRange.toFloat64Array().buffer;

  it("Bind Ids", () => {
    using(ECDbTestHelper.createECDb(_outDir, "bindids.ecdb"), (ecdb: ECDb) => {

      assert.isTrue(ecdb.isOpen());

      const verify = (ecdbToVerify: ECDb, actualRes: ECSqlInsertResult, expectedECInstanceId?: Id64) => {
        if (!expectedECInstanceId) {
          assert.notEqual(actualRes.status, DbResult.BE_SQLITE_DONE);
          assert.isUndefined(actualRes.id);
          return;
        }

        assert.equal(actualRes.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(actualRes.id);
        assert.equal(actualRes.id!.value, expectedECInstanceId.value);

        ecdbToVerify.withPreparedStatement("SELECT ECInstanceId, ECClassId, Name FROM ecdbf.ExternalFileInfo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, expectedId);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.id, expectedECInstanceId.value);
          assert.equal(row.className, "ECDbFileInfo.ExternalFileInfo");
          assert.equal(row.name, expectedECInstanceId.getLow().toString() + ".txt");
        });
      };

      let expectedId = new Id64([4444, 0]);
      let r: ECSqlInsertResult = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt: ECSqlStatement) => {
        stmt.bindId(1, expectedId);
        stmt.bindString(2, "4444.txt");
        return stmt.stepForInsert();
      });

      verify(ecdb, r, expectedId);

      expectedId = new Id64([4445, 0]);
      r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt: ECSqlStatement) => {
        stmt.bindId("id", expectedId);
        stmt.bindString("name", "4445.txt");

        return stmt.stepForInsert();
      });
      verify(ecdb, r, expectedId);

      expectedId = new Id64([4446, 0]);
      r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(?,?)", (stmt: ECSqlStatement) => {
        stmt.bindValues([expectedId, "4446.txt"]);
        return stmt.stepForInsert();
      });
      verify(ecdb, r, expectedId);

      expectedId = new Id64([4447, 0]);
      r = ecdb.withPreparedStatement("INSERT INTO ecdbf.ExternalFileInfo(ECInstanceId,Name) VALUES(:id,:name)", (stmt: ECSqlStatement) => {
        stmt.bindValues({ id: expectedId, name: "4447.txt" });
        return stmt.stepForInsert();
      });
      verify(ecdb, r, expectedId);
    });
  });

  it("Bind Numbers", () => {
    using(ECDbTestHelper.createECDb(_outDir, "bindnumbers.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECEntityClass typeName="Foo" modifier="Sealed">
      <ECProperty propertyName="D" typeName="double"/>
      <ECProperty propertyName="I" typeName="int"/>
      <ECProperty propertyName="L" typeName="long"/>
      <ECProperty propertyName="S" typeName="string"/>
      <ECProperty propertyName="Description" typeName="string"/>
    </ECEntityClass>
    </ECSchema>`), (ecdb) => {
        assert.isTrue(ecdb.isOpen());

        const doubleVal: number = 3.5;
        let id: Id64 = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindDouble')", (stmt: ECSqlStatement) => {
          stmt.bindDouble(1, doubleVal);
          stmt.bindDouble(2, doubleVal);
          stmt.bindDouble(3, doubleVal);
          stmt.bindDouble(4, doubleVal);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, doubleVal);
          assert.equal(row.i, 3);
          assert.equal(row.l, 3);
          assert.equal(row.s, "3.5");
        });

        const smallIntVal: number = 3;
        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, small int')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, smallIntVal);
          stmt.bindInteger(2, smallIntVal);
          stmt.bindInteger(3, smallIntVal);
          stmt.bindInteger(4, smallIntVal);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, smallIntVal);
          assert.equal(row.i, smallIntVal);
          assert.equal(row.l, smallIntVal);
          assert.equal(row.s, "3");
        });

        const largeUnsafeNumber: number = 12312312312312323654; // too large for int64, but fits into uint64
        assert.isFalse(Number.isSafeInteger(largeUnsafeNumber));
        const largeUnsafeNumberStr: string = "12312312312312323654";
        const largeUnsafeNumberHexStr: string = "0xaade1ed08b0b5e46";

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large unsafe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeUnsafeNumberStr);
          stmt.bindInteger(2, largeUnsafeNumberStr);
          stmt.bindInteger(3, largeUnsafeNumberStr);
          stmt.bindInteger(4, largeUnsafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT Str(I) si, HexStr(I) hi, Str(L) sl, HexStr(L) hl FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.si, largeUnsafeNumberStr);
          assert.equal(row.hi, largeUnsafeNumberHexStr);
          assert.equal(row.sl, largeUnsafeNumberStr);
          assert.equal(row.hl, largeUnsafeNumberHexStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large unsafe number as hexstring')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeUnsafeNumberHexStr);
          stmt.bindInteger(2, largeUnsafeNumberHexStr);
          stmt.bindInteger(3, largeUnsafeNumberHexStr);
          stmt.bindInteger(4, largeUnsafeNumberHexStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT Str(I) si, HexStr(I) hi, Str(L) sl, HexStr(L) hl FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.si, largeUnsafeNumberStr);
          assert.equal(row.hi, largeUnsafeNumberHexStr);
          assert.equal(row.sl, largeUnsafeNumberStr);
          assert.equal(row.hl, largeUnsafeNumberHexStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large unsafe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindString(1, largeUnsafeNumberStr);
          stmt.bindString(2, largeUnsafeNumberStr);
          stmt.bindString(3, largeUnsafeNumberStr);
          stmt.bindString(4, largeUnsafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        // uint64 cannot be bound as string in SQLite. They get converted to reals
        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.isNumber(row.d);
          assert.isNumber(row.i);
          assert.isNumber(row.l);
          assert.equal(row.s, largeUnsafeNumberStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large unsafe number as hexstring')", (stmt: ECSqlStatement) => {
          stmt.bindString(1, largeUnsafeNumberHexStr);
          stmt.bindString(2, largeUnsafeNumberHexStr);
          stmt.bindString(3, largeUnsafeNumberHexStr);
          stmt.bindString(4, largeUnsafeNumberHexStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT CAST(D AS TEXT) d,CAST(I AS TEXT) i,CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeUnsafeNumberHexStr);
          assert.equal(row.i, largeUnsafeNumberHexStr);
          assert.equal(row.l, largeUnsafeNumberHexStr);
          assert.equal(row.s, largeUnsafeNumberHexStr);
        });

        const largeNegUnsafeNumber: number = -123123123123123236;
        assert.isFalse(Number.isSafeInteger(largeNegUnsafeNumber));
        const largeNegUnsafeNumberStr: string = "-123123123123123236";

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large negative unsafe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeNegUnsafeNumberStr);
          stmt.bindInteger(2, largeNegUnsafeNumberStr);
          stmt.bindInteger(3, largeNegUnsafeNumberStr);
          stmt.bindInteger(4, largeNegUnsafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT CAST(I AS TEXT) i, CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.i, largeNegUnsafeNumberStr);
          assert.equal(row.l, largeNegUnsafeNumberStr);
          assert.equal(row.s, largeNegUnsafeNumberStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large negative unsafe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindString(1, largeNegUnsafeNumberStr);
          stmt.bindString(2, largeNegUnsafeNumberStr);
          stmt.bindString(3, largeNegUnsafeNumberStr);
          stmt.bindString(4, largeNegUnsafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT CAST(I AS TEXT) i, CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.i, largeNegUnsafeNumberStr);
          assert.equal(row.l, largeNegUnsafeNumberStr);
          assert.equal(row.s, largeNegUnsafeNumberStr);
        });

        const largeSafeNumber: number = 1231231231231232;
        assert.isTrue(Number.isSafeInteger(largeSafeNumber));
        const largeSafeNumberStr: string = largeSafeNumber.toString();
        const largeSafeNumberHexStr: string = "0x45fcc5c2c8500";

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large safe number')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeSafeNumber);
          stmt.bindInteger(2, largeSafeNumber);
          stmt.bindInteger(3, largeSafeNumber);
          stmt.bindInteger(4, largeSafeNumber);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I, Str(I) si, HexStr(I) hi, L, Str(L) sl, HexStr(L) hl,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeSafeNumber);
          assert.equal(row.i, largeSafeNumber);
          assert.equal(row.si, largeSafeNumberStr);
          assert.equal(row.hi, largeSafeNumberHexStr);
          assert.equal(row.l, largeSafeNumber);
          assert.equal(row.sl, largeSafeNumberStr);
          assert.equal(row.hl, largeSafeNumberHexStr);
          assert.equal(row.s, largeSafeNumberStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large safe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeSafeNumberStr);
          stmt.bindInteger(2, largeSafeNumberStr);
          stmt.bindInteger(3, largeSafeNumberStr);
          stmt.bindInteger(4, largeSafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeSafeNumber);
          assert.equal(row.i, largeSafeNumber);
          assert.equal(row.l, largeSafeNumber);
          assert.equal(row.s, largeSafeNumberStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large safe number as hexstring')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeSafeNumberHexStr);
          stmt.bindInteger(2, largeSafeNumberHexStr);
          stmt.bindInteger(3, largeSafeNumberHexStr);
          stmt.bindInteger(4, largeSafeNumberHexStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeSafeNumber);
          assert.equal(row.i, largeSafeNumber);
          assert.equal(row.l, largeSafeNumber);
          assert.equal(row.s, largeSafeNumberStr); // even though it was bound as hex str, it gets converted to int64 before persisting
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large safe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindString(1, largeSafeNumberStr);
          stmt.bindString(2, largeSafeNumberStr);
          stmt.bindString(3, largeSafeNumberStr);
          stmt.bindString(4, largeSafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeSafeNumber);
          assert.equal(row.i, largeSafeNumber);
          assert.equal(row.l, largeSafeNumber);
          assert.equal(row.s, largeSafeNumberStr);
        });

        // SQLite does not parse hex strs bound as strings.
        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large safe number as hexstring')", (stmt: ECSqlStatement) => {
          stmt.bindString(1, largeSafeNumberHexStr);
          stmt.bindString(2, largeSafeNumberHexStr);
          stmt.bindString(3, largeSafeNumberHexStr);
          stmt.bindString(4, largeSafeNumberHexStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT CAST(D AS TEXT) d,CAST(I AS TEXT) i,CAST(L AS TEXT) l,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeSafeNumberHexStr);
          assert.equal(row.i, largeSafeNumberHexStr);
          assert.equal(row.l, largeSafeNumberHexStr);
          assert.equal(row.s, largeSafeNumberHexStr);
        });

        const largeNegSafeNumber: number = -1231231231231232;
        assert.isTrue(Number.isSafeInteger(largeNegSafeNumber));
        const largeNegSafeNumberStr: string = largeNegSafeNumber.toString();

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large negative safe number')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeNegSafeNumber);
          stmt.bindInteger(2, largeNegSafeNumber);
          stmt.bindInteger(3, largeNegSafeNumber);
          stmt.bindInteger(4, largeNegSafeNumber);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeNegSafeNumber);
          assert.equal(row.i, largeNegSafeNumber);
          assert.equal(row.l, largeNegSafeNumber);
          assert.equal(row.s, largeNegSafeNumberStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindInteger, large negative safe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindInteger(1, largeNegSafeNumberStr);
          stmt.bindInteger(2, largeNegSafeNumberStr);
          stmt.bindInteger(3, largeNegSafeNumberStr);
          stmt.bindInteger(4, largeNegSafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeNegSafeNumber);
          assert.equal(row.i, largeNegSafeNumber);
          assert.equal(row.l, largeNegSafeNumber);
          assert.equal(row.s, largeNegSafeNumberStr);
        });

        id = ecdb.withPreparedStatement("INSERT INTO Test.Foo(D,I,L,S,Description) VALUES(?,?,?,?,'bindString, large negative safe number as string')", (stmt: ECSqlStatement) => {
          stmt.bindString(1, largeNegSafeNumberStr);
          stmt.bindString(2, largeNegSafeNumberStr);
          stmt.bindString(3, largeNegSafeNumberStr);
          stmt.bindString(4, largeNegSafeNumberStr);
          const r: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(r.status, DbResult.BE_SQLITE_DONE);
          return r.id!;
        });

        ecdb.withPreparedStatement("SELECT D,I,L,S FROM Test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.d, largeNegSafeNumber);
          assert.equal(row.i, largeNegSafeNumber);
          assert.equal(row.l, largeNegSafeNumber);
          assert.equal(row.s, largeNegSafeNumberStr);
        });
      });
  });

  it("Bind Primitives", () => {
    using(ECDbTestHelper.createECDb(_outDir, "bindprimitives.ecdb",
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

        const boolVal = true;
        const doubleVal = 3.5;
        const dtVal: ECSqlTypedString = { type: ECSqlStringType.DateTime, value: "2018-01-23T12:24:00.000" };
        const intVal = 3;
        const p2dVal = new Point2d(1, 2);
        const p3dVal = new Point3d(1, 2, 3);
        const strVal: string = "Hello world";

        const verify = (expectedId: Id64) => {
          ecdb.withPreparedStatement("SELECT Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl s_bl,Struct.Bo s_bo,Struct.D s_d,Struct.Dt s_dt,Struct.I s_i,Struct.P2d s_p2d,Struct.P3d s_p3d,Struct.S s_s FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
            stmt.bindId(1, expectedId);
            assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
            const row = stmt.getRow();
            assert.deepEqual(row.bl, blobVal);
            const f64 = new Float64Array(row.bl);
            const r2 = new Range3d(...f64);
            assert.deepEqual(r2, testRange);
            assert.equal(row.bo, boolVal);
            assert.equal(row.d, doubleVal);
            assert.equal(row.dt, dtVal.value);
            assert.equal(row.i, intVal);
            assert.equal(row.p2d.x, p2dVal.x);
            assert.equal(row.p2d.y, p2dVal.y);
            assert.equal(row.p3d.x, p3dVal.x);
            assert.equal(row.p3d.y, p3dVal.y);
            assert.equal(row.p3d.z, p3dVal.z);
            assert.equal(row.s, strVal);

            assert.deepEqual(row.s_bl, blobVal);
            assert.equal(row.s_bo, boolVal);
            assert.equal(row.s_d, doubleVal);
            assert.equal(row.s_dt, dtVal.value);
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
        ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl,Struct.Bo,Struct.D,Struct.Dt,Struct.I,Struct.P2d,Struct.P3d,Struct.S) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (stmt: ECSqlStatement) => {
          stmt.bindBlob(1, blobVal);
          stmt.bindBoolean(2, boolVal);
          stmt.bindDouble(3, doubleVal);
          stmt.bindDateTime(4, dtVal.value);
          stmt.bindInteger(5, intVal);
          stmt.bindPoint2d(6, p2dVal);
          stmt.bindPoint3d(7, p3dVal);
          stmt.bindString(8, strVal);
          stmt.bindBlob(9, blobVal);
          stmt.bindBoolean(10, boolVal);
          stmt.bindDouble(11, doubleVal);
          stmt.bindDateTime(12, dtVal.value);
          stmt.bindInteger(13, intVal);
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

        ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S,Struct.Bl,Struct.Bo,Struct.D,Struct.Dt,Struct.I,Struct.P2d,Struct.P3d,Struct.S) VALUES(:bl,:bo,:d,:dt,:i,:p2d,:p3d,:s,:s_bl,:s_bo,:s_d,:s_dt,:s_i,:s_p2d,:s_p3d,:s_s)", (stmt: ECSqlStatement) => {
          stmt.bindBlob("bl", blobVal);
          stmt.bindBoolean("bo", boolVal);
          stmt.bindDouble("d", doubleVal);
          stmt.bindDateTime("dt", dtVal.value);
          stmt.bindInteger("i", intVal);
          stmt.bindPoint2d("p2d", p2dVal);
          stmt.bindPoint3d("p3d", p3dVal);
          stmt.bindString("s", strVal);

          stmt.bindBlob("s_bl", blobVal);
          stmt.bindBoolean("s_bo", boolVal);
          stmt.bindDouble("s_d", doubleVal);
          stmt.bindDateTime("s_dt", dtVal.value);
          stmt.bindInteger("s_i", intVal);
          stmt.bindPoint2d("s_p2d", p2dVal);
          stmt.bindPoint3d("s_p3d", p3dVal);
          stmt.bindString("s_s", strVal);

          let res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          ids.push(res.id!);
          stmt.reset();
          stmt.clearBindings();
          stmt.bindValues({
            bl: blobVal, bo: boolVal, d: doubleVal, dt: dtVal,
            i: intVal, p2d: p2dVal, p3d: p3dVal, s: strVal,
            s_bl: blobVal, s_bo: boolVal, s_d: doubleVal, s_dt: dtVal,
            s_i: intVal, s_p2d: p2dVal, s_p3d: p3dVal, s_s: strVal,
          });

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
    using(ECDbTestHelper.createECDb(_outDir, "bindstructs.ecdb",
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

        const structVal = {
          bl: { blobVal }, bo: true, d: 3.5,
          dt: { type: ECSqlStringType.DateTime, value: "2018-01-23T12:24:00.000" },
          i: 3, p2d: new Point2d(1, 2), p3d: new Point3d(1, 2, 3), s: "Hello World",
        };

        const verify = (expectedId: Id64) => {
          ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
            stmt.bindId(1, expectedId);
            assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
            const row = stmt.getRow();
            assert.equal(row.struct.bl, structVal.bl);
            assert.equal(row.struct.bo, structVal.bo);
            assert.equal(row.struct.d, structVal.d);
            assert.equal(row.struct.dt, structVal.dt.value);
            assert.equal(row.struct.i, structVal.i);
            assert.equal(row.struct.p2d.x, structVal.p2d.x);
            assert.equal(row.struct.p2d.y, structVal.p2d.y);
            assert.equal(row.struct.p3d.x, structVal.p3d.x);
            assert.equal(row.struct.p3d.y, structVal.p3d.y);
            assert.equal(row.struct.p3d.z, structVal.p3d.z);
            assert.equal(row.struct.s, structVal.s);
          });

          ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt: ECSqlStatement) => {
            stmt.bindStruct(1, structVal);
            const res: ECSqlInsertResult = stmt.stepForInsert();
            assert.equal(res.status, DbResult.BE_SQLITE_DONE);
            assert.isDefined(res.id);
            verify(res.id!);
          });

          ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt: ECSqlStatement) => {
            stmt.bindValues([structVal]);
            const res: ECSqlInsertResult = stmt.stepForInsert();
            assert.equal(res.status, DbResult.BE_SQLITE_DONE);
            assert.isDefined(res.id);
            verify(res.id!);
          });

          ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(:str)", (stmt: ECSqlStatement) => {
            stmt.bindStruct("str", structVal);
            const res: ECSqlInsertResult = stmt.stepForInsert();
            assert.equal(res.status, DbResult.BE_SQLITE_DONE);
            assert.isDefined(res.id);
            verify(res.id!);
          });

          ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(:str)", (stmt: ECSqlStatement) => {
            stmt.bindValues({ str: structVal });
            const res: ECSqlInsertResult = stmt.stepForInsert();
            assert.equal(res.status, DbResult.BE_SQLITE_DONE);
            assert.isDefined(res.id);
            verify(res.id!);
          });
        };
      });
  });

  it("Bind Arrays", () => {
    using(ECDbTestHelper.createECDb(_outDir, "bindarrays.ecdb",
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
        const dtArray = [{ type: ECSqlStringType.DateTime, value: "2018-01-23T00:00:00.000" }, { type: ECSqlStringType.DateTime, value: "2018-01-23T16:39:00.000" }];
        const addressArray = [{ city: "London", zip: 10000 }, { city: "Manchester", zip: 20000 }, { city: "Edinburgh", zip: 30000 }];

        const verify = (expectedId: Id64) => {
          ecdb.withPreparedStatement("SELECT I_Array, Dt_Array, Addresses FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
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
              assert.equal(row.dt_Array[i], dtArray[i].value);
            }

            assert.equal(row.addresses.length, addressArray.length);
            for (let i = 0; i < addressArray.length; i++) {
              assert.equal(row.addresses[i].city, addressArray[i].city);
              assert.equal(row.addresses[i].zip, addressArray[i].zip);
            }
          });
        };

        ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(?,?,?)", (stmt: ECSqlStatement) => {
          stmt.bindArray(1, intArray);
          stmt.bindArray(2, dtArray);
          stmt.bindArray(3, addressArray);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

        ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(?,?,?)", (stmt: ECSqlStatement) => {
          stmt.bindValues([intArray, dtArray, addressArray]);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

        ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(:iarray,:dtarray,:addresses)", (stmt: ECSqlStatement) => {
          stmt.bindArray("iarray", intArray);
          stmt.bindArray("dtarray", dtArray);
          stmt.bindArray("addresses", addressArray);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });

        ecdb.withPreparedStatement("INSERT INTO test.Foo(I_Array,Dt_Array,Addresses) VALUES(:iarray,:dtarray,:addresses)", (stmt: ECSqlStatement) => {
          stmt.bindValues({ iarray: intArray, dtarray: dtArray, addresses: addressArray });
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          verify(res.id!);
        });
      });
  });

  it("Bind Navigation", () => {
    using(ECDbTestHelper.createECDb(_outDir, "bindnavigation.ecdb",
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

        const parentId: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Parent(Code) VALUES('Parent 1')", (stmt: ECSqlStatement) => {
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          return res.id!;
        });

        const childIds = new Array<Id64>();
        ecdb.withPreparedStatement("INSERT INTO test.Child(Name,Parent) VALUES(?,?)", (stmt: ECSqlStatement) => {
          stmt.bindString(1, "Child 1");
          stmt.bindNavigation(2, { id: parentId, relClassName: "Test.ParentHasChildren" });
          let res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          childIds.push(res.id!);

          stmt.reset();
          stmt.clearBindings();

          stmt.bindValues(["Child 2", { id: parentId, relClassName: "Test.ParentHasChildren" }]);
          res = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          childIds.push(res.id!);
        });

        ecdb.withPreparedStatement("INSERT INTO test.Child(Name,Parent) VALUES(:name,:parent)", (stmt: ECSqlStatement) => {
          stmt.bindString("name", "Child 3");
          stmt.bindNavigation("parent", { id: parentId, relClassName: "Test.ParentHasChildren" });
          let res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          childIds.push(res.id!);

          stmt.reset();
          stmt.clearBindings();

          stmt.bindValues({ name: "Child 4", parent: { id: parentId, relClassName: "Test.ParentHasChildren" } });
          res = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          childIds.push(res.id!);
        });

        ecdb.withPreparedStatement("SELECT Name,Parent FROM test.Child ORDER BY Name", (stmt: ECSqlStatement) => {
          let rowCount: number = 0;
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            rowCount++;
            const row = stmt.getRow();
            assert.equal(row.name, "Child " + rowCount);
            const parent: NavigationValue = row.parent as NavigationValue;
            assert.equal(parent.id, parentId.value);
            assert.equal(parent.relClassName, "Test.ParentHasChildren");
          }
          assert.equal(rowCount, 4);
        });
      });
  });

  it("BindRange3d for parameter in spatial SQL function", () => {
    const iModel: IModelDb = IModelTestUtils.createStandaloneIModel("bindrange3d.imodel", { rootSubject: { name: "test" } });
    try {
      iModel.withPreparedStatement("SELECT e.ECInstanceId FROM bis.Element e, bis.SpatialIndex rt WHERE rt.ECInstanceId MATCH DGN_spatial_overlap_aabb(?) AND e.ECInstanceId=rt.ECInstanceId",
        (stmt: ECSqlStatement) => {
          stmt.bindRange3d(1, new Range3d(0.0, 0.0, 0.0, 1000.0, 1000.0, 1000.0));
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

      iModel.withPreparedStatement("SELECT e.ECInstanceId FROM bis.Element e, bis.SpatialIndex rt WHERE rt.ECInstanceId MATCH DGN_spatial_overlap_aabb(?) AND e.ECInstanceId=rt.ECInstanceId",
        (stmt: ECSqlStatement) => {
          stmt.bindValues([new Range3d(0.0, 0.0, 0.0, 1000.0, 1000.0, 1000.0)]);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });

    } finally {
      iModel.closeStandalone();
    }
  });

  it("BindRange3d", () => {
    using(ECDbTestHelper.createECDb(_outDir, "bindrange3d.ecdb",
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="Range" typeName="binary"/>
        </ECEntityClass>
       </ECSchema>`), (ecdb) => {

        assert.isTrue(ecdb.isOpen());

        const id: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Foo(Range) VALUES(?)", (stmt: ECSqlStatement) => {
          stmt.bindRange3d(1, testRange);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          return res.id!;
        });

        ecdb.withPreparedStatement("SELECT Range FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const rangeBlob: ArrayBuffer = stmt.getValue(0).getBlob();
          const rangeFloatArray = new Float64Array(rangeBlob);
          assert.equal(rangeFloatArray.length, 6);
          const actualRange = new Range3d(...rangeFloatArray);
          assert.isTrue(actualRange.isAlmostEqual(testRange));
        });
      });
  });

  /* This test doesn't do anything specific with the binder life time but just runs a few scenarios
     with and without statement cache to test that stuff works fine */
  it("ECSqlBinder life time", () => {
    using(ECDbTestHelper.createECDb(_outDir, "ecsqlbinderlifetime.ecdb",
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
        using(ecdb.prepareStatement("INSERT INTO test.Person(Name,Age,Location) VALUES(?,?,?)"), (stmt: ECSqlStatement) => {
          stmt.bindString(1, "Mary Miller");
          stmt.bindInteger(2, 30);
          stmt.bindStruct(3, { Street: "2000 Main Street", City: "New York", Zip: 12311 });

          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          id1 = res.id!;
          assert.isTrue(id1.isValid);
        });

        // *** test withstatement cache
        ecdb.withPreparedStatement("INSERT INTO test.Person(Name,Age,Location) VALUES(?,?,?)", (stmt: ECSqlStatement) => {
          stmt.bindString(1, "Mary Miller");
          stmt.bindInteger(2, 30);
          stmt.bindStruct(3, { Street: "2000 Main Street", City: "New York", Zip: 12311 });

          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          id2 = res.id!;
          assert.isTrue(id2.isValid);
        });

        using(ecdb.prepareStatement("SELECT ECInstanceId,ECClassId,Name,Age,Location FROM test.Person ORDER BY ECInstanceId"), (stmt: ECSqlStatement) => {
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
          assert.equal(rowCount, 2);
        });
      });
  });

  it("GetRow with Primitives", () => {
    using(ECDbTestHelper.createECDb(_outDir, "getprimitives.ecdb",
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
      </ECSchema>`), (ecdb: ECDb) => {
        assert.isTrue(ecdb.isOpen());

        const boolVal: boolean = true;
        const doubleVal: number = 3.5;
        const dtVal: string = "2018-01-23T12:24:00.000";
        const intVal: number = 3;
        const p2dVal = new Point2d(1, 2);
        const p3dVal = new Point3d(1, 2, 3);
        const strVal: string = "Hello world";

        const id: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,P2d,P3d,S) VALUES(?,?,?,?,?,?,?,?)", (stmt: ECSqlStatement) => {
          stmt.bindBlob(1, blobVal);
          stmt.bindBoolean(2, boolVal);
          stmt.bindDouble(3, doubleVal);
          stmt.bindDateTime(4, dtVal);
          stmt.bindInteger(5, intVal);
          stmt.bindPoint2d(6, p2dVal);
          stmt.bindPoint3d(7, p3dVal);
          stmt.bindString(8, strVal);
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          return res.id!;
        });

        ecdb.withPreparedStatement("SELECT ECInstanceId, ECClassId, Bl,Bo,D,Dt,I,P2d,P3d,S FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.id, id.value);
          assert.equal(row.className, "Test.Foo");
          assert.deepEqual(row.bl, blobVal);
          assert.equal(row.bo, boolVal);
          assert.equal(row.d, doubleVal);
          assert.equal(row.dt, dtVal);
          assert.equal(row.i, intVal);
          assert.equal(row.p2d.x, p2dVal.x);
          assert.equal(row.p2d.y, p2dVal.y);
          assert.equal(row.p3d.x, p3dVal.x);
          assert.equal(row.p3d.y, p3dVal.y);
          assert.equal(row.p3d.z, p3dVal.z);
          assert.equal(row.s, strVal);
        });

        ecdb.withPreparedStatement("SELECT Bl AS Blobby, I+10, Lower(S), Upper(S) CapitalS FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.deepEqual(row.blobby, blobVal);
          assert.equal(row["[I] + 10"], intVal + 10);
          assert.equal(row["lower([S])"], strVal.toLowerCase());
          assert.equal(row.capitalS, strVal.toUpperCase());
        });

        const testSchemaId: Id64 = ecdb.withPreparedStatement("SELECT ECInstanceId FROM meta.ECSchemaDef WHERE Name='Test'", (stmt: ECSqlStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
          return new Id64(row.id);
        });

        const fooClassId: Id64 = ecdb.withPreparedStatement("SELECT ECInstanceId FROM meta.ECClassDef WHERE Name='Foo'", (stmt: ECSqlStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
          return new Id64(row.id);
        });

        ecdb.withPreparedStatement("SELECT s.ECInstanceId, c.ECInstanceId, c.Name, s.Name FROM meta.ECClassDef c JOIN meta.ECSchemaDef s ON c.Schema.Id=s.ECInstanceId WHERE s.Name='Test' AND c.Name='Foo'", (stmt: ECSqlStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.id, testSchemaId.value);
          assert.equal(row.id_1, fooClassId.value);
        });

        ecdb.withPreparedStatement("SELECT count(*) cnt FROM meta.ECSchemaDef", (stmt: ECSqlStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.isDefined(row.cnt);
          assert.equal(typeof (row.cnt), "number");
          assert.equal(row.cnt, 6);
        });

        ecdb.withPreparedStatement("SELECT 1 FROM meta.ECSchemaDef LIMIT 1", (stmt: ECSqlStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(typeof (row["1"]), "number");
          assert.equal(row["1"], 1);
        });

        ecdb.withPreparedStatement("SELECT NULL FROM meta.ECSchemaDef LIMIT 1", (stmt: ECSqlStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(Object.entries(row).length, 0);
        });

      });
  });

  it("GetRow with NavigationProperties and Relationships", () => {
    using(ECDbTestHelper.createECDb(_outDir, "getnavandrels.ecdb",
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

        const parentId: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Parent(Code) VALUES('Parent 1')", (stmt: ECSqlStatement) => {
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          return res.id!;
        });

        const childIds = new Array<Id64>();
        ecdb.withPreparedStatement("INSERT INTO test.Child(Name,Parent) VALUES(?,?)", (stmt: ECSqlStatement) => {
          stmt.bindString(1, "Child 1");
          stmt.bindNavigation(2, { id: parentId, relClassName: "Test.ParentHasChildren" });
          let res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          childIds.push(res.id!);

          stmt.reset();
          stmt.clearBindings();

          stmt.bindValues(["Child 2", { id: parentId, relClassName: "Test.ParentHasChildren" }]);
          res = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          childIds.push(res.id!);
        });

        ecdb.withPreparedStatement("SELECT Name,Parent FROM test.Child ORDER BY Name", (stmt: ECSqlStatement) => {
          let rowCount: number = 0;
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            rowCount++;
            const row = stmt.getRow();
            assert.equal(row.name, "Child " + rowCount);
            assert.equal(row.parent.id, parentId.value);
            assert.equal(row.parent.relClassName, "Test.ParentHasChildren");
          }
          assert.equal(rowCount, 2);
        });

        ecdb.withPreparedStatement("SELECT Name,Parent.Id,Parent.RelECClassId, Parent.Id myParentid, Parent.RelECClassId myParentRelClassId FROM test.Child ORDER BY Name", (stmt: ECSqlStatement) => {
          let rowCount: number = 0;
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            rowCount++;
            const row = stmt.getRow();
            assert.equal(row.name, "Child " + rowCount);
            assert.equal(row["parent.id"], parentId.value);
            assert.equal(row["parent.relClassName"], "Test.ParentHasChildren");
            assert.equal(row.myParentid, parentId.value);
            assert.isTrue(new Id64(row.myParentRelClassId).isValid);
          }
          assert.equal(rowCount, 2);
        });

        ecdb.withPreparedStatement("SELECT ECInstanceId,ECClassId,SourceECInstanceId,SourceECClassId,TargetECInstanceId,TargetECClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", (stmt: ECSqlStatement) => {
          const childId: Id64 = childIds[0];
          stmt.bindId(1, childId);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.id, childId.value);
          assert.equal(row.className, "Test.ParentHasChildren");
          assert.equal(row.sourceId, parentId.value);
          assert.equal(row.sourceClassName, "Test.Parent");
          assert.equal(row.targetId, childId.value);
          assert.equal(row.targetClassName, "Test.Child");
        });

        ecdb.withPreparedStatement("SELECT ECInstanceId as MyId,ECClassId as MyClassId,SourceECInstanceId As MySourceId,SourceECClassId As MySourceClassId,TargetECInstanceId As MyTargetId,TargetECClassId As MyTargetClassId FROM test.ParentHasChildren WHERE TargetECInstanceId=?", (stmt: ECSqlStatement) => {
          const childId: Id64 = childIds[0];
          stmt.bindId(1, childId);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row = stmt.getRow();
          assert.equal(row.myId, childId.value);
          assert.isTrue(new Id64(row.myClassId).isValid);
          assert.equal(row.mySourceId, parentId.value);
          assert.isTrue(new Id64(row.mySourceClassId).isValid);
          assert.equal(row.myTargetId, childId.value);
          assert.isTrue(new Id64(row.myTargetClassId).isValid);
        });
      });

  });

  it("getRow with Structs", () => {
    using(ECDbTestHelper.createECDb(_outDir, "getstructs.ecdb",
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

        const boolVal: boolean = true;
        const doubleVal: number = 3.5;
        const dtVal: string = "2018-01-23T12:24:00.000";
        const intVal: number = 3;
        const p2dVal: XAndY = { x: 1, y: 2 };
        const p3dVal: XYAndZ = { x: 1, y: 2, z: 3 };
        const stringVal: string = "Hello World";

        const id: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Foo(Struct) VALUES(?)", (stmt: ECSqlStatement) => {
          stmt.bindStruct(1, { bl: blobVal, bo: boolVal, d: doubleVal, dt: { type: ECSqlStringType.DateTime, value: dtVal }, i: intVal, p2d: p2dVal, p3d: p3dVal, s: stringVal });
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          return res.id!;
        });

        const expectedStruct = { bl: blobVal, bo: boolVal, d: doubleVal, dt: dtVal, i: intVal, p2d: p2dVal, p3d: p3dVal, s: stringVal };
        ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.deepEqual(row.struct.bl, expectedStruct.bl);
          assert.equal(row.struct.bo, expectedStruct.bo);
          assert.equal(row.struct.d, expectedStruct.d);
          assert.equal(row.struct.dt, expectedStruct.dt);
          assert.equal(row.struct.i, expectedStruct.i);
          assert.equal(row.struct.p2d.x, expectedStruct.p2d.x);
          assert.equal(row.struct.p2d.y, expectedStruct.p2d.y);
          assert.equal(row.struct.p3d.x, expectedStruct.p3d.x);
          assert.equal(row.struct.p3d.y, expectedStruct.p3d.y);
          assert.equal(row.struct.p3d.z, expectedStruct.p3d.z);
          assert.equal(row.struct.s, expectedStruct.s);
        });

        ecdb.withPreparedStatement("SELECT Struct FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const actualStruct: any = stmt.getValue(0).getStruct();
          assert.deepEqual(actualStruct.bl, expectedStruct.bl);
          assert.equal(actualStruct.bo, expectedStruct.bo);
          assert.equal(actualStruct.d, expectedStruct.d);
          assert.equal(actualStruct.dt, expectedStruct.dt);
          assert.equal(actualStruct.i, expectedStruct.i);
          assert.equal(actualStruct.p2d.x, expectedStruct.p2d.x);
          assert.equal(actualStruct.p2d.y, expectedStruct.p2d.y);
          assert.equal(actualStruct.p3d.x, expectedStruct.p3d.x);
          assert.equal(actualStruct.p3d.y, expectedStruct.p3d.y);
          assert.equal(actualStruct.p3d.z, expectedStruct.p3d.z);
          assert.equal(actualStruct.s, expectedStruct.s);
        });

        ecdb.withPreparedStatement("SELECT Struct.Bl, Struct.Bo, Struct.D, Struct.Dt, Struct.I, Struct.P2d, Struct.P3d, Struct.S FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.deepEqual(row["struct.Bl"], expectedStruct.bl);
          assert.equal(row["struct.Bo"], expectedStruct.bo);
          assert.equal(row["struct.D"], expectedStruct.d);
          assert.equal(row["struct.Dt"], expectedStruct.dt);
          assert.equal(row["struct.I"], expectedStruct.i);
          assert.equal(row["struct.P2d"].x, expectedStruct.p2d.x);
          assert.equal(row["struct.P2d"].y, expectedStruct.p2d.y);
          assert.equal(row["struct.P3d"].x, expectedStruct.p3d.x);
          assert.equal(row["struct.P3d"].y, expectedStruct.p3d.y);
          assert.equal(row["struct.P3d"].z, expectedStruct.p3d.z);
          assert.equal(row["struct.S"], expectedStruct.s);
        });

      });
  });

  it("HexStr SQL function", () => {
    using(ECDbTestHelper.createECDb(_outDir, "hexstrfunction.ecdb",
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

        const expectedRow = {
          bl: blobVal, bo: true, d: 3.5, dt: "2018-01-23T12:24:00.000",
          i: 3, l: 12312312312312, p2d: { x: 1, y: 2 }, p3d: { x: 1, y: 2, z: 3 }, s: "Hello World",
        };

        const id: Id64 = ecdb.withPreparedStatement("INSERT INTO test.Foo(Bl,Bo,D,Dt,I,L,P2d,P3d,S) VALUES(:bl,:bo,:d,:dt,:i,:l,:p2d,:p3d,:s)", (stmt: ECSqlStatement) => {
          stmt.bindValues({
            bl: blobVal, bo: expectedRow.bo, d: expectedRow.d,
            dt: { type: ECSqlStringType.DateTime, value: expectedRow.dt }, i: expectedRow.i, l: expectedRow.l, p2d: expectedRow.p2d, p3d: expectedRow.p3d, s: expectedRow.s,
          });
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          return res.id!;
        });

        ecdb.withPreparedStatement("SELECT I, HexStr(I) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row.i, expectedRow.i);
          assert.equal(row.hex, "0x3");
        });

        ecdb.withPreparedStatement("SELECT L, HexStr(L) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row.l, expectedRow.l);
          assert.equal(row.hex, "0xb32af0071f8");
        });

        ecdb.withPreparedStatement("SELECT Bl, HexStr(Bl) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
        });

        ecdb.withPreparedStatement("SELECT Bo, HexStr(Bo) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          const row: any = stmt.getRow();
          assert.equal(row.bo, expectedRow.bo);
          assert.equal(row.hex, "0x1");
        });

        ecdb.withPreparedStatement("SELECT D, HexStr(D) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
        });

        ecdb.withPreparedStatement("SELECT Dt, HexStr(Dt) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
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

        ecdb.withPreparedStatement("SELECT S, HexStr(S) hex FROM test.Foo WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
          stmt.bindId(1, id);
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ERROR);
        });
      });
  });

});
