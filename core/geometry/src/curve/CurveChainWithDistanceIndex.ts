/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { Geometry } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";
import { IStrokeHandler, GeometryHandler } from "../geometry3d/GeometryHandler";
import { StrokeOptions } from "./StrokeOptions";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { CurveChain } from "./CurveCollection";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { LineString3d } from "./LineString3d";
import { Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { CurveLocationDetail } from "./CurveLocationDetail";
/**
 * * Annotation of an interval of a curve.
 * * The interval is marked with two pairs of numbers:
 * * * fraction0, fraction1 = fraction parameters along the child curve
 * * * distance0,distance1 = distances within containing CurveChainWithDistanceIndex
 */
class PathFragment {
  public chainDistance0: number;
  public chainDistance1: number;
  public childFraction0: number;
  public childFraction1: number;
  public childCurve: CurvePrimitive;
  public constructor(childFraction0: number, childFraction1: number, distance0: number, distance1: number, childCurve: CurvePrimitive) {
    this.childFraction0 = childFraction0;
    this.childFraction1 = childFraction1;
    this.chainDistance0 = distance0;
    this.chainDistance1 = distance1;
    this.childCurve = childCurve;
  }
  /**
   * @returns true if the distance is within the distance limits of this fragment.
   * @param distance
   */
  public containsChainDistance(distance: number): boolean {
    return distance >= this.chainDistance0 && distance <= this.chainDistance1;
  }

  /**
   * @returns true if this fragment addresses `curve` and brackets `fraction`
   * @param distance
   */
  public containsChildCurveAndChildFraction(curve: CurvePrimitive, fraction: number): boolean {
    return this.childCurve === curve && fraction >= this.childFraction0 && fraction <= this.childFraction1;
  }

  /** Convert distance to local fraction, and apply that to interpolate between the stored curve fractions.
   * Note that proportional calculation does NOT account for nonuniform parameterization in the child curve.
   */
  public chainDistanceToInterpolatedChildFraction(distance: number): number {
    return Geometry.inverseInterpolate(
      this.childFraction0, this.chainDistance0,
      this.childFraction1, this.chainDistance1,
      distance, this.childFraction0)!;    // the interval "must" have nonzero length, division should be safe . ..
  }
  /** Convert chainDistance to true chidFraction, using detailed moveSignedDistanceFromFraction
   */
  public chainDistanceToAccurateChildFraction(chainDistance: number): number {
    // The fragments are really expected to do good mappings in their distance range ...
    const childDetail = this.childCurve.moveSignedDistanceFromFraction(
      this.childFraction0, chainDistance - this.chainDistance0, false);
    return childDetail.fraction;
  }
  /** Return the scale factor to map childCurve fraction derivatives to chain fraction derivatives
   * @param globalDistance total length of the global curve.
   */
  public fractionScaleFactor(globalDistance: number): number {
    return globalDistance * (this.childFraction1 - this.childFraction0) / (this.chainDistance1 - this.chainDistance0);
  }
  public reverseFractionsAndDistances(totalDistance: number) {
    const f0 = this.childFraction0;
    const f1 = this.childFraction1;
    const d0 = this.chainDistance0;
    const d1 = this.chainDistance1;
    this.childFraction0 = 1.0 - f1;
    this.childFraction1 = 1.0 - f0;
    this.chainDistance0 = totalDistance - d1;
    this.chainDistance1 = totalDistance - d0;
  }
  /**
   * convert a fractional position on the childCurve to distance in the chain space.
   * @param fraction fraction along the curve within this fragment
   */
  public childFractionTChainDistance(fraction: number): number {
    return this.chainDistance0 + this.childCurve.curveLengthBetweenFractions(this.childFraction0, fraction);
  }
}
/** Non-instantiable class to build a distance index for a path. */
class DistanceIndexConstructionContext implements IStrokeHandler {
  private _fragments: PathFragment[];
  private _accumulatedDistance: number;
  private constructor() {
    this._accumulatedDistance = 0;
    this._fragments = [];
  }
  // ignore curve announcements -- they are repeated in stroke announcements
  public startParentCurvePrimitive(_cp: CurvePrimitive) { }
  public startCurvePrimitive(_cp: CurvePrimitive) { }
  public endParentCurvePrimitive(_cp: CurvePrimitive) { }
  public endCurvePrimitive(_cp: CurvePrimitive) { }
  // um .. we need to see curves? how to reject?
  public announcePointTangent(_xyz: Point3d, _fraction: number, _tangent: Vector3d) { }
  /** Announce numPoints interpolated between point0 and point1, with associated fractions */
  public announceSegmentInterval(
    cp: CurvePrimitive,
    point0: Point3d,
    point1: Point3d,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    let d0 = this._accumulatedDistance;
    if (numStrokes <= 1) {
      this._accumulatedDistance += point0.distance(point1);
      this._fragments.push(new PathFragment(fraction0, fraction1, d0, this._accumulatedDistance, cp));
    } else {
      let f1;
      for (let i = 1, f0 = 0.0; i <= numStrokes; i++ , f0 = f1) {
        f1 = Geometry.interpolate(fraction0, i / numStrokes, fraction1);
        d0 = this._accumulatedDistance;
        this._accumulatedDistance += (Math.abs(f1 - f0) * point0.distance(point1));
        this._fragments.push(new PathFragment(f0, f1, d0, this._accumulatedDistance, cp));
      }
    }
  }
  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive,
    numStrokes: number,
    fraction0: number,
    fraction1: number): void {
    let f1, d, d0;
    for (let i = 1, f0 = fraction0; i <= numStrokes; i++ , f0 = f1) {
      f1 = Geometry.interpolate(fraction0, i / numStrokes, fraction1);
      d = cp.curveLengthBetweenFractions(f0, f1);
      d0 = this._accumulatedDistance;
      this._accumulatedDistance += d;
      this._fragments.push(new PathFragment(f0, f1, d0, this._accumulatedDistance, cp));
    }
  }
  public static createPathFragmentIndex(path: CurveChain, options?: StrokeOptions): PathFragment[] {
    const handler = new DistanceIndexConstructionContext();
    for (const curve of path.children) {
      curve.emitStrokableParts(handler, options);
    }
    const fragments = handler._fragments;
    return fragments;
  }
}
/**
 * `CurveChainWithDistanceIndex` is a CurvePrimitive whose fractional parameterization is proportional to true
 * distance along a CurveChain.
 * * The curve chain can be any type derived from CurveChain.
 * * * i.e. either a `Path` or a `Loop`
 */
export class CurveChainWithDistanceIndex extends CurvePrimitive {
  private _path: CurveChain;
  private _fragments: PathFragment[];
  private _totalLength: number; // matches final fragment distance1.
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof CurveChainWithDistanceIndex; }
  // finall assembly of CurveChainWithDistanceIndex -- caller must create valid fragment index.
  private constructor(path: CurveChain, fragments: PathFragment[]) {
    super();
    this._path = path;
    this._fragments = fragments;
    this._totalLength = fragments[fragments.length - 1].chainDistance1;
  }
  /**
   * Create a clone, transformed and with its own distance index.
   * @param transform transform to apply in the clone.
   */
  public cloneTransformed(transform: Transform): CurvePrimitive | undefined {
    const c = this._path.clone();
    if (c !== undefined && c instanceof CurveChain && c.tryTransformInPlace(transform))
      return CurveChainWithDistanceIndex.createCapture(c as CurveChain);
    return undefined;
  }
  public clone(): CurvePrimitive | undefined {
    const c = this._path.clone();
    if (c !== undefined && c instanceof CurveChain)
      return CurveChainWithDistanceIndex.createCapture(c as CurveChain);
    return undefined;
  }
  /** Ask if the curve is within tolerance of a plane.
   * @returns Returns true if the curve is completely within tolerance of the plane.
   */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    for (const c of this._path.children) {
      if (!c.isInPlane(plane))
        return false;
    }
    return true;
  }

  /** return the start point of the primitive.  The default implementation returns fractionToPoint (0.0) */
  public startPoint(result?: Point3d): Point3d {
    const c = this._path.cyclicCurvePrimitive(0);
    if (c)
      return c.startPoint(result);
    return Point3d.createZero(result);
  }
  /** @returns return the end point of the primitive. The default implementation returns fractionToPoint(1.0) */
  public endPoint(result?: Point3d): Point3d {
    const c = this._path.cyclicCurvePrimitive(-1);
    if (c)
      return c.startPoint(result);
    return Point3d.createZero(result);
  }
  /** Add strokes to caller-supplied linestring */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    for (const c of this._path.children) {
      c.emitStrokes(dest, options);
    }
  }
  /** Ask the curve to announce points and simple subcurve fragments for stroking.
   * See IStrokeHandler for description of the sequence of the method calls.
   */
  public emitStrokableParts(dest: IStrokeHandler, options?: StrokeOptions): void {
    for (const c of this._path.children) {
      c.emitStrokableParts(dest, options);
    }
  }
  /** dispatch the path to the handler */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    this._path.dispatchToGeometryHandler(handler);
  }
  /** Extend (increase) `rangeToExtend` as needed to include these curves (optionally transformed)
   */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this._path.extendRange(rangeToExtend, transform);
  }
  /**
   *
   * * Curve length is always positive.
   * @returns Returns a (high accuracy) length of the curve between fractional positions
   * @returns Returns the length of the curve.
   */
  public curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
    return Math.abs(fraction1 - fraction0) * this._totalLength;
  }
  /**
   *
   * @param primitives primitive array to be CAPTURED (not cloned)
   */
  public static createCapture(path: CurveChain, options?: StrokeOptions): CurveChainWithDistanceIndex {
    const fragments = DistanceIndexConstructionContext.createPathFragmentIndex(path, options);
    const result = new CurveChainWithDistanceIndex(path, fragments);
    return result;
  }

  /**
   * Resolve a fraction of the CurveChain to a PathFragment
   * @param distance
   * @param allowExtrapolation
   */
  protected chainDistanceToFragment(distance: number, allowExtrapolation: boolean = false): PathFragment | undefined {
    const numFragments = this._fragments.length;
    const fragments = this._fragments!;
    if (numFragments > 0) {
      if (distance < 0.0)
        return allowExtrapolation ? fragments[0] : undefined;
      if (distance >= this._totalLength)
        return allowExtrapolation ? fragments[numFragments - 1] : undefined;
      // humbug, linear search
      for (const fragment of fragments) {
        if (fragment.containsChainDistance(distance)) return fragment;
      }
    }
    return undefined;
  }
  /**
   * Convert distance along the chain to fraction along the chain.
   * @param distance distance along the chain
   */
  public chainDistanceToChainFraction(distance: number): number { return distance / this._totalLength; }
  /**
   * Resolve a fraction within a specific curve to a fragment.
   * @param curve
   * @param fraction
   */
  protected curveAndChildFractionToFragment(curve: CurvePrimitive, fraction: number): PathFragment | undefined {
    const numFragments = this._fragments.length;
    const fragments = this._fragments!;
    if (numFragments > 0) {
      // humbug, linear search
      for (const fragment of fragments) {
        if (fragment.containsChildCurveAndChildFraction(curve, fraction)) return fragment;
      }
    }
    return undefined;
  }

  /**
   * @returns the total length of curves.
   */
  public curveLength(): number {
    return this._totalLength;
  }
  /**
   * @returns the total length of curves.
   */
  public quickLength(): number {
    return this._totalLength;
  }

  /** Return the point (x,y,z) on the curve at fractional position along the chain.
   * @param fraction fractional position along the geometry.
   * @returns Returns a point on the curve.
   */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    const chainDistance = fraction * this._totalLength;
    let fragment = this.chainDistanceToFragment(chainDistance, true);
    if (fragment) {
      const childFraction = fragment.chainDistanceToAccurateChildFraction(chainDistance);
      return fragment.childCurve.fractionToPoint(childFraction, result);
    }
    fragment = this.chainDistanceToFragment(chainDistance, true);
    return this._fragments[0].childCurve.fractionToPoint(0.0, result);
  }

  /** Return the point (x,y,z) and derivative on the curve at fractional position.
   *
   * * Note that this derivative is "derivative of xyz with respect to fraction."
   * * this derivative shows the speed of the "fractional point" moving along the curve.
   * * this is not generally a unit vector.  use fractionToPointAndUnitTangent for a unit vector.
   * @param fraction fractional position along the geometry.
   * @returns Returns a ray whose origin is the curve point and direction is the derivative with respect to the fraction.
   */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.chainDistanceToFragment(distanceAlongPath, true)!;
    const curveFraction = fragment.chainDistanceToAccurateChildFraction(distanceAlongPath);
    result = fragment.childCurve.fractionToPointAndDerivative(curveFraction, result);
    const a = this._totalLength / result.direction.magnitude();
    result.direction.scaleInPlace(a);
    return result;
  }

  /**
   *
   * @param fraction fractional position on the curve
   * @param result optional receiver for the result.
   * @returns Returns a ray whose origin is the curve point and direction is the unit tangent.
   */
  public fractionToPointAndUnitTangent(fraction: number, result?: Ray3d): Ray3d {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.chainDistanceToFragment(distanceAlongPath, true)!;
    const curveFraction = fragment.chainDistanceToAccurateChildFraction(distanceAlongPath);
    result = fragment.childCurve.fractionToPointAndDerivative(curveFraction, result);
    result.direction.normalizeInPlace();
    return result;
  }
  /** Return a plane with
   *
   * * origin at fractional position along the curve
   * * vectorU is the first derivative, i.e. tangent vector with length equal to the rate of change with respect to the fraction.
   * * vectorV is the second derivative, i.e.derivative of vectorU.
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors | undefined {
    const totalLength = this._totalLength;
    const distanceAlongPath = fraction * totalLength;
    const fragment = this.chainDistanceToFragment(distanceAlongPath, true)!;
    const curveFraction = fragment.chainDistanceToAccurateChildFraction(distanceAlongPath);
    result = fragment.childCurve.fractionToPointAnd2Derivatives(curveFraction, result);
    if (!result)
      return undefined;
    const dotUU = result.vectorU.magnitudeSquared();
    const magU = Math.sqrt(dotUU);
    const dotUV = result.vectorU.dotProduct(result.vectorV);
    const duds = 1.0 / magU;
    const a = duds * duds;
    Vector3d.createAdd2Scaled(result.vectorV, a, result.vectorU, -a * dotUV / dotUU, result.vectorV);   // IN PLACE update to vectorV.
    result.vectorU.scale(duds);
    // scale for 0..1 parameterization ....
    result.vectorU.scaleInPlace(totalLength);
    result.vectorV.scaleInPlace(totalLength * totalLength);
    return result;
  }
  /** Attempt to transform in place.
   * * Warning: If any child fails, this object becomes invalid.  But that should never happen.
   */
  public tryTransformInPlace(transform: Transform): boolean {
    let numFail = 0;
    for (const c of this._path.children) {
      if (!c.tryTransformInPlace(transform))
        numFail++;
    }
    return numFail === 0;
  }
  /** Reverse the curve's data so that its fractional stroking moves in the opposite direction. */
  public reverseInPlace(): void {
    this._path.reverseChildrenInPlace();
    const totalLength = this._totalLength;
    for (const fragment of this._fragments)
      fragment.reverseFractionsAndDistances(totalLength);
    for (let i = 0, j = this._fragments.length - 1; i < j; i++ , j--) {
      const fragment = this._fragments[i];
      this._fragments[i] = this._fragments[j];
      this._fragments[j] = fragment;
    }
  }
  /**
   * Test for equality conditions:
   * * Mismatched totalLength is a quick exit condition
   * * If totalLength matches, recurse to the path for matching primitives.
   * @param other
   */
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof CurveChainWithDistanceIndex) {
      return Geometry.isSameCoordinate(this._totalLength, other._totalLength)
        && this._path.isAlmostEqual(other._path);
    }
    return false;
  }

  /** Implement moveSignedDistanceFromFraction.
   * * See `CurvePrimitive` for parameter details.
   * * The returned location directly identifies fractional position along the CurveChainWithDistanceIndex, and has pointer to an additional detail for the child curve.
   */
  public moveSignedDistanceFromFraction(startFraction: number, signedDistance: number, allowExtension: boolean, result?: CurveLocationDetail): CurveLocationDetail {
    const distanceA = startFraction * this._totalLength;
    const distanceB = distanceA + signedDistance;
    const fragmentB = this.chainDistanceToFragment(distanceB, true)!;
    const childDetail = fragmentB.childCurve.moveSignedDistanceFromFraction(fragmentB.childFraction0, distanceB - fragmentB.chainDistance0, allowExtension, result);
    const endFraction = startFraction + (signedDistance / this._totalLength);
    const chainDetail = CurveLocationDetail.createConditionalMoveSignedDistance(allowExtension, this, startFraction, endFraction, signedDistance, result);
    chainDetail.childDetail = childDetail;
    return chainDetail;
  }

  /** Search for the curve point that is closest to the spacePoint.
   * * The CurveChainWithDistanceIndex invokes the base class CurvePrimitive method, which
   *     (via a handler) determines a CurveLocation detail among the children.
   * * The returned detail directly identifies fractional position along the CurveChainWithDistanceIndex, and has pointer to an additional detail for the child curve.
   * @param spacePoint point in space
   * @param extend true to extend the curve (NOT USED)
   * @returns Returns a CurveLocationDetail structure that holds the details of the close point.
   */
  public closestPoint(spacePoint: Point3d, _extend: boolean): CurveLocationDetail | undefined {
    // umm... to "extend", would require selective extension of first, last
    const childDetail = super.closestPoint(spacePoint, false);
    if (!childDetail)
      return undefined;
    const fragment = this.curveAndChildFractionToFragment(childDetail.curve!, childDetail.fraction);
    if (fragment) {
      const chainDistance = fragment.childFractionTChainDistance(childDetail.fraction);
      const chainFraction = this.chainDistanceToChainFraction(chainDistance);
      const chainDetail = CurveLocationDetail.createCurveFractionPoint(this, chainFraction, childDetail.point);
      chainDetail.childDetail = childDetail;
      return chainDetail;
    }
    return undefined;
  }
}
