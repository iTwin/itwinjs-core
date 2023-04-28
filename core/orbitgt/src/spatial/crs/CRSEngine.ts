/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.crs;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Bounds } from "../geom/Bounds";
import { Coordinate } from "../geom/Coordinate";

/**
 * Abstract class CRSEngine provides a model for CRS transformation engines to implement.
 */
/** @internal */
export class CRSEngine {
  /**
   * Create a new engine.
   */
  public constructor() {}

  /**
   * Prepare a CRS for making transforms in a certain area.
   * @param crs the CRS to prepare.
   * @param area the area to prepare for (can be invalid to prepare only for the crs).
   */
  public async prepareForArea(crs: string, area: Bounds): Promise<Bounds> {
    // subclasses should override this method if they need to download some part of a grid correction file, or the CRS declaration
    return area;
  }

  /**
   * Transform a coordinate from one CRS to another.
   * @param point the point coordinate.
   * @param sourceCRS the source CRS.
   * @param targetCRS the target CRS.
   * @return the transformed coordinate.
   */
  public transformPoint(
    point: Coordinate,
    sourceCRS: string,
    targetCRS: string
  ): Coordinate {
    // subclasses should override this method
    return point;
  }

  /**
   * Check if a CRS is geocentric.
   * @param crs the CRS to check.
   * @return true if geocentric.
   */
  public isGeocentricCRS(crs: string): boolean {
    // subclasses should override this method
    return false;
  }

  /**
   * Check if a CRS is geographic.
   * @param crs the CRS to check.
   * @return true if geocentric.
   */
  public isGeographicCRS(crs: string): boolean {
    // subclasses should override this method
    return false;
  }

  /**
   * Check if a CRS is projected.
   * @param crs the CRS to check.
   * @return true if geocentric.
   */
  public isProjectedCRS(crs: string): boolean {
    // subclasses should override this method
    return false;
  }

  /**
   * Transform spatial bounds from one CRS to another.
   * @param point the point coordinate.
   * @param sourceCRS the source CRS.
   * @param targetCRS the target CRS.
   * @return the transformed bounds.
   */
  public transformBounds(
    bounds: Bounds,
    sourceCRS: string,
    targetCRS: string
  ): Bounds {
    // no real need to override this method in subclasses
    /* Create new bounds */
    let targetBounds: Bounds = new Bounds();
    if (bounds.isValid()) {
      /* Transform all 8 corners */
      let corner: Coordinate = Coordinate.create();
      for (let i: number = 0; i < 8; i++) {
        bounds.getCorner(i, corner);
        targetBounds.add(this.transformPoint(corner, sourceCRS, targetCRS));
      }
    }
    /* Return the target bounds */
    return targetBounds;
  }
}
