/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult } from "@bentley/bentleyjs-core";
import { BackendRequestContext, ECSqlStatement, IModelDb, IModelJsFs, IModelTransformer, SnapshotDb, SubCategory } from "@bentley/imodeljs-backend";
import { CreateIModelProps } from "@bentley/imodeljs-common";

export class SubCategoryFilterer extends IModelTransformer {
  public static async filter(sourceFileName: string, targetFileName: string): Promise<void> {
    const sourceDb = SnapshotDb.openFile(sourceFileName);
    if (IModelJsFs.existsSync(targetFileName)) {
      IModelJsFs.removeSync(targetFileName);
    }
    const targetDbProps: CreateIModelProps = {
      rootSubject: { name: "Clone-Target" },
      ecefLocation: sourceDb.ecefLocation,
    };
    const targetDb = SnapshotDb.createEmpty(targetFileName, targetDbProps);
    const filterer = new SubCategoryFilterer(sourceDb, targetDb);
    await filterer.processSchemas(new BackendRequestContext());
    filterer.initSubCategoryFilter();
    // filterer.processAll();
    filterer.dispose();
    sourceDb.close();
    targetDb.close();
  }
  private initSubCategoryFilter(): void {
    const sql = `SELECT ECInstanceId FROM ${SubCategory.classFullName} WHERE CodeValue='Obstruction' OR CodeValue='Insulation'`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        const subCategoryId = statement.getValue(0).getId();
        this.context.filterSubCategory(subCategoryId);
      }
    });
  }
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    super(sourceDb, targetDb, { cloneUsingBinaryGeometry: true, noProvenance: true });
  }
}
