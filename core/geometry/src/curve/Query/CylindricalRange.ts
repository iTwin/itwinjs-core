/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { GeometryQuery } from "../GeometryQuery";
import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";

import { LineSegment3d } from "../LineSegment3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { LineString3d } from "../LineString3d";
import { Transform } from "../../geometry3d/Transform";
import { StrokeOptions } from "../StrokeOptions";
import { Arc3d } from "../Arc3d";
import { Ray3d } from "../../geometry3d/Ray3d";
import { AnyCurve } from "../CurveChain";

/**
 * Context for computing geometry range around an axis.
 * * The publicly called method is `computeZRRange (ray, geometry)
 */
export class CylindricalQuery extends RecurseToCurvesGeometryHandler {
  // private geometry0: GeometryQuery;  <-- Never used
  private _perpVector: Vector3d;
  private _maxDistance: number;
  private _localToWorld: Transform;
  /** capture ray and initialize evolving ranges. */
  private constructor(ray: Ray3d) {
    super();
    this._perpVector = Vector3d.createZero();
    this._maxDistance = 0.0;
    this._localToWorld = ray.toRigidZFrame()!;
  }
  private _localPoint = Point3d.create();
  private _worldPoint = Point3d.create();
  private announcePoint(xyz: Point3d) {
    this._localToWorld.multiplyInversePoint3d(xyz, this._localPoint);
    const distance = this._localPoint.magnitudeXY();
    if (distance >= this._maxDistance) {
      this._maxDistance = distance;
      this._perpVector.setFromPoint3d(this._localPoint);
      this._perpVector.z = 0.0;
      this._localToWorld.matrix.multiplyXY(this._localPoint.x, this._localPoint.y, this._perpVector);
    }
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
   * Compute the largest vector perpendicular to a ray and ending on the geometry.
   * @param geometry0 geometry to search
   * @returns vector from ray to geometry.
   */
  public static computeMaxVectorFromRay(ray: Ray3d, geometry: GeometryQuery): Vector3d {
    const accumulator = new CylindricalQuery(ray);
    geometry.dispatchToGeometryHandler(accumulator);
    return accumulator._perpVector.clone();
  }

  /**
   * Recurse through geometry.children to find linestrings.
   * In each linestring, compute the surface normal annotation from
   *  * the curve tangent stored in the linestring
   *  * the axis of rotation
   *  * a default V vector to be used when the linestring point is close to the axis.
   * @param geometry
   * @param axis
   * @param defaultVectorV
   */
  public static buildRotationalNormalsInLineStrings(geometry: AnyCurve, axis: Ray3d, defaultVectorFromAxis: Vector3d) {
    if (geometry instanceof LineString3d) {
      const points = geometry.packedPoints;
      const derivatives = geometry.packedDerivatives;
      const normals = geometry.ensureEmptySurfaceNormals();
      if (derivatives && normals) {
        const vectorU = Vector3d.create();
        const vectorV = Vector3d.create();  // v direction (forwward along sweep) for surface of rotation.
        const xyz = Point3d.create();
        const n = points.length;
        for (let i = 0; i < n; i++) {
          points.getPoint3dAt(i, xyz);
          axis.perpendicularPartOfVectorToTarget(xyz, vectorU);
          if (vectorU.isAlmostZero)
            axis.direction.crossProduct(defaultVectorFromAxis, vectorV);
          else
            axis.direction.crossProduct(vectorU, vectorV);
          geometry.packedDerivatives!.atVector3dIndex(i, vectorU); // reuse vector U as curve derivative
          vectorU.crossProduct(vectorV, vectorV);  // reuse vector V as normal!
          vectorV.normalizeInPlace();
          normals.push(vectorV);
        }
      }
    } else if (geometry.children) {
      const children = geometry.children;
      for (const child of children) {
        this.buildRotationalNormalsInLineStrings(child as AnyCurve, axis, defaultVectorFromAxis);
      }
    }
  }
}
