/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Range2dProps } from "@itwin/core-geometry";
import { IModelHost } from "./IModelHost";

/** APIs for working with Geographic CRS (Coordinate Reference System)
 * @beta
 */
export namespace GeographicCRSServices {
  export interface CRSListRequestOptions {
    /** If provided, only return CRS's that contain the given extent. Minimum longitude and latitude correspond to extent.low.x and extent.low.y, respectively.
     * Maximum longitude and latitude correspond to extent.high.x and extent.high.y, respectively.
     */
    extent?: Range2dProps;
  }

  export type CRSListResponse = Array<CRSListResponseItem>;

  /** Items returned in the list of Geographic Coordinate Reference Systems.
   * @param name Name of the Coordinate Reference System.
   * @param description Description of the Coordinate Reference System.
   * @param deprecated indicate if the Coordinate Reference System is deprecated. A Coordinate Reference System is deprecated if it is no longer recommended for use.
   * A deprecated CRS can usually be substituted by a more accurate one.
   * @param crsExtent Extent of the Coordinate Reference System.
   */
  export interface CRSListResponseItem {
    name: string;
    description: string;
    deprecated: boolean;
    crsExtent: Range2dProps;
  }

  /** Get a list of Geographic Coordinate Reference Systems.
   * @param options Specifies the parameters to filter the returned list.
   * @returns The list of Geographic Coordinate Reference Systems, according to the supplied parameters.
   */
  export const getListOfCRS = async (options?: CRSListRequestOptions): Promise< CRSListResponse > => {
    const extent = options?.extent;
    return IModelHost.platform.GeoServices.getListOfCRS(extent);
  };
}
