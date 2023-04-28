/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.ecrs;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Bounds } from "../geom/Bounds";
import { Coordinate } from "../geom/Coordinate";
import { CRS } from "./CRS";

/**
 * Abstract class VerticalModel defines a vertical height/geoid model on top of a certain horizontal datum/ellopsoid.
 *
 * @version 1.0 May 2012
 */
/** @internal */
export class VerticalModel {
  /**
   * Create a new vertical model.
   */
  public constructor() {}

  /**
   * Is the model available (often support files are needed on disk)?
   * @return true if available.
   */
  public isAvailable(): boolean {
    return false;
  }

  /**
   * List the vertical CRS EPSG codes this model implements.
   * @return the list of vertical CRS codes.
   */
  public getVerticalCRSCodes(): Int32Array {
    return null;
  }

  /**
   * List the horizontal CRS EPSG codes in which the vertical model is supported.
   * @return the list of horizontal CRS codes.
   */
  public getHorizontalCRSCodes(): Int32Array {
    return null;
  }

  /**
   * Check if the vertical model implements a certain vertical datum.
   * @param datum the EPSG code of the vertical datum.
   * @return true if the datum is implemented.
   */
  public supportsVerticalDatum(datum: int32): boolean {
    return false;
  }

  /**
   * Check if the vertical model can be applied to a certain horizontal CRS.
   * @param crs the horizontal CRS.
   * @return true if the model can be applied.
   */
  public isValid(crs: CRS): boolean {
    return false;
  }

  /**
   * Prepare the model for a certain working area.
   * @param crs the CRS of the working area to prepare for.
   * @param area the working area to prepare for.
   * @return the working area.
   */
  public prepareForArea(crs: string, area: Bounds): Bounds {
    return area;
  }

  /**
   * Convert from an ellipsoid height to a local height.
   * @param crs the horizontal CRS.
   * @param position the position in the horizontal CRS.
   * @return the local height.
   */
  public toLocalHeight(crs: CRS, position: Coordinate): float64 {
    return position.getZ();
  }

  /**
   * Convert from a local height to an ellipsoid height.
   * @param crs the horizontal CRS.
   * @param position the position in the horizontal CRS.
   * @return the ellipsoid height.
   */
  public toEllipsoidHeight(crs: CRS, position: Coordinate): float64 {
    return position.getZ();
  }
}
