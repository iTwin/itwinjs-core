/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelJsNative } from "@bentley/imodeljs-native";
import { Range2dProps } from "@itwin/core-geometry";

/** Class containing services for working with geographic coordinates.
 * @public
 */
export abstract class GeoCoordServices {
  /** Get a list of Geographic Coordinate Systems.
   * @param ignoreLegacy If true, only return GCS's that are not considered legacy.
   * @param extent If provided, only return GCS's that contain the given extent. Minimum longitude and latitude correspond to extent.low.x and extent.low.y, respectively.
   * Maximum longitude and latitude correspond to extent.high.x and extent.high.y, respectively.
   * @returns The list of Geographic Coordinate Systems, according to the supplied parameters.
   */
  public static getListOfGCS(ignoreLegacy: boolean, extent?: Range2dProps): Array<{ name: string, description: string }> {
    return IModelJsNative.GeoServices.getListOfGCS(ignoreLegacy, extent);
  }
}
