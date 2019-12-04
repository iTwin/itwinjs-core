/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Point3d } from "./Point3dVector3d";

import { Transform } from "./Transform";

import { SphereImplicit, SineCosinePolynomial } from "../numerics/Polynomials";
import { Ray3d } from "./Ray3d";
import { Matrix3d } from "./Matrix3d";
import { Point2d } from "./Point2dVector2d";
import { Range3d, Range1d } from "./Range";
import { AngleSweep } from "./AngleSweep";
import { AxisIndex } from "../Geometry";
import { Angle } from "./Angle";
import { UVSurface } from "./GeometryHandler";
import { Plane3dByOriginAndVectors } from "./Plane3dByOriginAndVectors";
import { CurveAndSurfaceLocationDetail, UVSurfaceLocationDetail } from "../bspline/SurfaceLocationDetail";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
/**
 * For one component (x,y, or z) on the sphere
 *    f(theta,phi) = c + (u * cos(theta) + v * sin(theta)) * cos(phi) + w * sin(phi)
 *
 * For the equator circle, phi=0, cos(phi) = 1, sin(phi)=0
 *           f = u * cos(theta) + v * sin(theta).
 * with derivative
 *          df / dTheta = = u * sin(theta) + v * cos(theta)
 * whose zero is            tan(theta) = v/u
 * (and that has two solutions 180 degrees apart)
 * Then with that theta let      A = u * cos(theta) + v * sin(theta)
 *           f = A * cos(phi) + w * sin(phi)
 *          df/dPhi = - A * sin(phi) + w * cos(phi)
 *            tan(phi) = w / A
 * @internal
 */
class EllipsoidComponentExtrema {
  public c: number;
  public u: number;
  public v: number;
  public w: number;
  public axisIndex: AxisIndex;
  public theta0Radians: number;
  public phi0Radians: number;
  public cosTheta0: number;
  public sinTheta0: number;
  public cosPhi0: number;
  public sinPhi0: number;
  // temp vars used in arc range evaluation:
  private _axisRange: Range1d;
  private _trigForm: SineCosinePolynomial;
  public constructor(c: number, u: number, v: number, w: number, axisIndex: AxisIndex) {
    this.c = c;
    this.u = u;
    this.v = v;
    this.w = w;
    this.axisIndex = axisIndex;
    this.theta0Radians = Math.atan2(v, u);
    this.cosTheta0 = Math.cos(this.theta0Radians);
    this.sinTheta0 = Math.sin(this.theta0Radians);
    const A0 = u * this.cosTheta0 + v * this.sinTheta0;
    this.phi0Radians = Math.atan2(w, A0);
    this.cosPhi0 = Math.cos(this.phi0Radians);
    this.sinPhi0 = Math.sin(this.phi0Radians);
    this._axisRange = Range1d.createNull();
    this._trigForm = new SineCosinePolynomial(0, 0, 0);

  }
  /**
   * Create a component object with coefficients from a row of a `Transform`.
   * @param transform source transform.
   * @param axisIndex row index within the transform.
   */
  public static createTransformRow(transform: Transform, axisIndex: AxisIndex): EllipsoidComponentExtrema {
    const matrix = transform.matrix;
    return new EllipsoidComponentExtrema(transform.origin.at(axisIndex), matrix.at(axisIndex, 0), matrix.at(axisIndex, 1), matrix.at(axisIndex, 2), axisIndex);
  }
  public extendRangeForSmoothSurfacePoints(range: Range3d, theta0Radians: number, theta1Radians: number, phi0Radians: number, phi1Radians: number) {
    const delta = (this.u * this.cosTheta0 + this.v * this.sinTheta0) * this.cosPhi0 + this.w * this.sinPhi0;
    if (AngleSweep.isRadiansInStartEnd(this.theta0Radians, theta0Radians, theta1Radians)
      && AngleSweep.isRadiansInStartEnd(this.phi0Radians, phi0Radians, phi1Radians, false)) {
      range.extendSingleAxis(this.c + delta, this.axisIndex);
    }
    const thetaRadians = this.theta0Radians + Math.PI;
    const phiRadians = -this.phi0Radians;
    if (AngleSweep.isRadiansInStartEnd(thetaRadians, theta0Radians, theta1Radians)
      && AngleSweep.isRadiansInStartEnd(phiRadians, phi0Radians, phi1Radians, false)) {
      // cosTheta and sinTheta are both negated
      // sinPhi is negated
      // delta is negated
      range.extendSingleAxis(this.c - delta, this.axisIndex);
    }
  }
  /**
   * Extend range to include extrema of a phi-bounded arc at constant theta (i.e. a polar circle)
   * @param range range to extend
   * @param thetaRadians theta for arc
   * @param phi0Radians limit value on arc sweep
   * @param phi1Radians limit value on arc sweep
   */
  public extendRangeForConstantThetaArc(range: Range3d, thetaRadians: number, phi0Radians: number, phi1Radians: number) {
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    this._trigForm.set(this.c, (this.u * cosTheta + this.v * sinTheta), this.w);
    this._trigForm.rangeInStartEndRadians(phi0Radians, phi1Radians, this._axisRange);
    range.extendSingleAxis(this._axisRange.low, this.axisIndex);
    range.extendSingleAxis(this._axisRange.high, this.axisIndex);
  }

  /**
   * Extend range to include extrema of a theta-bounded arc at constant phi (i.e. a circle parallel to the equator)
   * @param range range to extend
   * @param phiRadians phi for arc
   * @param theta0Radians limit value on arc sweep
   * @param theta1Radians limit value on arc sweep
   */
  public extendRangeForConstantPhiArc(range: Range3d, theta0Radians: number, theta1Radians: number, phiRadians: number) {
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    this._trigForm.set(this.c + this.w * sinPhi, this.u * cosPhi, this.v * cosPhi);
    this._trigForm.rangeInStartEndRadians(theta0Radians, theta1Radians, this._axisRange);
    range.extendSingleAxis(this._axisRange.low, this.axisIndex);
    range.extendSingleAxis(this._axisRange.high, this.axisIndex);
  }
}

/**
 * * An Ellipsoid is a (complete) unit sphere with an arbitrary (possibly skewed) `Transform` to 3d.
 * * The (unit) sphere parameterization with respect to longitude `theta` and latitude `phi` is
 *    * `u = cos(theta) * cos (phi)`
 *    * `v = sin(theta) * cos(phi)`
 *    * `w = sin(phi)`
 *  * The sphere (u,v,w) multiply the x,y,z columns of the Ellipsoid transform.
 * @internal
 */
export class Ellipsoid {
  private _transform: Transform;
  private constructor(transform: Transform) {
    this._transform = transform;
  }
  /** Create with a clone (not capture) with given transform.
   */
  public static create(transform: Transform): Ellipsoid {
    return new Ellipsoid(transform.clone());
  }
  /**
   * Create a transform with given center and directions, applying the radii as multipliers for the respective columns of the axes.
   * @param center center of ellipsoid
   * @param axes x,y,z directions are columns of this matrix
   * @param radiusX multiplier to be applied to the x direction
   * @param radiusY multiplier to be applied to the y direction
   * @param radiusZ  multiplier to be applied to the z direction
   */
  public static createCenterMatrixRadii(center: Point3d, axes: Matrix3d, radiusX: number, radiusY: number, radiusZ: number): Ellipsoid {
    const scaledAxes = axes.scaleColumns(radiusX, radiusY, radiusZ);
    return new Ellipsoid(Transform.createOriginAndMatrix(center, scaledAxes));
  }

  /** return a clone with same coordinates */
  public clone(): Ellipsoid {
    return new Ellipsoid(this._transform.clone());
  }
  /** test equality of the 4 points */
  public isAlmostEqual(other: Ellipsoid): boolean {
    return this._transform.isAlmostEqual(other._transform);
  }
  /** Apply the transform to each point */
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this._transform, this._transform);
    return true;
  }
  /**
   * return a cloned and transformed ellipsoid.
   * @param transform
   */
  public cloneTransformed(transform: Transform): Ellipsoid | undefined {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }
  /** Compute intersections with a ray.
   * * Return the number of intersections
   * * Fill any combinations of arrays of
   *    * rayFractions = fractions along the ray
   *    * xyz = xyz intersection coordinates points in space
   *    * thetaPhiRadians = sphere longitude and latitude in radians.
   * * For each optional array, caller must of course initialize an array (usually empty)
   */
  public intersectRay(ray: Ray3d, rayFractions: number[] | undefined, xyz: Point3d[] | undefined, thetaPhiRadians: Point2d[] | undefined): number {
    if (xyz)
      xyz.length = 0;
    if (thetaPhiRadians !== undefined)
      thetaPhiRadians.length = 0;
    if (rayFractions)
      rayFractions.length = 0;
    const localRay = ray.cloneInverseTransformed(this._transform);
    if (localRay !== undefined) {
      const n = SphereImplicit.intersectSphereRay(Point3d.create(0, 0, 0), 1.0, localRay, rayFractions, xyz, thetaPhiRadians);
      if (xyz !== undefined) {
        this._transform.multiplyPoint3dArrayInPlace(xyz);
      }
      return n;
    }
    return 0;
  }

  /** Return the range of a uv-aligned patch of the sphere. */
  public patchRangeStartEndRadians(theta0Radians: number, theta1Radians: number, phi0Radians: number, phi1Radians: number, result?: Range3d): Range3d {
    const xExtreme = EllipsoidComponentExtrema.createTransformRow(this._transform, 0);
    const yExtreme = EllipsoidComponentExtrema.createTransformRow(this._transform, 1);
    const zExtreme = EllipsoidComponentExtrema.createTransformRow(this._transform, 2);
    if (!result)
      result = Range3d.createNull();
    else
      result.setNull();
    // Range extrema can occur at:
    //  * 2 smooth surface points in each direction
    //  * along low and high phi boundary arcs
    //  * along low and high theta boundary arcs
    // smooth surface extrema . ..
    xExtreme.extendRangeForSmoothSurfacePoints(result, theta0Radians, theta1Radians, phi0Radians, phi1Radians);
    yExtreme.extendRangeForSmoothSurfacePoints(result, theta0Radians, theta1Radians, phi0Radians, phi1Radians);
    zExtreme.extendRangeForSmoothSurfacePoints(result, theta0Radians, theta1Radians, phi0Radians, phi1Radians);
    //
    if (!Angle.isFullCircleRadians(theta1Radians - theta0Radians)) {
      xExtreme.extendRangeForConstantThetaArc(result, theta0Radians, phi0Radians, phi1Radians);
      yExtreme.extendRangeForConstantThetaArc(result, theta0Radians, phi0Radians, phi1Radians);
      zExtreme.extendRangeForConstantThetaArc(result, theta0Radians, phi0Radians, phi1Radians);

      xExtreme.extendRangeForConstantThetaArc(result, theta1Radians, phi0Radians, phi1Radians);
      yExtreme.extendRangeForConstantThetaArc(result, theta1Radians, phi0Radians, phi1Radians);
      zExtreme.extendRangeForConstantThetaArc(result, theta1Radians, phi0Radians, phi1Radians);
    }
    if (!Angle.isHalfCircleRadians(phi1Radians - phi0Radians)) {
      xExtreme.extendRangeForConstantPhiArc(result, theta0Radians, theta1Radians, phi0Radians);
      yExtreme.extendRangeForConstantPhiArc(result, theta0Radians, theta1Radians, phi0Radians);
      zExtreme.extendRangeForConstantPhiArc(result, theta0Radians, theta1Radians, phi0Radians);

      xExtreme.extendRangeForConstantPhiArc(result, theta0Radians, theta1Radians, phi1Radians);
      yExtreme.extendRangeForConstantPhiArc(result, theta0Radians, theta1Radians, phi1Radians);
      zExtreme.extendRangeForConstantPhiArc(result, theta0Radians, theta1Radians, phi1Radians);
    }
    return result;
  }
  /**
   * Evaluate a point on the ellipsoid at angles give in radians.
   * @param thetaRadians longitude, in radians
   * @param phiRadians latitude, in radians
   * @param result optional point result
   */
  public radiansToPoint(thetaRadians: number, phiRadians: number, result?: Point3d): Point3d {
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    return this._transform.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi, result);
  }
  /**
   * Evaluate a point and derivatives with respect to angle on the ellipsoid at angles give in radians.
   * * "u direction" vector of the returned plane is derivative with respect to longitude.
   * * "v direction" vector fo the returned plane is derivative with respect ot latitude.
   * @param thetaRadians longitude, in radians
   * @param phiRadians latitude, in radians
   * @param result optional plane result
   */
  public radiansToPointAndTangents(thetaRadians: number, phiRadians: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    const matrix = this._transform.matrix;
    if (!result)
      return Plane3dByOriginAndVectors.createCapture(
        this._transform.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi),
        matrix.multiplyXYZ(-sinTheta * cosPhi, cosTheta * cosPhi, 0),
        matrix.multiplyXYZ(-sinPhi * cosTheta, -sinPhi * sinTheta, cosPhi));
    // inplace modification requires direct reference to members of the result ...
    this._transform.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi, result.origin);
    matrix.multiplyXYZ(-sinTheta * cosPhi, cosTheta * cosPhi, 0, result.vectorU);
    matrix.multiplyXYZ(-sinPhi * cosTheta, -sinPhi * sinTheta, cosPhi, result.vectorV);
    return result;
  }
}
/**
 * * An `EllipsoidPatch` is
 *   * An underlying (full) `Ellipsoid` object
 *   * an angular range (`AngleSweep`) of longitudes around the equator
 *   * an angular range (`AngleSweep`) of latitudes, with 0 at the equator, +90 degrees at north pole.
 * * The `EllipsoidPatch` implements `UVSurface` methods, so a `PolyfaceBuilder` can generate facets in its method `addUVGridBody`
 * @internal
 */
export class EllipsoidPatch implements UVSurface {
  public ellipsoid: Ellipsoid;
  public longitudeSweep: AngleSweep;
  public latitudeSweep: AngleSweep;
  /**
   * CAPTURE ellipsoid and sweeps as an EllipsoidPatch.
   * @param ellipsoid
   * @param longitudeSweep
   * @param latitudeSweep
   */
  private constructor(ellipsoid: Ellipsoid, longitudeSweep: AngleSweep, latitudeSweep: AngleSweep) {
    this.ellipsoid = ellipsoid;
    this.longitudeSweep = longitudeSweep;
    this.latitudeSweep = latitudeSweep;
  }
  /**
   * Create a new EllipsoidPatch, capturing (not cloning) all input object references.
   * @param ellipsoid  full ellipsoid
   * @param longitudeSweep sweep of longitudes in the active patch
   * @param latitudeSweep sweep of latitudes in the active patch.
   */
  public static createCapture(ellipsoid: Ellipsoid, longitudeSweep: AngleSweep, latitudeSweep: AngleSweep): EllipsoidPatch {
    return new EllipsoidPatch(ellipsoid, longitudeSweep, latitudeSweep);
  }
  /** Return the point on the ellipsoid at fractional positions in the angular ranges. */
  public uvFractionToPoint(longitudeFraction: number, latitudeFraction: number): Point3d {
    return this.ellipsoid.radiansToPoint(this.longitudeSweep.fractionToRadians(longitudeFraction), this.latitudeSweep.fractionToRadians(latitudeFraction));
  }
  /** Return the point and derivative vectors on the ellipsoid at fractional positions in the angular ranges.
   * * Derivatives are with respect to fractional position.
   */
  public uvFractionToPointAndTangents(longitudeFraction: number, latitudeFraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    result = this.ellipsoid.radiansToPointAndTangents(
      this.longitudeSweep.fractionToRadians(longitudeFraction),
      this.latitudeSweep.fractionToRadians(latitudeFraction),
      result);
    result.vectorU.scale(this.longitudeSweep.sweepRadians);
    result.vectorV.scale(this.latitudeSweep.sweepRadians);
    return result;
  }
  /** Return the range of the patch, considering both boundary and internal extrema. */
  public range(result?: Range3d): Range3d {
    return this.ellipsoid.patchRangeStartEndRadians(this.longitudeSweep.startRadians, this.longitudeSweep.endRadians, this.latitudeSweep.startRadians, this.latitudeSweep.endRadians, result);
  }
  /** Return intersections of the ray and surface.
   * * uv values in the intersections are in radians unless `convertIntersectionRadiansToFractions` is true requesting conversion to patch fractions.
   */
  public intersectRay(ray: Ray3d, restrictToPatch: boolean, convertIntersectionRadiansToFractions: boolean = false): CurveAndSurfaceLocationDetail[] {
    const result: CurveAndSurfaceLocationDetail[] = [];
    const rayFractions: number[] = [];
    const xyz: Point3d[] = [];
    const thetaPhi: Point2d[] = [];
    const n = this.ellipsoid.intersectRay(ray, rayFractions, xyz, thetaPhi);
    for (let i = 0; i < n; i++) {
      if (!restrictToPatch
        || (this.longitudeSweep.isRadiansInSweep(thetaPhi[i].x)
          && this.latitudeSweep.isRadiansInSweep(thetaPhi[i].y))) {
        if (convertIntersectionRadiansToFractions) {
          thetaPhi[i].x = this.longitudeSweep.radiansToSignedPeriodicFraction(thetaPhi[i].x);
          thetaPhi[i].y = this.latitudeSweep.radiansToSignedPeriodicFraction(thetaPhi[i].y);
        }
        result.push(new CurveAndSurfaceLocationDetail(
          CurveLocationDetail.createRayFractionPoint(ray, rayFractions[i], xyz[i]),
          UVSurfaceLocationDetail.createSurfaceUVPoint(this, thetaPhi[i], xyz[i])));
      }
    }
    return result;
  }
}
