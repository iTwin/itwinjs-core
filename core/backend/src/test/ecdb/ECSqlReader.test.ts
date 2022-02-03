import { assert } from "chai";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, using } from "@itwin/core-bentley";
import { QueryBinder, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import type { ECDb } from "../../ECDb";
import type { ECSqlStatement } from "../../ECSqlStatement";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

describe("bind Id64 enumerable", async () => {
  const outDir = KnownTestLocations.outputDir;
  it("ecsql reader simple", async () => {
    await using(ECDbTestHelper.createECDb(outDir, "test.ecdb",
      `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo" modifier="Sealed">
          <ECProperty propertyName="n" typeName="int"/>
        </ECEntityClass>
      </ECSchema>`), async (ecdb: ECDb) => {
      assert.isTrue(ecdb.isOpen);
      ecdb.saveChanges();
      const params = new QueryBinder();
      params.bindIdSet(1, ["0x32"]);
      const optionBuilder = new QueryOptionsBuilder();
      optionBuilder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
      const reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE InVirtualSet(?, ECInstanceId)", params, optionBuilder.getOptions());
      const rows = await reader.toArray();
      assert.equal(rows[0].id, "0x32");
      assert.equal(rows.length, 1);
    });
  });
  it("ecsql reader simple using query reader", async () => {
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
      const params = new QueryBinder();
      params.bindString("name", "CompositeUnitRefersToUnit");
      const optionBuilder = new QueryOptionsBuilder();
      const reader = ecdb.createQueryReader("SELECT ECInstanceId, Name FROM meta.ECClassDef WHERE Name=:name", params, optionBuilder.getOptions());
      while (await reader.step()) {
        // eslint-disable-next-line no-console
        assert.equal(reader.current.id, "0x32");
        assert.equal(reader.current.ecinstanceid, "0x32");
        assert.equal(reader.current.name, "CompositeUnitRefersToUnit");
        assert.equal(reader.current.ID, "0x32");
        assert.equal(reader.current.ECINSTANCEID, "0x32");
        assert.equal(reader.current[0], "0x32");
        assert.equal(reader.current[1], "CompositeUnitRefersToUnit");

        const row0 = reader.current.toRow();
        assert.equal(row0.ECInstanceId, "0x32");
        assert.equal(row0.Name, "CompositeUnitRefersToUnit");
      }
    });
  });
});
