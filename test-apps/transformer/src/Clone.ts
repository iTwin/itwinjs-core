/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Logger } from "@bentley/bentleyjs-core";
import {
  BackendLoggerCategory, BackendRequestContext, ECSqlStatement, Element, IModelDb, IModelJsFs, IModelTransformer, SnapshotDb,
} from "@bentley/imodeljs-backend";
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
  private _numSourceElements = 0;
  private _numSourceElementsProcessed = 0;
  private _reportingInterval = 1000;
  private _saveChangesInterval = 10000;
  /** Construct a new IModelCloner */
  public constructor(sourceDb: IModelDb, targetDb: IModelDb) {
    super(sourceDb, targetDb, { cloneUsingBinaryGeometry: true });
    this._numSourceElements = sourceDb.withPreparedStatement(`SELECT COUNT(*) FROM ${Element.classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
    Logger.logInfo("Progress", `numSourceElements=${this._numSourceElements}`);
  }
  /** Override onTransformElement to log memory usage. */
  protected onTransformElement(sourceElement: Element): ElementProps {
    ++this._numSourceElementsProcessed;
    if (0 === this._numSourceElementsProcessed % this._reportingInterval) {
      this.logProgress();
      this.logMemoryUsage();
    }
    if (0 === this._numSourceElementsProcessed % this._saveChangesInterval) {
      Logger.logInfo("Progress", "Saving changes");
      this.targetDb.saveChanges();
    }
    return super.onTransformElement(sourceElement);
  }
  private logProgress(): void {
    Logger.logInfo("Progress", `Processed ${this._numSourceElementsProcessed} of ${this._numSourceElements}`);
  }
  private logMemoryUsage(): void {
    const used: any = process.memoryUsage();
    const values: string[] = [];
    // eslint-disable-next-line guard-for-in
    for (const key in used) {
      values.push(`${key}=${Math.round(used[key] / 1024 / 1024 * 100) / 100}MB `);
    }
    Logger.logInfo("Memory", `Memory: ${values.join()}`);
  }
}
