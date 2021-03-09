/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, DbOpcode, DbResult } from "@bentley/bentleyjs-core";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelHost } from "../../imodeljs-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "path";

// spell-checker: disable

describe.only("changeset reader", () => {
  it("read data using getColumnValue()", () => {
    const changesetFile = path.join(KnownTestLocations.assetsDir, "changesets/data.changeset");
    const reader: IModelJsNative.ChangesetReader = new IModelHost.platform.ChangesetReader()
    assert(reader.open(changesetFile, false) === DbResult.BE_SQLITE_OK);

    assert(reader.step() === DbResult.BE_SQLITE_ROW);
    const row = reader.getRow()!;
    const opCode = reader.getOpCode();
    const indirect = reader.isIndirectChange();
    assert(indirect === false);
    const n = reader.getColumnCount()!;
    for (let i = 0; i < n; ++i) {
      const col = row[i];
      if (opCode === DbOpcode.Update) {
        const oldVal = reader.getColumnValue(i, IModelJsNative.DbChangeStage.Old);
        const newVal = reader.getColumnValue(i, IModelJsNative.DbChangeStage.New);
        assert(col.old === oldVal);
        assert(col.new === newVal);
      } else if (opCode === DbOpcode.Insert) {
        const newVal = reader.getColumnValue(i, IModelJsNative.DbChangeStage.New);
        assert(col.new === newVal);
      } else if (opCode === DbOpcode.Delete) {
        const oldVal = reader.getColumnValue(i, IModelJsNative.DbChangeStage.Old);
        assert(col.old === oldVal);
      }
    }
    reader.close();
  });
  it("invert changeset", () => {
    const changesetFile = path.join(KnownTestLocations.assetsDir, "changesets/data.changeset");
    const reader: IModelJsNative.ChangesetReader = new IModelHost.platform.ChangesetReader()
    assert(reader.open(changesetFile, false) === DbResult.BE_SQLITE_OK);
    assert(reader.step() === DbResult.BE_SQLITE_ROW);
    assert(reader.getOpCode() === DbOpcode.Insert);
    reader.close();

    assert(reader.open(changesetFile, true) === DbResult.BE_SQLITE_OK);
    assert(reader.step() === DbResult.BE_SQLITE_ROW);
    assert(reader.getOpCode() === DbOpcode.Delete);
    reader.close();
  });
  it("read schema changeset", () => {
    const changesetFile = path.join(KnownTestLocations.assetsDir, "changesets/schema.changeset");
    const reader: IModelJsNative.ChangesetReader = new IModelHost.platform.ChangesetReader()
    assert(reader.open(changesetFile, false) === DbResult.BE_SQLITE_OK);
    const ddl = reader.getSchemaChanges();
    assert(typeof ddl !== "undefined");

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let rows = new Map<string, any[]>();
    while (reader.step() === DbResult.BE_SQLITE_ROW) {
      const opcode = reader.getOpCode();
      assert(typeof opcode !== "undefined");

      if (opcode === DbOpcode.Delete)
        deleted++;
      if (opcode === DbOpcode.Update)
        updated++;
      if (opcode === DbOpcode.Insert)
        inserted++;

      const row = reader.getRow();
      assert(typeof row !== "undefined");

      const tableName = reader.getTableName();
      assert(typeof tableName !== "undefined");

      rows.set(tableName!, row!);
    }

    assert(reader.close() === DbResult.BE_SQLITE_OK);

    // check total changes
    assert(inserted === 399);
    assert(updated === 0);
    assert(deleted === 0);

    // check if changed table exist
    assert(rows.size == 16);
    assert(rows.has("ec_Schema"));
    assert(rows.has("ec_SchemaReference"));
    assert(rows.has("ec_Class"));
    assert(rows.has("ec_ClassHasBaseClasses"));
    assert(rows.has("ec_RelationshipConstraint"));
    assert(rows.has("ec_RelationshipConstraintClass"));
    assert(rows.has("ec_CustomAttribute"));
    assert(rows.has("ec_Property"));
    assert(rows.has("ec_Column"));
    assert(rows.has("ec_Table"));
    assert(rows.has("ec_ClassMap"));
    assert(rows.has("ec_PropertyMap"));
    assert(rows.has("ec_PropertyPath"));
    assert(rows.has("ec_Index"));
    assert(rows.has("ec_IndexColumn"));
    assert(rows.has("dgn_Domain"));

    // count changes
    assert(rows.get("ec_Schema")?.length === 10);
    assert(rows.get("ec_SchemaReference")?.length === 3);
    assert(rows.get("ec_Class")?.length === 10);
    assert(rows.get("ec_ClassHasBaseClasses")?.length === 4);
    assert(rows.get("ec_RelationshipConstraint")?.length === 8);
    assert(rows.get("ec_RelationshipConstraintClass")?.length === 3);
    assert(rows.get("ec_CustomAttribute")?.length === 6);
    assert(rows.get("ec_Property")?.length === 23);
    assert(rows.get("ec_Column")?.length === 13);
    assert(rows.get("ec_Table")?.length === 6);
    assert(rows.get("ec_ClassMap")?.length === 5);
    assert(rows.get("ec_PropertyMap")?.length === 4);
    assert(rows.get("ec_PropertyPath")?.length === 3);
    assert(rows.get("ec_Index")?.length === 8);
    assert(rows.get("ec_IndexColumn")?.length === 4);
    assert(rows.get("dgn_Domain")?.length === 3);

    const sqls = ddl?.split(";");
    assert(sqls.length === 10);
    assert(sqls[0] === "ALTER TABLE [bis_Model] ADD COLUMN [ps4] BLOB");
    assert(sqls[1] === "ALTER TABLE [bis_Model] ADD COLUMN [ps5] BLOB");
    assert(sqls[2] === "ALTER TABLE [bis_Model] ADD COLUMN [ps6] BLOB");
    assert(sqls[3] === "CREATE TABLE [func_FunctionalElement]([ElementId] INTEGER PRIMARY KEY, [ECClassId] INTEGER NOT NULL, [TypeDefinitionId] INTEGER, [TypeDefinitionRelECClassId] INTEGER, FOREIGN KEY([ElementId]) REFERENCES [bis_Element]([Id]) ON DELETE CASCADE, FOREIGN KEY([TypeDefinitionId]) REFERENCES [bis_Element]([Id]) ON DELETE SET NULL)");
    assert(sqls[4] === "DROP INDEX IF EXISTS [ix_func_FunctionalElement_ecclassid]");
    assert(sqls[5] === "CREATE INDEX [ix_func_FunctionalElement_ecclassid] ON [func_FunctionalElement]([ECClassId])");
    assert(sqls[6] === "DROP INDEX IF EXISTS [ix_func_FunctionalElement_fk_func_FunctionalElementIsOfType_source]");
    assert(sqls[7] === "CREATE INDEX [ix_func_FunctionalElement_fk_func_FunctionalElementIsOfType_source] ON [func_FunctionalElement]([TypeDefinitionId]) WHERE ([TypeDefinitionId] IS NOT NULL)");
    assert(sqls[8] === "DROP INDEX IF EXISTS [ix_func_FunctionalElement_TypeDefinitionRelECClassId]");
    assert(sqls[9] === "CREATE INDEX [ix_func_FunctionalElement_TypeDefinitionRelECClassId] ON [func_FunctionalElement]([TypeDefinitionRelECClassId]) WHERE ([TypeDefinitionRelECClassId] IS NOT NULL)");
  });

  it("read data changeset via getRow()", () => {
    const changesetFile = path.join(KnownTestLocations.assetsDir, "changesets/data.cs");
    const reader: IModelJsNative.ChangesetReader = new IModelHost.platform.ChangesetReader()
    assert(reader.open(changesetFile, false) === DbResult.BE_SQLITE_OK);

    const fileName = reader.getFileName();
    assert(typeof fileName !== "undefined");
    assert(fileName! === changesetFile);

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let rows = new Map<string, any[]>();
    while (reader.step() === DbResult.BE_SQLITE_ROW) {
      const opcode = reader.getOpCode();
      assert(typeof opcode !== "undefined");

      if (opcode === DbOpcode.Delete)
        deleted++;
      if (opcode === DbOpcode.Update)
        updated++;
      if (opcode === DbOpcode.Insert)
        inserted++;

      const row = reader.getRow();
      assert(typeof row !== "undefined");

      const tableName = reader.getTableName();
      assert(typeof tableName !== "undefined");

      rows.set(tableName!, row!);
    }

    assert(reader.close() === DbResult.BE_SQLITE_OK);

    // check total changes
    assert(inserted === 1582);
    assert(updated === 2);
    assert(deleted === 0);

    // check if changed table exist
    assert(rows.size == 8);
    assert(rows.has("bis_Element"));
    assert(rows.has("bis_InformationReferenceElement"));
    assert(rows.has("bis_ElementMultiAspect"));
    assert(rows.has("bis_InformationPartitionElement"));
    assert(rows.has("bis_Model"));
    assert(rows.has("bis_ElementRefersToElements"));
    assert(rows.has("bis_DefinitionElement"));
    assert(rows.has("bis_CodeSpec"));

    // count changes
    assert(rows.get("bis_Element")?.length === 12);
    assert(rows.get("bis_InformationReferenceElement")?.length === 5);
    assert(rows.get("bis_ElementMultiAspect")?.length === 10);
    assert(rows.get("bis_InformationPartitionElement")?.length === 3);
    assert(rows.get("bis_Model")?.length === 12);
    assert(rows.get("bis_ElementRefersToElements")?.length === 5);
    assert(rows.get("bis_DefinitionElement")?.length === 35);
    assert(rows.get("bis_CodeSpec")?.length === 3);
  });
});
