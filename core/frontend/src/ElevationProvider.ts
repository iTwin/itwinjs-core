/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Cartographic } from "@itwin/core-common";
import { Range1d, Range2d } from "@itwin/core-geometry";
import { IModelConnection } from "./IModelConnection";

/** Provides terrain elevation data.
 * @beta
 */
export interface ElevationProvider {
  /** Return the height (altitude) at a given cartographic location.
   * Height is geodetic (WGS84 ellipsoid).
   */
  getHeight(carto: Cartographic): Promise<number>;

  /** Return a grid of elevations within the specified range.
   * Returns undefined if elevation data is unavailable for the range.
   */
  getHeights(range: Range2d): Promise<number[] | undefined>;
}

/** Compute the elevation range for an iModel's project extents using the given provider.
 * @beta
 */
export async function getHeightRange(provider: ElevationProvider, iModel: IModelConnection): Promise<Range1d> {
  const latLongRange = Range2d.createNull();
  const range = iModel.projectExtents.clone();

  // Expand for project surroundings.
  range.expandInPlace(1000);
  for (const corner of range.corners()) {
    const carto = iModel.spatialToCartographicFromEcef(corner);
    latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
  }

  const heights = await provider.getHeights(latLongRange);
  return heights ? Range1d.createArray(heights) : Range1d.createNull();
}

/** Compute the average elevation for an iModel's project extents using the given provider.
 * @beta
 */
export async function getHeightAverage(provider: ElevationProvider, iModel: IModelConnection): Promise<number> {
  const latLongRange = Range2d.createNull();
  for (const corner of iModel.projectExtents.corners()) {
    const carto = iModel.spatialToCartographicFromEcef(corner);
    latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
  }

  const heights = await provider.getHeights(latLongRange);
  if (!heights || !heights.length)
    return 0;

  let total = 0.0;
  for (const height of heights)
    total += height;

  return total / heights.length;
}
