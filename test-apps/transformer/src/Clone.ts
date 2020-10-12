import { Logger } from "@bentley/bentleyjs-core";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BackendLoggerCategory, BackendRequestContext, Element, IModelDb, IModelJsFs, IModelTransformer, SnapshotDb } from "@bentley/imodeljs-backend";
import { CreateIModelProps, ElementProps } from "@bentley/imodeljs-common";

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
    const cloner = new IModelCloner(sourceDb, targetDb);
    await cloner.processSchemas(new BackendRequestContext());
    cloner.processAll();
    cloner.dispose();
    sourceDb.close();
    targetDb.close();
  }
}

class IModelCloner extends IModelTransformer {
  /** Construct a new IModelCloner */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    super(sourceDb, targetDb, { cloneUsingBinaryGeometry: true });
  }
  /** Override onTransformElement to log memory usage. */
  protected onTransformElement(sourceElement: Element): ElementProps {
    this.logMemoryUsage();
    // if (sourceElement.id === "0x4000000a3f9") {
    //   Logger.logWarning(BackendLoggerCategory.IModelTransformer, `Problem Element ${sourceElement.id} found`);
    // }
    return super.onTransformElement(sourceElement);
  }
  private logMemoryUsage(): void {
    const used: any = process.memoryUsage();
    const values: string[] = [];
    // eslint-disable-next-line guard-for-in
    for (const key in used) {
      values.push(`${key}=${Math.round(used[key] / 1024 / 1024 * 100) / 100}MB `);
    }
    Logger.logTrace(BackendLoggerCategory.IModelTransformer, `Memory: ${values.join()}`);
  }
}
