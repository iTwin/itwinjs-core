/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Range2dProps } from "@itwin/core-geometry";
import { IModelHost } from "./IModelHost";

/** Describes a geographic coordinate reference system produced by [[getAvailableCoordinateReferenceSystems]].
 * @beta
 */
export interface AvailableCoordinateReferenceSystemProps {
  /** TODO: Document the fields. */
  name: string;
  description: string;
  deprecated: boolean;
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
  return IModelHost.platform.GeoServices.getListOfCRS(args.extent);
}
