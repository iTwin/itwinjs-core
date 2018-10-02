/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d, Vector3d } from "../geometry3d/PointVector";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";

import { GeometryQuery } from "../curve/GeometryQuery";
import { Geometry } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Angle } from "../geometry3d/Angle";
import { GeometryHandler, UVSurface } from "../geometry3d/GeometryHandler";
import { SolidPrimitive } from "./SolidPrimitive";
import { Loop } from "../curve/Loop";
import { Path } from "../curve/Path";
import { CurveCollection } from "../curve/CurveCollection";
import { Arc3d } from "../curve/Arc3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
/**
 * the stored form of the torus pipe is oriented for positive volume:
 *
 * * Both radii are positive, with r0 >= r1 > 0
 * * The sweep is positive
 * * The coordinate system has positive determinant.
 */
export class TorusPipe extends SolidPrimitive implements UVSurface {
  private _localToWorld: Transform;
  private _radiusA: number;  // radius of (large) circle in xy plane
  private _radiusB: number;  // radius of (small) circle in xz plane.
  private _sweep: Angle;
  private _isReversed: boolean;

  protected constructor(map: Transform, radiusA: number, radiusB: number, sweep: Angle, capped: boolean) {
    super(capped);
    this._localToWorld = map;
    this._radiusA = radiusA;
    this._radiusB = radiusB;
    this._sweep = sweep;
    this._isReversed = false;
  }

  public clone(): TorusPipe {
    const result = new TorusPipe(this._localToWorld.clone(), this._radiusA, this._radiusB, this._sweep.clone(), this.capped);
    result._isReversed = this._isReversed;
    return result;
  }

  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this._localToWorld, this._localToWorld);
    return true;
  }

  public cloneTransformed(transform: Transform): TorusPipe | undefined {
    const result = this.clone();
    transform.multiplyTransformTransform(result._localToWorld, result._localToWorld);
    return result;
  }

  public static createInFrame(frame: Transform, majorRadius: number, minorRadius: number, sweep: Angle, capped: boolean): TorusPipe | undefined {
    // force near-zero radii to true zero
    majorRadius = Math.abs(Geometry.correctSmallMetricDistance(majorRadius));
    minorRadius = Math.abs(Geometry.correctSmallMetricDistance(minorRadius));
    if (majorRadius < minorRadius) return undefined;
    if (majorRadius === 0.0) return undefined;
    if (minorRadius === 0.0) return undefined;

    if (sweep.isAlmostZero) return undefined;
    const xScale = 1.0;
    let yScale = 1.0;
    let zScale = 1.0;
    if (frame.matrix.determinant() < 0.0) zScale *= -1.0;
    let isReversed = false;
    const sweep1 = sweep.clone();
    if (sweep.radians < 0.0) {
      sweep1.setRadians(-sweep.radians);
      zScale *= -1.0;
      yScale *= -1.0;
      isReversed = true;
    }
    const frame1 = frame.clone();
    frame1.matrix.scaleColumns(xScale, yScale, zScale, frame1.matrix);
    const result = new TorusPipe(frame1, majorRadius, minorRadius, sweep1, capped);
    result._isReversed = isReversed;
    return result;
  }

  /** Create a TorusPipe from the typical parameters of the Dgn file */
  public static createDgnTorusPipe(center: Point3d, vectorX: Vector3d, vectorY: Vector3d, majorRadius: number, minorRadius: number,
    sweep: Angle, capped: boolean) {
    const vectorZ = vectorX.crossProduct(vectorY);
    vectorZ.scaleToLength(vectorX.magnitude(), vectorZ);
    const frame = Transform.createOriginAndMatrixColumns(center, vectorX, vectorY, vectorZ);
    return TorusPipe.createInFrame(frame, majorRadius, minorRadius, sweep, capped);
  }
  /** Return a coordinate frame (right handed, unit axes)
   * * origin at center of major circle
   * * major circle in xy plane
   * * z axis perpendicular
   */
  public getConstructiveFrame(): Transform | undefined {
    return this._localToWorld.cloneRigid();
  }
  public cloneCenter(): Point3d { return this._localToWorld.getOrigin(); }
  public cloneVectorX(): Vector3d { return this._localToWorld.matrix.columnX(); }
  public cloneVectorY(): Vector3d { return this._localToWorld.matrix.columnY(); }
  public getMinorRadius(): number { return this._radiusB; }
  public getMajorRadius(): number { return this._radiusA; }
  public getSweepAngle(): Angle { return this._sweep.clone(); }
  public getIsReversed(): boolean { return this._isReversed; }
  public getThetaFraction(): number { return this._sweep.radians / (Math.PI * 2.0); }
  public isSameGeometryClass(other: any): boolean { return other instanceof TorusPipe; }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof TorusPipe) {
      if (this.capped !== other.capped) return false;
      if (!this._localToWorld.isAlmostEqual(other._localToWorld)) return false;
      return Geometry.isSameCoordinate(this._radiusA, other._radiusA)
        && Geometry.isSameCoordinate(this._radiusB, other._radiusB)
        && this._sweep.isAlmostEqualNoPeriodShift(other._sweep);
    }
    return false;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleTorusPipe(this);
  }

  /**
   * @returns Return the Arc3d section at vFraction.  For the TorusPipe, this is a minor circle.
   * @param vFraction fractional position along the sweep direction
   */
  public constantVSection(vFraction: number): CurveCollection | undefined {
    const thetaRadians = this._sweep.radians * vFraction;
    const c0 = Math.cos(thetaRadians);
    const s0 = Math.sin(thetaRadians);
    const majorRadius = this.getMajorRadius();
    const minorRadius = this.getMinorRadius();

    const center = this._localToWorld.multiplyXYZ(majorRadius * c0, majorRadius * s0, 0);
    const vector0 = this._localToWorld.multiplyVectorXYZ(minorRadius * c0, minorRadius * s0, 0);
    const vector90 = this._localToWorld.multiplyVectorXYZ(0, 0, minorRadius);
    return Loop.create(Arc3d.create(center, vector0, vector90) as Arc3d);
  }
  public constantUSection(uFraction: number): CurveCollection | undefined {
    const theta1Radians = this._sweep.radians;
    const phiRadians = uFraction * Math.PI;

    const majorRadius = this.getMajorRadius();
    const minorRadius = this.getMinorRadius();
    const transform = this._localToWorld;
    const axes = transform.matrix;
    const center = this._localToWorld.multiplyXYZ(0, 0, minorRadius * Math.sin(phiRadians));
    const rxy = majorRadius + minorRadius * Math.cos(phiRadians);
    const vector0 = axes.multiplyXYZ(rxy, 0, 0);
    const vector90 = axes.multiplyXYZ(0, rxy, 0);
    return Path.create(Arc3d.create(center, vector0, vector90, AngleSweep.createStartEndRadians(0.0, theta1Radians)) as Arc3d);
  }
  public extendRange(range: Range3d, transform?: Transform) {
    const theta1Radians = this._sweep.radians;
    const majorRadius = this.getMajorRadius();
    const minorRadius = this.getMinorRadius();
    const transform0 = this._localToWorld;
    const numThetaSample = Math.ceil(theta1Radians / (Math.PI * 0.125));
    const numHalfPhiSample = 8;
    let phi0 = 0;
    let dphi = 0;
    let numPhiSample = 0;
    let theta = 0;
    let cosTheta = 0;
    let sinTheta = 0;
    let rxy = 0;
    let phi = 0;
    let j = 0;
    const dTheta = theta1Radians / numThetaSample;
    for (let i = 0; i <= numThetaSample; i++) {
      theta = i * dTheta;
      cosTheta = Math.cos(theta);
      sinTheta = Math.sin(theta);
      // At the ends, do the entire phi circle.
      // Otherwise only do the outer half
      if (i === 0 || i === numThetaSample) {
        phi0 = -Math.PI;
        dphi = 2.0 * Math.PI / numHalfPhiSample;
        numPhiSample = numHalfPhiSample;
      } else {
        phi0 = -0.5 * Math.PI;
        dphi = Math.PI / numHalfPhiSample;
        numPhiSample = 2 * numHalfPhiSample - 1;
      }
      if (transform) {
        for (j = 0; j <= numPhiSample; j++) {
          phi = phi0 + j * dphi;
          rxy = majorRadius + minorRadius * Math.cos(phi);
          range.extendTransformTransformedXYZ(transform, transform0,
            cosTheta * rxy, sinTheta * rxy,
            Math.sin(phi) * minorRadius);
        }
      } else {
        for (j = 0; j <= numPhiSample; j++) {
          phi = phi0 + j * dphi;
          rxy = majorRadius + minorRadius * Math.sin(phi);
          range.extendTransformedXYZ(transform0,
            cosTheta * rxy, sinTheta * rxy,
            Math.sin(phi) * minorRadius);
        }
      }
    }
  }
  /** Evaluate as a uv surface
   * @param u fractional position in minor (phi)
   * @param v fractional position on major (theta) arc
   */
  public UVFractionToPoint(u: number, v: number, result?: Point3d): Point3d {
    const thetaRadians = v * this._sweep.radians;
    const phiRadians = u * Math.PI * 2.0;
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const minorRadius = this.getMinorRadius();
    const rxy = this.getMajorRadius() + Math.cos(phiRadians) * minorRadius;
    return this._localToWorld.multiplyXYZ(rxy * cosTheta, rxy * sinTheta, minorRadius * Math.sin(phiRadians), result);
  }
  /** Evaluate as a uv surface, returning point and two vectors.
   * @param u fractional position in minor (phi)
   * @param v fractional position on major (theta) arc
   */
  public UVFractionToPointAndTangents(u: number, v: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const thetaRadians = v * this._sweep.radians;
    const phiRadians = u * Math.PI * 2.0;
    const fTheta = this._sweep.radians;
    const fPhi = Math.PI * 2.0;
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const sinPhi = Math.sin(phiRadians);
    const cosPhi = Math.cos(phiRadians);
    const minorRadius = this.getMinorRadius();
    const rxy = this.getMajorRadius() + Math.cos(phiRadians) * minorRadius;
    const rSinPhi = minorRadius * sinPhi;
    const rCosPhi = minorRadius * cosPhi;   // appears only as derivative of rSinPhi.
    return Plane3dByOriginAndVectors.createOriginAndVectors(
      this._localToWorld.multiplyXYZ(cosTheta * rxy, sinTheta * rxy, rSinPhi),
      this._localToWorld.multiplyVectorXYZ(-rxy * sinTheta * fTheta, rxy * cosTheta * fTheta, 0),
      this._localToWorld.multiplyVectorXYZ(-cosTheta * rSinPhi * fPhi, -sinTheta * rSinPhi * fPhi, rCosPhi * fPhi),
      result);
  }

}
