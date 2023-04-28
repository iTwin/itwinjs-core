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

import { Strings } from "../../system/runtime/Strings";
import { Bounds } from "../geom/Bounds";
import { Coordinate } from "../geom/Coordinate";
import { Transform } from "../geom/Transform";
import { CRSEngine } from "./CRSEngine";

/**
 * Class CRSManager defines the main access point to the CRS transformation engine.
 */
/** @internal */
export class CRSManager {
  /** The main instance of the CRS engine. This needs to be set by the application on startup. */
  public static ENGINE: CRSEngine = null;

  /**
   * Allow no instances, all methods are static.
   */
  private constructor() {}

  /**
   * Prepare a CRS for making transforms in a certain area.
   * @param crs the CRS to prepare.
   * @param area the area to prepare for (can be invalid to prepare only for the crs).
   */
  public static async prepareForArea(
    crs: string,
    area: Bounds
  ): Promise<Bounds> {
    if (CRSManager.ENGINE == null) return area;
    return CRSManager.ENGINE.prepareForArea(crs, area);
  }

  /**
   * Transform a coordinate from one CRS to another.
   * @param point the point coordinate.
   * @param sourceCRS the source CRS.
   * @param targetCRS the target CRS.
   * @return the transformed coordinate.
   */
  public static transformPoint(
    point: Coordinate,
    sourceCRS: string,
    targetCRS: string
  ): Coordinate {
    if (CRSManager.ENGINE == null) return point;
    return CRSManager.ENGINE.transformPoint(point, sourceCRS, targetCRS);
  }

  /**
   * Transform spatial bounds from one CRS to another.
   * @param point the point coordinate.
   * @param sourceCRS the source CRS.
   * @param targetCRS the target CRS.
   * @return the transformed bounds.
   */
  public static transformBounds(
    bounds: Bounds,
    sourceCRS: string,
    targetCRS: string
  ): Bounds {
    if (CRSManager.ENGINE == null) return bounds;
    return CRSManager.ENGINE.transformBounds(bounds, sourceCRS, targetCRS);
  }

  /**
   * Create an approximate 3D transformation from a source to a target CRS.
   * @param sourceCRS the source CRS.
   * @param sourcePoint the origin point in the source CRS.
   * @param targetCRS the target CRS.
   * @return the transform.
   */
  public static createTransform(
    sourceCRS: string,
    sourcePoint: Coordinate,
    targetCRS: string
  ): Transform {
    /* Check */
    let transform: Transform = new Transform();
    if (CRSManager.ENGINE == null) return transform;
    if (sourceCRS == null) return transform;
    if (targetCRS == null) return transform;
    if (sourcePoint == null) return transform;
    /* Same? */
    if (Strings.equals(targetCRS, sourceCRS)) return transform;
    /* Transform X and Y at 100 meter distance (assume Z is metric) */
    let sizeXY: float64 = 100.0;
    if (CRSManager.ENGINE.isGeographicCRS(sourceCRS))
      sizeXY = (sizeXY / 40000000.0) * 360.0;
    let sizeZ: float64 = 100.0;
    /* Create the frame */
    let p0: Coordinate = sourcePoint.copy();
    let pX: Coordinate = p0.copy();
    pX.add0(new Coordinate(sizeXY, 0.0, 0.0));
    let pY: Coordinate = p0.copy();
    pY.add0(new Coordinate(0.0, sizeXY, 0.0));
    let pZ: Coordinate = p0.copy();
    pZ.add0(new Coordinate(0.0, 0.0, sizeZ));
    /* Transform the frame */
    p0 = CRSManager.ENGINE.transformPoint(p0, sourceCRS, targetCRS);
    pX = CRSManager.ENGINE.transformPoint(pX, sourceCRS, targetCRS);
    pY = CRSManager.ENGINE.transformPoint(pY, sourceCRS, targetCRS);
    pZ = CRSManager.ENGINE.transformPoint(pZ, sourceCRS, targetCRS);
    /* Get the columns */
    let colX: Coordinate = pX.subtract(p0).scale(1.0 / sizeXY);
    let colY: Coordinate = pY.subtract(p0).scale(1.0 / sizeXY);
    let colZ: Coordinate = pZ.subtract(p0).scale(1.0 / sizeZ);
    /* Create the transform */
    transform = Transform.createWithColumns(colX, colY, colZ, p0);
    transform.translate(
      -sourcePoint.getX(),
      -sourcePoint.getY(),
      -sourcePoint.getZ()
    );
    return transform;
  }
}
