/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult, Logger } from "@bentley/bentleyjs-core";
import {
  BackendRequestContext, ECSqlStatement, Element, ElementRefersToElements, IModelDb, IModelTransformer, IModelTransformOptions, Relationship,
} from "@bentley/imodeljs-backend";

export const progressLoggerCategory = "Progress";

export interface TransformerOptions extends IModelTransformOptions {
  simplifyElementGeometry?: boolean;
}

export class Transformer extends IModelTransformer {
  private _numSourceElements = 0;
  private _numSourceElementsProcessed = 0;
  private _numSourceRelationships = 0;
  private _numSourceRelationshipsProcessed = 0;
  private _startTime = new Date();

  public static async transformAll(sourceDb: IModelDb, targetDb: IModelDb, options?: TransformerOptions): Promise<void> {
    const transformer = new Transformer(sourceDb, targetDb, options);
    if (options?.simplifyElementGeometry) {
      transformer.importer.simplifyElementGeometry = true;
    }
    transformer.initialize();
    await transformer.processSchemas(new BackendRequestContext());
    targetDb.saveChanges("processSchemas");
    await transformer.processAll();
    targetDb.saveChanges("processAll");
    transformer.dispose();
    transformer.logElapsedTime();
  }

  public constructor(sourceDb: IModelDb, targetDb: IModelDb, options?: IModelTransformOptions) {
    super(sourceDb, targetDb, options);
  }

  private initialize(): void {
    Logger.logInfo(progressLoggerCategory, `sourceDb=${this.sourceDb.pathName}`);
    Logger.logInfo(progressLoggerCategory, `targetDb=${this.targetDb.pathName}`);

    // query for and log the number of source Elements that will be processed
    this._numSourceElements = this.sourceDb.withPreparedStatement(`SELECT COUNT(*) FROM ${Element.classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
    Logger.logInfo(progressLoggerCategory, `numSourceElements=${this._numSourceElements}`);

    // query for and log the number of source Relationships that will be processed
    this._numSourceRelationships = this.sourceDb.withPreparedStatement(`SELECT COUNT(*) FROM ${ElementRefersToElements.classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
    Logger.logInfo(progressLoggerCategory, `numSourceRelationships=${this._numSourceRelationships}`);
  }

  protected shouldExportElement(sourceElement: Element): boolean {
    if (this._numSourceElementsProcessed < this._numSourceElements) { // with deferred element processing, the number processed can be more than the total
      ++this._numSourceElementsProcessed;
    }
    return super.shouldExportElement(sourceElement);
  }

  protected shouldExportRelationship(relationship: Relationship): boolean {
    if (this._numSourceRelationshipsProcessed < this._numSourceRelationships) {
      ++this._numSourceRelationshipsProcessed;
    }
    return super.shouldExportRelationship(relationship);
  }

  protected onProgress(): void {
    if (this._numSourceElementsProcessed > 0) {
      Logger.logInfo(progressLoggerCategory, `Processed ${this._numSourceElementsProcessed} of ${this._numSourceElements} elements`);
    }
    if (this._numSourceRelationshipsProcessed > 0) {
      Logger.logInfo(progressLoggerCategory, `Processed ${this._numSourceRelationshipsProcessed} of ${this._numSourceRelationships} relationships`);
    }
    this.logElapsedTime();
    this.targetDb.saveChanges();
    super.onProgress();
  }

  private logElapsedTime(): void {
    const elapsedTimeMinutes: number = (new Date().valueOf() - this._startTime.valueOf()) / 60000.0;
    Logger.logInfo(progressLoggerCategory, `Elapsed time: ${Math.round(100 * elapsedTimeMinutes) / 100.0} minutes`);
  }
}
