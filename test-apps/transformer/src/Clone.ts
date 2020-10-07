/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BackendRequestContext, IModelJsFs, IModelTransformer, SnapshotDb } from "@bentley/imodeljs-backend";
import { CreateIModelProps } from "@bentley/imodeljs-common";

export class CloneIModel {
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
    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.processSchemas(new BackendRequestContext());
    transformer.processAll();
    transformer.dispose();
    sourceDb.close();
    targetDb.close();
  }
}
