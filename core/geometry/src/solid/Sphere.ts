/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d, Vector3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform, Matrix3d } from "../Transform";

import { GeometryQuery } from "../curve/CurvePrimitive";
import { StrokeOptions } from "../curve/StrokeOptions";

import { Geometry, AngleSweep } from "../Geometry";
import { GeometryHandler, UVSurface } from "../GeometryHandler";
import { SolidPrimitive } from "./SolidPrimitive";
import { Loop, CurveCollection } from "../curve/CurveChain";
import { Arc3d } from "../curve/Arc3d";
import { LineString3d } from "../curve/LineString3d";
import { Plane3dByOriginAndVectors } from "../AnalyticGeometry";
/**
 * A Sphere is
 *
 * * A unit sphere (but read on ....)
 * * mapped by an arbitrary (possibly skewed, non-uniform scaled) transform
 * * hence possibly the final geometry is ellipsoidal
 */
export class Sphere extends SolidPrimitive implements UVSurface {
  private _localToWorld: Transform;  // unit sphere maps to world through the transform0 part of this map.
  private _latitudeSweep: AngleSweep;
  /** Return the latitude (in radians) all fractional v. */
  public vFractionToRadians(v: number): number {
    return this._latitudeSweep.fractionToRadians(v);
  }
  /** Return the longitude (in radians) all fractional u. */
  public uFractionToRadians(u: number): number {
    return u * Math.PI * 2.0;
  }

  private constructor(localToWorld: Transform, latitudeSweep: AngleSweep, capped: boolean) {
    super(capped);
    this._localToWorld = localToWorld;
    this._latitudeSweep = latitudeSweep ? latitudeSweep : AngleSweep.createFullLatitude();
  }
  public clone(): Sphere {
    return new Sphere(this._localToWorld.clone(), this._latitudeSweep.clone(), this.capped);
  }
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this._localToWorld, this._localToWorld);
    return true;
  }
  public cloneTransformed(transform: Transform): Sphere | undefined {
    const sphere1 = this.clone();
    transform.multiplyTransformTransform(sphere1._localToWorld, sphere1._localToWorld);
    return sphere1;
  }
  /** Return a coordinate frame (right handed, unit axes)
   * * origin at sphere center
   * * equator in xy plane
   * * z axis perpendicular
   */
  public getConstructiveFrame(): Transform | undefined {
    return this._localToWorld.cloneRigid();
  }

  public static createCenterRadius(center: Point3d, radius: number, latitudeSweep?: AngleSweep): Sphere {
    const localToWorld = Transform.createOriginAndMatrix(center, Matrix3d.createUniformScale(radius));
    return new Sphere(localToWorld,
      latitudeSweep ? latitudeSweep : AngleSweep.createFullLatitude(), false);
  }
  /** Create an ellipsoid which is a unit sphere mapped to position by an (arbitrary, possibly skewed and scaled) transform. */
  public static createEllipsoid(localToWorld: Transform, latitudeSweep: AngleSweep, capped: boolean): Sphere | undefined {
    return new Sphere(localToWorld, latitudeSweep, capped);
  }

  /** Create a sphere from the typical parameters of the Dgn file */
  public static createDgnSphere(center: Point3d, vectorX: Vector3d, vectorZ: Vector3d, radiusXY: number, radiusZ: number,
    latitudeSweep: AngleSweep,
    capped: boolean): Sphere | undefined {
    const vectorY = vectorX.rotate90Around(vectorZ);
    if (vectorY) {
      const matrix = Matrix3d.createColumns(vectorX, vectorY, vectorZ);
      matrix.scaleColumns(radiusXY, radiusXY, radiusZ, matrix);
      const frame = Transform.createOriginAndMatrix(center, matrix);
      return new Sphere(frame, latitudeSweep.clone(), capped);
    }
    return undefined;
  }

  /** Create a sphere from the typical parameters of the Dgn file */
  public static createFromAxesAndScales(center: Point3d, axes: undefined | Matrix3d, radiusX: number, radiusY: number, radiusZ: number,
    latitudeSweep: AngleSweep | undefined,
    capped: boolean): Sphere | undefined {
    const localToWorld = Transform.createOriginAndMatrix(center, axes);
    localToWorld.matrix.scaleColumnsInPlace(radiusX, radiusY, radiusZ);
    return new Sphere(localToWorld, latitudeSweep ? latitudeSweep.clone() : AngleSweep.createFullLatitude(), capped);
  }

  /** return (copy of) sphere center */
  public cloneCenter(): Point3d { return this._localToWorld.getOrigin(); }
  /** return the (full length, i.e. scaled by radius) X vector from the sphere transform */
  public cloneVectorX(): Vector3d { return this._localToWorld.matrix.columnX(); }
  /** return the (full length, i.e. scaled by radius) Y vector from the sphere transform */
  public cloneVectorY(): Vector3d { return this._localToWorld.matrix.columnY(); }
  /** return the (full length, i.e. scaled by radius) Z vector from the sphere transform */
  public cloneVectorZ(): Vector3d { return this._localToWorld.matrix.columnZ(); }
  /** return (a copy of) the sphere's angle sweep. */
  public cloneLatitudeSweep(): AngleSweep { return this._latitudeSweep.clone(); }
  public trueSphereRadius(): number | undefined {
    const factors = this._localToWorld.matrix.factorRigidWithSignedScale();
    if (!factors) return undefined;
    if (factors && factors.scale > 0)
      return factors.scale;
    return undefined;
  }
  /**
   * @returns Return a (clone of) the sphere's local to world transformation.
   */
  public cloneLocalToWorld(): Transform { return this._localToWorld.clone(); }
  public isSameGeometryClass(other: any): boolean { return other instanceof Sphere; }

  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof Sphere) {
      if (this.capped !== other.capped) return false;
      if (!this._localToWorld.isAlmostEqual(other._localToWorld)) return false;
      return true;
    }
    return false;
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
    const phi = this.vFractionToRadians(v);
    const c1 = Math.cos(phi);
    const s1 = Math.sin(phi);
    const result = LineString3d.create();
    const deltaRadians = Math.PI * 2.0 / strokeCount;
    let radians = 0;
    const transform = this._localToWorld;
    for (let i = 0; i <= strokeCount; i++) {
      if (i * 2 <= strokeCount)
        radians = i * deltaRadians;
      else
        radians = (i - strokeCount) * deltaRadians;
      const xyz = transform.multiplyXYZ(c1 * Math.cos(radians), c1 * Math.sin(radians), s1);
      result.addPoint(xyz);
    }
    return result;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleSphere(this);
  }
  /**
   * @returns Return the Arc3d section at vFraction.  For the sphere, this is a latitude circle.
   * @param vFraction fractional position along the sweep direction
   */
  public constantVSection(vFraction: number): CurveCollection | undefined {
    const phi = this._latitudeSweep.fractionToRadians(vFraction);
    const s1 = Math.sin(phi);
    const c1 = Math.cos(phi);
    const transform = this._localToWorld;
    const center = transform.multiplyXYZ(0, 0, s1);
    const vector0 = transform.matrix.multiplyXYZ(c1, 0, 0);
    const vector90 = transform.matrix.multiplyXYZ(0, c1, 0);
    return Loop.create(Arc3d.create(center, vector0, vector90) as Arc3d);
  }

  public extendRange(range: Range3d, transform?: Transform): void {
    let placement = this._localToWorld;
    if (transform) {
      placement = transform.multiplyTransformTransform(placement);
    }

    range.extendTransformedXYZ(placement, -1, -1, -1);
    range.extendTransformedXYZ(placement, 1, -1, -1);
    range.extendTransformedXYZ(placement, -1, 1, -1);
    range.extendTransformedXYZ(placement, 1, 1, -1);

    range.extendTransformedXYZ(placement, -1, -1, 1);
    range.extendTransformedXYZ(placement, 1, -1, 1);
    range.extendTransformedXYZ(placement, -1, 1, 1);
    range.extendTransformedXYZ(placement, 1, 1, 1);

  }
  /** Evaluate as a uv surface
   * @param uFraction fractional position in minor (phi)
   * @param vFraction fractional position on major (theta) arc
   */
  public UVFractionToPoint(uFraction: number, vFraction: number, result?: Point3d): Point3d {
    // sphere with radius 1 . . .
    const thetaRadians = this.uFractionToRadians(uFraction);
    const phiRadians = this.vFractionToRadians(vFraction);
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const sinPhi = Math.sin(phiRadians);
    const cosPhi = Math.cos(phiRadians);
    return this._localToWorld.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi, result);
  }
  /** Evaluate as a uv surface, returning point and two vectors.
   * @param u fractional position in minor (phi)
   * @param v fractional position on major (theta) arc
   */
  public UVFractionToPointAndTangents(uFraction: number, vFraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const thetaRadians = this.uFractionToRadians(uFraction);
    const phiRadians = this.vFractionToRadians(vFraction);
    const fTheta = Math.PI * 2.0;
    const fPhi = this._latitudeSweep.sweepRadians;
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const sinPhi = Math.sin(phiRadians);
    const cosPhi = Math.cos(phiRadians);
    return Plane3dByOriginAndVectors.createOriginAndVectors(
      this._localToWorld.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi),
      this._localToWorld.multiplyVectorXYZ(-fTheta * sinTheta * cosPhi, fTheta * cosTheta * cosPhi, 0),
      this._localToWorld.multiplyVectorXYZ(-fPhi * cosTheta * sinPhi, -fPhi * sinTheta, fPhi * cosPhi),
      result);
  }
}
