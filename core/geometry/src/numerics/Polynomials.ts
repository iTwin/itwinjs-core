/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Numerics */

import { Point2d, Vector2d, Point3d, Vector3d } from "../PointVector";
// import { Angle, AngleSweep, Geometry } from "../Geometry";
import { Geometry } from "../Geometry";
import { OptionalGrowableFloat64Array, GrowableFloat64Array } from "../GrowableArray";
// import { Arc3d } from "../curve/Arc3d";

/* tslint:disable:variable-name*/
export class Degree2PowerPolynomial {
  public coffs: number[];

  constructor(c0: number = 0, c1: number = 0, c2: number = 0) {
    this.coffs = [c0, c1, c2];
  }

  /**
   * * Return 2 duplicate roots in double root case.
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

  public addConstant(a: number) {
    this.coffs[0] += a;
  }

  // Add s * (a + b*x)^2 to the quadratic coefficients
  public addSquaredLinearTerm(a: number, b: number, s: number = 1): void {
    this.coffs[0] += s * (a * a);
    this.coffs[1] += s * (2.0 * a * b);
    this.coffs[2] += s * (b * b);
  }

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

  /**
   * Evaluate the quadratic at x.
   */
  public evaluate(x: number): number {
    return this.coffs[0] + x * (this.coffs[1] + x * this.coffs[2]);
  }

  /**
   * Evaluate the bezier function at a parameter value.  (i.e. summ the basis functions times coefficients)
   * @param u parameter for evaluation
   */
  public evaluateDerivative(x: number): number {
    return this.coffs[1] + 2 * x * this.coffs[2];
  }

  // Factor the polyonmial as c0 + c1 * x + c2 * x*x = y0 + c2 * (x-x0)^2
  public tryGetVertexFactorization(): { x0: number, y0: number, c: number } | undefined {
    const x = Geometry.conditionalDivideFraction(-this.coffs[1], 2.0 * this.coffs[2]);
    if (x !== undefined) {
      const y = this.evaluate(x);
      return { c: this.coffs[2], x0: x, y0: y };
    }
    return undefined;
  }

  public static fromRootsAndC2(root0: number, root1: number, c2: number = 1) {
    return new Degree2PowerPolynomial(
      c2 * root0 * root1,
      - c2 * (root0 + root1),
      c2);
  }

}
export class Degree3PowerPolynomial {
  public coffs: number[];

  constructor(c0: number = 0, c1: number = 0, c2: number = 0, c3: number = 1) {
    this.coffs = [c0, c1, c2, c3];
  }

  public addConstant(a: number) {
    this.coffs[0] += a;
  }

  // Add s * (a + b*x)^2 to the quadratic coefficients
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

  public static fromRootsAndC3(root0: number, root1: number, root2: number, c3: number = 1.0): Degree3PowerPolynomial {
    return new Degree3PowerPolynomial(
      -c3 * root0 * root1 * root2,
      c3 * (root0 * root1 + root1 * root2 + root0 * root2),
      - c3 * (root0 + root1 + root2),
      c3);
  }

}
export class Degree4PowerPolynomial {
  public coffs: number[];

  constructor(c0: number = 0, c1: number = 0, c2: number = 0, c3: number = 0, c4: number = 0) {
    this.coffs = [c0, c1, c2, c3, c4];
  }

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

  public static fromRootsAndC4(root0: number, root1: number, root2: number, root3: number, c4: number = 1): Degree4PowerPolynomial {
    return new Degree4PowerPolynomial(
      c4 * (root0 * root1 * root2 * root3),
      -c4 * (root0 * root1 * root2 + root0 * root1 * root3 + root0 * root2 * root3 + root1 * root2 * root3),
      c4 * (root0 * root1 + root0 * root2 + root0 * root3 + root1 * root2 + root1 * root3 + root2 * root3),
      -c4 * (root0 + root1 + root2 + root3),
      c4);
  }

}
export class TorusImplicit {
  public majorRadius: number;
  public minorRadius: number;

  constructor(majorRadiusR: number, minorRadiusr: number) {
    this.majorRadius = majorRadiusR;
    this.minorRadius = minorRadiusr;
  }

  // Return size of box (e.g. for use as scale factor)
  public boxSize() {
    return (Math.abs(this.majorRadius) + Math.abs(this.minorRadius));
  }
  /** @returns a scale factor appropriate to control the magnitude of the implicit function. */
  public implicitFunctionScale(): number {
    const a = this.boxSize();
    if (a === 0.0)
      return 1.0;
    return 1.0 / (a * a * a * a);
  }

  // Implicit equation for the torus is ...
  // (x^2+y^2+z^2+(R^2-r^2))^2 = 4 R^2(x^2+y^2)
  // x,y,z are weighted,
  // (x^2+y^2+z^2+(R^2-r^2)w^2)^2 = 4 R^2 w^2 (x^2+y^2)
  public evaluateImplicitFunctionXYZ(x: number, y: number, z: number): number {
    const rho2 = x * x + y * y;
    const z2 = z * z;
    const R2 = this.majorRadius * this.majorRadius;
    const r2 = this.minorRadius * this.minorRadius;
    const f = rho2 + z2 + (R2 - r2);
    const g = 4.0 * R2 * rho2;
    return (f * f - g) * this.implicitFunctionScale();
  }

  public evaluateImplicitFunctionPoint(xyz: Point3d): number {
    return this.evaluateImplicitFunctionXYZ(xyz.x, xyz.y, xyz.z);
  }

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

  // public intersectRay(ray: Ray3d, rayFractions: number, points: Point3d, maxHit: number) {}

  public evaluateThetaPhi(theta: number, phi: number): Point3d {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    // theta=0 point
    const x0 = this.majorRadius + this.minorRadius * Math.cos(phi);
    const z0 = this.minorRadius * Math.sin(phi);
    return Point3d.create(c * x0, s * x0, z0);
  }

  public evaluateDerivativesThetaPhi(theta: number, phi: number, dxdTheta: Vector3d, dxdPhi: Vector3d) {
    const cTheta = Math.cos(theta);
    const sTheta = Math.sin(theta);
    const bx = this.minorRadius * Math.cos(phi);
    const bz = this.minorRadius * Math.sin(phi);
    const x0 = this.majorRadius + bx;
    Vector3d.create(-x0 * sTheta, x0 * cTheta, 0.0, dxdTheta);
    Vector3d.create(-cTheta * bz, -sTheta * bz, bx, dxdPhi);
  }

  public evaluateThetaPhiDistance(theta: number, phi: number, distance: number): Point3d {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    // theta=0 point
    const x0 = this.majorRadius + distance * Math.cos(phi);
    const z0 = distance * Math.sin(phi);
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
  public XYZToThetaPhiDistance(xyz: Point3d): { theta: number, phi: number, distance: number, rho: number, safePhi: boolean } {
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
    const drho = rho - this.majorRadius;
    let safePhi;
    let phi;
    if (xyz.z === 0.0 && drho === 0.0) {
      phi = 0.0;
      safePhi = false;
    } else {
      phi = Math.atan2(xyz.z, drho);
      safePhi = true;
    }
    return { theta: (theta), phi: (phi), distance: (distance), rho: (rho), safePhi: safeMajor && safePhi };
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
 * evaluation methods for an implicit sphere `x*x + y*y + z*z - r*r = 0`.
 */
export class SphereImplicit {
  public radius: number;
  constructor(r: number) { this.radius = r; }

  // Evaluate the implicit function at space point
  // @param [in] xyz coordinates
  public evaluateImplicitFunction(x: number, y: number, z: number): number {
    return x * x + y * y + z * z - this.radius * this.radius;
  }

  // Evaluate the implicit function at weighted space point (wx/w, wy/w, wz/w)
  // @param [in] wx (preweighted) x coordinate
  // @param [in] wy (preweighted) y coordinate
  // @param [in] wz (preweighted) z coordinate
  // @param [in] w  weight
  public evaluateImplicitFunctionXYZW(wx: number, wy: number, wz: number, w: number): number {
    if (w === 0.0)
      return 0.0;
    return (wx * wx + wy * wy + wz * wz) - this.radius * this.radius * w * w;
  }

  public XYZToThetaPhiR(xyz: Point3d): { theta: number, phi: number, r: number, valid: boolean } {
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
    return { theta: (theta), phi: (phi), r: (r), valid: (valid) };
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

  // Compute the point on the surface at specified angles
  // @param [in] theta major circle angle.
  // @param [in] phi minor circle angle.
  // @return point on surface
  public evaluateThetaPhi(thetaRadians: number, phiRadians: number): Point3d {
    const rc = this.radius * Math.cos(thetaRadians);
    const rs = this.radius * Math.sin(thetaRadians);
    const cosPhi = Math.cos(phiRadians);
    const sinPhi = Math.sin(phiRadians);
    return Point3d.create(rc * cosPhi, rs * cosPhi, this.radius * sinPhi);
  }

  // Compute derivatives of the point on the surface at specified angles
  // @param [in] theta major circle angle.
  // @param [in] phi minor circle angle.
  // @param [out] dXdTheta derivative wrt theta
  // @param [out] dXdPhi derivative wrt phi
  public evaluateDerivativesThetaPhi(theta: number, phi: number, dxdTheta: Vector3d, dxdPhi: Vector3d) {
    const rc = this.radius * Math.cos(theta);
    const rs = this.radius * Math.sin(theta);
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
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
 *
 */
export class AnalyticRoots {

  public static readonly EQN_EPS = 1.0e-9;
  public static readonly s_safeDivideFactor = 1.0e-14;
  public static readonly s_quadricRelTol = 1.0e-14;
  public static readonly sTestWindow = 1.0e-6;
  /** Absolute zero test with a tolerance that has worked well for the analytic root use case . . . */
  public static IsZero(x: number): boolean {
    return Math.abs(x) < this.EQN_EPS;
  }
  /** Without actually doing a division, test if (x/y) is small.
   * @param x numerator
   * @param y denominator
   * @param abstol absolute tolerance
   * @param reltol relative tolerance
   */
  public static isSmallRatio(x: number, y: number, abstol: number = 1.0e-9, reltol: number = 8.0e-16) {
    return Math.abs(x) <= abstol || Math.abs(x) < reltol * Math.abs(y);
  }
  // @returns the principal (always real) cube root of x.
  public static cbrt(x: number): number {
    return ((x) > 0.0 ? Math.pow((x), 1.0 / 3.0) : ((x) < 0.0 ? -Math.pow(-(x), 1.0 / 3.0) : 0.0));
  }
  /**
   * Try to divide `numerator/denominator` and place the result (or defaultValue) in `values[offset]`
   * @param values array of values.  `values[offset]` will be replaced.
   * @param numerator numerator for division.
   * @param denominator denominator for division.
   * @param defaultValue value to save if denominator is too small to divide.
   * @param offset index of value to replace.
   */
  public static SafeDivide(values: Float64Array, numerator: number, denominator: number, defaultValue: number = 0.0, offset: number): boolean {
    if (Math.abs(denominator) > (this.s_safeDivideFactor * Math.abs(numerator))) {
      values[offset] = numerator / denominator;
      return true;
    }
    values[offset] = defaultValue;
    return false;
  }
  // Used in NewtonMethod for testing if a root has been adjusted past its bounding region
  private static checkRootProximity(roots: GrowableFloat64Array, i: number): boolean {
    if (i === 0) { // Case 1: Beginning Root (check root following it)
      return roots.at(i) < roots.at(i + 1);
    } else if (i > 0 && i + 1 < roots.length) { // Case 2: Middle Root (check roots before and after)
      return (roots.at(i) > roots.at(i - 1)) && (roots.at(i) < roots.at(i + 1));
    } else { // Case 3: End root (check preceding root)
      return (roots.at(i) > roots.at(i - 1));
    }
  }
  private static NewtonMethodAdjustment(coffs: Float64Array | number[], root: number, order: number) {
    if (order === 3) {
      const f = coffs[0] + root * (coffs[1] + root * (coffs[2] + root * coffs[3]));
      const df = coffs[1] + root * (2.0 * coffs[2] + root * 3.0 * coffs[3]);
      return f / df;
    } else if (order === 4) {
      const f = coffs[0] + root * (coffs[1] + root * (coffs[2] + root * (coffs[3] + root * coffs[4])));
      const df = coffs[1] + root * (2.0 * coffs[2] + root * (3.0 * coffs[3] + root * 4.0 * coffs[4]));
      return f / df;
    } else {
      return 0;
    }
  }
  private static improveSortedRoots(coffs: Float64Array | number[], degree: number, roots: GrowableFloat64Array) {
    const relTol = 1.0e-10;

    // Loop through each root
    for (let i = 0; i < roots.length; i++) {
      let dx = this.NewtonMethodAdjustment(coffs, roots.at(i), degree);
      if (!dx) continue;  // skip if newton step had divide by zero.
      const originalValue = roots.at(i);
      let counter = 0;
      let convergenceCounter = 0;

      // Loop through applying changes to found root until dx is diminished or counter is hit
      while (dx !== 0 && (counter < 10)) {
        // consider it converged if two successive iterations satisfy the (not too demanding) tolerance.
        if (Math.abs(dx) < relTol * (1.0 + Math.abs(roots.at(i)))) {
          if (++convergenceCounter > 1)
            break;
        } else {
          convergenceCounter = 0;
        }

        const rootDX = roots.at(i) - dx;
        roots.reassign(i, rootDX);

        // If root is thrown past one of its neighboring roots, unstable condition is assumed.. revert
        // to originally found root
        if (!this.checkRootProximity(roots, i)) {
          roots.reassign(i, originalValue);
          break;
        }

        dx = this.NewtonMethodAdjustment(coffs, roots.at(i), degree);
        counter++;
      }
    }
  }
  /**
   * Append (if defined) value to results.
   * @param value optional value to append
   * @param results growning array
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
   * If `co/c1` is a safed division, append it to the values array.
   * @param c0 numerator
   * @param c1 denominaotr
   * @param values array to expand
   */
  public static appendLinearRoot(c0: number, c1: number, values: GrowableFloat64Array) {
    AnalyticRoots.appendSolution(Geometry.conditionalDivideFraction(-c0, c1), values);
  }
  // Search an array for the value which is farthest from the average of all the values.
  private static mostDistantFromMean(data: GrowableFloat64Array | undefined): number {
    if (!data || data.length === 0) return 0;
    let a = 0.0;  // to become the sum and finally the average.
    for (let i = 0; i < data.length; i++) a += data.at(i);
    a /= data.length;
    let dMax = 0.0;
    let result = data.at(0);
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(data.at(i) - a);
      if (d < dMax) {
        dMax = d;
        result = data.at(i);
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

    if (this.IsZero(D)) {
      this.appendSolution(-p, values);
      return;
    } else if (D < 0) {
      return;
    } else if (D > 0) {
      const sqrt_D = Math.sqrt(D);
      this.append2Solutions(sqrt_D - p, - sqrt_D - p, values);
      return;
    }
    return;
  }
  private static addConstant(value: number, data: GrowableFloat64Array) {
    for (let i = 0; i < data.length; i++) data.reassign(i, data.at(i) + value);
  }
  /** return roots of a cubic c0 + c1 *x + c2 * x^2 + c2 * x3.
   * In the usual case where c0 is non-zero, there are either 1 or 3 roots.
   * But if c0 is zero the (0, 1, or 2) roots of the lower order equation
   */
  private static appendCubicRootsUnsorted(c: Float64Array | number[], results: GrowableFloat64Array) {
    let A: number;
    let B: number;
    let C: number;
    let sq_A: number;
    let p: number;
    let q: number;
    let cb_p: number;
    let D: number;

    // normal form: x^3 + Ax^2 + Bx + C = 0

    const scaleFactor = Geometry.conditionalDivideFraction(1.0, c[3]);
    if (!scaleFactor) {
      this.appendQuadraticRoots(c, results);
      return;
    }

    // It is a real cubic.  There MUST be at least one real solution . . .
    A = c[2] * scaleFactor;
    B = c[1] * scaleFactor;
    C = c[0] * scaleFactor;

    /*  substitute x = y - A/3 to eliminate quadric term:
        f = y^3 +3py + 2q = 0
        f' = 3y^2 + p
            local min/max at Y = +-sqrt (-p)
            f(+Y) = -p sqrt(-p) + 3p sqrt (-p) + 2q = 2 p sqrt (-p) + 2q
    */
    sq_A = A * A;
    p = (3.0 * B - sq_A) / 9.0;
    q = 1.0 / 2 * (2.0 / 27 * A * sq_A - 1.0 / 3 * A * B + C);

    // Use Cardano's formula
    cb_p = p * p * p;
    D = q * q + cb_p;
    const origin = A / (-3.0);
    if (D >= 0.0 && this.IsZero(D)) {
      if (this.IsZero(q)) {
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
    } else if (D <= 0) {      // Causes irreducibilis: three real solutions
      const phi = 1.0 / 3 * Math.acos(-q / Math.sqrt(-cb_p));
      const t = 2 * Math.sqrt(-p);
      results.push(origin + t * Math.cos(phi));
      results.push(origin - t * Math.cos(phi + Math.PI / 3));
      results.push(origin - t * Math.cos(phi - Math.PI / 3));
      return;
    } else {    // One real solution
      const sqrt_D = Math.sqrt(D);
      const u = this.cbrt(sqrt_D - q);
      const v = -(this.cbrt(sqrt_D + q));
      results.push(origin + u + v);
      return;
    }
  }
  public static appendCubicRoots(c: Float64Array | number[], results: GrowableFloat64Array) {
    this.appendCubicRootsUnsorted(c, results);
    results.sort();
  }

  public static appendQuarticRoots(c: Float64Array | number[], results: GrowableFloat64Array) {
    const coeffs = new Float64Array(4); // at various times .. coefficients of quadratic an cubic intermediates.
    let u: number;
    let v: number;
    let A: number;
    let B: number;
    let C: number;
    let D: number;
    let sq_A: number;
    let p: number;
    let q: number;
    let r: number;

    // normal form: x^4 + Ax^3 + Bx^2 + Cx + D = 0

    const coffScale = new Float64Array(1);
    if (!this.SafeDivide(coffScale, 1.0, c[4], 0.0, 0)) {
      this.appendCubicRoots(c, results);
      return;
    }
    A = c[3] * coffScale[0];
    B = c[2] * coffScale[0];
    C = c[1] * coffScale[0];
    D = c[0] * coffScale[0];
    const origin = -0.25 * A;
    /*  substitute x = y - A/4 to eliminate cubic term:
        x^4 + px^2 + qx + r = 0 */
    sq_A = A * A;
    p = -3.0 / 8 * sq_A + B;
    q = 0.125 * sq_A * A - 0.5 * A * B + C;
    r = -3.0 / 256 * sq_A * sq_A + 1.0 / 16 * sq_A * B - 1.0 / 4 * A * C + D;

    const tempStack = new GrowableFloat64Array();

    if (this.IsZero(r)) {

      // no absolute term: y(y^3 + py + q) = 0
      coeffs[0] = q;
      coeffs[1] = p;
      coeffs[2] = 0;
      coeffs[3] = 1;
      this.appendCubicRootsUnsorted(coeffs, results);
      results.push(0); // APPLY ORIGIN ....
      this.addConstant(origin, results);
      return;
    } else {

      // Solve the resolvent cubic
      coeffs[0] = 1.0 / 2 * r * p - 1.0 / 8 * q * q;
      coeffs[1] = - r;
      coeffs[2] = - 1.0 / 2 * p;
      coeffs[3] = 1;

      this.appendCubicRootsUnsorted(coeffs, tempStack);
      const z = this.mostDistantFromMean(tempStack);

      // ... to build two quadric equations
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
        for (let i = 0; i < tempStack.length; i++) {
          results.push(tempStack.at(i));
        }
        return;
      }

      coeffs[0] = z - u;
      coeffs[1] = ((q < 0) ? (-v) : (v));
      coeffs[2] = 1;

      this.appendQuadraticRoots(coeffs, results);

      coeffs[0] = z + u;
      coeffs[1] = ((q < 0) ? (v) : (-v));
      coeffs[2] = 1;

      this.appendQuadraticRoots(coeffs, results);
    }

    // resubstitute
    this.addConstant(origin, results);

    results.sort();
    this.improveSortedRoots(c, 4, results);

    return;
  }

  private static appendCosSinRadians(c: number, s: number, cosValues: OptionalGrowableFloat64Array, sinValues: OptionalGrowableFloat64Array,
    radiansValues: OptionalGrowableFloat64Array) {
    if (cosValues) cosValues.push(c);
    if (sinValues) sinValues.push(s);
    if (radiansValues) radiansValues.push(Math.atan2(s, c));
  }

  /*-----------------------------------------------------------------
   Solve the simultaneous equations
   <pre>
                 alpha + beta*c + gamma*s = 0
                 c*c + s*s = 1

   @param c1P OUT x cosine component of first solution point
   @param s1P OUT y sine component of first solution point
   @param c2P OUT x cosine component of second solution point
   @param s2P OUT y sine component of second solution point
   @param solutionType OUT One of the following values:
  <pre>
      -2 -- all coefficients identically 0.   The entire c,s plane -- and therefore
          the entire unit circle -- is a solution.
      -1 -- beta,gamma are zero, alpha is not.   There is no line defined.  There are
          no solutions.
      0 -- the line is well defined, but passes completely outside the unit circle.
              In this case, (c1,s1) is the circle point closest to the line
              and (c2,s2) is the line point closest to the circle.
      1 -- the line is tangent to the unit circle.  As tangency is identified at
              numerical precision, faithful interpretation of the coefficients
              may allow for some distance from line to circle. (c1,s1) is returned
              as the closest circle point, (c2,s2) the line point.  These are
              nominally the same but may differ due to the tolerance
              decision.
      2 -- two simple intersections.
  </pre>

    @param alpha => constant coefficient on line
   @param beta => x cosine coefficient on line
   @param gamma => y sine coefficient on line
   @param reltol => relative tolerance for tangencies
   @return the (nonnegative) solution count.

  @remarks Here is an example of the tangible meaning of the coefficients and
  the cryptic 5-way solution type separation.
  Point X on a 3D ellipse at parameter space angle theta is given by
      X = C + U cos(theta) + V sin(theta)
  where C,U,V are (respectively) center, 0 degree, and 90 degree vectors.
  A plane has normal N and is at distance a from the origin.  X is on the plane if
      X.N = a
  i.e.
      C.N + U.N cos(theta) + V.N sin(theta) = a
  i.e.
      C.N - a + U.N cos(theta) + V.N sin(theta) = 0
  i.e.
      alpha = C.N - a
      beta =  U.N
      gamma = V.N
  If the ellipse is parallel to the plane, both beta and gamma are zero.  These are
  the two degenerat cases.  If alpha is also zero the entire ellipse is completely
  in the plane.   If alpha is nonzero the ellipse is completely out of plane.

  If the ellipse plane is NOT parallel, there are zero, one, or two solutions according as
  the ellipse is completly on one side, tangent or is properly split by the plane.

   @bsihdr                                       EarlinLutz      12/97
  +---------------+---------------+---------------+---------------+------*/
  public static appendImplicitLineUnitCircleIntersections(alpha: number, beta: number, gamma: number,
    cosValues: OptionalGrowableFloat64Array, sinValues: OptionalGrowableFloat64Array, radiansValues: OptionalGrowableFloat64Array,
    reltol: number = 1.0e-14): number {

    let twoTol: number;
    const delta2 = beta * beta + gamma * gamma;
    const alpha2 = alpha * alpha;
    let solutionType = 0;

    if (reltol < 0.0) {
      twoTol = 0.0;
    } else {
      twoTol = 2.0 * reltol;
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

export class PowerPolynomial {

  // Evaluate a standard basis polynomial.
  public static degreeKnownEvaluate(coff: Float64Array, degree: number, x: number): number {
    if (degree < 0) {
      return 0.0;
    }
    let p = coff[degree];
    for (let i = degree - 1; i >= 0; i--)
      p = x * p + coff[i];
    return p;
  }
  // Evaluate a standard basis polynomial
  public static Evaluate(coff: Float64Array, x: number): number {
    const degree = coff.length - 1;
    return this.degreeKnownEvaluate(coff, degree, x);
  }

  // Accumulate Q*scale into P.  Both are treated as full degree.
  //         (Expect Address exceptions if P is smaller than Q)
  // Returns degree of result as determined by comparing leading coefficients to zero
  public static Accumulate(coffP: Float64Array, coffQ: Float64Array, scaleQ: number): number {
    let degreeP = coffP.length - 1;
    const degreeQ = coffQ.length - 1;

    for (let i = 0; i <= degreeQ; i++) {
      coffP[i] += scaleQ * coffQ[i];
    }

    while (degreeP >= 0 && coffP[degreeP] === 0.0) {
      degreeP--;
    }
    return degreeP;
  }
  // Zero all coefficients in a polynomial
  public static Zero(coff: Float64Array) {
    for (let i = 0; i < coff.length; i++) {
      coff[i] = 0.0;
    }
  }
}
export class TrigPolynomial {
  // Constants taken from Angle.cpp (may be later moved to a constants module)
  public static readonly SmallAngle: number = 1.0e-11;

  // Standard Basis coefficients for rational sine numerator.
  public static readonly S = Float64Array.from([0.0, 2.0, -2.0]);
  // Standard Basis coefficients for rational cosine numerator.
  public static readonly C = Float64Array.from([1.0, -2.0]);
  // Standard Basis coefficients for rational denominator.
  public static readonly W = Float64Array.from([1.0, -2.0, 2.0]);
  // Standard Basis coefficients for cosine*weight numerator
  public static readonly CW = Float64Array.from([1.0, -4.0, 6.0, -4.0]);
  // Standard Basis coefficients for sine*weight numerator
  public static readonly SW = Float64Array.from([0.0, 2.0, -6.0, 8.0, -4.0]);
  // Standard Basis coefficients for sine*cosine numerator
  public static readonly SC = Float64Array.from([0.0, 2.0, -6.0, 4.0]);
  // Standard Basis coefficients for sine^2 numerator
  public static readonly SS = Float64Array.from([0.0, 0.0, 4.0, -8.0, 4.0]);
  // Standard Basis coefficients for cosine^2 numerator
  public static readonly CC = Float64Array.from([1.0, -4.0, 4.0]);
  // Standard Basis coefficients for weight^2
  public static readonly WW = Float64Array.from([1.0, -4.0, 8.0, -8.0, 4.0]);
  // Standard Basis coefficients for (Math.Cos^2 - sine^2) numerator
  public static readonly CCminusSS = Float64Array.from([1.0, -4.0, 0.0, 8.0, -4.0]);

  /// Solve a polynomial created from trigonometric condition using
  /// Trig.S, Trig.C, Trig.W.  Solution logic includes inferring angular roots
  /// corresponding zero leading coefficients (roots at infinity)
  /// <param name="coff">Coefficients</param>
  /// <param name="nominalDegree">degree of the polynomial under most complex
  ///     root case.  If there are any zero coefficients up to this degree, a single root
  ///     "at infinity" is recorded as its corresponding angular parameter at negative pi/2
  /// <param name="referenceCoefficient">A number which represents the size of coefficients
  ///     at various stages of computation.  A small fraction of this will be used as a zero
  ///     tolerance</param>
  /// <param name="angles">Roots are placed here. Assumed preallocated with adequate size.</param>
  /// <param name="numRoots">Number of roots  .  Zero roots is possible. (Passed as array of size
  /// one to pass-by-reference)</param>
  /// Returns false if equation is all zeros.   This usually means any angle is a solution.
  // ------------------------------------------------------------------------------------------------
  // Solve a standard basis polynomial.   Immediately use the roots as ordinates
  //            in rational polynomials for sine and cosine, and convert to angle via arctan
  public static SolveAngles(coff: Float64Array, nominalDegree: number, referenceCoefficient: number,
    radians: number[]): boolean {
    let maxCoff = Math.abs(referenceCoefficient);
    let a;
    radians.length = 0;
    const relTol = this.SmallAngle;

    for (let i = 0; i <= nominalDegree; i++) {
      a = Math.abs(coff[i]);
      if (a > maxCoff) {
        maxCoff = a;
      }
    }
    const coffTol = relTol * maxCoff;
    let degree = nominalDegree;
    while (degree > 0 && (Math.abs(coff[degree - 1]) <= coffTol)) {
      degree--;
    }
    // let bstat = false;
    const roots = new GrowableFloat64Array();
    if (degree === -1) {
      // Umm.   Dunno.   Nothing there.
      // bstat = false;
    } else {
      // bstat = true;
      if (degree === 0) {
        // p(t) is a nonzero constant
        // No roots, but not degenerate.
        // bstat = true;
      } else if (degree === 1) {
        // p(t) = coff[1] * t + coff[0]...
        roots.push(- coff[0] / coff[1]);
      } else if (degree === 2) {
        AnalyticRoots.appendQuadraticRoots(coff, roots);
      } else if (degree === 3) {
        AnalyticRoots.appendCubicRoots(coff, roots);
      } else if (degree === 4) {
        AnalyticRoots.appendQuarticRoots(coff, roots);
      } else {
        // TODO: WILL WORK WITH BEZIER SOLVER
        // bstat = false;
      }
      if (roots.length > 0) {
        // Each solution t represents an angle with
        //  Math.Cos(theta)=C(t)/W(t),  ,sin(theta)=S(t)/W(t)
        // Division by W has no effect on Atan2 calculations, so we just compute S(t),C(t)
        for (let i = 0; i < roots.length; i++) {
          const ss = PowerPolynomial.Evaluate(this.S, roots.at(i));
          const cc = PowerPolynomial.Evaluate(this.C, roots.at(i));
          radians.push(Math.atan2(ss, cc));
        }

        // Each leading zero at the front of the coefficients corresponds to a root at -PI/2.
        // Only make one entry....
        // for (int i = degree; i < nominalDegree; i++)
        if (degree < nominalDegree) {
          radians.push(-0.5 * Math.PI);
        }
      }
    }
    return radians.length > 0;
  }
  public static readonly coeffientRelTol = 1.0e-12;
  /// <summary> Compute intersections of unit circle x^2 + y 2 = 1 with general quadric
  ///         axx*x^2 + axy*x*y + ayy*y^2 + ax * x + ay * y + a1 = 0
  /// Solutions are returned as angles. Sine and Cosine of the angles are the x,y results.
  /// <param name="axx">Coefficient of x^2</param>
  /// <param name="axy">Coefficient of xy</param>
  /// <param name="ayy">Coefficient of y^2</param>
  /// <param name="ax">Coefficient of x</param>
  /// <param name="ay">Coefficient of y</param>
  /// <param name="a1">Constant coefficient</param>
  /// <param name="angles">solution angles</param>
  /// <param name="numAngle">number of solution angles (Passed as array to make changes to reference)</param>
  public static SolveUnitCircleImplicitQuadricIntersection(axx: number, axy: number, ayy: number,
    ax: number, ay: number, a1: number, radians: number[]): boolean {
    const Coffs = new Float64Array(5);
    PowerPolynomial.Zero(Coffs);
    let degree = 2;
    if (Math.hypot(axx, axy, ayy) > TrigPolynomial.coeffientRelTol * Math.hypot(ax, ay, a1)) {
      PowerPolynomial.Accumulate(Coffs, this.CW, ax);
      PowerPolynomial.Accumulate(Coffs, this.SW, ay);
      PowerPolynomial.Accumulate(Coffs, this.WW, a1);
      PowerPolynomial.Accumulate(Coffs, this.SS, ayy);
      PowerPolynomial.Accumulate(Coffs, this.CC, axx);
      PowerPolynomial.Accumulate(Coffs, this.SC, axy);
      degree = 4;
    } else {
      PowerPolynomial.Accumulate(Coffs, this.C, ax);
      PowerPolynomial.Accumulate(Coffs, this.S, ay);
      PowerPolynomial.Accumulate(Coffs, this.W, a1);
      degree = 2;
    }

    let maxCoff = 0.0;
    maxCoff = Math.max(maxCoff,
      Math.abs(axx),
      Math.abs(ayy),
      Math.abs(axy),
      Math.abs(ax),
      Math.abs(ay),
      Math.abs(a1));

    const b = this.SolveAngles(Coffs, degree, maxCoff, radians);
    /*
    for (const theta of angles) {
      const c = theta.cos();
      const s = theta.sin();
      console.log({
        angle: theta, co: c, si: s,
        f: axx * c * c + axy * c * s + ayy * s * s + ax * c + ay * s + a1});
  } */

    return b;
  }
  /// <summary> Compute intersections of unit circle x^2 + y 2 = 1 with the ellipse
  ///         (x,y) = (cx + ux Math.Cos + vx sin, cy + uy Math.Cos + vy sin)
  /// Solutions are returned as angles in the ellipse space.
  /// <param name="cx">center x</param>
  /// <param name="cy">center y</param>
  /// <param name="ux">0 degree vector x</param>
  /// <param name="uy">0 degree vector y</param>
  /// <param name="vx">90 degree vector x</param>
  /// <param name="vy">90 degree vector y</param>
  /// <param name="ellipseAngles">solution angles in ellipse parameter space</param>
  /// <param name="circleAngles">solution angles in circle parameter space</param>
  /// <param name="numAngle">number of solution angles (passed as an array to change reference)</param>
  public static SolveUnitCircleEllipseIntersection(cx: number, cy: number, ux: number, uy: number,
    vx: number, vy: number, ellipseRadians: number[], circleRadians: number[]): boolean {
    circleRadians.length = 0;
    const acc = ux * ux + uy * uy;
    const acs = 2.0 * (ux * vx + uy * vy);
    const ass = vx * vx + vy * vy;
    const ac = 2.0 * (ux * cx + uy * cy);
    const asi = 2.0 * (vx * cx + vy * cy);
    const a = cx * cx + cy * cy - 1.0;
    const boolstat = this.SolveUnitCircleImplicitQuadricIntersection(acc, acs, ass, ac, asi, a, ellipseRadians);
    for (const radians of ellipseRadians) {
      const cc = Math.cos(radians);
      const ss = Math.sin(radians);
      const x = cx + ux * cc + vx * ss;
      const y = cy + uy * cc + vy * ss;
      circleRadians.push(Math.atan2(y, x));
    }
    return boolstat;
  }
}
export class SmallSystem {
  /**
   * Return true if lines (a0,a1) to (b0, b1) have a simple intersection.
   * Return the fractional (not xy) coordinates in result.x, result.y
   * @param a0 start point of line a
   * @param a1  end point of line a
   * @param b0  start point of line b
   * @param b1 end point of line b
   * @param result point to receive fractional coordinates of intersection.   result.x is fraction on line a. result.y is fraction on line b.
   */
  public static lineSegment2dXYTransverseIntersectionUnbounded(a0: Point2d, a1: Point2d, b0: Point2d, b1: Point2d,
    result: Vector2d): boolean {
    const ux = a1.x - a0.x;
    const uy = a1.y - a0.y;

    const vx = b1.x - b0.x;
    const vy = b1.y - b0.y;

    const cx = b0.x - a0.x;
    const cy = b0.y - a0.y;

    const uv = Geometry.crossProductXYXY(ux, uy, vx, vy);
    const cv = Geometry.crossProductXYXY(cx, cy, vx, vy);
    const cu = Geometry.crossProductXYXY(ux, uy, cx, cy);
    const s = Geometry.conditionalDivideFraction(cv, uv);
    const t = Geometry.conditionalDivideFraction(cu, uv);
    if (s !== undefined && t !== undefined) {
      result.set(s, -t);
      return true;
    }
    result.set(0, 0);
    return false;
  }

  /**
   * Return true if lines (a0,a1) to (b0, b1) have a simple intersection using only xy parts
   * Return the fractional (not xy) coordinates in result.x, result.y
   * @param a0 start point of line a
   * @param a1  end point of line a
   * @param b0  start point of line b
   * @param b1 end point of line b
   * @param result point to receive fractional coordinates of intersection.   result.x is fraction on line a. result.y is fraction on line b.
   */
  public static lineSegment3dXYTransverseIntersectionUnbounded(a0: Point3d, a1: Point3d, b0: Point3d, b1: Point3d,
    result: Vector2d): boolean {
    const ux = a1.x - a0.x;
    const uy = a1.y - a0.y;

    const vx = b1.x - b0.x;
    const vy = b1.y - b0.y;

    const cx = b0.x - a0.x;
    const cy = b0.y - a0.y;

    const uv = Geometry.crossProductXYXY(ux, uy, vx, vy);
    const cv = Geometry.crossProductXYXY(cx, cy, vx, vy);
    const cu = Geometry.crossProductXYXY(ux, uy, cx, cy);
    const s = Geometry.conditionalDivideFraction(cv, uv);
    const t = Geometry.conditionalDivideFraction(cu, uv);
    if (s !== undefined && t !== undefined) {
      result.set(s, -t);
      return true;
    }
    result.set(0, 0);
    return false;
  }

  /**
   * Return true if lines (a0,a1) to (b0, b1) have closest approach (go by each other) in 3d
   * Return the fractional (not xy) coordinates in result.x, result.y
   * @param a0 start point of line a
   * @param a1  end point of line a
   * @param b0  start point of line b
   * @param b1 end point of line b
   * @param result point to receive fractional coordinates of intersection.   result.x is fraction on line a. result.y is fraction on line b.
   */
  public static lineSegment3dClosestApproachUnbounded(a0: Point3d, a1: Point3d, b0: Point3d, b1: Point3d,
    result: Vector2d): boolean {
    const ux = a1.x - a0.x;
    const uy = a1.y - a0.y;
    const uz = a1.z - a0.z;

    const vx = b1.x - b0.x;
    const vy = b1.y - b0.y;
    const vz = b1.z - b0.z;

    const cx = b0.x - a0.x;
    const cy = b0.y - a0.y;
    const cz = b0.z - a0.z;

    const uu = Geometry.dotProductXYZXYZ(ux, uy, uz, ux, uy, uz);
    const vv = Geometry.dotProductXYZXYZ(vx, vy, vz, vx, vy, vz);
    const uv = Geometry.dotProductXYZXYZ(ux, uy, uz, vx, vy, vz);
    const cu = Geometry.dotProductXYZXYZ(cx, cy, cz, ux, uy, uz);
    const cv = Geometry.dotProductXYZXYZ(cx, cy, cz, vx, vy, vz);
    return SmallSystem.linearSystem2d(uu, -uv, uv, -vv, cu, cv, result);
  }

  public static linearSystem2d(
    ux: number, vx: number, // first row of matrix
    uy: number, vy: number, // second row of matrix
    cx: number, cy: number, // right side
    result: Vector2d): boolean {
    const uv = Geometry.crossProductXYXY(ux, uy, vx, vy);
    const cv = Geometry.crossProductXYXY(cx, cy, vx, vy);
    const cu = Geometry.crossProductXYXY(ux, uy, cx, cy);
    const s = Geometry.conditionalDivideFraction(cv, uv);
    const t = Geometry.conditionalDivideFraction(cu, uv);
    if (s !== undefined && t !== undefined) {
      result.set(s, t);
      return true;
    }
    result.set(0, 0);
    return false;
  }
  /**
   * Solve a linear system
   * * x equation: `ux *u * vx * v + wx * w = cx`
   * * y equation: `uy *u * vy * v + wy * w = cy`
   * * z equation: `uz *u * vz * v + wz * w = cz`
   * @param axx row 0, column 0 coefficient
   * @param axy row 0, column 1 coefficient
   * @param axz row 0, column 1 coefficient
   * @param ayx row 1, column 0 coefficient
   * @param ayy row 1, column 1 coefficient
   * @param ayz row 1, column 2 coefficient
   * @param azx row 2, column 0 coefficient
   * @param azy row 2, column 1 coefficient
   * @param azz row 2, column 2 coefficient
   * @param cx right hand side row 0 coefficient
   * @param cy right hand side row 1 coefficient
   * @param cz right hand side row 2 coeficient
   * @param result optional result.
   */
  public static linearSystem3d(
    axx: number, axy: number, axz: number, // first row of matrix
    ayx: number, ayy: number, ayz: number, // second row of matrix
    azx: number, azy: number, azz: number, // second row of matrix
    cx: number, cy: number, cz: number, // right side
    result?: Vector3d): Vector3d | undefined {
    // determinants of various combinations of columns ...
    const detXYZ = Geometry.tripleProduct(axx, ayx, azx, axy, ayy, azy, axz, ayz, azz);
    const detCYZ = Geometry.tripleProduct(cx, cy, cz, axy, ayy, azy, axz, ayz, azz);
    const detXCZ = Geometry.tripleProduct(axx, ayx, azx, cx, cy, cz, axz, ayz, azz);
    const detXYC = Geometry.tripleProduct(cx, cy, cz, axy, ayy, azy, cx, cy, cz);
    const s = Geometry.conditionalDivideFraction(detCYZ, detXYZ);
    const t = Geometry.conditionalDivideFraction(detXCZ, detXYZ);
    const u = Geometry.conditionalDivideFraction(detXYC, detXYZ);
    if (s !== undefined && t !== undefined && t !== undefined) {
      return Vector3d.create(s, t, u, result);
    }
    return undefined;
  }

}
