/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64, Id64String, Logger } from "@itwin/core-bentley";
import { QueryOptionsBuilder } from "@itwin/core-common";
import { assert, expect } from "chai";
import path from "path";
import sinon from "sinon";
import { ECDb, ECDbOpenMode, ECSqlInsertResult, ECSqlStatement, IModelJsFs, SqliteStatement, SqliteValue, SqliteValueType } from "../../core-backend.js";
import { KnownTestLocations } from "../KnownTestLocations.js";
import { ECDbTestHelper } from "./ECDbTestHelper.js";

describe("ECDb", () => {
  const outDir = KnownTestLocations.outputDir;

  it("should be able to create a new ECDb", () => {
    using ecdb = ECDbTestHelper.createECDb(outDir, "create.ecdb");
    assert.isTrue(ecdb.isOpen);
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
    {
      using testECDb = ECDbTestHelper.createECDb(outDir, fileName);
      assert.isTrue(testECDb.isOpen);
    }

    using ecdb = new ECDb();
    ecdb.openDb(ecdbPath, ECDbOpenMode.ReadWrite);
    assert.isTrue(ecdb.isOpen);
  });

  it("Open ECDb with upgrade option", () => {
    const fileName = "open.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    {
      using testECDb = ECDbTestHelper.createECDb(outDir, fileName);
      assert.isTrue(testECDb.isOpen);
    }
    {
      using ecdb = new ECDb();
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.Readonly));
    }
    {
      using ecdb = new ECDb();
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.ReadWrite));
    }
    {
      using ecdb = new ECDb();
      assert.doesNotThrow(() => ecdb.openDb(ecdbPath, ECDbOpenMode.FileUpgrade));
    }

  });
  it("attach/detach newer profile version", async () => {
    const fileName1 = "source_file.ecdb";
    const ecdbPath1: string = path.join(outDir, fileName1);
    using testECDb = ECDbTestHelper.createECDb(outDir, fileName1,
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Person" modifier="Sealed">
        <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
      </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(testECDb.isOpen);
    testECDb.withPreparedStatement("INSERT INTO test.Person(Name,Age) VALUES('Mary', 45)", (stmt: ECSqlStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      assert.isTrue(Id64.isValidId64(res.id!));
      return res.id!;
    });

    // override profile version to 55.0.0 which is currently not supported
    testECDb.withSqliteStatement(`
        UPDATE be_Prop SET
          StrData = '{"major":55,"minor":0,"sub1":0,"sub2":0}'
        WHERE Namespace = 'ec_Db' AND Name = 'SchemaVersion'`,
      (stmt: SqliteStatement) => { stmt.step(); });
    testECDb.saveChanges();

    const runDbListPragmaUsingStatement = (ecdb: ECDb) => {
      return ecdb.withPreparedStatement("PRAGMA db_list", (stmt: ECSqlStatement) => {
        const result: { alias: string, filename: string, profile: string }[] = [];
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          result.push(stmt.getRow());
        }
        return result;
      });
    }
    const runDbListPragmaCCQ = async (ecdb: ECDb) => {
      const reader = ecdb.createQueryReader("PRAGMA db_list");
      const result: { alias: string, filename: string, profile: string }[] = [];
      while (await reader.step()) {
        result.push(reader.current.toRow());
      }
      return result;
    }
    using testECDb0 = ECDbTestHelper.createECDb(outDir, "file2.ecdb");
    // following call will not fail but unknow ECDb profile will cause it to be attach as SQLite.
    testECDb0.attachDb(ecdbPath1, "source");
    expect(() => testECDb0.withPreparedStatement("SELECT Name, Age FROM source.test.Person", () => { })).to.throw("ECClass 'source.test.Person' does not exist or could not be loaded.");
    expect(runDbListPragmaUsingStatement(testECDb0)).deep.equals([
      {
        sno: 0,
        alias: "main",
        fileName: path.join(outDir, "file2.ecdb"),
        profile: "ECDb"
      },
      {
        sno: 1,
        alias: "source",
        fileName: path.join(outDir, "source_file.ecdb"),
        profile: "SQLite"
      }
    ]);
    testECDb0.detachDb("source");
    expect(runDbListPragmaUsingStatement(testECDb0)).deep.equals([
      {
        sno: 0,
        alias: "main",
        fileName: path.join(outDir, "file2.ecdb"),
        profile: "ECDb"
      },
    ]);
    expect(() => testECDb0.withPreparedStatement("SELECT Name, Age FROM source.test.Person", () => { })).to.throw("ECClass 'source.test.Person' does not exist or could not be loaded.");

    using testECDb1 = ECDbTestHelper.createECDb(outDir, "file4.ecdb");
    testECDb1.attachDb(ecdbPath1, "source");
    const reader1 = testECDb1.createQueryReader("SELECT Name, Age FROM source.test.Person");
    let expectThrow = false;
    try {
      await reader1.step();
    } catch (err) {
      if (err instanceof Error) {
        assert.equal(err.message, "ECClass 'source.test.Person' does not exist or could not be loaded.");
        expectThrow = true;
      }
    }
    assert.isTrue(expectThrow);
    expect(await runDbListPragmaCCQ(testECDb1)).deep.equals([
      {
        sno: 0,
        alias: "main",
        fileName: path.join(outDir, "file4.ecdb"),
        profile: "ECDb"
      },
      {
        sno: 1,
        alias: "source",
        fileName: path.join(outDir, "source_file.ecdb"),
        profile: "SQLite"
      }
    ]);
    testECDb1.detachDb("source");
    expect(await runDbListPragmaCCQ(testECDb1)).deep.equals([
      {
        sno: 0,
        alias: "main",
        fileName: path.join(outDir, "file4.ecdb"),
        profile: "ECDb"
      },
    ]);
  });
  it("attach/detach file & db_list pragma", async () => {
    const fileName1 = "source_file.ecdb";
    const ecdbPath1: string = path.join(outDir, fileName1);
    using testECDb = ECDbTestHelper.createECDb(outDir, fileName1,
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Person" modifier="Sealed">
        <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
      </ECEntityClass>
      </ECSchema>`);
    assert.isTrue(testECDb.isOpen);
    testECDb.withPreparedStatement("INSERT INTO test.Person(Name,Age) VALUES('Mary', 45)", (stmt: ECSqlStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      assert.isTrue(Id64.isValidId64(res.id!));
      return res.id!;
    });
    testECDb.saveChanges();

    const runDbListPragma = (ecdb: ECDb) => {
      return ecdb.withPreparedStatement("PRAGMA db_list", (stmt: ECSqlStatement) => {
        const result: { alias: string, filename: string, profile: string }[] = [];
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          result.push(stmt.getRow());
        }
        return result;
      });
    }
    using testECDb0 = ECDbTestHelper.createECDb(outDir, "file2.ecdb");
    testECDb0.attachDb(ecdbPath1, "source");
    testECDb0.withPreparedStatement("SELECT Name, Age FROM source.test.Person", (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const row = stmt.getRow();
      assert.equal(row.name, "Mary");
      assert.equal(row.age, 45);
    });
    expect(runDbListPragma(testECDb0)).deep.equals([
      {
        sno: 0,
        alias: "main",
        fileName: path.join(outDir, "file2.ecdb"),
        profile: "ECDb"
      },
      {
        sno: 1,
        alias: "source",
        fileName: path.join(outDir, "source_file.ecdb"),
        profile: "ECDb"
      }
    ]);
    testECDb0.detachDb("source");
    expect(runDbListPragma(testECDb0)).deep.equals([
      {
        sno: 0,
        alias: "main",
        fileName: path.join(outDir, "file2.ecdb"),
        profile: "ECDb"
      },
    ]);
    expect(() => testECDb0.withPreparedStatement("SELECT Name, Age FROM source.test.Person", () => { })).to.throw("ECClass 'source.test.Person' does not exist or could not be loaded.");

    using testECDb1 = ECDbTestHelper.createECDb(outDir, "file3.ecdb");
    testECDb1.attachDb(ecdbPath1, "source");
    const reader1 = testECDb1.createQueryReader("SELECT Name, Age FROM source.test.Person", undefined, new QueryOptionsBuilder().setUsePrimaryConnection(true).getOptions());
    assert.equal(await reader1.step(), true);
    assert.equal(reader1.current.name, "Mary");
    assert.equal(reader1.current.age, 45);
    testECDb1.detachDb("source");


    using testECDb2 = ECDbTestHelper.createECDb(outDir, "file4.ecdb");
    testECDb2.attachDb(ecdbPath1, "source");
    const reader2 = testECDb2.createQueryReader("SELECT Name, Age FROM source.test.Person");
    assert.equal(await reader2.step(), true);
    assert.equal(reader2.current.name, "Mary");
    assert.equal(reader2.current.age, 45);
    testECDb2.detachDb("source");
    const reader3 = testECDb2.createQueryReader("SELECT Name, Age FROM source.test.Person");
    let expectThrow = false;
    try {
      await reader3.step();
    } catch (err) {
      if (err instanceof Error) {
        assert.equal(err.message, "ECClass 'source.test.Person' does not exist or could not be loaded.");
        expectThrow = true;
      }
    }
    assert.isTrue(expectThrow);
  });
  it("should be able to import a schema", () => {
    const fileName = "schemaimport.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    let id: Id64String;
    {
      using testECDb = ECDbTestHelper.createECDb(outDir, fileName,
        `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Person" modifier="Sealed">
      <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
        </ECEntityClass>
        </ECSchema>`);
      assert.isTrue(testECDb.isOpen);
      id = testECDb.withPreparedStatement("INSERT INTO test.Person(Name,Age) VALUES('Mary', 45)", (stmt: ECSqlStatement) => {
        const res: ECSqlInsertResult = stmt.stepForInsert();
        assert.equal(res.status, DbResult.BE_SQLITE_DONE);
        assert.isDefined(res.id);
        assert.isTrue(Id64.isValidId64(res.id!));
        return res.id!;
      });
      testECDb.saveChanges();
    }

    using ecdb = new ECDb();
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

  it("should be able to get schema props", () => {
    const fileName = "schema-props.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    {
      using testECDb = ECDbTestHelper.createECDb(outDir, fileName);
      assert.isTrue(testECDb.isOpen);
    }
    using ecdb = new ECDb();
    ecdb.openDb(ecdbPath);
    const schema = ecdb.getSchemaProps("ECDbMeta");
    assert.equal(schema.name, "ECDbMeta");
  });

  it("Run plain SQL", () => {
    const fileName = "plainseql.ecdb";
    const ecdbPath: string = path.join(outDir, fileName);
    {
      using testECDb = ECDbTestHelper.createECDb(outDir, fileName);
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
    }

    using ecdb = new ECDb();
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

  it("should make importSchema fail if new schema changes are observed without version bump", () => {
    const ecdb: ECDb = ECDbTestHelper.createECDb(outDir, "importSchemaNoVersionBump.ecdb");
    const xmlpathOriginal = path.join(outDir, "importSchemaNoVersionBump1.ecschema.xml");

    IModelJsFs.writeFileSync(xmlpathOriginal, `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="Person" modifier="Sealed">
        <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
      </ECEntityClass>
    </ECSchema>`);
    ecdb.importSchema(xmlpathOriginal);
    ecdb.saveChanges();

    const xmlpathUpdated = path.join(outDir, "importSchemaNoVersionBump2.ecschema.xml");
    IModelJsFs.writeFileSync(xmlpathUpdated, `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="Person" modifier="Sealed">
        <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
        <ECProperty propertyName="Height" typeName="int"/>
      </ECEntityClass>
    </ECSchema>`);

    let calledCategory = "";
    let calledMessage = "";
    const stubbedLogError = sinon.stub(Logger, "logError").callsFake((category: string, message: string) => {
      calledCategory = category;
      calledMessage = message;
    });

    // although an error should be logged, no error is actually returned to not disrupt currently existing workflows and to alert the user about some wrong/unexpected behavior
    expect(ecdb.importSchema(xmlpathUpdated)).to.not.throw;
    expect(calledCategory).to.equal("ECDb");
    expect(calledMessage).to.equal("ECSchema import has failed. Schema Test has new changes, but the schema version is not incremented.");

    stubbedLogError.restore();
    ecdb.closeDb();
  });
});
