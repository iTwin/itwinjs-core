/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set, Id64Array, Id64String, Logger, StopWatch } from "@itwin/core-bentley";
import { CustomViewState3dCreatorOptions, CustomViewState3dProps, IModelError, IModelStatus, QueryRowFormat } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { IModelDb } from "./IModelDb";

const loggerCategory = BackendLoggerCategory.CustomViewState3dCreator;

/**
 * Class which helps to generate a custom ViewState3d.
 * @internal
 */
export class CustomViewState3dCreator {
  private _imodel: IModelDb;
  public constructor(iModel: IModelDb) {
    this._imodel = iModel;
  }
  /**
   * Gets default view state data such as category Ids and modelextents. If no model ids are passed in, all 3D models in the iModel are used.
   * @param [modelIds] Ids of models to display in the view.
   * @throws [IModelError]($common) If no 3d models are found in the iModel.
   * @returns CustomViewState3dProps
   */
  public async getCustomViewState3dData(options: CustomViewState3dCreatorOptions): Promise<CustomViewState3dProps> {
    let decompressedModelIds;
    if (options?.modelIds !== undefined)
      decompressedModelIds = CompressedId64Set.decompressArray(options.modelIds);
    const models: Id64Array = decompressedModelIds ?? await this._getAllModels();
    const categories: Id64Array = await this._getAllCategories();
    const modelExtents: Range3d = await this._getModelExtents(models);
    return {
      modelIds: CompressedId64Set.sortAndCompress(models),
      categoryIds: CompressedId64Set.sortAndCompress(categories),
      modelExtents: modelExtents.toJSON(),
    };
  }

  private async _getAllCategories(): Promise<Id64Array> {
    // Only use categories with elements in them
    Logger.logInfo(loggerCategory, "Starting getAllCategories query.");
    const query = `SELECT DISTINCT Category.Id AS id FROM BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId FROM BisCore.SpatialCategory)`;
    const categories: Id64Array = await this._executeQuery(query);
    Logger.logInfo(loggerCategory, "Finished getAllCategories query.");
    return categories;
  }

  /**
   * Gets the union of the extents of each model id passed in. Can return null range if no ids are passed, or no geometry found for the models.
   * @param modelIdsList array of modelIds to get extents for
   * @returns Range3d, the union of the extents of each model id
   */
  private async _getModelExtents(modelIdsList: Id64String[]): Promise<Range3d> {
    const modelExtents = new Range3d();
    if (modelIdsList.length === 0)
      return modelExtents;
    const modelIds = new Set(modelIdsList);
    Logger.logInfo(loggerCategory, "Starting getModelExtents query.");
    for (const id of modelIds) {
      const modelExtentsStopWatch = new StopWatch("getModelExtents query", false);
      try {
        await new Promise((resolve) => setImmediate(resolve)); // Free up main thread temporarily. Ideally we get queryModelExtents off the main thread and do not need to do this.
        Logger.logInfo(loggerCategory, "Starting getModelExtents query.");
        modelExtentsStopWatch.start();
        const props = this._imodel.nativeDb.queryModelExtents({ id }).modelExtents;
        modelExtentsStopWatch.stop();
        Logger.logInfo(LoggerCategory, `Finished getModelExtents query. Time taken: ${modelExtentsStopWatch.elapsed} ms.`);
        modelExtents.union(Range3d.fromJSON(props), modelExtents);
      } catch (err: any) {
        modelExtentsStopWatch.stop();
        Logger.logInfo(loggerCategory, `Finished getModelExtents query with error: ${err?.message}. errorNumber:${err?.errorNumber} Time taken: ${modelExtentsStopWatch.elapsed} ms.`);
        if ((err as IModelError).errorNumber === IModelStatus.NoGeometry) { // if there was no geometry, just return null range
          continue;
        }
        if (modelIds.size === 1)
          throw err; // if they're asking for more than one model, don't throw on error.
        continue;
      }
    }
    Logger.logInfo(loggerCategory, "Finished getModelExtents query.");
    return modelExtents;
  }

  /**
   * Get all PhysicalModel ids in the iModel
   */
  private async _getAllModels(): Promise<Id64Array> {
    // Note: IsNotSpatiallyLocated was introduced in a later version of the BisCore ECSchema.
    // If the iModel has an earlier version, the statement will throw because the property does not exist.
    // If the iModel was created from an earlier version and later upgraded to a newer version, the property may be NULL for models created prior to the upgrade.
    const select = "SELECT ECInstanceId FROM Bis.GeometricModel3D WHERE IsPrivate = false AND IsTemplate = false";
    const spatialCriterion = "AND (IsNotSpatiallyLocated IS NULL OR IsNotSpatiallyLocated = false)";
    let models = [];
    Logger.logInfo(loggerCategory, "Starting getAllModels query.");
    try {
      models = await this._executeQuery(`${select} ${spatialCriterion}`);
    } catch {
      models = await this._executeQuery(select);
    }
    Logger.logInfo(loggerCategory, "Finished getAllModels query.");
    return models;
  }
  /**
   * Helper function to execute ECSql queries.
   */
  private _executeQuery = async (query: string) => {
    const rows = [];
    for await (const row of this._imodel.query(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      rows.push(row.id);

    return rows;
  };
}
