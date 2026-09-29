/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { SnapshotDb } from "@itwin/core-backend";
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

  it("materializes a row with JavaScript-friendly aliases", () => {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Sync_JsRow
    const row = iModel.withQueryReader("SELECT ECInstanceId AS id, ec_classname(ECClassId, 's.c') AS className FROM bis.Element WHERE ECInstanceId=?", (reader) => {
      return reader.step() ? reader.current.toRow() : undefined;
    }, new QueryBinder().bindId(1, "0x1"), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
    // __PUBLISH_EXTRACT_END__
    assert.equal(row.id, "0x1");
    assert.equal(row.className, "BisCore.Subject");
  });
});
