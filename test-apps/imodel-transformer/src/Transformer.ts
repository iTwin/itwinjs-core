/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, ClientRequestContext, DbResult, Id64, Id64Array, Logger } from "@bentley/bentleyjs-core";
import {
  BackendRequestContext, ECSqlStatement, Element, ElementRefersToElements, GeometryPart, IModelDb, IModelTransformer, IModelTransformOptions,
  InformationPartitionElement,
  PhysicalModel, PhysicalPartition, Relationship, SubCategory,
} from "@bentley/imodeljs-backend";
import { IModel } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

export const progressLoggerCategory = "Progress";

export interface TransformerOptions extends IModelTransformOptions {
  simplifyElementGeometry?: boolean;
  combinePhysicalModels?: boolean;
  deleteUnusedGeometryParts?: boolean;
  excludeSubCategories?: string[];
}

export class Transformer extends IModelTransformer {
  private _numSourceElements = 0;
  private _numSourceElementsProcessed = 0;
  private _numSourceRelationships = 0;
  private _numSourceRelationshipsProcessed = 0;
  private _startTime = new Date();
  private _targetPhysicalModelId = Id64.invalid; // will be valid when PhysicalModels are being combined

  public static async transformAll(requestContext: AuthorizedClientRequestContext | ClientRequestContext, sourceDb: IModelDb, targetDb: IModelDb, options?: TransformerOptions): Promise<void> {
    const transformer = new Transformer(sourceDb, targetDb, options);
    transformer.initialize(options);
    await transformer.processSchemas(requestContext);
    targetDb.saveChanges("processSchemas");
    await transformer.processAll();
    targetDb.saveChanges("processAll");
    if (options?.deleteUnusedGeometryParts) {
      transformer.deleteUnusedGeometryParts();
      targetDb.saveChanges("deleteUnusedGeometryParts");
    }
    transformer.dispose();
    transformer.logElapsedTime();
  }

  public static async transformChanges(requestContext: AuthorizedClientRequestContext, sourceDb: IModelDb, targetDb: IModelDb, sourceStartChangeSetId: string, options?: TransformerOptions): Promise<void> {
    if ("" === sourceDb.changeSetId) {
      assert("" === sourceStartChangeSetId);
      return this.transformAll(requestContext, sourceDb, targetDb, options);
    }
    const transformer = new Transformer(sourceDb, targetDb, options);
    transformer.initialize(options);
    await transformer.processChanges(requestContext, sourceStartChangeSetId);
    targetDb.saveChanges("processChanges");
    if (options?.deleteUnusedGeometryParts) {
      transformer.deleteUnusedGeometryParts();
      targetDb.saveChanges("deleteUnusedGeometryParts");
    }
    transformer.dispose();
    transformer.logElapsedTime();
  }

  private constructor(sourceDb: IModelDb, targetDb: IModelDb, options?: IModelTransformOptions) {
    super(sourceDb, targetDb, options);
  }

  private initialize(options?: TransformerOptions): void {
    Logger.logInfo(progressLoggerCategory, `sourceDb=${this.sourceDb.pathName}`);
    Logger.logInfo(progressLoggerCategory, `targetDb=${this.targetDb.pathName}`);
    this.logChangeTrackingMemoryUsed();

    // customize transformer using the specified options
    if (options?.simplifyElementGeometry) {
      this.importer.simplifyElementGeometry = true;
    }
    if (options?.combinePhysicalModels) {
      this._targetPhysicalModelId = PhysicalModel.insert(this.targetDb, IModel.rootSubjectId, "CombinedPhysicalModel"); // WIP: Id should be passed in, not inserted here
      this.importer.doNotUpdateElementIds.add(this._targetPhysicalModelId);
    }
    if (options?.excludeSubCategories) {
      this.excludeSubCategories(options.excludeSubCategories);
    }

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

  /** Initialize IModelTransformer to exclude SubCategory Elements and geometry entries in a SubCategory from the target iModel.
   * @param subCategoryNames Array of SubCategory names to exclude
   * @note This sample code assumes that you want to exclude all SubCategories of a given name regardless of parent Category
   */
  private excludeSubCategories(subCategoryNames: string[]): void {
    const sql = `SELECT ECInstanceId FROM ${SubCategory.classFullName} WHERE CodeValue=:subCategoryName`;
    for (const subCategoryName of subCategoryNames) {
      this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
        statement.bindString("subCategoryName", subCategoryName);
        while (DbResult.BE_SQLITE_ROW === statement.step()) {
          const subCategoryId = statement.getValue(0).getId();
          const subCategory = this.sourceDb.elements.getElement<SubCategory>(subCategoryId, SubCategory);
          if (!subCategory.isDefaultSubCategory) { // cannot exclude a default SubCategory
            this.context.filterSubCategory(subCategoryId); // filter out geometry entries in this SubCategory from the target iModel
            this.exporter.excludeElement(subCategoryId); // exclude the SubCategory Element itself from the target iModel
          }
        }
      });
    }
  }

  /** Override that counts elements processed and optionally remaps PhysicalPartitions.
   * @note Override of IModelExportHandler.shouldExportElement
   */
  protected shouldExportElement(sourceElement: Element): boolean {
    if (sourceElement instanceof InformationPartitionElement) {
      Logger.logInfo(progressLoggerCategory, `${sourceElement.classFullName} "${sourceElement.getDisplayLabel()}"`);
    }
    if (this._numSourceElementsProcessed < this._numSourceElements) { // with deferred element processing, the number processed can be more than the total
      ++this._numSourceElementsProcessed;
    }
    if (Id64.isValidId64(this._targetPhysicalModelId) && (sourceElement instanceof PhysicalPartition)) {
      this.context.remapElement(sourceElement.id, this._targetPhysicalModelId); // combine all source PhysicalModels into a single target PhysicalModel
      // NOTE: must allow export to continue so the PhysicalModel sub-modeling the PhysicalPartition is processed
    }
    return super.shouldExportElement(sourceElement);
  }

  // protected onTransformElement(sourceElement: Element): ElementProps {
  //   if (sourceElement.getDisplayLabel() === "L1.DS1-DC1-010-V-0001.ifc") {
  //     Logger.logInfo(progressLoggerCategory, "Found problem element");
  //   }
  //   return super.onTransformElement(sourceElement);
  // }

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
    this.logChangeTrackingMemoryUsed();
    // this.targetDb.saveChanges();
    super.onProgress();
  }

  private logElapsedTime(): void {
    const elapsedTimeMinutes: number = (new Date().valueOf() - this._startTime.valueOf()) / 60000.0;
    Logger.logInfo(progressLoggerCategory, `Elapsed time: ${Math.round(100 * elapsedTimeMinutes) / 100.0} minutes`);
  }

  public logChangeTrackingMemoryUsed(): void {
    if (this.targetDb.isBriefcase) {
      const bytesUsed = this.targetDb.nativeDb.getChangeTrackingMemoryUsed(); // can't call this internal method unless targetDb has change tracking enabled
      const mbUsed = Math.round((bytesUsed * 100) / (1024 * 1024)) / 100;
      Logger.logInfo(progressLoggerCategory, `Change Tracking Memory Used: ${mbUsed} MB`);
    }
  }

  private deleteUnusedGeometryParts(): void {
    const geometryPartIds: Id64Array = [];
    const sql = `SELECT ECInstanceId FROM ${GeometryPart.classFullName}`;
    this.sourceDb.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        geometryPartIds.push(statement.getValue(0).getId());
      }
    });
    this.targetDb.elements.deleteDefinitionElements(geometryPartIds); // will delete only if unused
  }
}
