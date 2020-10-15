import { DbResult, Id64Set, Id64String, Logger } from "@bentley/bentleyjs-core";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECSqlStatement, Element, IModelDb, IModelJsFs, IModelTransformer, PhysicalPartition, SnapshotDb, Subject } from "@bentley/imodeljs-backend";
import { CreateIModelProps } from "@bentley/imodeljs-common";

export class CloneNonPhysical {
  public static async clone(sourceFileName: string, targetFileName: string): Promise<void> {
    const sourceDb = SnapshotDb.openFile(sourceFileName);
    if (IModelJsFs.existsSync(targetFileName)) {
      IModelJsFs.removeSync(targetFileName);
    }
    const targetDbProps: CreateIModelProps = {
      rootSubject: { name: "Clone-Target" },
      ecefLocation: sourceDb.ecefLocation,
    };
    const targetDb = SnapshotDb.createEmpty(targetFileName, targetDbProps);
    const cloner = new NonPhysicalCloner(sourceDb, targetDb);
    cloner.clone();
    cloner.dispose();
    sourceDb.close();
    targetDb.close();
  }
}

class NonPhysicalCloner extends IModelTransformer {
  private _sourceSubjectCodeSpecId: Id64String;
  private _childPhysicalPartitionIds: Id64Set = new Set<Id64String>();
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    super(sourceDb, targetDb);
    this._sourceSubjectCodeSpecId = sourceDb.codeSpecs.getByName("bis:Subject").id;
  }
  public clone(): void {
    this.processAll();
    this._childPhysicalPartitionIds.forEach((partitionId: Id64String) => {
      Logger.logInfo("transformer-test-app", partitionId);
    });
  }
  protected shouldExportElement(sourceElement: Element): boolean {
    if ((sourceElement.code.spec === this._sourceSubjectCodeSpecId) && (sourceElement.code.getValue() === "Physical")) {
      this.forEachChildPhysicalPartition(sourceElement.id, (partitionId: Id64String) => {
        // create target PhysicalPartition remap physical partition to appropriate consolidated one
        this._childPhysicalPartitionIds.add(partitionId);
      });
      return false;
    }
    return super.shouldExportElement(sourceElement);
  }
  private forEachChildPhysicalPartition(parentSubjectId: Id64String, fn: (partitionId: Id64String) => void): void {
    const partitionSql = `SELECT ECInstanceId FROM ${PhysicalPartition.classFullName} WHERE Parent.Id=:parentId`;
    this.sourceDb.withPreparedStatement(partitionSql, (statement: ECSqlStatement): void => {
      statement.bindId("parentId", parentSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const partitionId = statement.getValue(0).getId();
        fn(partitionId);
      }
    });
    const subjectSql = `SELECT ECInstanceId FROM ${Subject.classFullName} WHERE Parent.Id=:parentId`;
    this.sourceDb.withPreparedStatement(subjectSql, (statement: ECSqlStatement): void => {
      statement.bindId("parentId", parentSubjectId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const subjectId = statement.getValue(0).getId();
        this.forEachChildPhysicalPartition(subjectId, fn);
      }
    });
  }
}
