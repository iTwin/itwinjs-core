/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { CurveAndSurfaceLocationDetail, UVSurfaceLocationDetail } from "../bspline/SurfaceLocationDetail";
import { Clipper } from "../clipping/ClipUtils";
import { Arc3d } from "../curve/Arc3d";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
import { AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive } from "../curve/CurvePrimitive";
import { AxisIndex, AxisOrder, Geometry } from "../Geometry";
import { Point4d } from "../geometry4d/Point4d";
import { Order3Bezier } from "../numerics/BezierPolynomials";
import { Newton2dUnboundedWithDerivative, NewtonEvaluatorRRtoRRD } from "../numerics/Newton";
import { SineCosinePolynomial, SphereImplicit, TrigPolynomial } from "../numerics/Polynomials";
import { TriDiagonalSystem } from "../numerics/TriDiagonalSystem";
import { Angle } from "./Angle";
import { AngleSweep } from "./AngleSweep";
import { UVSurface } from "./GeometryHandler";
import { LongitudeLatitudeNumber } from "./LongitudeLatitudeAltitude";
import { Matrix3d } from "./Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "./Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "./Plane3dByOriginAndVectors";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Range1d, Range3d } from "./Range";
import { Ray3d } from "./Ray3d";
import { Transform } from "./Transform";
import { XYAndZ } from "./XYZProps";

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
 * @public
 */
export class Ellipsoid implements Clipper {
  private _transform: Transform;
  private _unitVectorA: Vector3d;
  private _unitVectorB: Vector3d;
  private _workPointA: Point3d;
  private _workPointB: Point3d;
  private constructor(transform: Transform) {
    this._transform = transform;
    this._unitVectorA = Vector3d.create();
    this._unitVectorB = Vector3d.create();
    this._workPointA = Point3d.create();
    this._workPointB = Point3d.create();
  }
  /** Create with a clone (not capture) with given transform.
   * * If transform is undefined, create a unit sphere.
   */
  public static create(matrixOrTransform?: Transform | Matrix3d): Ellipsoid {
    if (matrixOrTransform instanceof Transform)
      return new Ellipsoid(matrixOrTransform);
    else if (matrixOrTransform instanceof Matrix3d)
      return new Ellipsoid(Transform.createOriginAndMatrix(undefined, matrixOrTransform));
    else
      return new Ellipsoid(Transform.createIdentity());
  }
  /**
   * Create a transform with given center and directions, applying the radii as multipliers for the respective columns of the axes.
   * @param center center of ellipsoid
   * @param axes x,y,z directions are columns of this matrix
   * @param radiusX multiplier to be applied to the x direction
   * @param radiusY multiplier to be applied to the y direction
   * @param radiusZ  multiplier to be applied to the z direction
   */
  public static createCenterMatrixRadii(center: Point3d, axes: Matrix3d | undefined, radiusX: number, radiusY: number, radiusZ: number): Ellipsoid {
    let scaledAxes;
    if (axes === undefined)
      scaledAxes = Matrix3d.createScale(radiusX, radiusY, radiusZ)!;
    else
      scaledAxes = axes.scaleColumns(radiusX, radiusY, radiusZ);
    return new Ellipsoid(Transform.createOriginAndMatrix(center, scaledAxes));
  }
  /** Return a (REFERENCE TO) the transform from world space to the mapped sphere space.
   * * This maps coordinates "relative to the sphere" to world.
   * * Its inverse maps world coordinates into the sphere space.
   *   * In the sphere space, an xyz (vector from origin) with magnitude equal to 1 is ON the sphere (hence its world image is ON the ellipsoid)
   *   * In the sphere space, an xyz (vector from origin) with magnitude less than 1 is INSIDE the sphere (hence its world image is INSIDE the ellipsoid)
   *   * In the sphere space, an xyz (vector from origin) with magnitude greater than 1 is OUTSIDE the sphere (hence its world image is OUTSIDE the ellipsoid)
   */
  public get transformRef(): Transform { return this._transform; }
  /**
   * * Convert a world point to point within the underlying mapped sphere space.
   *   * In the sphere space, an xyz (vector from origin) with magnitude equal to 1 is ON the sphere (hence its world image is ON the ellipsoid)
   *   * In the sphere space, an xyz (vector from origin) with magnitude less than 1 is INSIDE the sphere (hence its world image is INSIDE the ellipsoid)
   *   * In the sphere space, an xyz (vector from origin) with magnitude greater than 1 is OUTSIDE the sphere (hence its world image is OUTSIDE the ellipsoid)
   * * This is undefined in the highly unusual case that the ellipsoid frame is singular.
   */
  public worldToLocal(worldPoint: XYAndZ, result?: Point3d): Point3d | undefined {
    return this._transform.multiplyInversePoint3d(worldPoint, result);
  }
  /**
   * * Convert a point within the underlying mapped sphere space to world coordinates.
   *   * In the sphere space, an xyz (vector from origin) with magnitude equal to 1 is ON the sphere (hence its world image is ON the ellipsoid)
   *   * In the sphere space, an xyz (vector from origin) with magnitude less than 1 is INSIDE the sphere (hence its world image is INSIDE the ellipsoid)
   *   * In the sphere space, an xyz (vector from origin) with magnitude greater than 1 is OUTSIDE the sphere (hence its world image is OUTSIDE the ellipsoid)
   */
  public localToWorld(localPoint: XYAndZ, result?: Point3d): Point3d {
    return this._transform.multiplyPoint3d(localPoint, result);
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
  /** Find the closest point of the (patch of the) ellipsoid.
   * * In general there are multiple points where a space point projects onto an ellipse.
   * * This searches for only one point, using heuristics which are reliable for points close to the surface but not for points distant from highly skewed ellipsoid
   */
  public projectPointToSurface(spacePoint: Point3d): LongitudeLatitudeNumber | undefined {
    const searcher = new EllipsoidClosestPoint(this);
    return searcher.searchClosestPoint(spacePoint);
  }

  /** Find the silhouette of the ellipsoid as viewed from a homogeneous eyepoint.
   * * Returns undefined if the eyepoint is inside the ellipsoid
   */
  public silhouetteArc(eyePoint: Point4d): Arc3d | undefined {
    const localEyePoint = this._transform.multiplyInversePoint4d(eyePoint);
    if (localEyePoint !== undefined) {
      // localEyePoint is now looking at a unit sphere centered at the origin.
      // the plane through the silhouette is the eye point with z negated ...
      const localPlaneA = Point4d.create(localEyePoint.x, localEyePoint.y, localEyePoint.z, -localEyePoint.w);
      const localPlaneB = localPlaneA.toPlane3dByOriginAndUnitNormal();
      // if the silhouette plane has origin inside the sphere, there is a silhouette with center at the plane origin.
      if (localPlaneB) {
        const rr = 1.0 - localPlaneB.getOriginRef().magnitudeSquared();  // squared distance radius of silhouette arc
        if (rr > 0.0 && rr <= 1.0) {
          const arc = Arc3d.createCenterNormalRadius(localPlaneB.getOriginRef(), localPlaneB.getNormalRef(), Math.sqrt(rr));
          if (arc.tryTransformInPlace(this._transform))
            return arc;
        }
      }
    }
    return undefined;
  }

  /** Compute intersections with a ray.
   * * Return the number of intersections
   * * Fill any combinations of arrays of
   *    * rayFractions = fractions along the ray
   *    * xyz = xyz intersection coordinates points in space
   *    * thetaPhiRadians = sphere longitude and latitude in radians.
   * * For each optional array, caller must of course initialize an array (usually empty)
   * * return 0 if ray length is too small.
   */
  public intersectRay(ray: Ray3d, rayFractions: number[] | undefined, xyz: Point3d[] | undefined, thetaPhiRadians: LongitudeLatitudeNumber[] | undefined): number {
    if (xyz)
      xyz.length = 0;
    if (thetaPhiRadians !== undefined)
      thetaPhiRadians.length = 0;
    if (rayFractions)
      rayFractions.length = 0;
    // if ray comes in unit vector in large ellipsoid, localRay direction is minuscule.
    // use a ray scaled up so its direction vector magnitude is comparable to the ellipsoid radiusX
    const ray1 = ray.clone();
    const a0 = ray.direction.magnitude();
    const aX = this._transform.matrix.columnXMagnitude();
    const scale = Geometry.conditionalDivideCoordinate(aX, a0);
    if (scale === undefined)
      return 0;
    ray1.direction.scaleInPlace(scale);
    const localRay = ray1.cloneInverseTransformed(this._transform);
    if (localRay !== undefined) {
      const n = SphereImplicit.intersectSphereRay(Point3d.create(0, 0, 0), 1.0, localRay, rayFractions, xyz, thetaPhiRadians);
      if (rayFractions !== undefined) {
        for (let i = 0; i < rayFractions.length; i++)
          rayFractions[i] *= scale;
      }
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
   * * For a given pair of points on an ellipsoid, construct an arc (possibly elliptical) which
   *   * passes through both points
   *   * is completely within the ellipsoid surface
   *   * has its centerEvaluate a point on the ellipsoid at angles give in radians.
   * * If the ellipsoid is a sphere, this is the shortest great-circle arc between the two points.
   * * If the ellipsoid is not a sphere, this is close to but not precisely the shortest path.
   * @param thetaARadians longitude, in radians, for pointA
   * @param phiARadians latitude, in radians, for pointA
   * @param thetaBRadians longitude, in radians, for pointB
   * @param phiBRadians latitude, in radians, for pointB
   * @param result optional preallocated result
   */
  public radiansPairToGreatArc(
    thetaARadians: number, phiARadians: number,
    thetaBRadians: number, phiBRadians: number,
    result?: Arc3d): Arc3d | undefined {
    SphereImplicit.radiansToUnitSphereXYZ(thetaARadians, phiARadians, this._unitVectorA);
    SphereImplicit.radiansToUnitSphereXYZ(thetaBRadians, phiBRadians, this._unitVectorB);
    const sweepAngle = this._unitVectorA.angleTo(this._unitVectorB);
    // the unit vectors (on unit sphere) are never 0, so this cannot fail.
    const matrix = Matrix3d.createRigidFromColumns(this._unitVectorA, this._unitVectorB, AxisOrder.XYZ)!;
    if (matrix !== undefined) {
      const matrix1 = this._transform.matrix.multiplyMatrixMatrix(matrix);
      return Arc3d.create(this._transform.getOrigin(), matrix1.columnX(), matrix1.columnY(),
        AngleSweep.createStartEndRadians(0.0, sweepAngle.radians), result);
    }
    return undefined;
  }
  /**
   * See radiansPairToGreatArc, which does this computation with positions from `angleA` and `angleB` directly as radians
   */
  public anglePairToGreatArc(angleA: LongitudeLatitudeNumber, angleB: LongitudeLatitudeNumber, result?: Arc3d): Arc3d | undefined {
    return this.radiansPairToGreatArc(
      angleA.longitudeRadians, angleA.latitudeRadians, angleB.longitudeRadians, angleB.latitudeRadians, result);
  }
  /**
   * Construct an arc for the section cut of a plane with the ellipsoid.
   * * this is undefined if the plane does not intersect the ellipsoid.
   */
  public createPlaneSection(plane: Plane3dByOriginAndUnitNormal): Arc3d | undefined {
    const localPlane = plane.cloneTransformed(this._transform, true);
    if (localPlane !== undefined) {
      // construct center and arc vectors in the local system --- later transform them out to global.
      const center = localPlane.projectPointToPlane(Point3d.createZero());
      const d = center.magnitude();
      if (d < 1.0) {
        const frame = Matrix3d.createRigidHeadsUp(localPlane.getNormalRef(), AxisOrder.ZYX);
        const vector0 = frame.columnX();
        const vector90 = frame.columnY();
        const sectionRadius = Math.sqrt(1.0 - d * d);
        vector0.scaleInPlace(sectionRadius);
        vector90.scaleInPlace(sectionRadius);

        this._transform.multiplyPoint3d(center, center);
        this._transform.multiplyVector(vector0, vector0);
        this._transform.multiplyVector(vector90, vector90);
        return Arc3d.create(center, vector0, vector90, undefined);
      }
    }
    return undefined;
  }
  /**
   * Construct an arc which
   *  * start at pointA (defined by its angle position)
   *  * ends at pointB (defined by its angle position)
   *  * contains the 3rd vector as an in-plane point.
   */
  public createSectionArcPointPointVectorInPlane(pointAnglesA: LongitudeLatitudeNumber, pointAnglesB: LongitudeLatitudeNumber, inPlaneVector: Vector3d,
    result?: Arc3d): Arc3d | undefined {
    const xyzA = this.radiansToPoint(pointAnglesA.longitudeRadians, pointAnglesA.latitudeRadians);
    const xyzB = this.radiansToPoint(pointAnglesB.longitudeRadians, pointAnglesB.latitudeRadians);
    const localA = this._transform.multiplyInversePoint3d(xyzA);
    const localB = this._transform.multiplyInversePoint3d(xyzB);
    const a = this._transform.matrix.maxAbs();
    const scaledInPlaneVector = inPlaneVector.scaleToLength(a);
    if (scaledInPlaneVector === undefined)
      return undefined;
    const localInPlaneVector = this._transform.matrix.multiplyInverse(scaledInPlaneVector);
    if (localA !== undefined && localB !== undefined && localInPlaneVector !== undefined) {
      const localPlane = Plane3dByOriginAndUnitNormal.createPointPointVectorInPlane(localA, localB, localInPlaneVector);
      if (localPlane !== undefined) {
        // construct center and arc vectors in the local system --- later transform them out to global.
        const center = localPlane.projectPointToPlane(Point3d.createZero());
        const vector0 = Vector3d.createStartEnd(center, localA);
        const vectorB = Vector3d.createStartEnd(center, localB);
        const vector90 = Vector3d.createRotateVectorAroundVector(vector0, localPlane.getNormalRef(), undefined);
        if (vector90 !== undefined) {
          const sweepRadians = vector0.planarRadiansTo(vectorB, localPlane.getNormalRef());
          this._transform.multiplyPoint3d(center, center);
          this._transform.multiplyVector(vector0, vector0);
          this._transform.multiplyVector(vector90, vector90);
          return Arc3d.create(center, vector0, vector90, AngleSweep.createStartEndRadians(0, sweepRadians), result);
        }
      }
    }
    return undefined;
  }
  /**
   * * For a given pair of points on an ellipsoid, construct another ellipsoid
   *   * touches the same xyz points in space
   *   * has transformation modified so that the original two points are on the equator.
   * * Note that except for true sphere inputs, the result axes can be both non-perpendicular axes and of different lengths.
   * @param thetaARadians longitude, in radians, for pointA
   * @param phiARadians latitude, in radians, for pointA
   * @param thetaBRadians longitude, in radians, for pointB
   * @param phiBRadians latitude, in radians, for pointB
   * @param result optional preallocated result
   */
  public radiansPairToEquatorialEllipsoid(
    thetaARadians: number, phiARadians: number,
    thetaBRadians: number, phiBRadians: number,
    result?: Ellipsoid): Ellipsoid | undefined {
    SphereImplicit.radiansToUnitSphereXYZ(thetaARadians, phiARadians, this._unitVectorA);
    SphereImplicit.radiansToUnitSphereXYZ(thetaBRadians, phiBRadians, this._unitVectorB);

    const matrix = Matrix3d.createRigidFromColumns(this._unitVectorA, this._unitVectorB, AxisOrder.XYZ);
    if (matrix) {
      if (result) {
        this._transform.multiplyTransformMatrix3d(matrix, result._transform);
        return result;
      }
      return Ellipsoid.create(this._transform.multiplyTransformMatrix3d(matrix));
    }
    return undefined;
  }
  /**
   * Return an arc (circular or elliptical) at constant longitude
   * @param longitude (strongly typed) longitude
   * @param latitude latitude sweep angles
   * @param result
   */
  public constantLongitudeArc(longitude: Angle, latitudeSweep: AngleSweep, result?: Arc3d): Arc3d | undefined {
    if (Angle.isAlmostEqualRadiansNoPeriodShift(0, latitudeSweep.sweepRadians))
      return undefined;
    const cosTheta = longitude.cos();
    const sinTheta = longitude.sin();
    const vector0 = this._transform.matrix.multiplyXY(cosTheta, sinTheta);
    const vector90 = this._transform.matrix.columnZ();
    const center = this._transform.getOrigin();
    return Arc3d.create(center, vector0, vector90, latitudeSweep, result);
  }
  /**
   * Return an arc (circular or elliptical) at constant longitude
   * @param latitude sweep angles
   * @param latitude (strongly typed) latitude
   * @param result
   */
  public constantLatitudeArc(longitudeSweep: AngleSweep, latitude: Angle, result?: Arc3d): Arc3d | undefined {
    if (Angle.isAlmostEqualRadiansNoPeriodShift(0, longitudeSweep.sweepRadians))
      return undefined;
    if (latitude.isAlmostNorthOrSouthPole)
      return undefined;
    const cosPhi = latitude.cos();
    const sinPhi = latitude.sin();
    const vector0 = this._transform.matrix.columnX(); vector0.scaleInPlace(cosPhi);
    const vector90 = this._transform.matrix.columnY(); vector90.scaleInPlace(cosPhi);
    const center = this._transform.multiplyXYZ(0, 0, sinPhi);
    return Arc3d.create(center, vector0, vector90, longitudeSweep, result);
  }
  /**
   * * create a section arc with and end at positions A and B, and in plane with the normal at a fractional
   *    interpolation between.
   * @param angleA start point of arc (given as angles on this ellipsoid)
   * @param intermediateNormalFraction
   * @param angleB end point of arc (given as angles on this ellipsoid)
   */
  public sectionArcWithIntermediateNormal(
    angleA: LongitudeLatitudeNumber,
    intermediateNormalFraction: number,
    angleB: LongitudeLatitudeNumber): Arc3d {
    const normalA = this.radiansToUnitNormalRay(angleA.longitudeRadians, angleA.latitudeRadians)!;
    const normalB = this.radiansToUnitNormalRay(angleB.longitudeRadians, angleB.latitudeRadians)!;
    const normal = normalA.direction.interpolate(intermediateNormalFraction, normalB.direction);
    const arc = this.createSectionArcPointPointVectorInPlane(angleA, angleB, normal);
    return arc!;
  }

  /**
   * Evaluate a point and derivatives with respect to angle on the ellipsoid at angles give in radians.
   * * "u direction" vector of the returned plane is derivative with respect to longitude.
   * * "v direction" vector fo the returned plane is derivative with respect ot latitude.
   * @param thetaRadians longitude, in radians
   * @param phiRadians latitude, in radians
   * @param applyCosPhiFactor selector for handling of theta (around equator derivative)
   *   * if true, compute the properly scaled derivative, which goes to zero at the poles.
   *    * If false, omit he cos(phi) factor on the derivative wrt theta.  This ensures it is always nonzero and can be safely used in cross product for surface normal.
   * @param result optional plane result
   */
  public radiansToPointAndDerivatives(thetaRadians: number, phiRadians: number, applyCosPhiFactor = true, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const cosPhiA = applyCosPhiFactor ? cosPhi : 1.0;
    const sinPhi = Math.sin(phiRadians);
    const matrix = this._transform.matrix;
    if (!result)
      return Plane3dByOriginAndVectors.createCapture(
        this._transform.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi),
        matrix.multiplyXYZ(-sinTheta * cosPhiA, cosTheta * cosPhiA, 0),
        matrix.multiplyXYZ(-sinPhi * cosTheta, -sinPhi * sinTheta, cosPhi));
    // in place modification requires direct reference to members of the result ...
    this._transform.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi, result.origin);
    matrix.multiplyXYZ(-sinTheta * cosPhiA, cosTheta * cosPhiA, 0, result.vectorU);
    matrix.multiplyXYZ(-sinPhi * cosTheta, -sinPhi * sinTheta, cosPhi, result.vectorV);
    return result;
  }
  /**
   * Evaluate a point and derivatives wrt to theta, phi, thetaTheta, phiPhi, and thetaPhi.
   * All outputs are to caller-allocated points and vectors.
   * @param thetaRadians longitude, in radians
   * @param phiRadians latitude, in radians
   * @param point (returned) surface point
   * @param d1Theta (returned) derivative wrt theta
   * @param d1Phi (returned) derivative wrt phi
   * @param d2ThetaTheta (returned) second derivative wrt theta twice
   * @param d2PhiPhi (returned) second derivative wrt phi twice
   * @param d2ThetaPhi (returned) second derivative wrt theta and phi
   * @param result optional plane result
   */
  public radiansToPointAnd2Derivatives(thetaRadians: number, phiRadians: number,
    point: Point3d,
    d1Theta: Vector3d,
    d1Phi: Vector3d,
    d2ThetaTheta: Vector3d,
    d2PhiPhi: Vector3d,
    d2ThetaPhi: Vector3d) {
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    const matrix = this._transform.matrix;
    this._transform.multiplyXYZ(cosTheta * cosPhi, sinTheta * cosPhi, sinPhi, point);
    // theta derivatives
    matrix.multiplyXYZ(-sinTheta * cosPhi, cosTheta * cosPhi, 0, d1Theta);
    matrix.multiplyXYZ(-cosTheta * cosPhi, -sinTheta * cosPhi, 0, d2ThetaTheta);

    // phi derivatives
    matrix.multiplyXYZ(-cosTheta * sinPhi, -sinTheta * sinPhi, cosPhi, d1Phi);
    matrix.multiplyXYZ(-cosTheta * cosPhi, -sinTheta * cosPhi, -sinPhi, d2PhiPhi);

    // mixed derivative
    matrix.multiplyXYZ(sinTheta * sinPhi, -cosTheta * sinPhi, 0, d2ThetaPhi);
  }

  /**
   * Evaluate a point and rigid local coordinate frame the ellipsoid at angles give in radians.
   * * The undefined return is only possible if the placement transform is singular (and even then only at critical angles)
   * @param thetaRadians longitude, in radians
   * @param phiRadians latitude, in radians
   * @param result optional transform result
   *
   */
  public radiansToFrenetFrame(thetaRadians: number, phiRadians: number, result?: Transform): Transform | undefined {
    const plane = this.radiansToPointAndDerivatives(thetaRadians, phiRadians, false);
    return plane.toRigidFrame(result);
  }
  /**
   * Evaluate a point and unit normal at given angles.
   * @param thetaRadians longitude, in radians
   * @param phiRadians latitude, in radians
   * @param result optional transform result
   *
   */
  public radiansToUnitNormalRay(thetaRadians: number, phiRadians: number, result?: Ray3d): Ray3d | undefined {
    const plane = this.radiansToPointAndDerivatives(thetaRadians, phiRadians, false);
    return plane.unitNormalRay(result);
  }

  /**
   * Find the (unique) extreme point for a given true surface perpendicular vector (outward)
   */
  public surfaceNormalToAngles(normal: Vector3d, result?: LongitudeLatitudeNumber): LongitudeLatitudeNumber {
    const matrix = this._transform.matrix;
    const conjugateVector = matrix.multiplyTransposeVector(normal);
    const thetaRadians = Math.atan2(conjugateVector.y, conjugateVector.x);
    // For that phi arc,
    const axy = -(conjugateVector.x * Math.cos(thetaRadians) + conjugateVector.y * Math.sin(thetaRadians));
    const az = conjugateVector.z;
    const phiRadians = Math.atan2(az, -axy);
    return LongitudeLatitudeNumber.createRadians(thetaRadians, phiRadians, 0.0, result);
  }

  /**
   * * Evaluate the surface normal on `other` ellipsoid at given angles
   *    * If `other` is undefined, default to unit sphere.
   * * Find the angles for the same normal on `this` ellipsoid
   */
  public otherEllipsoidAnglesToThisEllipsoidAngles(otherEllipsoid: Ellipsoid | undefined, otherAngles: LongitudeLatitudeNumber, result?: LongitudeLatitudeNumber): LongitudeLatitudeNumber | undefined {
    const normal = Ellipsoid.radiansToUnitNormalRay(otherEllipsoid, otherAngles.longitudeRadians, otherAngles.latitudeRadians);
    if (normal !== undefined)
      return this.surfaceNormalToAngles(normal.direction, result);
    return undefined;
  }
  /**
   * * if ellipsoid is given, return its surface point and unit normal as a Ray3d.
   * * if not given, return surface point and unit normal for unit sphere.
   */
  public static radiansToUnitNormalRay(ellipsoid: Ellipsoid | undefined, thetaRadians: number, phiRadians: number, result?: Ray3d): Ray3d | undefined {
    if (ellipsoid) {
      return ellipsoid.radiansToUnitNormalRay(thetaRadians, phiRadians, result);
    }
    if (!result)
      result = Ray3d.createZAxis();
    // for unit sphere, the vector from center to surface point is identical to the unit normal.
    SphereImplicit.radiansToUnitSphereXYZ(thetaRadians, phiRadians, result.origin);
    result.direction.setFromPoint3d(result.origin);
    return result;
  }
  /** Implement the `isPointInOnOrOutside` test fom the `interface` */
  public isPointOnOrInside(point: Point3d): boolean {
    const localPoint = this._transform.multiplyInversePoint3d(point, this._workPointA);
    if (localPoint !== undefined)
      return localPoint.magnitude() <= 1.0;
    return false;
  }
  /** Announce "in" portions of a line segment.  See `Clipper.announceClippedSegmentIntervals` */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean {
    const localA = this._transform.multiplyInversePoint3d(pointA, this._workPointA);
    const localB = this._transform.multiplyInversePoint3d(pointB, this._workPointB);
    if (localA && localB) {
      const dotAA = Vector3d.dotProductAsXYAndZ(this._workPointA, this._workPointA);
      const dotAB = Vector3d.dotProductAsXYAndZ(this._workPointA, this._workPointB);
      const dotBB = Vector3d.dotProductAsXYAndZ(this._workPointB, this._workPointB);
      const bezier = new Order3Bezier(dotAA, dotAB, dotBB);
      const roots = bezier.roots(1.0, false);
      if (roots !== undefined && roots.length === 2) {
        // we know the roots are sorted.  The f0,f1 might not be ..
        if (f0 < f1) {
          if (roots[0] < f0)
            roots[0] = f0;
          if (f1 < roots[1])
            roots[1] = f1;
          if (roots[0] < roots[1]) {
            if (announce)
              announce(roots[0], roots[1]);
            return true;
          }
        } else {
          // f0,f1 are reversed. do the outputs in the same sense
          if (roots[1] > f0)
            roots[1] = f0;
          if (roots[0] < f1)
            roots[0] = f1;
          if (roots[1] > roots[0]) {
            if (announce)
              announce(roots[1], roots[0]);
            return true;
          }
        }
      }
    }
    return false;
  }
  /** Announce "in" portions of a line segment.  See `Clipper.announceClippedSegmentIntervals` */
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    const arcData = arc.toVectors();
    let numAnnounce = 0;
    if (this._transform.multiplyInversePoint3d(arcData.center, arcData.center)
      && this._transform.matrix.multiplyInverse(arcData.vector0, arcData.vector0)
      && this._transform.matrix.multiplyInverse(arcData.vector90, arcData.vector90)) {
      // in local coordinates the arc parameterization is   X = center + vector0 * cos(theta) + vector90 * sin(theta)
      //  We want X DOT X === 1, viz
      //    center DOT center + 2 * cos(theta) * center DOT vector0 + 2 * sin(theta) * center DOT vector90 + cos(theta) ^2 * vector0 DOT vector0 + sin (theta)^2 * vector90 DOT vector90 = 1
      const cc = Vector3d.dotProductAsXYAndZ(arcData.center, arcData.center);
      const cu = Vector3d.dotProductAsXYAndZ(arcData.center, arcData.vector0);
      const cv = Vector3d.dotProductAsXYAndZ(arcData.center, arcData.vector90);
      const uv = Vector3d.dotProductAsXYAndZ(arcData.vector0, arcData.vector90);
      const uu = Vector3d.dotProductAsXYAndZ(arcData.vector0, arcData.vector0);
      const vv = Vector3d.dotProductAsXYAndZ(arcData.vector90, arcData.vector90);
      const intersectionRadians: number[] = [];

      if (TrigPolynomial.solveUnitCircleImplicitQuadricIntersection(
        uu, 2.0 * uv, vv,
        2.0 * cu, 2.0 * cv, cc - 1.0,
        intersectionRadians)) {
        const fractions = [0.0, 1.0];
        for (const radians of intersectionRadians) {
          const fraction = arc.sweep.radiansToSignedPeriodicFraction(radians);
          if (Geometry.isIn01(fraction))
            fractions.push(fraction);
        }
        fractions.sort();
        let f0, f1;
        for (let i1 = 1; i1 < fractions.length; i1++) {
          f0 = fractions[i1 - 1];
          f1 = fractions[i1];
          if (f1 > f0) {
            const xyz = arc.fractionToPoint(Geometry.interpolate(fractions[i1 - 1], 0.5, fractions[i1]));
            if (this.isPointOnOrInside(xyz)) {
              if (announce)
                announce(fractions[i1 - 1], fractions[i1], arc);
              numAnnounce++;
            }
          }
        }
      }
    }
    return numAnnounce > 0;
  }
}
/**
 * * An `EllipsoidPatch` is
 *   * An underlying (full) `Ellipsoid` object
 *   * an angular range (`AngleSweep`) of longitudes around the equator
 *   * an angular range (`AngleSweep`) of latitudes, with 0 at the equator, +90 degrees at north pole.
 * * The `EllipsoidPatch` implements `UVSurface` methods, so a `PolyfaceBuilder` can generate facets in its method `addUVGridBody`
 * @public
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
  public uvFractionToPoint(longitudeFraction: number, latitudeFraction: number, result?: Point3d): Point3d {
    return this.ellipsoid.radiansToPoint(this.longitudeSweep.fractionToRadians(longitudeFraction), this.latitudeSweep.fractionToRadians(latitudeFraction), result);
  }
  /** Return the point and derivative vectors on the ellipsoid at fractional positions in the angular ranges.
   * * Derivatives are with respect to fractional position.
   */
  public uvFractionToPointAndTangents(longitudeFraction: number, latitudeFraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    result = this.ellipsoid.radiansToPointAndDerivatives(
      this.longitudeSweep.fractionToRadians(longitudeFraction),
      this.latitudeSweep.fractionToRadians(latitudeFraction),
      true,
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
    const thetaPhi: LongitudeLatitudeNumber[] = [];
    const n = this.ellipsoid.intersectRay(ray, rayFractions, xyz, thetaPhi);
    for (let i = 0; i < n; i++) {
      const longitudeRadians = thetaPhi[i].longitudeRadians;
      const latitudeRadians = thetaPhi[i].latitudeRadians;

      if (!restrictToPatch
        || (this.longitudeSweep.isRadiansInSweep(longitudeRadians)
          && this.latitudeSweep.isRadiansInSweep(latitudeRadians))) {
        if (convertIntersectionRadiansToFractions) {
          const uFraction = this.longitudeSweep.radiansToSignedPeriodicFraction(longitudeRadians);
          const vFraction = this.latitudeSweep.radiansToSignedPeriodicFraction(latitudeRadians);
          result.push(new CurveAndSurfaceLocationDetail(
            CurveLocationDetail.createRayFractionPoint(ray, rayFractions[i], xyz[i]),
            UVSurfaceLocationDetail.createSurfaceUVNumbersPoint(this, uFraction, vFraction, xyz[i])));
        } else {
          result.push(new CurveAndSurfaceLocationDetail(
            CurveLocationDetail.createRayFractionPoint(ray, rayFractions[i], xyz[i]),
            UVSurfaceLocationDetail.createSurfaceUVNumbersPoint(this, longitudeRadians, latitudeRadians, xyz[i])));
        }
      }
    }
    return result;
  }
  /**
   * test if the angles of the `LongitudeLatitudeNumber` are within the sweep ranges.
   * @param position longitude and latitude to test.
   * @param `allowPeriodicLongitude` true to allow the longitude to be in when shifted by a multiple of 2 PI
   *    (latitude is never periodic for patches)
   */
  public containsAngles(position: LongitudeLatitudeNumber, allowPeriodicLongitude: boolean = true): boolean {
    return this.latitudeSweep.isRadiansInSweep(position.latitudeRadians, false)
      && this.longitudeSweep.isRadiansInSweep(position.longitudeRadians, allowPeriodicLongitude);
  }

  /**
   * Compute point (with altitude) at given angles and altitude.
   * * Never fails for non-singular ellipsoid.
   * * In the returned ray,
   *    * ray.origin is the point at requested altitude.
   *    * ray.direction is an outward-directed unit vector
   * @param position longitude, latitude, and height
   *
   */
  public anglesToUnitNormalRay(position: LongitudeLatitudeNumber, result?: Ray3d): Ray3d | undefined {
    const ray = this.ellipsoid.radiansToUnitNormalRay(position.longitudeRadians, position.latitudeRadians, result);
    if (!ray)
      return undefined;
    ray.origin = ray.fractionToPoint(position.altitude, ray.origin);
    return ray;
  }
  /**
   * Return simple angles of a fractional position in the patch.
   * @param thetaFraction fractional position in longitude (theta) interval
   * @param phiFraction fractional position in latitude (phi) interval
   * @param h optional altitude
   * @param result optional preallocated result.
   */
  public uvFractionToAngles(longitudeFraction: number, phiFraction: number, h: number = 0, result?: LongitudeLatitudeNumber): LongitudeLatitudeNumber {
    return LongitudeLatitudeNumber.createRadians(this.longitudeSweep.fractionToRadians(longitudeFraction), this.latitudeSweep.fractionToRadians(phiFraction), h, result);
  }
  /** Find the closest point of the (patch of the) ellipsoid. */
  public projectPointToSurface(spacePoint: Point3d): LongitudeLatitudeNumber | undefined {
    return this.ellipsoid.projectPointToSurface(spacePoint);
  }
}
/**
 * Internal class for searching for the closest point (projection of spacePoint) on an ellipsoid.
 */
class EllipsoidClosestPoint extends NewtonEvaluatorRRtoRRD {
  private _ellipsoid: Ellipsoid;
  private _spacePoint!: Point3d;
  private _surfacePoint: Point3d;
  private _d1Theta: Vector3d;
  private _d2Theta: Vector3d;
  private _d1Phi: Vector3d;
  private _d2Phi: Vector3d;
  private _d2ThetaPhi: Vector3d;
  private _delta: Vector3d;
  public constructor(ellipsoid: Ellipsoid) {
    super();
    this._ellipsoid = ellipsoid;
    this._surfacePoint = Point3d.create();
    this._d1Theta = Vector3d.create();
    this._d1Phi = Vector3d.create();
    this._d2Theta = Vector3d.create();
    this._d2Phi = Vector3d.create();
    this._d2ThetaPhi = Vector3d.create();

    this._delta = Vector3d.create();
  }
  public searchClosestPoint(spacePoint: Point3d): LongitudeLatitudeNumber | undefined {
    this._spacePoint = spacePoint;
    const localPoint = this._ellipsoid.transformRef.multiplyInversePoint3d(spacePoint);
    if (!localPoint)
      return undefined;
    const sphere = new SphereImplicit(1.0);
    const uv = sphere.xyzToThetaPhiR(localPoint);
    const newtonSearcher = new Newton2dUnboundedWithDerivative(this);
    newtonSearcher.setUV(uv.thetaRadians, uv.phiRadians);
    if (newtonSearcher.runIterations()) {
      uv.thetaRadians = newtonSearcher.getU();
      uv.phiRadians = newtonSearcher.getV();
    }
    return LongitudeLatitudeNumber.createRadians(uv.thetaRadians, uv.phiRadians, 0.0);
  }
  public evaluate(thetaRadians: number, phiRadians: number): boolean {
    this._ellipsoid.radiansToPointAnd2Derivatives(thetaRadians, phiRadians,
      this._surfacePoint,
      this._d1Theta, this._d1Phi,
      this._d2Theta, this._d2Phi,
      this._d2ThetaPhi);
    Vector3d.createStartEnd(this._spacePoint, this._surfacePoint, this._delta);
    const q = this._d1Theta.dotProduct(this._d1Phi) + this._delta.dotProduct(this._d2ThetaPhi);
    this.currentF.setOriginAndVectorsXYZ(
      // f,g,0
      this._delta.dotProduct(this._d1Theta), this._delta.dotProduct(this._d1Phi), 0,
      // df/dTheta, dg/dTheta, 0
      this._d1Theta.dotProduct(this._d1Theta) + this._delta.dotProduct(this._d2Theta), q, 0,
      // df/dPhi, dg/dPhi, 0
      q, this._d1Phi.dotProduct(this._d1Phi) + this._delta.dotProduct(this._d2Phi), 0);

    return true;
  }
}
/**
 * Detailed data for a point on a 2-angle parameter space.
 * @public
 */
export class GeodesicPathPoint {
  /** First angle, in radians */
  public thetaRadians: number;
  /** Second angle, in radians */
  public phiRadians: number;
  public point: Point3d;
  public dTheta: Vector3d;
  public dPhi: Vector3d;
  public d2Theta: Vector3d;
  public d2Phi: Vector3d;
  public d2ThetaPhi: Vector3d;
  public d1Cross: Vector3d;
  public constructor() {
    this.thetaRadians = 0;
    this.phiRadians = 0;
    this.point = Point3d.create();
    this.dTheta = Vector3d.create();
    this.dPhi = Vector3d.create();
    this.d2Theta = Vector3d.create();
    this.d2Phi = Vector3d.create();
    this.d2ThetaPhi = Vector3d.create();
    this.d1Cross = Vector3d.create();
  }
  /** Fill all evaluations at given theta and phi. */
  public evaluateDerivativesAtCurrentAngles(ellipsoid: Ellipsoid) {
    ellipsoid.radiansToPointAnd2Derivatives(this.thetaRadians, this.phiRadians, this.point, this.dTheta, this.dPhi, this.d2Theta, this.d2Phi, this.d2ThetaPhi);
    this.dTheta.crossProduct(this.dPhi, this.d1Cross);
  }
  private static _vectorAB?: Vector3d;
  private static _vectorCB?: Vector3d;
  private static _vectorCross?: Vector3d;
  /** Evaluate the newton function and derivatives:
   *          `(UAB cross UCB) dot d1cross`
   * with as the central data, UAB = vector from pointA to pointB, UCB = vector from pointC to pointA.
   * * Return order is:
   *   * values[0] = the function
   *   * values[1] = derivative wrt pointA.phi
   *   * values[2] = derivative wrt pointB.phi
   *   * values[3] = derivative wrt pointC.phi
   */
  public static evaluateNewtonFunction(pointA: GeodesicPathPoint, pointB: GeodesicPathPoint, pointC: GeodesicPathPoint, values: Float64Array) {
    this._vectorAB = Vector3d.createStartEnd(pointA.point, pointB.point, this._vectorAB);
    this._vectorCB = Vector3d.createStartEnd(pointC.point, pointB.point, this._vectorCB);
    this._vectorCross = this._vectorAB.crossProduct(this._vectorCB);
    // this._vectorCross is the cross product of vectors from A to B and C to B
    // it should be perpendicular to (have zero dot product with) the surface normal, which is sitting in pointB as d1Cross
    values[0] = this._vectorCross.dotProduct(pointB.d1Cross);
    // Derivatives wrt phi at A, B, C creates derivatives of values[0] wrt each.
    // derivatives at neighbor appear only on their point-to-point vector, and with negative sign ..
    values[1] = - pointA.dPhi.tripleProduct(this._vectorCB, pointB.d1Cross);
    values[3] = - this._vectorAB.tripleProduct(pointC.dPhi, pointB.d1Cross);
    // values from pointB appear with positive sign everywhere . ..
    values[2] = pointB.dPhi.tripleProduct(this._vectorCB, pointB.d1Cross)
      + this._vectorAB.tripleProduct(pointB.dPhi, pointB.d1Cross)
      + this._vectorCross.tripleProduct(pointB.d2ThetaPhi, pointB.dPhi)
      + this._vectorCross.tripleProduct(pointB.dTheta, pointB.d2Phi);
    // CRUNCH CRUNCH CRUNCH
  }
  /**
   * Extract the two angles form this structure to a LongitudeLatitudeNumber structure.
   */
  public toAngles(): LongitudeLatitudeNumber {
    return LongitudeLatitudeNumber.createRadians(this.thetaRadians, this.phiRadians);
  }
}
/**
 * Algorithm implementation class for computing approximate optimal (shortest) path points.
 * * Call the static method `createGeodesicPath` to compute path points.
 * @public
 */
export class GeodesicPathSolver {
  private _defaultArc: Arc3d;
  private _pathPoints: GeodesicPathPoint[];
  private _tridiagonalSolver!: TriDiagonalSystem;
  private constructor(defaultArc: Arc3d) {
    this._pathPoints = [];
    this._defaultArc = defaultArc;
  }
  /**
   *
   * @param originalEllipsoid Given start and endpoints on an ellipsoid, compute points along a near-optimal shortest path.
   * * The points are located so that at each point the local surface normal is contained in the plane of the point and its two neighbors.
   * @param startAngles angles for the start of the path
   * @param endAngles angles for the end of the path
   * @param density If this is a number, it is the requested edge count.  If this is an angle, it ias an angular spacing measured in the great arc through the two points.
   */
  public static createGeodesicPath(originalEllipsoid: Ellipsoid,
    startAngles: LongitudeLatitudeNumber, endAngles: LongitudeLatitudeNumber, density: number | Angle): GeodesicPathPoint[] | undefined {
    const workEllipsoid1 = originalEllipsoid.radiansPairToEquatorialEllipsoid(startAngles.longitudeRadians, startAngles.latitudeRadians,
      endAngles.longitudeRadians, endAngles.latitudeRadians);
    const workArc = originalEllipsoid.radiansPairToGreatArc(startAngles.longitudeRadians, startAngles.latitudeRadians,
      endAngles.longitudeRadians, endAngles.latitudeRadians);
    if (workEllipsoid1 === undefined || workArc === undefined)
      return undefined;
    let numEdges = 4;
    if (density instanceof Angle) {
      numEdges = Geometry.stepCount(density.radians, workArc.sweep.sweepRadians, 4, 180);
    } else if (Number.isFinite(density)) {
      numEdges = Math.max(numEdges, density);
    }
    if (numEdges > 180)
      numEdges = 180;
    const scaledMatrix = workEllipsoid1.transformRef.matrix.clone();
    const largestCoordinate = scaledMatrix.maxAbs();
    const inverseLargestCoordinate = 1.0 / largestCoordinate;
    scaledMatrix.scaleColumnsInPlace(inverseLargestCoordinate, inverseLargestCoordinate, inverseLargestCoordinate);
    const workEllipsoid = Ellipsoid.create(Transform.createOriginAndMatrix(undefined, scaledMatrix));

    const solver = new GeodesicPathSolver(workArc);
    solver.createInitialPointsAndTridiagonalSystem(numEdges);

    let numConverged = 0;
    let previousMaxDPhi = 10000.0;
    let numStep = 0;
    const dPhiTolerance = 1.0e-8;
    solver.setupStep(workEllipsoid);
    while (numStep < 15 && numConverged < 2) {
      if (!solver.solve())
        break;
      previousMaxDPhi = solver.applyUpdate(0.1);
      solver.setupStep(workEllipsoid);
      if (previousMaxDPhi < dPhiTolerance)
        numConverged++;
      else
        numConverged = 0;
      numStep++;
    }
    if (numConverged > 0) {
      const workAngles = LongitudeLatitudeNumber.createRadians(0, 0);
      const originalAngles = LongitudeLatitudeNumber.createRadians(0, 0);
      for (const p of solver._pathPoints) {
        LongitudeLatitudeNumber.createRadians(p.thetaRadians, p.phiRadians, 0, workAngles);
        originalEllipsoid.otherEllipsoidAnglesToThisEllipsoidAngles(workEllipsoid, workAngles, originalAngles);
        p.thetaRadians = originalAngles.longitudeRadians;
        p.phiRadians = originalAngles.latitudeRadians;
        p.evaluateDerivativesAtCurrentAngles(originalEllipsoid);
      }
      return solver._pathPoints;
    }
    return numConverged > 0 ? solver._pathPoints : undefined;
  }
  private createInitialPointsAndTridiagonalSystem(numEdges: number) {
    if (numEdges < 2)
      numEdges = 2;
    let f, thetaRadians;
    for (let i = 0; i <= numEdges; i++) {
      f = i / numEdges;
      thetaRadians = this._defaultArc.sweep.fractionToRadians(f);
      const p = new GeodesicPathPoint();
      p.thetaRadians = thetaRadians;
      p.phiRadians = 0.0;
      this._pathPoints.push(p);
    }
    this._tridiagonalSolver = new TriDiagonalSystem(this._pathPoints.length);
  }
  private applyUpdate(maxDPhiRadians: number): number {
    let dPhiMax = 0;
    for (let i = 0; i < this._pathPoints.length; i++) {
      const dPhi = Geometry.clampToStartEnd(this._tridiagonalSolver.getX(i), -maxDPhiRadians, maxDPhiRadians);
      this._pathPoints[i].phiRadians -= dPhi;
      dPhiMax = Geometry.maxAbsXY(dPhiMax, dPhi);
    }
    return dPhiMax;
  }

  /**
   * Set up a step with specified ellipsoid.
   * * ASSUME angles in _pathPoints are valid on given ellipsoid.
   * @param ellipsoid
   */
  private setupStep(ellipsoid: Ellipsoid) {
    for (const p of this._pathPoints) {
      p.evaluateDerivativesAtCurrentAngles(ellipsoid);
    }
    const lastRow = this._pathPoints.length - 1;
    // first and last points get trivial dPhi=0 equations:
    this._tridiagonalSolver.reset();
    this._tridiagonalSolver.addToRow(0, 0, 1, 0);
    this._tridiagonalSolver.addToB(0, 0);
    this._tridiagonalSolver.addToRow(lastRow, 0, 1, 0);
    this._tridiagonalSolver.addToB(lastRow, 0);

    // interior points get proper newton equations
    const values = new Float64Array(4);
    for (let i = 1; i < lastRow; i++) {
      GeodesicPathPoint.evaluateNewtonFunction(this._pathPoints[i - 1], this._pathPoints[i], this._pathPoints[i + 1], values);
      this._tridiagonalSolver.addToRow(i, values[1], values[2], values[3]);
      this._tridiagonalSolver.addToB(i, values[0]);
    }
  }

  private solve(): boolean {
    return this._tridiagonalSolver.factorAndBackSubstitute();
  }
  /**
   * Construct various section arcs (on the ellipsoid), using planes that (a) pass through the two given points and (b) have in-plane vector sampled between the normals of the two points.
   * * Each candidate ellipse has is in a plane with ellipsoid normal at vector constructed "between" the endpoint normals.
   * * The intermediate construction is by interpolation between stated fractions (which maybe outside 0 to 1)
   * @param ellipsoid
   * @param angleA start point of all candidates
   * @param angleB end point of all candidates
   * @param numSample number of ellipses to construct as candidates.
   * @param normalInterpolationFraction0
   * @param normalInterpolationFraction1
   */
  public static approximateMinimumLengthSectionArc(ellipsoid: Ellipsoid,
    angleA: LongitudeLatitudeNumber,
    angleB: LongitudeLatitudeNumber, numSample: number,
    normalInterpolationFraction0: number,
    normalInterpolationFraction1: number): { minLengthArc: Arc3d, minLengthNormalInterpolationFraction: number } | undefined {
    numSample = Geometry.clampToStartEnd(numSample, 2, 200);
    const normalA = ellipsoid.radiansToUnitNormalRay(angleA.longitudeRadians, angleA.latitudeRadians);
    const normalB = ellipsoid.radiansToUnitNormalRay(angleB.longitudeRadians, angleB.latitudeRadians);
    if (normalA !== undefined && normalB !== undefined) {
      let normalC;
      let resultArc;
      let lengthC;
      let fractionC;

      for (let i = 1; i <= numSample; i++) {
        const f = Geometry.interpolate(normalInterpolationFraction0, i / numSample, normalInterpolationFraction1);
        normalC = normalA.direction.interpolate(f, normalB.direction, normalC);
        const candidateArc = ellipsoid.createSectionArcPointPointVectorInPlane(angleA, angleB, normalC);
        if (candidateArc !== undefined) {
          const candidateLength = candidateArc.curveLength();
          if (lengthC === undefined || candidateLength < lengthC) {
            lengthC = candidateLength;
            resultArc = candidateArc;
            fractionC = f;
          }
        }
      }
      if (resultArc !== undefined && fractionC !== undefined)
        return { minLengthArc: resultArc, minLengthNormalInterpolationFraction: fractionC };
    }
    return undefined;
  }

}
