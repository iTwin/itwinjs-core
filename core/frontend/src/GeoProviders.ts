/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Cartographic } from "@itwin/core-common";
import { Range1d, Range2d } from "@itwin/core-geometry";
import { IModelConnection } from "./IModelConnection";
import type { GlobalLocation } from "./ViewGlobalLocation";

/** Provides terrain elevation data.
 * @beta
 */
export interface ElevationProvider {
  /** Return the height (altitude) at a given cartographic location.
   * If geodetic is true (the default) then height is returned in the Ellipsoidal WGS84 datum.
   * If geodetic is false then sea level height is returned using the Earth Gravitational Model 2008 (EGM2008 2.5').
   */
  getHeight(carto: Cartographic, geodetic?: boolean): Promise<number>;

  /** Return a grid of elevations within the specified range.
   * Returns undefined if elevation data is unavailable for the range.
   * Implementations that do not support bulk grid queries may omit this method.
   */
  getHeights?(range: Range2d): Promise<number[] | undefined>;
}

/** Provides geoid undulation — the offset between the geodetic ellipsoid (WGS84) and sea level (EGM2008).
 * @beta
 */
export interface GeoidProvider {
  /** Return the offset from geodetic height to sea level height at the given cartographic location. */
  getGeodeticToSeaLevelOffset(carto: Cartographic): Promise<number>;
}

/** Provides geocoding — converting a query string to a geographic location.
 * @beta
 */
export interface LocationProvider {
  /** Return the location for a query string, or undefined if not found. */
  getLocation(query: string): Promise<GlobalLocation | undefined>;
}

/** Compute the elevation range for an iModel's project extents using the given provider.
 * @beta
 */
export async function getHeightRange(provider: ElevationProvider, iModel: IModelConnection): Promise<Range1d> {
  if (!iModel.isGeoLocated)
    return Range1d.createNull();

  const latLongRange = Range2d.createNull();
  const range = iModel.projectExtents.clone();

  // Expand for project surroundings.
  range.expandInPlace(1000);
  for (const corner of range.corners()) {
    const carto = iModel.spatialToCartographicFromEcef(corner);
    latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
  }

  const heights = await provider.getHeights?.(latLongRange);
  return heights ? Range1d.createArray(heights) : Range1d.createNull();
}

/** Compute the average elevation for an iModel's project extents using the given provider.
 * @beta
 */
export async function getHeightAverage(provider: ElevationProvider, iModel: IModelConnection): Promise<number> {
  if (!iModel.isGeoLocated)
    return 0;

  const latLongRange = Range2d.createNull();
  for (const corner of iModel.projectExtents.corners()) {
    const carto = iModel.spatialToCartographicFromEcef(corner);
    latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
  }

  const heights = await provider.getHeights?.(latLongRange);
  if (!heights || !heights.length)
    return 0;

  let total = 0.0;
  for (const height of heights)
    total += height;

  return total / heights.length;
}
