/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
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
    if (transform.matrix.isSingular())
      return false;
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
   * * both radii must be of the same sign.
   * * negative radius is accepted to create interior surface.    Downstream effects of that combined with capping may be a problem.
   */
  public static createAxisPoints(centerA: Point3d, centerB: Point3d, radiusA: number, radiusB: number, capped: boolean): Cone | undefined {
    const zDirection = centerA.vectorTo(centerB);
    const a = zDirection.magnitude();
    if (Geometry.isSmallMetricDistance(a)) return undefined;
    // force near-zero radii to true zero
    radiusA = Geometry.correctSmallMetricDistance(radiusA);
    radiusB = Geometry.correctSmallMetricDistance(radiusB);
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
   * * fixedStrokeCount takes priority over stroke options.
   * * The linestring is created by LineString3d.createForStrokes (fixedStrokeCount, options), which sets up property according to the options:
   *   * optional fractions member
   *   * optional uvParams.  uvParams are installed as full-scale distance parameters.
   *   * optional derivatives.
   * @param v fractional position along the cone axis
   * @param fixedStrokeCount optional stroke count.
   * @param options optional stroke options.
   */
  public strokeConstantVSection(v: number, fixedStrokeCount: number | undefined, options: StrokeOptions | undefined): LineString3d {
    let strokeCount = 16;
    if (fixedStrokeCount !== undefined)
      strokeCount = fixedStrokeCount;
    else if (options !== undefined)
      strokeCount = options.defaultCircleStrokes;   // NEEDS WORK -- get circle stroke count with this.maxRadius !!!
    else {
      // accept the local default
    }
    strokeCount = Geometry.clampToStartEnd(strokeCount, 4, 64);
    const r = this.vFractionToRadius(v);
    const result = LineString3d.createForStrokes(fixedStrokeCount, options);
    const twoPi = Math.PI * 2.0;
    const deltaRadians = twoPi / strokeCount;
    let radians = 0;
    const fractions = result.fractions;     // possibly undefined !!!
    const derivatives = result.packedDerivatives; // possibly undefined !!!
    const uvParams = result.packedUVParams; // possibly undefined !!
    const xyz = Point3d.create();
    const uvw = Vector3d.create();
    const transform = this._localToWorld;
    let rc, rs;
    for (let i = 0; i <= strokeCount; i++) {
      if (i * 2 <= strokeCount)
        radians = i * deltaRadians;
      else
        radians = (i - strokeCount) * deltaRadians;
      rc = r * Math.cos(radians);
      rs = r * Math.sin(radians);
      transform.multiplyXYZ(rc, rs, v, xyz);
      result.addPoint(xyz);
      if (fractions)
        fractions.push(i / strokeCount);
      if (derivatives) {
        transform.matrix.multiplyXYZ(-rs * twoPi, rc * twoPi, 0.0, uvw);
        derivatives.push(uvw);
      }
      if (uvParams) {
        uvParams.pushXY(rc, rs);
      }
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

  public uvFractionToPoint(uFraction: number, vFraction: number, result?: Point3d): Point3d {
    const theta = uFraction * Math.PI * 2.0;
    const r = Geometry.interpolate(this._radiusA, vFraction, this._radiusB);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    return this._localToWorld.multiplyXYZ(r * cosTheta, r * sinTheta, vFraction, result);
  }
  public uvFractionToPointAndTangents(uFraction: number, vFraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
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
