/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { join } from "node:path";
import { assert } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ECDb, ECDbOpenMode } from "../../ECDb";
import { IModelHost } from "../../IModelHost";
import { ECDbTestHelper } from "./ECDbTestHelper";

/** Usage: worker <directory> [<double>]. With a double, the Points array map is repointed at the column holding it. */
async function main(): Promise<void> {
  const [directory, scalar] = process.argv.slice(2);
  assert.isString(directory);
  await IModelHost.startup({ cacheDir: join(directory, "cache") });
  try {
    const ecdb = ECDbTestHelper.createECDb(directory, "test.ecdb",
      `<ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Foo">
          <ECArrayProperty propertyName="Points" typeName="point3d"/>
          <ECProperty propertyName="Num" typeName="double"/>
        </ECEntityClass>
      </ECSchema>`);
    const points = [{ x: 1, y: 2, z: 3 }];
    ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(Num,Points) VALUES(?,?)", (stmt) => {
      stmt.bindDouble(1, scalar === undefined ? 0 : Number(scalar));
      stmt.bindArray(2, points);
      assert.equal(stmt.stepForInsert().status, DbResult.BE_SQLITE_DONE);
    });

    if (scalar !== undefined) {
      // Simulate a stale property map: Points now reads the REAL column backing Num.
      ecdb.withSqliteStatement(
        `UPDATE ec_PropertyMap SET ColumnId=(
           SELECT pm.ColumnId FROM ec_PropertyMap pm JOIN ec_PropertyPath pp ON pp.Id=pm.PropertyPathId WHERE pp.AccessString='Num')
         WHERE PropertyPathId=(SELECT Id FROM ec_PropertyPath WHERE AccessString='Points')`, (stmt) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
        });
      ecdb.withSqliteStatement("SELECT changes()", (stmt) => {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        assert.equal(stmt.getValueInteger(0), 1);
      });
    }
    ecdb.saveChanges();
    ecdb.closeDb();

    // Reopen so the native layer reloads the property maps.
    const db = new ECDb();
    db.openDb(join(directory, "test.ecdb"), ECDbOpenMode.Readonly);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    db.withPreparedStatement("SELECT Points FROM ts.Foo", (stmt) => {
      const status = stmt.step();
      if (scalar !== undefined && status === DbResult.BE_SQLITE_ERROR)
        return;

      assert.equal(status, DbResult.BE_SQLITE_ROW);
      try {
        const array: unknown[] = stmt.getValue(0).getArray();
        assert.isUndefined(scalar, `Scalar ${scalar} must not decode as an array: ${JSON.stringify(array)}`);
        assert.deepEqual(array, points);
      } catch (error) {
        if (scalar === undefined || !(error instanceof IModelError) || error.errorNumber !== DbResult.BE_SQLITE_ERROR)
          throw error;
      }
    });
    db.closeDb();
  } finally {
    await IModelHost.shutdown();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
