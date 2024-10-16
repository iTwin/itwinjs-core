/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Numerics
 */

import { assert } from "@itwin/core-bentley";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { GrowableFloat64Array, OptionalGrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { LongitudeLatitudeNumber } from "../geometry3d/LongitudeLatitudeAltitude";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d, XYZ } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { XAndY } from "../geometry3d/XYZProps";

// cspell:words Cardano internaldocs

/**
 * degree 2 (quadratic) polynomial in for y = c0 + c1*x + c2*x^2
 * @internal
 */
export class Degree2PowerPolynomial {
  /** The three coefficients for the quadratic */
  public coffs: number[];

  constructor(c0: number = 0, c1: number = 0, c2: number = 0) {
    this.coffs = [c0, c1, c2];
  }

  /**
   * * Return 2 duplicate roots in double root case.
   * * The solutions are always in algebraic order.
   * @returns 0, 1, or 2 solutions of the usual quadratic (a*x*x + b * x + c = 0)
   */
  public static solveQuadratic(a: number, b: number, c: number): number[] | undefined {
    const b1 = Geometry.conditionalDivideFraction(b, a);
    const c1 = Geometry.conditionalDivideFraction(c, a);
    if (b1 !== undefined && c1 !== undefined) {
      // now solving xx + b1*x + c1 = 0 -- i.e. implied "a" coefficient is 1 . .
      const q = b1 * b1 - 4 * c1;
      if (q > 0) {
        const e = Math.sqrt(q);
        // e is positive, so this sorts algebraically
        return [0.5 * (-b1 - e), 0.5 * (-b1 + e)];
      }
      if (q < 0)
        return undefined;
      const root = -0.5 * b1;
      return [root, root];
    }
    // "divide by a" failed.  solve bx + c = 0
    const x = Geometry.conditionalDivideFraction(-c, b);
    if (x !== undefined)
      return [x];
    return undefined;
  }
  /** Add `a` to the constant term. */
  public addConstant(a: number) {
    this.coffs[0] += a;
  }

  /** Add  `s * (a + b*x)^2` to the quadratic coefficients */
  public addSquaredLinearTerm(a: number, b: number, s: number = 1): void {
    this.coffs[0] += s * (a * a);
    this.coffs[1] += s * (2.0 * a * b);
    this.coffs[2] += s * (b * b);
  }
  /** Return the real roots of this polynomial */
  public realRoots(): number[] | undefined {
    const ss = Degree2PowerPolynomial.solveQuadratic(this.coffs[2], this.coffs[1], this.coffs[0]);
    if (ss && ss.length > 1) {
      if (ss[0] > ss[1]) {
        const temp = ss[0];
        ss[0] = ss[1];
        ss[1] = temp;
      }
    }
    return ss;
  }

  /** Evaluate the quadratic at x. */
  public evaluate(x: number): number {
    return this.coffs[0] + x * (this.coffs[1] + x * this.coffs[2]);
  }

  /**
   * Evaluate the bezier function at a parameter value.  (i.e. sum the basis functions times coefficients)
   * @param u parameter for evaluation
   */
  public evaluateDerivative(x: number): number {
    return this.coffs[1] + 2 * x * this.coffs[2];
  }

  /** Factor the polynomial in to the form `y0 + c * (x-x0)^2)`, i.e. complete the square. */
  public tryGetVertexFactorization(): { x0: number, y0: number, c: number } | undefined {
    const x = Geometry.conditionalDivideFraction(-this.coffs[1], 2.0 * this.coffs[2]);
    if (x !== undefined) {
      const y = this.evaluate(x);
      return { c: this.coffs[2], x0: x, y0: y };
    }
    return undefined;
  }
  /** Construct a quadratic from input form `c2 * (x-root0) * (x-root1)` */
  public static fromRootsAndC2(root0: number, root1: number, c2: number = 1): Degree2PowerPolynomial {
    return new Degree2PowerPolynomial(
      c2 * root0 * root1,
      - c2 * (root0 + root1),
      c2);
  }

}
/**
 * degree 3 (cubic) polynomial in for y = c0 + c1*x + c2*x^2 + c3*x^3
 * @internal
 */
export class Degree3PowerPolynomial {
  /** polynomial coefficients, index corresponds to power */
  public coffs: number[];

  constructor(c0: number = 0, c1: number = 0, c2: number = 0, c3: number = 1) {
    this.coffs = [c0, c1, c2, c3];
  }
  /** Add `a` to the constant term. */
  public addConstant(a: number) {
    this.coffs[0] += a;
  }

  /** Add `s * (a + b*x)^2` to the cubic */
  public addSquaredLinearTerm(a: number, b: number, s: number = 1): void {
    this.coffs[0] += s * (a * a);
    this.coffs[1] += s * (2.0 * a * b);
    this.coffs[2] += s * (b * b);
  }

  /**
   * Evaluate the polynomial at x
   * @param u parameter for evaluation
   */
  public evaluate(x: number): number {
    return this.coffs[0] + x * (this.coffs[1] + x * (this.coffs[2] + x * this.coffs[3]));
  }

  /**
   * Evaluate the polynomial derivative
   * @param u parameter for evaluation
   */
  public evaluateDerivative(x: number): number {
    return this.coffs[1] + x * (2.0 * this.coffs[2] + x * 3.0 * this.coffs[3]);
  }
  /** Construct a cubic from the form `c3 * (x-root0) * (x - root1) * (x- root2)` */
  public static fromRootsAndC3(root0: number, root1: number, root2: number, c3: number = 1.0): Degree3PowerPolynomial {
    return new Degree3PowerPolynomial(
      -c3 * root0 * root1 * root2,
      c3 * (root0 * root1 + root1 * root2 + root0 * root2),
      - c3 * (root0 + root1 + root2),
      c3);
  }
}
/**
 * degree 4 (quartic) polynomial in for y = c0 + c1*x + c2*x^2 + c4*x^4
 * @internal
 */
export class Degree4PowerPolynomial {
  /** polynomial coefficients, index corresponds to power */
  public coffs: number[];

  constructor(c0: number = 0, c1: number = 0, c2: number = 0, c3: number = 0, c4: number = 0) {
    this.coffs = [c0, c1, c2, c3, c4];
  }
  /** Add `a` to the constant term. */
  public addConstant(a: number) {
    this.coffs[0] += a;
  }

  /**
   * Evaluate the polynomial
   * @param x x coordinate for evaluation
   */
  public evaluate(x: number): number {
    return this.coffs[0] + x * (this.coffs[1] + x * (this.coffs[2] + x * (this.coffs[3] + x * this.coffs[4])));
  }

  /**
   * Evaluate the derivative
   * @param x x coordinate for evaluation
   */
  public evaluateDerivative(x: number): number {
    return (this.coffs[1] + x * (2.0 * this.coffs[2] + x * (3.0 * this.coffs[3] + x * 4.0 * this.coffs[4])));
  }

  /** Construct a quartic from the form `c3 * (x-root0) * (x - root1) * (x- root2) * (x-root3)` */
  public static fromRootsAndC4(root0: number, root1: number, root2: number, root3: number, c4: number = 1): Degree4PowerPolynomial {
    return new Degree4PowerPolynomial(
      c4 * (root0 * root1 * root2 * root3),
      -c4 * (root0 * root1 * root2 + root0 * root1 * root3 + root0 * root2 * root3 + root1 * root2 * root3),
      c4 * (root0 * root1 + root0 * root2 + root0 * root3 + root1 * root2 + root1 * root3 + root2 * root3),
      -c4 * (root0 + root1 + root2 + root3),
      c4);
  }

}
/**
 * polynomial services for an implicit torus with
 * * z axis is "through the donut hole"
 * * `majorRadius` is the radius of the circle "around the z axis"
 * * `minorRadius` is the radius of circles around the major circle
 * * for simple xyz the implicit form is
 *   * `(x^2+y^2+z^2+(R^2-r^2))^2 = 4 R^2(x^2+y^2)`
 * * In weighted form
 *   * `(x^2+y^2+z^2+(R^2-r^2)w^2)^2 = 4 R^2 w^2 (x^2+y^2)`
 * @internal
 */
export class TorusImplicit {
  /** major (xy plane) radius */
  public majorRadius: number;
  /** hoop (perpendicular to major circle) radius */
  public minorRadius: number;

  constructor(majorRadius: number, minorRadius: number) {
    this.majorRadius = majorRadius;
    this.minorRadius = minorRadius;
  }

  /** Return sum of (absolute) major and minor radii, which is (half) the box size in x and y directions */
  public boxSize() {
    return (Math.abs(this.majorRadius) + Math.abs(this.minorRadius));
  }
  /** Return scale factor appropriate to control the magnitude of the implicit function. */
  public implicitFunctionScale(): number {
    const a = this.boxSize();
    if (a === 0.0)
      return 1.0;
    return 1.0 / (a * a * a * a);
  }

  /**
   * At space point (x,y,z) evaluate the implicit form of the torus (See `ImplicitTorus`)
   */
  public evaluateImplicitFunctionXYZ(x: number, y: number, z: number): number {
    const rho2 = x * x + y * y;
    const z2 = z * z;
    const R2 = this.majorRadius * this.majorRadius;
    const r2 = this.minorRadius * this.minorRadius;
    const f = rho2 + z2 + (R2 - r2);
    const g = 4.0 * R2 * rho2;
    return (f * f - g) * this.implicitFunctionScale();
  }
  /** Evaluate the implicit function at a point. */
  public evaluateImplicitFunctionPoint(xyz: Point3d): number {
    return this.evaluateImplicitFunctionXYZ(xyz.x, xyz.y, xyz.z);
  }
  /** Evaluate the implicit function at homogeneous coordinates */
  public evaluateImplicitFunctionXYZW(x: number, y: number, z: number, w: number) {
    const rho2 = x * x + y * y;
    const z2 = z * z;
    const w2 = w * w;
    const R2 = this.majorRadius * this.majorRadius;
    const r2 = this.minorRadius * this.minorRadius;
    const f = rho2 + z2 + w2 * (R2 - r2);
    const g = w2 * 4.0 * R2 * rho2;
    return (f * f - g) * this.implicitFunctionScale();
  }

  /** Evaluate the surface point at angles (in radians) on the major and minor circles. */
  public evaluateThetaPhi(thetaRadians: number, phiRadians: number): Point3d {
    const c = Math.cos(thetaRadians);
    const s = Math.sin(thetaRadians);
    // theta=0 point
    const x0 = this.majorRadius + this.minorRadius * Math.cos(phiRadians);
    const z0 = this.minorRadius * Math.sin(phiRadians);
    return Point3d.create(c * x0, s * x0, z0);
  }

  /** Evaluate partial derivatives at angles (int radians) on major and minor circles. */
  public evaluateDerivativesThetaPhi(thetaRadians: number, phiRadians: number, dxdTheta: Vector3d, dxdPhi: Vector3d) {
    const cTheta = Math.cos(thetaRadians);
    const sTheta = Math.sin(thetaRadians);
    const bx = this.minorRadius * Math.cos(phiRadians);
    const bz = this.minorRadius * Math.sin(phiRadians);
    const x0 = this.majorRadius + bx;
    Vector3d.create(-x0 * sTheta, x0 * cTheta, 0.0, dxdTheta);
    Vector3d.create(-cTheta * bz, -sTheta * bz, bx, dxdPhi);
  }

  /** Evaluate space point at major and minor angles (in radians) and distance from major hoop. */
  public evaluateThetaPhiDistance(thetaRadians: number, phiRadians: number, distance: number): Point3d {
    const c = Math.cos(thetaRadians);
    const s = Math.sin(thetaRadians);
    // theta=0 point
    const x0 = this.majorRadius + distance * Math.cos(phiRadians);
    const z0 = distance * Math.sin(phiRadians);
    return Point3d.create(c * x0, s * x0, z0);
  }
  /** Given an xyz coordinate in the local system of the toroid, compute the torus parametrization
   * * theta = angular coordinate in xy plane
   * * phi = angular coordinate in minor circle.
   * * distance = distance from major circle
   * * rho = distance from origin to xy part of the input.
   * @param xyz space point in local coordinates.
   * @return object with properties theta, phi, distance, rho
   */
  public xyzToThetaPhiDistance(xyz: Point3d): { theta: number, phi: number, distance: number, rho: number, safePhi: boolean } {
    const rho = xyz.magnitudeXY();
    const majorRadiusFactor = Geometry.conditionalDivideFraction(this.majorRadius, rho);
    let safeMajor;
    let majorCirclePoint;
    if (majorRadiusFactor) {
      safeMajor = true;
      majorCirclePoint = Point3d.create(majorRadiusFactor * xyz.x, majorRadiusFactor * xyz.y, 0.0);
    } else {
      safeMajor = false;
      majorCirclePoint = Point3d.create(xyz.x, xyz.y, 0.0);
    }
    const theta = safeMajor ? Math.atan2(xyz.y, xyz.x) : 0.0;
    const vectorFromMajorCircle = Vector3d.createStartEnd(majorCirclePoint, xyz);
    const distance = vectorFromMajorCircle.magnitude();
    const dRho = rho - this.majorRadius;
    let safePhi;
    let phi;
    if (xyz.z === 0.0 && dRho === 0.0) {
      phi = 0.0;
      safePhi = false;
    } else {
      phi = Math.atan2(xyz.z, dRho);
      safePhi = true;
    }
    return { theta, phi, distance, rho, safePhi: safeMajor && safePhi };
  }
  /*
    public minorCircle(theta: Angle): Arc3d {
      const c = Math.cos(theta.radians);
      const s = Math.sin(theta.radians);
      return Arc3d.create(
        Point3d.create(c * this.majorRadius, s * this.majorRadius, 0.0),
        Vector3d.create(c * this.minorRadius, s * this.minorRadius, 0.0),
        Vector3d.create(0.0, 0.0, this.minorRadius),
        AngleSweep.create360()) as Arc3d;
    }

    public majorCircle(phi: Angle): Arc3d {
      const c = Math.cos(phi.radians);
      const s = Math.sin(phi.radians);
      const a = this.majorRadius + c * this.minorRadius;
      return Arc3d.create(
        Point3d.create(0.0, 0.0, this.minorRadius * s),
        Vector3d.create(a, 0.0, 0.0),
        Vector3d.create(0.0, a, 0.0),
        AngleSweep.create360()) as Arc3d;
    }
  */
}
/**
 * evaluation methods for an implicit sphere
 * * xyz function `x*x + y*y + z*z - r*r = 0`.
 * * xyzw function `x*x + y*y + z*z - r*r*w*w = 0`.
 * @internal
 */
export class SphereImplicit {
  /** Radius of sphere. */
  public radius: number;
  constructor(r: number) { this.radius = r; }

  /** Evaluate the implicit function at coordinates x,y,z */
  public evaluateImplicitFunction(x: number, y: number, z: number): number {
    return x * x + y * y + z * z - this.radius * this.radius;
  }

  /** Evaluate the implicit function at homogeneous coordinates x,y,z,w */
  public evaluateImplicitFunctionXYZW(wx: number, wy: number, wz: number, w: number): number {
    return (wx * wx + wy * wy + wz * wz) - this.radius * this.radius * w * w;
  }

  /** Given an xyz coordinate in the local system of the toroid, compute the sphere parametrization
   * * theta = angular coordinate in xy plane
   * * phi = rotation from xy plane towards z axis.
   * @param xyz space point in local coordinates.
   * @return object with properties thetaRadians, phi, r
   */
  public xyzToThetaPhiR(xyz: Point3d): { thetaRadians: number, phiRadians: number, r: number, valid: boolean } {
    const rhoSquared = xyz.x * xyz.x + xyz.y * xyz.y;
    const rho = Math.sqrt(rhoSquared);
    const r = Math.sqrt(rhoSquared + xyz.z * xyz.z);
    let theta;
    let phi;
    let valid;
    if (r === 0.0) {
      theta = phi = 0.0;
      valid = false;
    } else {
      phi = Math.atan2(xyz.z, rho); // At least one of these is nonzero
      if (rhoSquared !== 0.0) {
        theta = Math.atan2(xyz.y, xyz.x);
        valid = true;
      } else {
        theta = 0.0;
        valid = false;
      }
    }
    return { thetaRadians: (theta), phiRadians: (phi), r, valid };
  }
  /** Return the range of a uv-aligned patch of the sphere. */
  public static patchRangeStartEndRadians(center: Point3d, radius: number, theta0Radians: number, theta1Radians: number, phi0Radians: number, phi1Radians: number, result?: Range3d): Range3d {
    const thetaSweep = AngleSweep.createStartEndRadians(theta0Radians, theta1Radians);
    const phiSweep = AngleSweep.createStartEndRadians(phi0Radians, phi1Radians);
    const range = Range3d.createNull(result);
    const xyz = Point3d.create();
    if (thetaSweep.isFullCircle && phiSweep.isFullLatitudeSweep) {
      // full sphere, no trimming -- build directly
      range.extendPoint(center);
      range.expandInPlace(Math.abs(radius));
    } else {
      const sphere = new SphereImplicit(radius);
      // construct range for ORIGIN CENTERED sphere ...
      const pi = Math.PI;
      const piOver2 = 0.5 * Math.PI;
      let phi, theta;
      // 6 candidate interior extreme points on equator and 0, 90 degree meridians
      for (const thetaPhi of [
        [0.0, 0.0],
        [pi, 0.0],
        [piOver2, 0.0],
        [-piOver2, 0.0],
        [theta0Radians, piOver2],
        [theta0Radians, -piOver2]]) {
        theta = thetaPhi[0];
        phi = thetaPhi[1];
        if (thetaSweep.isRadiansInSweep(theta) && phiSweep.isRadiansInSweep(phi))
          range.extendPoint(sphere.evaluateThetaPhi(theta, phi, xyz));
      }

      // 4 boundary curves, each with 3 components ...
      // BUT: phi should not extend beyond poles. Hence z extremes on constant theta curve will never be different from z of constant phi curve or of poles as tested above.
      const axisRange = Range1d.createNull();
      const cosPhi0 = Math.cos(phi0Radians);
      const cosPhi1 = Math.cos(phi1Radians);
      const sinPhi0 = Math.sin(phi0Radians);
      const sinPhi1 = Math.sin(phi1Radians);
      const trigForm = new SineCosinePolynomial(0, 0, 0);
      // constant phi curves at phi0 and phi1
      for (const cosPhi of [cosPhi0, cosPhi1]) {
        trigForm.set(0, cosPhi * radius, 0);
        trigForm.rangeInSweep(thetaSweep, axisRange);
        range.extendXOnly(axisRange.low); range.extendXOnly(axisRange.high);
        trigForm.set(0, 0, cosPhi * radius);
        trigForm.rangeInSweep(thetaSweep, axisRange);
        range.extendYOnly(axisRange.low); range.extendYOnly(axisRange.high);
      }
      range.extendZOnly(sinPhi0 * radius);
      range.extendZOnly(sinPhi1 * radius);

      // constant theta curves as theta0 and theta1:
      for (const thetaRadians of [theta0Radians, theta1Radians]) {
        const cosThetaR = Math.cos(thetaRadians) * radius;
        const sinThetaR = Math.sin(thetaRadians) * radius;
        trigForm.set(0, cosThetaR, 0);
        trigForm.rangeInSweep(phiSweep, axisRange);
        range.extendXOnly(axisRange.low); range.extendXOnly(axisRange.high);

        trigForm.set(0, sinThetaR, 0);
        trigForm.rangeInSweep(phiSweep, axisRange);
        range.extendYOnly(axisRange.low); range.extendYOnly(axisRange.high);
      }
      range.cloneTranslated(center, range);
    }
    return range;
  }
  /** Compute intersections with a ray.
   * * Return the number of intersections
   * * Fill any combinations of arrays of
   *    * rayFractions = fractions along the ray
   *    * xyz = xyz intersection coordinates points in space
   *    * thetaPhiRadians = sphere longitude and latitude in radians.
   * * For each optional array, caller must of course initialize an array (usually empty)
   */
  public static intersectSphereRay(center: Point3d, radius: number, ray: Ray3d, rayFractions: number[] | undefined, xyz: Point3d[] | undefined, thetaPhiRadians: LongitudeLatitudeNumber[] | undefined): number {
    const vx = ray.origin.x - center.x;
    const vy = ray.origin.y - center.y;
    const vz = ray.origin.z - center.z;
    const ux = ray.direction.x;
    const uy = ray.direction.y;
    const uz = ray.direction.z;
    const a0 = Geometry.hypotenuseSquaredXYZ(vx, vy, vz) - radius * radius;
    const a1 = 2.0 * Geometry.dotProductXYZXYZ(ux, uy, uz, vx, vy, vz);
    const a2 = Geometry.hypotenuseSquaredXYZ(ux, uy, uz);
    const parameters = Degree2PowerPolynomial.solveQuadratic(a2, a1, a0);
    if (rayFractions !== undefined)
      rayFractions.length = 0;
    if (xyz !== undefined)
      xyz.length = 0;
    if (thetaPhiRadians !== undefined)
      thetaPhiRadians.length = 0;

    if (parameters === undefined) {
      return 0;
    }
    const sphere = new SphereImplicit(radius);
    if (rayFractions !== undefined)
      for (const f of parameters) rayFractions.push(f);
    if (xyz !== undefined || thetaPhiRadians !== undefined) {
      for (const f of parameters) {
        const point = ray.fractionToPoint(f);
        if (xyz !== undefined)
          xyz.push(point);
        if (thetaPhiRadians !== undefined) {
          const data = sphere.xyzToThetaPhiR(point);
          thetaPhiRadians.push(LongitudeLatitudeNumber.createRadians(data.thetaRadians, data.phiRadians));
        }
      }
    }
    return parameters.length;
  }

  // public intersectRay(ray: Ray3d, maxHit: number): {rayFractions: number, points: Point3d} {
  //   const q = new Degree2PowerPolynomial();
  //   // Ray is (origin.x + s * direction.x, etc)
  //   // squared distance from origin is (origin.x + s*direction.x)^2 + etc
  //   // sphere radius in local system is 1.
  //   q.addSquaredLinearTerm(ray.origin.x, ray.direction.x);
  //   q.addSquaredLinearTerm(ray.origin.y, ray.direction.y);
  //   q.addSquaredLinearTerm(ray.origin.z, ray.direction.z);
  //   q.addConstant(-this.radius * this.radius);
  //   let ss = [];
  //   let n = q.realRoots(ss);
  //   if (n > maxHit)
  //     n = maxHit;
  //   let rayFractions;
  //   let points;
  //   for (let i = 0; i < n; i++) {
  //     rayFractions[i] = ss[i];
  //     points[i] = Point3d. // What is the equivalent of FromSumOf in TS?
  //   }
  /** Compute the point on a sphere at angular coordinates.
   * @param thetaRadians latitude angle
   * @param phiRadians longitude angle
   */
  public evaluateThetaPhi(thetaRadians: number, phiRadians: number, result?: Point3d): Point3d {
    const rc = this.radius * Math.cos(thetaRadians);
    const rs = this.radius * Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    return Point3d.create(rc * cosPhi, rs * cosPhi, this.radius * sinPhi, result);
  }
  /**
   * * convert radians to xyz on unit sphere
   * * Note that there is no radius used -- implicitly radius is 1
   * * Evaluation is always to a preallocated xyz.
   */
  public static radiansToUnitSphereXYZ(thetaRadians: number, phiRadians: number, xyz: XYZ) {
    const cosTheta = Math.cos(thetaRadians);
    const sinTheta = Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    xyz.x = cosTheta * cosPhi;
    xyz.y = sinTheta * cosPhi;
    xyz.z = sinPhi;
  }
  /** Compute the derivatives with respect to spherical angles.
   * @param thetaRadians latitude angle
   * @param phiRadians longitude angle
   */
  public evaluateDerivativesThetaPhi(thetaRadians: number, phiRadians: number, dxdTheta: Vector3d, dxdPhi: Vector3d) {
    const rc = this.radius * Math.cos(thetaRadians);
    const rs = this.radius * Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    Vector3d.create(-rs * cosPhi, rc * cosPhi, 0.0, dxdTheta);
    Vector3d.create(-rc * sinPhi, -rs * sinPhi, this.radius * cosPhi, dxdPhi);
  }
  /*
    public meridianCircle(theta: number): Arc3d {
      const rc = this.radius * Math.cos(theta);
      const rs = this.radius * Math.sin(theta);
      return Arc3d.create(
        Point3d.create(0.0, 0.0, 0.0),
        Vector3d.create(rc, rs, 0),
        Vector3d.create(0, 0, this.radius),
        AngleSweep.create360()) as Arc3d;
    }

    public parallelCircle(phi: number): Arc3d {
      const cr = this.radius * Math.cos(phi);
      const sr = this.radius * Math.sin(phi);
      return Arc3d.create(
        Point3d.create(0, 0, sr),
        Vector3d.create(cr, 0, 0),
        Vector3d.create(0, cr, 0),
        AngleSweep.create360()) as Arc3d;
    }
    */
}
/** AnalyticRoots has static methods for solving quadratic, cubic, and quartic equations.
 * @internal
 *
 */
export class AnalyticRoots {
  private static readonly _EQN_EPS = 1.0e-9;
  private static readonly _safeDivideFactor = 1.0e-14;
  /** Absolute zero test with a tolerance that has worked well for the analytic root use case . . . */
  private static isZero(x: number): boolean {
    return Math.abs(x) < this._EQN_EPS;
  }
  /** Without actually doing a division, test if (x/y) is small.
   * @param x numerator
   * @param y denominator
   * @param absTol absolute tolerance
   * @param relTol relative tolerance
   */
  private static isSmallRatio(x: number, y: number, absTol: number = 1.0e-9, relTol: number = 8.0e-16) {
    return Math.abs(x) <= absTol || Math.abs(x) < relTol * Math.abs(y);
  }
  /** Return the (real, signed) principal cube root of x */
  public static cbrt(x: number): number {
    return ((x) > 0.0
      ? Math.pow((x), 1.0 / 3.0)
      : ((x) < 0.0
        ? -Math.pow(-(x), 1.0 / 3.0)
        : 0.0));
  }
  /**
   * Try to divide `numerator/denominator` and place the result (or defaultValue) in `values[offset]`
   * @param values array of values.  `values[offset]` will be replaced.
   * @param numerator numerator for division.
   * @param denominator denominator for division.
   * @param defaultValue value to save if denominator is too small to divide.
   * @param offset index of value to replace.
   */
  private static safeDivide(values: Float64Array, numerator: number, denominator: number, defaultValue: number = 0.0, offset: number): boolean {
    if (Math.abs(denominator) > (this._safeDivideFactor * Math.abs(numerator))) {
      values[offset] = numerator / denominator;
      return true;
    }
    values[offset] = defaultValue;
    return false;
  }
  // Used in NewtonMethod for testing if a root has been adjusted past its bounding region
  private static checkRootProximity(roots: GrowableFloat64Array, i: number): boolean {
    if (i === 0) { // Case 1: Beginning Root (check root following it)
      return roots.atUncheckedIndex(i) < roots.atUncheckedIndex(i + 1);
    } else if (i > 0 && i + 1 < roots.length) { // Case 2: Middle Root (check roots before and after)
      return (roots.atUncheckedIndex(i) > roots.atUncheckedIndex(i - 1)) && (roots.atUncheckedIndex(i) < roots.atUncheckedIndex(i + 1));
    } else { // Case 3: End root (check preceding root)
      return (roots.atUncheckedIndex(i) > roots.atUncheckedIndex(i - 1));
    }
  }
  private static newtonMethodAdjustment(coffs: Float64Array | number[], root: number, degree: number): number | undefined {
    let p = coffs[degree];
    let q = 0.0;
    for (let i = degree - 1; i >= 0; i--) {
      q = p + root * q;
      p = coffs[i] + root * p;
    }
    if (Math.abs(q) >= 1.0e-14 * (1.0 + Math.abs(root))) {
      return p / q;
    }
    return undefined;
  }
  private static improveRoots(
    coffs: Float64Array | number[], degree: number, roots: GrowableFloat64Array, restrictOrderChanges: boolean,
  ) {
    const relTol = 1.0e-10;
    // Loop through each root
    for (let i = 0; i < roots.length; i++) {
      let dx = this.newtonMethodAdjustment(coffs, roots.atUncheckedIndex(i), degree);
      if (dx === undefined || dx === 0.0) continue;  // skip if newton step had divide by zero.
      const originalValue = roots.atUncheckedIndex(i);
      let counter = 0;
      let convergenceCounter = 0;
      // Loop through applying changes to found root until dx is diminished or counter is hit
      while (dx !== undefined && dx !== 0.0 && (counter < 12)) {
        // consider it converged if two successive iterations satisfy the (not too demanding) tolerance.
        if (Math.abs(dx) < relTol * (1.0 + Math.abs(roots.atUncheckedIndex(i)))) {
          if (++convergenceCounter > 1)
            break;
        } else {
          convergenceCounter = 0;
        }
        const rootDX = roots.atUncheckedIndex(i) - dx;
        roots.reassign(i, rootDX);
        // If root is thrown past one of its neighboring roots, unstable condition is assumed.. revert
        // to originally found root
        if (restrictOrderChanges && !this.checkRootProximity(roots, i)) {
          roots.reassign(i, originalValue);
          break;
        }
        dx = this.newtonMethodAdjustment(coffs, roots.atUncheckedIndex(i), degree);
        counter++;
      }
    }
  }
  /**
   * Append (if defined) value to results.
   * @param value optional value to append
   * @param results growing array
   */
  private static appendSolution(value: number | undefined, results: GrowableFloat64Array) {
    if (value !== undefined) {
      results.push(value);
    }
  }
  /**
   * Append 2 solutions -- note that both are required args, no option of omitting as in single solution case
   * @param value1
   * @param value2
   * @param results
   */
  private static append2Solutions(valueA: number, valueB: number, results: GrowableFloat64Array) {
    results.push(valueA);
    results.push(valueB);
  }

  /**
   * If `co/c1` is a safe division, append it to the values array.
   * @param c0 numerator
   * @param c1 denominator
   * @param values array to expand
   */
  public static appendLinearRoot(c0: number, c1: number, values: GrowableFloat64Array) {
    AnalyticRoots.appendSolution(Geometry.conditionalDivideFraction(-c0, c1), values);
  }
  /**
   * * Compute the mean of all the entries in `data`
   * * Return the data value that is farthest away
   */
  public static mostDistantFromMean(data: GrowableFloat64Array | undefined): number {
    if (!data || data.length === 0) return 0;
    let a = 0.0;  // to become the sum and finally the average.
    for (let i = 0; i < data.length; i++) a += data.atUncheckedIndex(i);
    a /= data.length;
    let dMax = 0.0;
    let result = data.atUncheckedIndex(0);
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(data.atUncheckedIndex(i) - a);
      if (d > dMax) {
        dMax = d;
        result = data.atUncheckedIndex(i);
      }
    }
    return result;
  }
  /**
   * Append 0, 1, or 2 solutions of a quadratic to the values array.
   * @param c array of coefficients for quadratic `c[0] + c[1] * x + c[2] * x*x`
   * @param values array to be expanded.
   */
  public static appendQuadraticRoots(c: Float64Array | number[], values: GrowableFloat64Array) {
    // Normal form: x^2 + 2px + q = 0

    const divFactor = Geometry.conditionalDivideFraction(1.0, c[2]);
    if (!divFactor) {
      this.appendLinearRoot(c[0], c[1], values);
      return;
    }

    const p = 0.5 * c[1] * divFactor;
    const q = c[0] * divFactor;

    const D = p * p - q;

    if (this.isZero(D)) {
      this.appendSolution(-p, values);
      return;
    } else if (D < 0) {
      return;
    } else if (D > 0) {
      const sqrtD = Math.sqrt(D);
      this.append2Solutions(sqrtD - p, - sqrtD - p, values);
      return;
    }
    return;
  }
  /** Add `a` to the constant term. */
  private static addConstant(value: number, data: GrowableFloat64Array) {
    for (let i = 0; i < data.length; i++) data.reassign(i, data.atUncheckedIndex(i) + value);
  }

  private static signedCubeRoot(y: number): number {
    if (y >= 0.0)
      return Math.pow(y, 1.0 / 3.0);
    return -Math.pow(-y, 1.0 / 3.0);
  }
  /**
   * RWD Nickalls Cubic solution
   * The Mathematical Gazette (1993) (vol 77) pp 354-359
   * * ASSUME a is nonzero.
   */
  // Solve full cubic ASSUMING a3 is nonzero.
  private static appendFullCubicSolutions(a: number, b: number, c: number, d: number, result: GrowableFloat64Array) {
    const q = b * b - 3.0 * a * c;
    const aa = a * a;
    const delta2 = q / (9.0 * aa);
    const xN = - b / (3.0 * a);
    const yN = d + xN * (c + xN * (b + xN * a));
    const yN2 = yN * yN;
    const h2 = 4.0 * a * a * delta2 * delta2 * delta2;
    const discriminant = yN2 - h2;
    if (discriminant > 0) {
      // 1 real root
      const r = Math.sqrt(discriminant);
      const f = 0.5 / a;
      result.push(xN + this.signedCubeRoot(f * (-yN + r)) + this.signedCubeRoot(f * (-yN - r)));
    } else if (discriminant < 0) {
      // 3 real roots
      let h = Math.sqrt(h2);
      // I don't see comment in Nickalls about sign of h -- but this sign change is needed ...
      if (a < 0)
        h = -h;
      // sign of h?
      const thetaRadians = Math.acos(-yN / h) / 3.0;
      const g = 2.0 * Math.sqrt(delta2);
      const shift = 2.0 * Math.PI / 3.0;
      result.push(xN + g * Math.cos(thetaRadians));
      result.push(xN + g * Math.cos(thetaRadians + shift));
      result.push(xN + g * Math.cos(thetaRadians - shift));
    } else {
      // NOTE: The double-root case is not toleranced.
      // double root + single root
      const delta = this.signedCubeRoot(0.5 * yN / a);
      const minMaxRoot = xN + delta;
      result.push(xN - 2 * delta);
      result.push(minMaxRoot);
      result.push(minMaxRoot);
    }
  }

  /* return roots of a cubic c0 + c1 *x + c2 * x^2 + c2 * x3.
   * In the usual case where c0 is non-zero, there are either 1 or 3 roots.
   * But if c0 is zero the (0, 1, or 2) roots of the lower order equation
   */
  /*
  private static _appendCubicRootsUnsorted(c: Float64Array | number[], results: GrowableFloat64Array) {
    let AA: number;
    let p: number;
    let q: number;

    // normal form: x^3 + Ax^2 + Bx + C = 0

    const scaleFactor = Geometry.conditionalDivideFraction(1.0, c[3]);
    if (!scaleFactor) {
      this.appendQuadraticRoots(c, results);
      return;
    }
    // It is a real cubic.  There MUST be at least one real solution . . .
    const A: number = c[2] * scaleFactor;
    const B: number = c[1] * scaleFactor;
    const C: number = c[0] * scaleFactor;

    //  substitute x = y - A/3 to eliminate quadric term:
    //    f = y^3 +3py + 2q = 0
    //    f' = 3y^2 + p
    //        local min/max at Y = +-sqrt (-p)
    //        f(+Y) = -p sqrt(-p) + 3p sqrt (-p) + 2q = 2 p sqrt (-p) + 2q
    AA = A * A;
    p = (3.0 * B - AA) / 9.0;
    q = 1.0 / 2 * (2.0 / 27 * A * AA - 1.0 / 3 * A * B + C);

    // Use Cardano formula
    const cb_p: number = p * p * p;
    const D: number = q * q + cb_p;
    const origin = A / (-3.0);
    if (D >= 0.0 && this.isZero(D)) {
      if (this.isZero(q)) {
        // One triple solution
        results.push(origin);
        results.push(origin);
        results.push(origin);
        return;
      } else {
        // One single and one double solution
        const u = this.cbrt(-q);
        if (u < 0) {
          results.push(origin + 2 * u);
          results.push(origin - u);
          results.push(origin - u);
          return;
        } else {
          results.push(origin - u);
          results.push(origin - u);
          results.push(origin + 2 * u);
          return;
        }
      }
    } else if (D <= 0) {      // three real solutions
      const phi = 1.0 / 3 * Math.acos(-q / Math.sqrt(-cb_p));
      const t = 2 * Math.sqrt(-p);
      results.push(origin + t * Math.cos(phi));
      results.push(origin - t * Math.cos(phi + Math.PI / 3));
      results.push(origin - t * Math.cos(phi - Math.PI / 3));
      this.improveRoots(c, 3, results, false);

      return;
    } else {    // One real solution
      const sqrtD = Math.sqrt(D);
      const u = this.cbrt(sqrtD - q);
      const v = -(this.cbrt(sqrtD + q));
      results.push(origin + u + v);
      this.improveRoots(c, 3, results, false);
      return;
    }
  }
  */
  /** Compute roots of cubic 'c[0] + c[1] * x + c[2] * x^2 + c[3] * x^3 */
  public static appendCubicRoots(c: Float64Array | number[], results: GrowableFloat64Array) {
    if (Geometry.conditionalDivideCoordinate(1.0, c[3]) !== undefined) {
      this.appendFullCubicSolutions(c[3], c[2], c[1], c[0], results);
      // EDL April 5, 2020 replace classic GraphicsGems solver by RWDNickalls.
      // Don't know if improveRoots is needed.
      // Breaks in AnalyticRoots.test.ts checkQuartic suggest it indeed converts many e-16 errors to zero.
      // e-13 cases are unaffected
      this.improveRoots(c, 3, results, false);
    } else {
      this.appendQuadraticRoots(c, results);
    }
    // this.appendCubicRootsUnsorted(c, results);
    results.sort();
  }
  /** Compute roots of quartic `c[0] + c[1] * x + c[2] * x^2 + c[3] * x^3 + c[4] * x^4` */
  public static appendQuarticRoots(c: Float64Array | number[], results: GrowableFloat64Array) {
    // for details, see core\geometry\internaldocs\quarticRoots.md
    const coffs = new Float64Array(4);
    let u: number;
    let v: number;
    const coffScale = new Float64Array(1);
    if (!this.safeDivide(coffScale, 1.0, c[4], 0.0, 0)) {
      this.appendCubicRoots(c, results);
      return;
    }
    // normal form: x^4 + Ax^3 + Bx^2 + Cx + D = 0
    const A: number = c[3] * coffScale[0];
    const B: number = c[2] * coffScale[0];
    const C: number = c[1] * coffScale[0];
    const D: number = c[0] * coffScale[0];
    const origin = -0.25 * A;
    // substitute x = y - A/4 to eliminate cubic term: y^4 + py^2 + qy + r = 0
    const AA: number = A * A;
    const p: number = -0.375 * AA + B;
    const q: number = 0.125 * AA * A - 0.5 * A * B + C;
    const r: number = -0.01171875 * AA * AA + 0.0625 * AA * B - 0.25 * A * C + D;
    const cubicSolutions = new GrowableFloat64Array();
    if (this.isZero(r)) { // no absolute term: y(y^3 + py + q) = 0
      coffs[0] = q;
      coffs[1] = p;
      coffs[2] = 0;
      coffs[3] = 1;
      this.appendCubicRoots(coffs, results);
      results.push(0);
      this.addConstant(origin, results); // apply origin
      return;
    } else { // solve the resolvent cubic
      coffs[0] = 0.5 * r * p - 0.125 * q * q;
      coffs[1] = -r;
      coffs[2] = -0.5 * p;
      coffs[3] = 1;
      this.appendCubicRoots(coffs, cubicSolutions);
      const z = this.mostDistantFromMean(cubicSolutions);
      u = z * z - r;
      v = 2 * z - p;
      if (this.isSmallRatio(u, r)) {
        u = 0;
      } else if (u > 0) {
        u = Math.sqrt(u);
      } else {
        return;
      }
      if (this.isSmallRatio(v, p)) {
        v = 0;
      } else if (v > 0) {
        v = Math.sqrt(v);
      } else {
        return;
      }
      // the two quadratic equations
      coffs[0] = z - u;
      coffs[1] = ((q < 0) ? (-v) : (v));
      coffs[2] = 1;
      this.appendQuadraticRoots(coffs, results);
      coffs[0] = z + u;
      coffs[1] = ((q < 0) ? (v) : (-v));
      coffs[2] = 1;
      this.appendQuadraticRoots(coffs, results);
    }
    this.addConstant(origin, results); // apply origin
    results.sort();
    this.improveRoots(c, 4, results, true);
    return;
  }

  private static appendCosSinRadians(c: number, s: number, cosValues: OptionalGrowableFloat64Array, sinValues: OptionalGrowableFloat64Array,
    radiansValues: OptionalGrowableFloat64Array) {
    if (cosValues) cosValues.push(c);
    if (sinValues) sinValues.push(s);
    if (radiansValues) radiansValues.push(Math.atan2(s, c));
  }

  /**
   * * Solve the simultaneous equations in variables`c` and`s`:
   *   * A line: `alpha + beta*c + gamma*s = 0`
   *   * The unit circle `c*c + s*s = 1`
   * * Solution values are returned as 0, 1, or 2(c, s) pairs
   * * Return value indicates one of these solution states:
   *   * -2 -- all coefficients identically 0.   The entire c, s plane-- and therefore the entire unit circle-- is a solution.
   *   * -1 -- beta, gamma are zero, alpha is not.There is no line defined.There are no solutions.
   *   * 0 -- the line is well defined, but passes completely outside the unit circle.
   *     * In this case, (c1, s1) is the circle point closest to the line and(c2, s2) is the line point closest to the circle.
   * * 1 -- the line is tangent to the unit circle.
   *   * Tangency is determined by tolerances, which calls a "close approach" point a tangency.
   *    * (c1, s1) is the closest circle point
   *    * (c2, s2) is the line point.
   * * 2 -- two simple intersections.
   * @param alpha constant coefficient on line
   * @param beta x cosine coefficient on line
   * @param gamma y sine coefficient on line
   * @param relTol relative tolerance for tangencies
   * @param cosValues (caller allocated) array to receive solution `c` values
   * @param sinValues (caller allocated) array to receive solution `s` values
   * @param radiansValues (caller allocated) array to receive solution radians values.
   */
  public static appendImplicitLineUnitCircleIntersections(
    alpha: number,
    beta: number,
    gamma: number,
    cosValues: OptionalGrowableFloat64Array,
    sinValues: OptionalGrowableFloat64Array,
    radiansValues: OptionalGrowableFloat64Array,
    relTol: number = 1.0e-14,
  ): number {
    let twoTol: number;
    const delta2 = beta * beta + gamma * gamma;
    const alpha2 = alpha * alpha;
    let solutionType = 0;
    if (relTol < 0.0) {
      twoTol = 0.0;
    } else {
      twoTol = 2.0 * relTol;
    }
    if (delta2 <= 0.0) {
      solutionType = (alpha === 0) ? -2 : -1;
    } else {
      const lambda = - alpha / delta2;
      const a2 = alpha2 / delta2;
      const D2 = 1.0 - a2;
      if (D2 < -twoTol) {
        const delta = Math.sqrt(delta2);
        const iota = (alpha < 0) ? (1.0 / delta) : (-1.0 / delta);
        this.appendCosSinRadians(lambda * beta, lambda * gamma, cosValues, sinValues, radiansValues);
        this.appendCosSinRadians(beta * iota, gamma * iota, cosValues, sinValues, radiansValues);
        solutionType = 0;
      } else if (D2 < twoTol) {
        const delta = Math.sqrt(delta2);
        const iota = (alpha < 0) ? (1.0 / delta) : (- 1.0 / delta);
        this.appendCosSinRadians(lambda * beta, lambda * gamma, cosValues, sinValues, radiansValues);
        this.appendCosSinRadians(beta * iota, gamma * iota, cosValues, sinValues, radiansValues);
        solutionType = 1;
      } else {
        const mu = Math.sqrt(D2 / delta2);
        /* c0,s0 = closest approach of line to origin */
        const c0 = lambda * beta;
        const s0 = lambda * gamma;
        this.appendCosSinRadians(c0 - mu * gamma, s0 + mu * beta, cosValues, sinValues, radiansValues);
        this.appendCosSinRadians(c0 + mu * gamma, s0 - mu * beta, cosValues, sinValues, radiansValues);
        solutionType = 2;
      }
    }
    return solutionType;
  }
}
/**
 * Manipulations of polynomials with where `coff[i]` multiplies x^i
 * @internal
 */
export class PowerPolynomial {
  /** Evaluate a standard basis polynomial at `x`, with `degree` possibly less than `coff.length` */
  public static degreeKnownEvaluate(coff: Float64Array, degree: number, x: number): number {
    if (degree < 0) {
      return 0.0;
    }
    let p = coff[degree];
    for (let i = degree - 1; i >= 0; i--)
      p = x * p + coff[i];
    return p;
  }
  /** Evaluate the standard basis polynomial of degree `coff.length` at `x` */
  public static evaluate(coff: Float64Array, x: number): number {
    const degree = coff.length - 1;
    return this.degreeKnownEvaluate(coff, degree, x);
  }
  /**
   * Accumulate `coffQ*scaleQ` into `coffP`.
   * * The length of `coffP` must be at least length of `coffQ`.
   * * Returns degree of result as determined by comparing trailing coefficients to zero.
   */
  public static accumulate(coffP: Float64Array, coffQ: Float64Array, scaleQ: number): number {
    let degreeP = coffP.length - 1;
    const degreeQ = coffQ.length - 1;
    for (let i = 0; i <= degreeQ; i++)
      coffP[i] += scaleQ * coffQ[i];
    while (degreeP >= 0 && coffP[degreeP] === 0.0)
      degreeP--;
    return degreeP;
  }
  /** Zero all coefficients */
  public static zero(coff: Float64Array) {
    for (let i = 0; i < coff.length; i++) {
      coff[i] = 0.0;
    }
  }
}
/**
 * manipulation of polynomials with powers of sine and cosine
 * @internal
 */
export class TrigPolynomial {
  // tolerance for small angle decision.
  private static readonly _smallAngle: number = 1.0e-11;

  // see core\geometry\internaldocs\unitCircleEllipseIntersection.md for derivation of these coefficients.
  /** Standard Basis coefficients for the numerator of the y-coordinate y(t) = S(t)/W(t) in the rational semicircle parameterization. */
  public static readonly S = Float64Array.from([0.0, 2.0, -2.0]);
  /** Standard Basis coefficients for the numerator of the x-coordinate x(t) = C(t)/W(t) in the rational semicircle parameterization. */
  public static readonly C = Float64Array.from([1.0, -2.0]);
  /** Standard Basis coefficients for the denominator of x(t) and y(t) in the rational semicircle parameterization. */
  public static readonly W = Float64Array.from([1.0, -2.0, 2.0]);
  /** Standard Basis coefficients for C(t) * W(t). */
  public static readonly CW = Float64Array.from([1.0, -4.0, 6.0, -4.0]);
  /** Standard Basis coefficients for S(t) * W(t). */
  public static readonly SW = Float64Array.from([0.0, 2.0, -6.0, 8.0, -4.0]);
  /** Standard Basis coefficients for S(t) * C(t). */
  public static readonly SC = Float64Array.from([0.0, 2.0, -6.0, 4.0]);
  /** Standard Basis coefficients for S(t) * S(t). */
  public static readonly SS = Float64Array.from([0.0, 0.0, 4.0, -8.0, 4.0]);
  /** Standard Basis coefficients for C(t) * C(t). */
  public static readonly CC = Float64Array.from([1.0, -4.0, 4.0]);
  /** Standard Basis coefficients for W(t) * W(t). */
  public static readonly WW = Float64Array.from([1.0, -4.0, 8.0, -8.0, 4.0]);
  /** Standard Basis coefficients for C(t) * C(t) - S(t) * S(t). */
  public static readonly CCMinusSS = Float64Array.from([1.0, -4.0, 0.0, 8.0, -4.0]); // eslint-disable-line @typescript-eslint/naming-convention

  /**
   * Find the roots of a univariate polynomial created from substituting the rational parameterization of the unit
   * circle into a trigonometric polynomial. Roots are returned as radian angles.
   * * Currently implemented for polynomials of degree <= 4.
   * * For example, the ellipse-ellipse intersection problem reduces to finding the roots of a quartic polynomial:
   * `p(t) = coff[0] + coff[1] t + coff[2] t^2 + coff[3] t^3 + coff[4] t^4`.
   * * Particular care is given to report a root at t = +/-infinity, which corresponds to the returned angle -pi/2.
   * @param coff coefficients in the power basis
   * @param nominalDegree degree of the polynomial under the most complex root case.
   * @param referenceCoefficient a number which represents the size of coefficients at various stages of computation.
   * A small fraction of this number will be used as a zero tolerance.
   * @param radians roots are placed here.
   * @return false if equation is all zeros. This usually means any angle is a solution.
   */
  public static solveAngles(
    coff: Float64Array, nominalDegree: number, referenceCoefficient: number, radians: number[],
  ): boolean {
    let maxCoff = Math.abs(referenceCoefficient);
    let a;
    radians.length = 0;
    const relTol = this._smallAngle;
    for (let i = 0; i <= nominalDegree; i++) {
      a = Math.abs(coff[i]);
      if (a > maxCoff)
        maxCoff = a;
    }
    const coffTol = relTol * maxCoff;
    let degree = nominalDegree;
    while (degree > 0 && (Math.abs(coff[degree]) <= coffTol))
      degree--;
    const roots = new GrowableFloat64Array();
    if (degree === -1) {
      // do nothing
    } else {
      if (degree === 0) {
        // p(t) is a nonzero constant; no roots but not degenerate.
      } else if (degree === 1) {
        roots.push(-coff[0] / coff[1]); // p(t) = coff[0] + coff[1] * t
      } else if (degree === 2) {
        AnalyticRoots.appendQuadraticRoots(coff, roots);
      } else if (degree === 3) {
        AnalyticRoots.appendCubicRoots(coff, roots);
      } else if (degree === 4) {
        AnalyticRoots.appendQuarticRoots(coff, roots);
      } else {
        // TODO: WORK WITH BEZIER SOLVER
        assert(false, "Unimplemented degree in trig solver");
      }
      if (roots.length > 0) {
        // each solution t represents an angle with Math.Cos(theta) = C(t)/W(t) and sin(theta) = S(t)/W(t)
        // division by W has no effect on atan2 calculations, so we just compute S(t),C(t)
        for (let i = 0; i < roots.length; i++) {
          const ss = PowerPolynomial.evaluate(this.S, roots.atUncheckedIndex(i));
          const cc = PowerPolynomial.evaluate(this.C, roots.atUncheckedIndex(i));
          radians.push(Math.atan2(ss, cc));
        }
      }
      // If the tail of the coff array is zero, we solved a polynomial of lesser degree above, and
      // we report the skipped "root at infinity" as the corresponding angle -pi/2 (without multiplicity).
      // See core\geometry\internaldocs\unitCircleEllipseIntersection.md for details.
      if (degree < nominalDegree)
        radians.push(-0.5 * Math.PI);
    }
    return radians.length > 0;
  }
  private static readonly _coefficientRelTol = 1.0e-12;
  /**
   * Compute intersections of the unit circle `x^2 + y^2 = 1` with the general quadric (conic)
   * `axx x^2 + axy xy + ayy y^2 + ax x + ay y + a = 0`.
   * @param axx coefficient of x^2
   * @param axy coefficient of xy
   * @param ayy coefficient of y^2
   * @param ax coefficient of x
   * @param ay coefficient of y
   * @param a constant coefficient
   * @param radians up to 4 solution angles t in the quadric parameterization: x = cos(t), y = sin(t)
   */
  public static solveUnitCircleImplicitQuadricIntersection(
    axx: number, axy: number, ayy: number, ax: number, ay: number, a: number, radians: number[],
  ): boolean {
    const coffs = new Float64Array(5);
    PowerPolynomial.zero(coffs);
    let degree;
    // see core\geometry\internaldocs\unitCircleEllipseIntersection.md for derivation of these coefficients
    if (Geometry.hypotenuseXYZ(axx, axy, ayy) > TrigPolynomial._coefficientRelTol * Geometry.hypotenuseXYZ(ax, ay, a)) {
      PowerPolynomial.accumulate(coffs, this.CW, ax);
      PowerPolynomial.accumulate(coffs, this.SW, ay);
      PowerPolynomial.accumulate(coffs, this.WW, a);
      PowerPolynomial.accumulate(coffs, this.SS, ayy);
      PowerPolynomial.accumulate(coffs, this.CC, axx);
      PowerPolynomial.accumulate(coffs, this.SC, axy);
      degree = 4;
    } else {
      PowerPolynomial.accumulate(coffs, this.C, ax);
      PowerPolynomial.accumulate(coffs, this.S, ay);
      PowerPolynomial.accumulate(coffs, this.W, a);
      degree = 2;
    }
    const maxCoff = Math.max(Math.abs(axx), Math.abs(ayy), Math.abs(axy), Math.abs(ax), Math.abs(ay), Math.abs(a));
    const b = this.solveAngles(coffs, degree, maxCoff, radians);
    /*
    for (const theta of angles) {
      const c = theta.cos();
      const s = theta.sin();
      GeometryCoreTestIO.consoleLog({
        angle: theta, co: c, si: s,
        f: axx * c * c + axy * c * s + ayy * s * s + ax * c + ay * s + a,
      });
    } */
    return b;
  }
  /**
   * Compute intersections of unit circle x^2 + y 2 = 1 with the ellipse
   *         (x,y) = (cx + ux Math.Cos + vx sin, cy + uy Math.Cos + vy sin)
   * Solutions are returned as angles in the ellipse space.
   * @param cx center x
   * @param cy center y
   * @param ux 0 degree vector x
   * @param uy 0 degree vector y
   * @param vx 90 degree vector x
   * @param vy 90 degree vector y
   * @param ellipseRadians solution angles in ellipse parameter space
   * @param circleRadians solution angles in circle parameter space
   */
  public static solveUnitCircleEllipseIntersection(
    cx: number, cy: number,
    ux: number, uy: number,
    vx: number, vy: number,
    ellipseRadians: number[], circleRadians: number[],
  ): boolean {
    circleRadians.length = 0;
    // see core\geometry\internaldocs\unitCircleEllipseIntersection.md for derivation of these coefficients:
    const acc = ux * ux + uy * uy;
    const acs = 2.0 * (ux * vx + uy * vy);
    const ass = vx * vx + vy * vy;
    const ac = 2.0 * (ux * cx + uy * cy);
    const as = 2.0 * (vx * cx + vy * cy);
    const a = cx * cx + cy * cy - 1.0;
    const status = this.solveUnitCircleImplicitQuadricIntersection(acc, acs, ass, ac, as, a, ellipseRadians);
    for (const radians of ellipseRadians) {
      const cc = Math.cos(radians);
      const ss = Math.sin(radians);
      const x = cx + ux * cc + vx * ss;
      const y = cy + uy * cc + vy * ss;
      circleRadians.push(Math.atan2(y, x));
    }
    return status;
  }
  /**
   * Compute intersections of unit circle `x^2 + y^2 = w^2` (in homogeneous coordinates) with the ellipse
   * `F(t) = (cx + ux cos(t) + vx sin(t), cy + uy cos(t) + vy sin(t)) / (cw + uw cos(t) + vw sin(t))`.
   * @param cx center x
   * @param cy center y
   * @param cw center w
   * @param ux 0 degree vector x
   * @param uy 0 degree vector y
   * @param uw 0 degree vector w
   * @param vx 90 degree vector x
   * @param vy 90 degree vector y
   * @param vw 90 degree vector w
   * @param ellipseRadians solution angles in ellipse parameter space
   * @param circleRadians solution angles in circle parameter space
   */
  public static solveUnitCircleHomogeneousEllipseIntersection(
    cx: number, cy: number, cw: number,
    ux: number, uy: number, uw: number,
    vx: number, vy: number, vw: number,
    ellipseRadians: number[], circleRadians: number[],
  ): boolean {
    circleRadians.length = 0;
    // see core\geometry\internaldocs\unitCircleEllipseIntersection.md for derivation of these coefficients:
    const acc = ux * ux + uy * uy - uw * uw;
    const acs = 2.0 * (ux * vx + uy * vy - uw * vw);
    const ass = vx * vx + vy * vy - vw * vw;
    const ac = 2.0 * (ux * cx + uy * cy - uw * cw);
    const as = 2.0 * (vx * cx + vy * cy - vw * cw);
    const a = cx * cx + cy * cy - cw * cw;
    const status = this.solveUnitCircleImplicitQuadricIntersection(
      acc, acs, ass, ac, as, a, ellipseRadians,
    );
    for (const radians of ellipseRadians) {
      const cc = Math.cos(radians);
      const ss = Math.sin(radians);
      const x = cx + ux * cc + vx * ss;
      const y = cy + uy * cc + vy * ss;
      circleRadians.push(Math.atan2(y, x));
    }
    return status;
  }
}

/**
 * * bilinear expression
 * * `f(u,v) = a + b * u * c * v + d * u * v`
 * @internal
 */
export class BilinearPolynomial {
  /** constant coefficient */
  public a: number;
  /** u coefficient */
  public b: number;
  /** v coefficient */
  public c: number;
  /** uv coefficient */
  public d: number;
  /**
   *
   * @param a constant coefficient
   * @param b `u` coefficient
   * @param c `v` coefficient
   * @param d `u*v` coefficient
   */
  public constructor(a: number, b: number, c: number, d: number) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }
  /**
   * Evaluate the bilinear expression at u,v
   */
  public evaluate(u: number, v: number): number {
    return this.a + this.b * u + v * (this.c + this.d * u);
  }
  /** Create a bilinear polynomial z=f(u,v) given z values at 00, 10, 01, 11.
   */
  public static createUnitSquareValues(f00: number, f10: number, f01: number, f11: number): BilinearPolynomial {
    return new BilinearPolynomial(f00, f10, f10, f11 - f10 - f01);
  }
  /**
   * Solve a pair of bilinear equations
   * * First equation: `a0 + b0 * u + c0 * v + d0 * u * v = 0`
   * * Second equation: `a1 + b1 * u + c1 * v + d1 * u * v = 0`
   */
  public static solveBilinearPair(
    a0: number, b0: number, c0: number, d0: number,
    a1: number, b1: number, c1: number, d1: number,
  ): Point2d[] | undefined {
    // constant linear, and quadratic coefficients for c0 + c1 * u + c2 * u*u = 0
    const e0 = Geometry.crossProductXYXY(a0, a1, c0, c1);
    const e1 = Geometry.crossProductXYXY(b0, b1, c0, c1) + Geometry.crossProductXYXY(a0, a1, d0, d1);
    const e2 = Geometry.crossProductXYXY(b0, b1, d0, d1);
    const uRoots = Degree2PowerPolynomial.solveQuadratic(e2, e1, e0);
    if (uRoots === undefined)
      return undefined;
    const uv = [];
    for (const u of uRoots) {
      const v0 = Geometry.conditionalDivideFraction(-(a0 + b0 * u), c0 + d0 * u);
      const v1 = Geometry.conditionalDivideFraction(-(a1 + b1 * u), c1 + d1 * u);
      if (v0 !== undefined)
        uv.push(Point2d.create(u, v0));
      else if (v1 !== undefined)
        uv.push(Point2d.create(u, v1));
    }
    return uv;
  }
  /**
   * Solve the simultaneous equations
   * * `p(u,v) = pValue`
   * * `q(u,v) = qValue`
   * @param p
   * @param pValue
   * @param q
   * @param qValue
   */
  public static solvePair(p: BilinearPolynomial, pValue: number, q: BilinearPolynomial, qValue: number): Point2d[] | undefined {
    return BilinearPolynomial.solveBilinearPair(p.a - pValue, p.b, p.c, p.d, q.a - qValue, q.b, q.c, q.d);
  }
}

/**
 * * trigonometric expresses `f(theta) = a + cosineCoff * cos(theta) + sineCoff * sin(theta)`
 * @internal
 */
export class SineCosinePolynomial {
  /** constant coefficient */
  public a: number;
  /** cosine coefficient */
  public cosineCoff: number;
  /** sine coefficient */
  public sineCoff: number;
  /**
   *
   * @param a constant coefficient
   * @param cosineCoff `cos(theta)` coefficient
   * @param sinCoff `sin(theta)` coefficient
   */
  public constructor(a: number, cosCoff: number, sinCoff: number) {
    this.a = a;
    this.cosineCoff = cosCoff;
    this.sineCoff = sinCoff;
  }
  /** set all coefficients */
  public set(a: number, cosCoff: number, sinCoff: number) {
    this.a = a;
    this.cosineCoff = cosCoff;
    this.sineCoff = sinCoff;
  }
  /** Return the function value at given angle in radians */
  public evaluateRadians(theta: number): number {
    return this.a + this.cosineCoff * Math.cos(theta) + this.sineCoff * Math.sin(theta);
  }
  /** Return the range of function values over the entire angle range. */
  public range(result?: Range1d): Range1d {
    const q = Geometry.hypotenuseXY(this.cosineCoff, this.sineCoff);
    return Range1d.createXX(this.a - q, this.a + q, result);
  }
  /** Return the min and max values of the function over theta range from radians0 to radians1  inclusive. */
  public rangeInStartEndRadians(radians0: number, radians1: number, result?: Range1d): Range1d {
    if (Angle.isFullCircleRadians(radians1 - radians0))
      return this.range(result);
    result = Range1d.createXX(this.evaluateRadians(radians0), this.evaluateRadians(radians1), result);
    // angles of min and max ...
    // angles for min and max of the sine wave . ..
    const alphaA = Math.atan2(this.sineCoff, this.cosineCoff);
    const alphaB = alphaA + Math.PI;
    if (AngleSweep.isRadiansInStartEnd(alphaA, radians0, radians1))
      result.extendX(this.evaluateRadians(alphaA));
    if (AngleSweep.isRadiansInStartEnd(alphaB, radians0, radians1))
      result.extendX(this.evaluateRadians(alphaB));
    return result;
  }
  /** Return the min and max values of the function over theta range from radians0 to radians1  inclusive. */
  public rangeInSweep(sweep: AngleSweep, result?: Range1d): Range1d {
    return this.rangeInStartEndRadians(sweep.startRadians, sweep.endRadians, result);
  }
  /**
   * Return a representative angle (in radians) for min and max values.
   * * The radians value is atan2(sineCoff, cosineCoff)
   * * Hence the candidates for min and max of the function are at this value and this value plus PI
   */
  public referenceMinMaxRadians(): number {
    return Math.atan2(this.sineCoff, this.cosineCoff);
  }
}
/**
 * Support for an implicit linear equation (half space)
 * f(x,y) = a0 + x * ax + y * ay
 * @internal
 */
export class ImplicitLineXY {
  /**
   * constant coefficient
   */
  public a: number;
  /**
  * x coefficient
  */
  public ax: number;
  /**
   * y coefficient
   */
  public ay: number;
  /** construct the ImplicitLineXY from coefficients */
  public constructor(a: number, ax: number, ay: number) {
    this.a = a;
    this.ax = ax;
    this.ay = ay;
  }
  /** Compute 2 points of a line segment with
   * * the segment is on the zero-line of this ImplicitLineXY
   * * the start and endpoints are distance `b` from the projection of the origin onto the ImplicitLineXY
   * @returns undefined if ax,ay are both zero.   Otherwise the two points of the segment.
   */
  public convertToSegmentPoints(b: number): Point3d[] | undefined {
    const q = Math.sqrt(this.ax * this.ax + this.ay * this.ay);
    const alpha = Geometry.conditionalDivideCoordinate(1.0, q, 1.0e10);
    if (alpha === undefined)
      return undefined;
    const ux = alpha * this.ax;
    const uy = alpha * this.ay;
    const px = -alpha * ux;
    const py = -alpha * uy;
    return [Point3d.create(px - b * uy, py + b * ux), Point3d.create(px + b * uy, py - b * ux)];
  }
  /**
   * Evaluate the half-space function at an xy point
   * @param xy xy values for evaluation
   * @returns evaluation.
   */
  public evaluatePoint(xy: XAndY): number {
    return this.a + xy.x * this.ax + xy.y * this.ay;
  }
  /**
   * add scale * (a,ax,ay) to the respective coefficients.
   */
  public addScaledCoefficientsInPlace(a: number, ax: number, ay: number, scale: number) {
    this.a += scale * a;
    this.ax += scale * ax;
    this.ay += scale * ay;
  }
}
