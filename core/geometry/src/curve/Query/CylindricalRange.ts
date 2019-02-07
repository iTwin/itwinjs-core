/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { GeometryQuery } from "../GeometryQuery";
import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";

import { LineSegment3d } from "../LineSegment3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { LineString3d } from "../LineString3d";
import { Range1d, Range2d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { StrokeOptions } from "../StrokeOptions";
import { Arc3d } from "../Arc3d";
import { Ray3d } from "../../geometry3d/Ray3d";

/**
 * Context for computing geometry range around an axis.
 * * The publicly called method is `computeZRRange (ray, geometry)
 */
export class CylindricalRange extends RecurseToCurvesGeometryHandler {
  // private geometry0: GeometryQuery;  <-- Never used
  private _axisRange: Range1d;
  private _radialRange: Range1d;
  private _localToWorld: Transform;
  /** capture ray and initialize evolving ranges. */
  private constructor(ray: Ray3d) {
    super();
    this._axisRange = Range1d.createNull();
    this._radialRange = Range1d.createNull();
    this._localToWorld = ray.toRigidZFrame()!;
  }
  private _localPoint = Point3d.create();
  private _worldPoint = Point3d.create();
  private announcePoint(xyz: Point3d) {
    this._localToWorld.multiplyInversePoint3d(xyz, this._localPoint);
    this._axisRange.extendX(this._localPoint.z);
    this._radialRange.extendX(this._localPoint.magnitudeXY());
  }

  public handleLineSegment3d(segment0: LineSegment3d) {
    this.announcePoint(segment0.startPoint(this._worldPoint));
    this.announcePoint(segment0.endPoint(this._worldPoint));
  }
  public handleLineString3d(ls0: LineString3d) {
    for (let i = 0; i < ls0.numPoints(); i++) {
      ls0.pointAt(i, this._worldPoint);
      this.announcePoint(this._worldPoint);
    }
  }

  public handleArc3d(arc0: Arc3d): any {
    // humbug .. just stroke it ..
    // exact solution is:
    //   project the arc to the z=0 plane of the local system.
    //   find max distance to origin.
    const numStroke = StrokeOptions.applyAngleTol(undefined, 3, arc0.sweep.sweepRadians, 0.1);
    const df = 1.0 / numStroke;
    for (let i = 0; i <= numStroke; i++) {
      arc0.fractionToPoint(i * df, this._worldPoint);
      this.announcePoint(this._worldPoint);
    }
    return undefined;
  }

  /**
   * Compute range of geometry measured along and away from a ray.
   * * In the returned range
   *   * x is range along the ray
   *   * y is range of radial distance away from the ray.
   * @param geometry0 geometry to search
   */
  public static computeZRRange(ray: Ray3d, geometry: GeometryQuery): Range2d {
    const accumulator = new CylindricalRange(ray);
    geometry.dispatchToGeometryHandler(accumulator);
    const range = Range2d.createXYXY(
      accumulator._axisRange.low, accumulator._radialRange.low,
      accumulator._axisRange.high, accumulator._radialRange.high);
    return range;
  }
}
