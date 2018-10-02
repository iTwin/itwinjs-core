/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d, Vector3d } from "../geometry3d/PointVector";
import { Range3d } from "../geometry3d/Range";
import { Transform, Matrix3d } from "../geometry3d/Transform";
import { GeometryQuery } from "../curve/GeometryQuery";
import { Geometry } from "../Geometry";
import { GeometryHandler, UVSurface } from "../geometry3d/GeometryHandler";
import { SolidPrimitive } from "./SolidPrimitive";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Loop } from "../curve/Loop";
import { CurveCollection } from "../curve/CurveCollection";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";

import { Arc3d } from "../curve/Arc3d";
import { LineString3d } from "../curve/LineString3d";
/**
 * A cone with axis along the z axis of a (possibly skewed) local coordinate system.
 *
 * * In local coordinates, the sections at z=0 and z=1 are circles of radius r0 and r1.
 * * Either one individually  may be zero, but they may not both be zero.
 * * The stored matrix has unit vectors in the xy columns, and full-length z column.
 * *
 */
export class Cone extends SolidPrimitive implements UVSurface {
  private _localToWorld: Transform;       // Transform from local to global.
  private _radiusA: number;    // nominal radius at z=0.  skewed axes may make it an ellipse
  private _radiusB: number;    // radius at z=1.  skewed axes may make it an ellipse
  private _maxRadius: number; // maximum radius anywhere on the cone.
  protected constructor(map: Transform, radiusA: number, radiusB: number, capped: boolean) {
    super(capped);
    this._localToWorld = map;
    this._radiusA = radiusA;
    this._radiusB = radiusB;
    this._maxRadius = Math.max(this._radiusA, this._radiusB);  // um... should resolve elliptical sections
  }
  public clone(): Cone {
    return new Cone(this._localToWorld.clone(), this._radiusA, this._radiusB, this.capped);
  }
  /** Return a coordinate frame (right handed unit vectors)
   * * origin at center of the base circle.
   * * base circle in the xy plane
   * * z axis by right hand rule.
   */
  public getConstructiveFrame(): Transform | undefined {
    return this._localToWorld.cloneRigid();
  }
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this._localToWorld, this._localToWorld);
    return true;
  }
  public cloneTransformed(transform: Transform): Cone | undefined {
    const result = this.clone();
    transform.multiplyTransformTransform(result._localToWorld, result._localToWorld);
    return result;
  }
  /** create a cylinder or cone from two endpoints and their radii.   The circular cross sections are perpendicular to the axis line
   * from start to end point.
   */
  public static createAxisPoints(centerA: Point3d, centerB: Point3d, radiusA: number, radiusB: number, capped: boolean): Cone | undefined {
    const zDirection = centerA.vectorTo(centerB);
    const a = zDirection.magnitude();
    if (Geometry.isSmallMetricDistance(a)) return undefined;
    // force near-zero radii to true zero
    radiusA = Math.abs(Geometry.correctSmallMetricDistance(radiusA));
    radiusB = Math.abs(Geometry.correctSmallMetricDistance(radiusB));
    // cone tip may not be "within" the z range.
    if (radiusA * radiusB < 0.0) return undefined;
    // at least one must be nonzero.
    if (radiusA + radiusB === 0.0) return undefined;
    const matrix = Matrix3d.createRigidHeadsUp(zDirection);
    matrix.scaleColumns(1.0, 1.0, a, matrix);
    const localToWorld = Transform.createOriginAndMatrix(centerA, matrix);
    return new Cone(localToWorld, radiusA, radiusB, capped);
  }
  /** create a cylinder or cone from axis start and end with cross section defined by vectors that do not need to be perpendicular to each other or
   * to the axis.
   */
  public static createBaseAndTarget(centerA: Point3d, centerB: Point3d, vectorX: Vector3d, vectorY: Vector3d, radiusA: number, radiusB: number, capped: boolean) {
    radiusA = Math.abs(Geometry.correctSmallMetricDistance(radiusA));
    radiusB = Math.abs(Geometry.correctSmallMetricDistance(radiusB));
    const vectorZ = centerA.vectorTo(centerB);
    const localToWorld = Transform.createOriginAndMatrixColumns(centerA, vectorX, vectorY, vectorZ);
    return new Cone(localToWorld, radiusA, radiusB, capped);
  }

  public getCenterA(): Point3d { return this._localToWorld.multiplyXYZ(0, 0, 0); }
  public getCenterB(): Point3d { return this._localToWorld.multiplyXYZ(0, 0, 1); }
  public getVectorX(): Vector3d { return this._localToWorld.matrix.columnX(); }
  public getVectorY(): Vector3d { return this._localToWorld.matrix.columnY(); }
  public getRadiusA(): number { return this._radiusA; }
  public getRadiusB(): number { return this._radiusB; }
  public getMaxRadius(): number { return this._maxRadius; }
  public vFractionToRadius(v: number): number { return Geometry.interpolate(this._radiusA, v, this._radiusB); }
  public isSameGeometryClass(other: any): boolean { return other instanceof Cone; }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof Cone) {
      if (this.capped !== other.capped) return false;
      if (!this._localToWorld.isAlmostEqual(other._localToWorld)) return false;
      return Geometry.isSameCoordinate(this._radiusA, other._radiusA)
        && Geometry.isSameCoordinate(this._radiusB, other._radiusB);
    }
    return false;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleCone(this);
  }
  /**
   *  return strokes for a cross-section (elliptic arc) at specified fraction v along the axis.
   * @param v fractional position along the cone axis
   * @param strokes stroke count or options.
   */
  public strokeConstantVSection(v: number, strokes: number | StrokeOptions | undefined): LineString3d {
    let strokeCount = 16;
    if (strokes === undefined) {
      // accept the default above.
    } else if (strokes instanceof Number) {
      strokeCount = strokes as number;
    } else if (strokes instanceof StrokeOptions) {
      strokeCount = strokes.defaultCircleStrokes;   // NEEDS WORK -- get circle stroke count with this.maxRadius !!!
    }
    strokeCount = Geometry.clampToStartEnd(strokeCount, 4, 64);
    const r = this.vFractionToRadius(v);
    const result = LineString3d.create();
    const deltaRadians = Math.PI * 2.0 / strokeCount;
    let radians = 0;
    const transform = this._localToWorld;
    for (let i = 0; i <= strokeCount; i++) {
      if (i * 2 <= strokeCount)
        radians = i * deltaRadians;
      else
        radians = (i - strokeCount) * deltaRadians;
      const xyz = transform.multiplyXYZ(r * Math.cos(radians), r * Math.sin(radians), v);
      result.addPoint(xyz);
    }
    return result;
  }
  /**
   * @returns Return the Arc3d section at vFraction
   * @param vFraction fractional position along the sweep direction
   */
  public constantVSection(vFraction: number): CurveCollection | undefined {
    const r = this.vFractionToRadius(vFraction);
    const transform = this._localToWorld;
    const center = transform.multiplyXYZ(0, 0, vFraction);
    const vector0 = transform.matrix.multiplyXYZ(r, 0, 0);
    const vector90 = transform.matrix.multiplyXYZ(0, r, 0);
    return Loop.create(Arc3d.create(center, vector0, vector90) as Arc3d);
  }
  public extendRange(range: Range3d, transform?: Transform): void {
    const arc0 = this.constantVSection(0.0)!;
    const arc1 = this.constantVSection(1.0)!;
    arc0.extendRange(range, transform);
    arc1.extendRange(range, transform);
  }

  public UVFractionToPoint(uFraction: number, vFraction: number, result?: Point3d): Point3d {
    const theta = uFraction * Math.PI * 2.0;
    const r = Geometry.interpolate(this._radiusA, vFraction, this._radiusB);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    return this._localToWorld.multiplyXYZ(r * cosTheta, r * sinTheta, vFraction, result);
  }
  public UVFractionToPointAndTangents(uFraction: number, vFraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const theta = uFraction * Math.PI * 2.0;
    const r = Geometry.interpolate(this._radiusA, vFraction, this._radiusB);
    const drdv = this._radiusB - this._radiusA;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const fTheta = 2.0 * Math.PI;
    return Plane3dByOriginAndVectors.createOriginAndVectors(
      this._localToWorld.multiplyXYZ(r * cosTheta, r * sinTheta, vFraction),
      this._localToWorld.multiplyVectorXYZ(-r * sinTheta * fTheta, r * cosTheta * fTheta, 0),
      this._localToWorld.multiplyVectorXYZ(drdv * cosTheta, drdv * sinTheta, 1.0),
      result);
  }
}
