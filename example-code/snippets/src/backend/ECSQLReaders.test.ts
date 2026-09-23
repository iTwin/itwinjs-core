/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { ECDb, IModelJsFs, SnapshotDb } from "@itwin/core-backend";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelTestUtils } from "./IModelTestUtils";

describe("ECSQL reader examples", () => {
  let iModel: SnapshotDb;

  before(async () => {
    iModel = IModelTestUtils.openSnapshotFromSeed("test.bim", { copyFilename: "ecsql-readers.bim" });
  });

  after(() => {
    iModel.close();
  });

  it("iterates synchronously", () => {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Sync_Iteration
    const ids: Id64String[] = [];
    iModel.withQueryReader("SELECT ECInstanceId FROM bis.Element LIMIT 5", (reader) => {
      for (const row of reader)
        ids.push(row[0]);
    });
    // __PUBLISH_EXTRACT_END__
    assert.isNotEmpty(ids);
    assert.isTrue(ids.every((id) => Id64.isValidId64(id)));
  });

  it("steps synchronously", () => {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Sync_Step
    const ids: Id64String[] = [];
    const classIds: Id64String[] = [];
    iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element LIMIT 5", (reader) => {
      while (reader.step()) {
        ids.push(reader.current.ECInstanceId);
        classIds.push(reader.current.ECClassId);
      }
    });
    // __PUBLISH_EXTRACT_END__
    assert.isNotEmpty(ids);
    assert.isTrue(ids.every((id) => Id64.isValidId64(id)));
    assert.isTrue(classIds.every((id) => Id64.isValidId64(id)));
  });

  it("materializes synchronous rows with toArray", () => {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Sync_ToArray
    const rows = iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element LIMIT 5", (reader) => {
      return reader.toArray();
    }, undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
    // __PUBLISH_EXTRACT_END__
    assert.isNotEmpty(rows);
    assert.isTrue(rows.every((row) => Id64.isValidId64(row.ECInstanceId) && Id64.isValidId64(row.ECClassId)));
  });

  it("binds a named class name synchronously", () => {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Sync_Binding
    const rows = iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element WHERE ECClassId=ec_classid(:className)", (reader) => {
      return reader.toArray();
    }, new QueryBinder().bindString("className", "BisCore.Subject"));
    // __PUBLISH_EXTRACT_END__
    assert.isTrue(rows.some((row) => row[0] === "0x1"));
  });

  it("materializes a JavaScript-shaped row", () => {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Sync_JsRow
    const row = iModel.withQueryReader("SELECT ECInstanceId, ECClassId, Model FROM bis.Element WHERE ECInstanceId=?", (reader) => {
      return reader.step() ? reader.current.toRow() : undefined;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    }, new QueryBinder().bindId(1, "0x1"), { rowFormat: QueryRowFormat.UseJsPropertyNames });
    // __PUBLISH_EXTRACT_END__
    assert.equal(row.id, "0x1");
    assert.equal(row.className, "BisCore.Subject");
    assert.equal(row.model.id, "0x1");
    assert.equal(row.model.relClassName, "BisCore.ModelContainsElements");
  });

  it("formats blob results", async () => {
    using ecdb = new ECDb();
    ecdb.createDb(IModelTestUtils.prepareOutputFile("ecsql-reader-blobs.ecdb"));
    const schemaPath = IModelTestUtils.prepareOutputFile("ecsql-reader-blobs.ecschema.xml");
    IModelJsFs.writeFileSync(schemaPath, `<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="MySchema" alias="myschema" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="BlobExample">
          <ECProperty propertyName="Data" typeName="binary" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.importSchema(schemaPath);

    const blob = new Uint8Array([1, 2, 3]);
    const insertStatus = ecdb.withWriteStatement("INSERT INTO myschema.BlobExample(Data) VALUES(?)", (stmt) => {
      stmt.bindBlob(1, blob);
      return stmt.step();
    });
    assert.equal(insertStatus, DbResult.BE_SQLITE_DONE);
    ecdb.saveChanges();

    for (const abbreviateBlobs of [undefined, false, true]) {
      const query = "SELECT Data FROM myschema.BlobExample";
      const expected = abbreviateBlobs ? '{"bytes":3}' : blob;
      const asyncRows = await ecdb.createQueryReader(query, undefined, { abbreviateBlobs }).toArray();
      const syncRows = ecdb.withQueryReader(query, (reader) => reader.toArray(), undefined, { abbreviateBlobs });
      assert.deepEqual(asyncRows, [[expected]]);
      assert.deepEqual(syncRows, [[expected]]);
    }
  });

  it("preserves row formats and bindings", async () => {
    const rootSelect = "SELECT ECInstanceId, ECClassId FROM bis.Element WHERE ECInstanceId=?";

    const asyncIndexRows = await iModel.createQueryReader(rootSelect, new QueryBinder().bindId(1, "0x1")).toArray();
    assert.isArray(asyncIndexRows[0]);
    assert.equal(asyncIndexRows[0][0], "0x1");
    assert.isTrue(Id64.isValidId64(asyncIndexRows[0][1]));

    const asyncECSqlNameRows = await iModel.createQueryReader(rootSelect, new QueryBinder().bindId(1, "0x1"), { rowFormat: QueryRowFormat.UseECSqlPropertyNames }).toArray();
    assert.equal(asyncECSqlNameRows[0].ECInstanceId, "0x1");
    assert.isTrue(Id64.isValidId64(asyncECSqlNameRows[0].ECClassId));

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const asyncJsNameRows = await iModel.createQueryReader(rootSelect, new QueryBinder().bindId(1, "0x1"), { rowFormat: QueryRowFormat.UseJsPropertyNames }).toArray();
    assert.equal(asyncJsNameRows[0].id, "0x1");
    assert.equal(asyncJsNameRows[0].className, "BisCore.Subject");

    const syncIndexRows = iModel.withQueryReader(rootSelect, (reader) => reader.toArray(), new QueryBinder().bindId(1, "0x1"));
    assert.isArray(syncIndexRows[0]);
    assert.equal(syncIndexRows[0][0], "0x1");
    assert.isTrue(Id64.isValidId64(syncIndexRows[0][1]));

    const syncECSqlNameRows = iModel.withQueryReader(rootSelect, (reader) => reader.toArray(), new QueryBinder().bindId(1, "0x1"), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
    assert.equal(syncECSqlNameRows[0].ECInstanceId, "0x1");
    assert.isTrue(Id64.isValidId64(syncECSqlNameRows[0].ECClassId));

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const syncJsNameRows = iModel.withQueryReader(rootSelect, (reader) => reader.toArray(), new QueryBinder().bindId(1, "0x1"), { rowFormat: QueryRowFormat.UseJsPropertyNames });
    assert.equal(syncJsNameRows[0].id, "0x1");
    assert.equal(syncJsNameRows[0].className, "BisCore.Subject");

    const asyncReader = iModel.createQueryReader(rootSelect, new QueryBinder().bindId(1, "0x1"));
    assert.isTrue(await asyncReader.step());
    const asyncObjectRow = asyncReader.current.toRow();
    assert.isFalse(Array.isArray(asyncObjectRow));
    assert.equal(asyncObjectRow.ECInstanceId, "0x1");

    const objectRow = iModel.withQueryReader(rootSelect, (reader) => {
      assert.isTrue(reader.step());
      return reader.current.toRow();
    }, new QueryBinder().bindId(1, "0x1"));
    assert.isObject(objectRow);
    assert.equal(objectRow.ECInstanceId, "0x1");

    const arrayRows = iModel.withQueryReader(rootSelect, (reader) => reader.toArray(), new QueryBinder().bindId(1, "0x1"));
    assert.isArray(arrayRows[0]);

    const idSetRows = await iModel.createQueryReader("SELECT ECInstanceId FROM bis.Element WHERE InVirtualSet(?, ECInstanceId)", new QueryBinder().bindIdSet(1, ["0x1", "0x2"])).toArray();
    assert.isTrue(idSetRows.some((row) => row[0] === "0x1"));
    const syncIdSetRows = iModel.withQueryReader("SELECT ECInstanceId FROM bis.Element WHERE InVirtualSet(?, ECInstanceId)", (reader) => reader.toArray(), new QueryBinder().bindIdSet(1, ["0x1", "0x2"]));
    assert.sameDeepMembers(syncIdSetRows, idSetRows);
  });
});
