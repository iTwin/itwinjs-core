/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { ECDbTestHelper } from "./ECDbTestHelper";

import { DbResult, OpenMode } from "@bentley/bentleyjs-core";
import { ECDb } from "../ECDb";
import { ECSqlInsertResult } from "../ECSqlStatement";
import { Id64 } from "@bentley/bentleyjs-core";
import { using } from "@bentley/bentleyjs-core";
import { KnownTestLocations } from "./KnownTestLocations";

describe("ECDb", () => {
  const _outDir = KnownTestLocations.outputDir;

  it("should be able to create a new ECDb", () => {
    using(ECDbTestHelper.createECDb(_outDir, "create.ecdb"), (ecdb) => {
      assert.isTrue(ecdb.isOpen());
    });
  });

  it("should be able to close an ECDb", () => {
    const ecdb: ECDb = ECDbTestHelper.createECDb(_outDir, "close.ecdb");
    assert.isTrue(ecdb.isOpen());
    ecdb.closeDb();
    assert.isFalse(ecdb.isOpen());
  });

  it("should be able to open an ECDb", () => {
    const fileName: string = "open.ecdb";
    const ecdbPath: string = path.join(_outDir, fileName);
    using(ECDbTestHelper.createECDb(_outDir, fileName), (testECDb) => {
      assert.isTrue(testECDb.isOpen());
    });

    using(new ECDb(), (ecdb) => {
      ecdb.openDb(ecdbPath, OpenMode.ReadWrite);
      assert.isTrue(ecdb.isOpen());
    });
  });

  it("should be able to import a schema", () => {
    const fileName: string = "schemaimport.ecdb";
    const ecdbPath: string = path.join(_outDir, fileName);
    let id: Id64;
    using(ECDbTestHelper.createECDb(_outDir, fileName,
      `<ECSchema schemaName="Test" alias="test" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECEntityClass typeName="Person" modifier="Sealed">
        <ECProperty propertyName="Name" typeName="string"/>
        <ECProperty propertyName="Age" typeName="int"/>
      </ECEntityClass>
      </ECSchema>`), (testECDb) => {
        assert.isTrue(testECDb.isOpen());

        id = testECDb.withPreparedStatement("INSERT INTO test.Person(Name,Age) VALUES('Mary', 45)", (stmt) => {
          const res: ECSqlInsertResult = stmt.stepForInsert();
          assert.equal(res.status, DbResult.BE_SQLITE_DONE);
          assert.isDefined(res.id);
          assert.isTrue(res.id!.isValid());
          return res.id!;
        });
      });

    using(new ECDb(), (ecdb) => {
      ecdb.openDb(ecdbPath, OpenMode.Readonly);
      assert.isTrue(ecdb.isOpen());

      ecdb.withPreparedStatement("SELECT Name, Age FROM test.Person WHERE ECInstanceId=?", (stmt) => {
        stmt.bindId(1, id);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        const row = stmt.getRow();
        assert.equal(row.name, "Mary");
        assert.equal(row.age, 45);
      });
    });
  });
});
