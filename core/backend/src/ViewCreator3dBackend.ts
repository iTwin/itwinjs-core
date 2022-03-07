/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export class ViewCreator3dBackend {
  public static async getAllModels(): Promise<Id64Array> {
    // Note: IsNotSpatiallyLocated was introduced in a later version of the BisCore ECSchema.
    // If the iModel has an earlier version, the statement will throw because the property does not exist.
    // If the iModel was created from an earlier version and later upgraded to a newer version, the property may be NULL for models created prior to the upgrade.
    const select = "SELECT ECInstanceId FROM Bis.GeometricModel3D WHERE IsPrivate = false AND IsTemplate = false";
    const spatialCriterion = "AND (IsNotSpatiallyLocated IS NULL OR IsNotSpatiallyLocated = false)";
    let models = [];
    try {
      models = await this._executeQuery(`${select} ${spatialCriterion}`);
    } catch {
      models = await this._executeQuery(select);
    }

    return models;
  }
}
