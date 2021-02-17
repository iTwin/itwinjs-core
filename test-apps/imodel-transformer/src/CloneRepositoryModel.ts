/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Element, IModelDb, IModelJsFs, IModelTransformer, SnapshotDb } from "@bentley/imodeljs-backend";
import { CreateIModelProps, IModel } from "@bentley/imodeljs-common";

export class CloneRepositoryModel {
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
    const cloner = new RepositoryModelCloner(sourceDb, targetDb);
    await cloner.clone();
    cloner.dispose();
    sourceDb.close();
    targetDb.close();
  }
}

class RepositoryModelCloner extends IModelTransformer {
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    super(sourceDb, targetDb);
  }
  public async clone(): Promise<void> {
    await this.exporter.exportCodeSpecs();
    await this.exporter.exportFonts();
    this.exporter.visitElements = true;
    await this.exporter.exportChildElements(IModel.rootSubjectId);
    this.exporter.visitElements = false;
    return this.exporter.exportSubModels(IModel.repositoryModelId);
  }
  protected shouldExportElement(sourceElement: Element): boolean {
    if (sourceElement.model !== IModel.repositoryModelId) {
      throw new Error("Only Elements in the RepositoryModel should be visited");
    }
    return super.shouldExportElement(sourceElement);
  }
}
