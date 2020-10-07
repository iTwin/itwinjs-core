import { Id64String } from "@bentley/bentleyjs-core";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  BackendRequestContext, Element, IModelDb, IModelJsFs, IModelTransformer, PhysicalModel, PhysicalPartition, SnapshotDb, Subject,
} from "@bentley/imodeljs-backend";
import { CreateIModelProps, IModel } from "@bentley/imodeljs-common";

export class CombineModels {
  public static async combine(sourceFileName: string, targetFileName: string): Promise<void> {
    const sourceDb = SnapshotDb.openFile(sourceFileName);
    if (IModelJsFs.existsSync(targetFileName)) {
      IModelJsFs.removeSync(targetFileName);
    }
    const targetDbProps: CreateIModelProps = {
      rootSubject: { name: "Combine-Target" },
      ecefLocation: sourceDb.ecefLocation,
    };
    const targetDb = SnapshotDb.createEmpty(targetFileName, targetDbProps);
    const subjectId: Id64String = Subject.insert(targetDb, IModel.rootSubjectId, "PDMX-Combined"); // cspell:ignore PDMX
    const targetComponentsModelId: Id64String = PhysicalModel.insert(targetDb, subjectId, "Components");
    const targetPhysicalTagsModelId: Id64String = PhysicalModel.insert(targetDb, subjectId, "PDMxPhysical-Tags");
    const combiner = new PhysicalModelCombiner(sourceDb, targetDb, targetComponentsModelId, targetPhysicalTagsModelId);
    await combiner.processSchemas(new BackendRequestContext());
    combiner.processAll();
    combiner.dispose();
    sourceDb.close();
    targetDb.close();
  }
}

class PhysicalModelCombiner extends IModelTransformer {
  private readonly _targetComponentsModelId: Id64String;
  private readonly _targetPhysicalTagsModelId: Id64String;
  public constructor(sourceDb: IModelDb, targetDb: IModelDb, targetComponentsModelId: Id64String, targetPhysicalTagsModelId: Id64String) {
    super(sourceDb, targetDb);
    this._targetComponentsModelId = targetComponentsModelId;
    this._targetPhysicalTagsModelId = targetPhysicalTagsModelId;
    this.importer.doNotUpdateElementIds.add(targetComponentsModelId);
    this.importer.doNotUpdateElementIds.add(targetPhysicalTagsModelId);
  }
  /** Override shouldExportElement to remap PhysicalPartition instances. */
  protected shouldExportElement(sourceElement: Element): boolean {
    if (sourceElement instanceof PhysicalPartition) {
      if (sourceElement.code.getValue() === "Components") {
        this.context.remapElement(sourceElement.id, this._targetComponentsModelId);
      }
    }
    return super.shouldExportElement(sourceElement);
  }
}
