/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DefinitionPartition, ElementOwnsChildElements, ElementRefersToElements, IModelDb, IModelHost, SnapshotDb, SubjectOwnsPartitionElements } from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { Code, IModel } from "@itwin/core-common";
import * as fs from "fs";

/* eslint-disable no-console */

async function nested(sourceDb: IModelDb, _targetDb: IModelDb) {
  sourceDb.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE ECInstanceId < :test", (stmt) => {
    stmt.bindInteger("test", 1_000_000);
    while (DbResult.BE_SQLITE_ROW === stmt.step()) {
      const id = stmt.getValue(0).getId();
      const element = sourceDb.elements.getElement(id);
      sourceDb.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=:id", (inStmt) => {
        inStmt.bindId("id", id);
        while (DbResult.BE_SQLITE_ROW === inStmt.step()) {
          console.log(`child of ${id}: ${JSON.stringify(element.toJSON())}`);
          // new DefinitionPartition({
          //   code: Code.createEmpty(),
          //   model: IModel.rootSubjectId,
          //   parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
          //   classFullName: DefinitionPartition.classFullName,
          // }, targetDb).insert();
        }
      });
    }
  });
}

async function rels(sourceDb: IModelDb, _targetDb: IModelDb) {
  const sql = `SELECT ECInstanceId FROM ${ElementRefersToElements.classFullName}`;
  for await (const [relInstanceId] of sourceDb.query(sql, undefined, { usePrimaryConn: true })) {
    sourceDb.relationships.getInstanceProps(ElementRefersToElements.classFullName, relInstanceId);
    // await exportRelationship(relProps.classFullName, relInstanceId); // must call exportRelationship using the actual classFullName, not baseRelClassFullName
    // console.log(`relId: ${relProps.id}`);
  }
}

async function main() {
  await IModelHost.startup();
  const sourceDb = SnapshotDb.openFile("/home/mike/shell.bim");
  const targetPath = "/tmp/test-out.bim";
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  const targetDb = SnapshotDb.createEmpty(targetPath, { rootSubject: { name: "test"}});
  return rels(sourceDb, targetDb);
}

main().catch(console.error);
