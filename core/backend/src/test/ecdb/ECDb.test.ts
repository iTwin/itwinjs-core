/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64String, using } from "@itwin/core-bentley";
import { ECDb, ECDbOpenMode, ECSqlInsertResult, ECSqlStatement, IModelJsFs, SqliteStatement, SqliteValue, SqliteValueType } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

describe("ECDb", () => {
  const outDir = KnownTestLocations.outputDir;

  it("should be able to create a new ECDb", () => {
    using(ECDbTestHelper.createECDb(outDir, "create.ecdb"), (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen);
    });
  });

  it("should be able to close an ECDb", () => {
    const ecdb: ECDb = ECDbTestHelper.createECDb(outDir, "close.ecdb");
    assert.isTrue(ecdb.isOpen);
    ecdb.closeDb();
    assert.isFalse(ecdb.isOpen);
  });

  it("should be able to open an ECDb", () => {
    const fileName = "open.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    using(ECDbTestHelper.createECDb(outDir, fileName), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen);
    });

    using(new ECDb(), (ecdb: ECDb) => {
      ecdb.openDb(ecdbPath, ECDbOpenMode.ReadWrite);
      assert.isTrue(ecdb.isOpen);
    });
  });

  it("Open ECDb with upgrade option", () => {
    const fileName = "open.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    using(ECDbTestHelper.createECDb(outDir, fileName), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen);
    });

    using(new ECDb(), (ecdb: ECDb) => {
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.Readonly));
    });

    using(new ECDb(), (ecdb: ECDb) => {
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.ReadWrite));
    });

    using(new ECDb(), (ecdb: ECDb) => {
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.FileUpgrade));
    });
  });

  it("should be able to import a schema", () => {
    const fileName = "schemaimport.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    let id: Id64String;
    using(ECDbTestHelper.createECDb(outDir, fileName,
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Person" modifier="Sealed">
        <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
      </ECEntityClass>
      </ECSchema>`), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen);
      id = testECDb.withPreparedStatement("INSERT INTO test.Person(Name,Age) VALUES('Mary', 45)", (stmt: ECSqlStatement) => {
        const res: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(res.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(res.id);
        assert.isTrue(Id64.isValidId64(res.id!));
        return res.id!;
      });
      testECDb.saveChanges();
    });

    using(new ECDb(), (ecdb: ECDb) => {
      ecdb.openDb(ecdbPath, ECDbOpenMode.Readonly);
      assert.isTrue(ecdb.isOpen);

      ecdb.withPreparedStatement("SELECT Name, Age FROM test.Person WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
        stmt.bindId(1, id);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.name, "Mary");
        assert.equal(row.age, 45);
      });
    });
  });

  it("should be able to get schema props", () => {
    const fileName = "schema-props.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    using(ECDbTestHelper.createECDb(outDir, fileName), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen);
    });
    using(new ECDb(), (ecdb) => {
      ecdb.openDb(ecdbPath);
      const schema = ecdb.getSchemaProps("ECDbMeta");
      assert.equal(schema.name, "ECDbMeta");
    });
  });

  it("Run plain SQL", () => {
    const fileName = "plainseql.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    using(ECDbTestHelper.createECDb(outDir, fileName), (testECDb: ECDb) => {
      assert.isTrue(testECDb.isOpen);

      testECDb.withPreparedSqliteStatement("CREATE TABLE Test(Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, Code INTEGER)", (stmt: SqliteStatement) => {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValue(1, "Dummy 1");
        stmt.bindValue(2, 100);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues(["Dummy 2", 200]);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValue(":p1", "Dummy 3");
        stmt.bindValue(":p2", 300);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValues({ ":p1": "Dummy 4", ":p2": 400 });
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      testECDb.saveChanges();
    });

    using(new ECDb(), (ecdb: ECDb) => {
      ecdb.openDb(ecdbPath, ECDbOpenMode.Readonly);
      assert.isTrue(ecdb.isOpen);

      ecdb.withPreparedSqliteStatement("SELECT Id,Name,Code FROM Test ORDER BY Id", (stmt: SqliteStatement) => {
        for (let i: number = 1; i <= 4; i++) {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          assert.equal(stmt.getColumnCount(), 3);
          const val0: SqliteValue = stmt.getValue(0);
          assert.equal(val0.columnName, "Id");
          assert.equal(val0.type, SqliteValueType.Integer);
          assert.isFalse(val0.isNull);
          assert.equal(val0.getInteger(), i);

          const val1: SqliteValue = stmt.getValue(1);
          assert.equal(val1.columnName, "Name");
          assert.equal(val1.type, SqliteValueType.String);
          assert.isFalse(val1.isNull);
          assert.equal(val1.getString(), `Dummy ${i}`);

          const val2: SqliteValue = stmt.getValue(2);
          assert.equal(val2.columnName, "Code");
          assert.equal(val2.type, SqliteValueType.Integer);
          assert.isFalse(val2.isNull);
          assert.equal(val2.getInteger(), i * 100);

          const row: any = stmt.getRow();
          assert.equal(row.id, i);
          assert.equal(row.name, `Dummy ${i}`);
          assert.equal(row.code, i * 100);
        }
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });
    });
  });

  it("test unit labels in composite formats", () => {
    const ecdb: ECDb = ECDbTestHelper.createECDb(outDir, "TestCompositeFormats.ecdb");
    const xmlpathOriginal = path.join(outDir, "compositeFormats1.ecschema.xml");

    IModelJsFs.writeFileSync(xmlpathOriginal, `<?xml version="1.0" encoding="utf-8" ?>
    <ECSchema schemaName="TestCompositeFormats" alias="tcf" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="Units" version="01.00.00" alias="u" />
      <Unit typeName="TestUnit" displayLabel="Test Unit" definition="u:M" numerator="1.0" phenomenon="u:LENGTH" unitSystem="u:METRIC" />
      <Format typeName="TestFormat" displayLabel="TestFormat" roundFactor="0.3" type="Fractional" showSignOption="OnlyNegative" formatTraits="TrailZeroes|KeepSingleZero" precision="4" decimalSeparator="." thousandSeparator="," uomSeparator=" ">
        <Composite>
          <Unit>u:KM</Unit>
          <Unit label="m">TestUnit</Unit>
          <Unit label="">u:CM</Unit>
          <Unit label="mm">u:MM</Unit>
        </Composite>
      </Format>
      <KindOfQuantity typeName="TestKOQ2" description="Test KOQ2" displayLabel="TestKOQ2" persistenceUnit="u:M" presentationUnits="TestFormat" relativeError="10e-3" />
    </ECSchema>`);
    ecdb.importSchema(xmlpathOriginal);
    ecdb.saveChanges();

    const expectedLabels = [undefined, "m", "", "mm"];
    let index = 0;
    ecdb.withStatement("select label from meta.FormatCompositeUnitDef where Format.Id=0x1", (stmt: ECSqlStatement) => {
      for (let i: number = 1; i <= 4; i++) {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        expect(stmt.getRow().label).to.eql(expectedLabels[index++]);
      }
    });

    const xmlpathUpdated = path.join(outDir, "compositeFormats2.ecschema.xml");
    IModelJsFs.writeFileSync(xmlpathUpdated, `<?xml version="1.0" encoding="utf-8" ?>
    <ECSchema schemaName="TestCompositeFormats" alias="tcf" version="1.0.1" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="Units" version="01.00.00" alias="u" />
      <Unit typeName="TestUnit" displayLabel="Test Unit" definition="u:M" numerator="1.0" phenomenon="u:LENGTH" unitSystem="u:METRIC" />
      <Format typeName="TestFormat" displayLabel="TestFormat" roundFactor="0.3" type="Fractional" showSignOption="OnlyNegative" formatTraits="TrailZeroes|KeepSingleZero" precision="4" decimalSeparator="." thousandSeparator="," uomSeparator=" ">
        <Composite spacer="=" includeZero="False">
          <Unit label="">u:KM</Unit>
          <Unit label="m">TestUnit</Unit>
          <Unit>u:CM</Unit>
          <Unit label="mm">u:MM</Unit>
        </Composite>
      </Format>
      <KindOfQuantity typeName="TestKOQ2" description="Test KOQ2" displayLabel="TestKOQ2" persistenceUnit="u:M" presentationUnits="TestFormat" relativeError="10e-3" />
    </ECSchema>`);

    ecdb.importSchema(xmlpathUpdated);
    ecdb.saveChanges();

    const expectedLabelsUpdated = ["", "m", undefined, "mm"];
    index = 0;
    ecdb.withStatement("select label from meta.FormatCompositeUnitDef where Format.Id=0x1", (stmt: ECSqlStatement) => {
      for (let i: number = 1; i <= 4; i++) {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        expect(stmt.getRow().label).to.eql(expectedLabelsUpdated[index++]);
      }
    });

    ecdb.closeDb();
  });
});
