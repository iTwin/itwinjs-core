/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set, Id64Array, Id64String, Logger, StopWatch } from "@itwin/core-bentley";
import { CustomViewState3dCreatorOptions, CustomViewState3dProps, QueryRowFormat } from "@itwin/core-common";
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
  /** Gets default view state data such as category Ids and modelextents. If no model ids are passed in, all 3D models in the iModel are used.
   * @param [modelIds] Ids of models to display in the view.
   * @throws [IModelError]($common) If no 3d models are found in the iModel.
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

  /** Compute the union of the extents of all the specified models. */
  private async _getModelExtents(modelIds: Id64String[]): Promise<Range3d> {
    if (modelIds.length === 0)
      return new Range3d();

    const timer = new StopWatch("getModelExtents query", true);
    const range = await this._imodel.models.queryRange(modelIds);

    timer.stop();
    Logger.logInfo(loggerCategory, "Finished getModelExtents query.", {timeElapsedMs: timer.elapsed});

    return range;
  }

  /** Get the Ids of all spatially-located, non-template 3d models in the iModel. */
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

  private _executeQuery = async (query: string) => {
    const rows = [];
    for await (const row of this._imodel.query(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames }))
      rows.push(row.id);

    return rows;
  };
}
