import { assert } from "chai";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, using } from "@itwin/core-bentley";
import { QueryConfigBuilder, QueryParams } from "@itwin/core-common";
import { ECSqlStatement } from "../../ECSqlStatement";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { ECDb } from "../../ECDb";

describe("ECSqlReader and ECSqlBlobReader", async () => {
  const outDir = KnownTestLocations.outputDir;

  it("ecsql reader simple", async () => {
    await using(ECDbTestHelper.createECDb(outDir, "test.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`), async (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen);

      const r = await ecdb.withStatement("INSERT INTO ts.Foo(n) VALUES(20)", async (stmt: ECSqlStatement) => {
        return stmt.stepForInsert();
      });
      ecdb.saveChanges();
      assert.equal(r.status, DbResult.BE_SQLITE_DONE);
      assert.equal(r.id, "0x1");
      const params = new QueryParams();
      params.bindString("name", "CompositeUnitRefersToUnit");
      const config = new QueryConfigBuilder();
      const reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE Name=:name", params, config.config);
      while (await reader.step()) {
        // eslint-disable-next-line no-console
        console.log(`id          : ${reader.current.id}`);
        console.log(`ecinstanceid: ${reader.current.ecinstanceid}`);
        console.log(`name        : ${reader.current.name}`);
        console.log(`ID          : ${reader.current.ID}`);
        console.log(`ECINSTANCEID: ${reader.current.ECINSTANCEID}`);
        console.log(`NAME        : ${reader.current.NAME}`);
        console.log(`[0]         : ${reader.current[0]}`);
        console.log(`[1]         : ${reader.current[1]}`);

        console.log(JSON.stringify(reader.current.toRow(), undefined, 3));
        console.log(JSON.stringify(reader.current.toJsRow(), undefined, 3));
      }
    });
  });
});
