/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Range2dProps, XAndY } from "@itwin/core-geometry";
import { IModelNative } from "./internal/NativePlatform";
import { GeoCoordConfig } from "./GeoCoordConfig";

/** Describes a coordinate reference system produced by [[getAvailableCoordinateReferenceSystems]].
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
  /** The name of the linear unit used by the coordinate reference system.
   *  When returned by [[getAvailableCoordinateReferenceSystems]], the value uses the canonical casing returned by [[getAvailableCRSUnits]].
   */
  unit?: string;
}

/** Arguments supplied to [[getAvailableCoordinateReferenceSystems]].
 * @beta
 */
export interface GetAvailableCoordinateReferenceSystemsArgs {
  /** If provided, only return coordinate reference systems that contain the given extent. Minimum longitude and latitude correspond to extent.low.x and extent.low.y, respectively.
   * Maximum longitude and latitude correspond to extent.high.x and extent.high.y, respectively.
   */
  extent?: Range2dProps;
  /** If true, returns additional coordinate reference systems with extents spanning the entire Earth's surface.
   * @default false
   */
  includeWorld?: boolean;
  /**
   * If provided, filter coordinate reference systems by unit name.
   * Matching is case-insensitive.
   * Use [[getAvailableCRSUnits]] to get a list of canonical unit names.
   */
  unit?: string;
}

/** Describes a vertical coordinate reference system produced by [[getAvailableVerticalCoordinateReferenceSystems]].
 * @beta
 */
export interface AvailableVerticalCoordinateReferenceSystemProps {
  /** Name in the Bentley Vertical Datum dictionary. */
  crsName: string;
  /** Backward-compatible approximation used by older readers. */
  id: "GEOID" | "ELLIPSOID" | "NGVD29" | "NAVD88" | "LOCAL_ELLIPSOID";
  /** EPSG code identifying the vertical coordinate reference system, when one is defined. */
  epsg?: number;
  /** Description of the vertical coordinate reference system. */
  description: string;
  /** Whether the vertical coordinate reference system is deprecated. */
  deprecated: boolean;
  /** The vertical coordinate reference system type. */
  type: string;
  /** The name of the linear unit used by the vertical coordinate reference system.
   * The value uses the canonical casing returned by [[getAvailableCRSUnits]].
   */
  unit: string;
  /** The geographic extent where the vertical coordinate reference system applies. */
  extent: Range2dProps;
}

/** Arguments supplied to [[getAvailableVerticalCoordinateReferenceSystems]].
 * @beta
 */
export interface GetAvailableVerticalCoordinateReferenceSystemsArgs {
  /** If provided, only return vertical coordinate reference systems applicable at this geographic point in degrees.
   * The x coordinate is longitude and the y coordinate is latitude.
   */
  point?: XAndY;
  /** If provided, only return vertical coordinate reference systems whose extent contains this extent. */
  extent?: Range2dProps;
  /** If true, include vertical coordinate reference systems whose extent intersects, but does not contain, [[extent]].
   * @default false
   */
  includeIntersecting?: boolean;
  /** If provided, filter vertical coordinate reference systems by unit name.
   * Matching is case-insensitive. Use [[getAvailableCRSUnits]] to get a list of canonical unit names.
   */
  unit?: string;
}

/** Get a list of Geographic Coordinate Reference Systems.
 * @param options Specifies the parameters to filter the returned list.
 * @returns The list of Geographic Coordinate Reference Systems, according to the supplied parameters.
 * @beta
 */
export async function getAvailableCoordinateReferenceSystems(
  args: GetAvailableCoordinateReferenceSystemsArgs
): Promise<AvailableCoordinateReferenceSystemProps[]> {
  GeoCoordConfig.loadDefaultDatabases();
  return IModelNative.platform.GeoServices.getListOfCRS(
    args.extent,
    args.includeWorld,
    args.unit
  );
}

/** Get a list of Vertical Coordinate Reference Systems.
 * @param args Specifies the parameters used to filter the returned list. Point and extent filters are mutually exclusive.
 * @returns The list of Vertical Coordinate Reference Systems according to the supplied parameters.
 * @beta
 */
export async function getAvailableVerticalCoordinateReferenceSystems(
  args: GetAvailableVerticalCoordinateReferenceSystemsArgs = {}
): Promise<AvailableVerticalCoordinateReferenceSystemProps[]> {
  GeoCoordConfig.loadDefaultDatabases();
  return IModelNative.platform.GeoServices.getListOfVerticalCRS(args);
}

/** Get a list of units used by horizontal and vertical coordinate reference systems in iTwin.js.
 * @returns An array of canonical unit names.
 * @beta
 */
export function getAvailableCRSUnits(): string[] {
  GeoCoordConfig.loadDefaultDatabases();
  return IModelNative.platform.GeoServices.getAvailableUnitNames();
}
