/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Range2dProps } from "@itwin/core-geometry";
import { NativePlatform } from "./internal/NativePlatform";

/** Describes a geographic coordinate reference system produced by [[getAvailableCoordinateReferenceSystems]].
 * @beta
 */
export interface AvailableCoordinateReferenceSystemProps {
  /** The name of the coordinate reference system. It can be presented to the user in the UI as an identifier for the coordinate reference system. */
  name: string;
  /** The description of the coordinate reference system. It can be presented to the user in the UI as extra information for the coordinate reference system. */
  description: string;
  /** Indicate if the coordinate reference system is deprecated. A coordinate reference system is deprecated if it is no longer recommended for use.
   *  A deprecated coordinate reference system can usually be substituted by a more accurate one. It is possible that an existing project uses a deprecated coordinate reference system.
   *  However, for new projects, it is recommended to use a non-deprecated coordinate reference system.
   */
  deprecated: boolean;
  /** Extent of the coordinate reference system. This is the area where the coordinate reference system can be used.
   *  Outside of this area, the coordinate reference system may not be accurate. The extent is defined by a range of longitude and latitude values.
   *  Minimum longitude and latitude correspond to crsExtent.low.x and crsExtent.low.y, respectively.
   *  Maximum longitude and latitude correspond to crsExtent.high.x and crsExtent.high.y, respectively.
   */
  crsExtent: Range2dProps;
}

/** Arguments supplied to [[getAvailableCoordinateReferenceSystems]].
 * @beta
 */
export interface GetAvailableCoordinateReferenceSystemsArgs {
  /** If provided, only return CRS's that contain the given extent. Minimum longitude and latitude correspond to extent.low.x and extent.low.y, respectively.
   * Maximum longitude and latitude correspond to extent.high.x and extent.high.y, respectively.
   */
  extent?: Range2dProps;
}

/** Get a list of Geographic Coordinate Reference Systems.
 * @param options Specifies the parameters to filter the returned list.
 * @returns The list of Geographic Coordinate Reference Systems, according to the supplied parameters.
 * @beta
 */
export async function getAvailableCoordinateReferenceSystems(args: GetAvailableCoordinateReferenceSystemsArgs): Promise<AvailableCoordinateReferenceSystemProps[]> {
  return NativePlatform.GeoServices.getListOfCRS(args.extent);
}
