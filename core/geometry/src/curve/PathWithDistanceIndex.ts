/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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
/**
 * * Annotation of an interval of a curve.
 * * The interval is marked with two pairs of numbers:
 * * * fraction0, fraction1 = fraction parameters along the parent curve
 * * * distance0,distance1 = distances within containing PathWithDistanceIndex
 */
class PathFragment {
  public distance0: number;
  public distance1: number;
  public fraction0: number;
  public fraction1: number;
  public curve: CurvePrimitive;
  public constructor(fraction0: number, fraction1: number, distance0: number, distance1: number, curve: CurvePrimitive) {
    this.fraction0 = fraction0;
    this.fraction1 = fraction1;
    this.distance0 = distance0;
    this.distance1 = distance1;
    this.curve = curve;
  }
  /**
   * @returns true if the distance is within the distance limits of this fragment.
   * @param distance
   */
  public containsDistance(distance: number): boolean {
    return distance >= this.distance0 && distance <= this.distance1;
  }
  /** Convert distance to local fraction, and apply that to interpolate between the stored curve fractions */
  public distanceToCurveFraction(distance: number): number {
    return Geometry.inverseInterpolate(
      this.fraction0, this.distance0,
      this.fraction1, this.distance1,
      distance, this.fraction0)!;    // the interval "must" have nonzero length, division should be safe . ..
  }
  /** Return the scale factor to map curve fraction derivatives to parent fraction derivatives
   * @param globalDistance total length of the global curve.
   */
  public fractionScaleFactor(globalDistance: number): number {
    return globalDistance * (this.fraction1 - this.fraction0) / (this.distance1 - this.distance0);
  }
  public reverseFractionsAndDistances(totalDistance: number) {
    this.fraction0 = 1.0 - this.fraction0;
    this.fraction1 = 1.0 - this.fraction1;
    this.distance0 = totalDistance - this.distance0;
    this.distance1 = totalDistance - this.distance0;
  }
}
/** Non-instantiable class to build a distance index for a path. */
class PathIndexConstructionContext implements IStrokeHandler {
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
        this._accumulatedDistance += point0.distance(point1);
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
    for (let i = 1, f0 = 0.0; i <= numStrokes; i++ , f0 = f1) {
      f1 = Geometry.interpolate(fraction0, i / numStrokes, fraction1);
      d = cp.curveLengthBetweenFractions(f0, f1);
      d0 = this._accumulatedDistance;
      this._accumulatedDistance += d;
      this._fragments.push(new PathFragment(f0, f1, d0, this._accumulatedDistance, cp));
    }
  }
  public static createPathFragmentIndex(path: CurveChain, options?: StrokeOptions): PathFragment[] {
    const handler = new PathIndexConstructionContext();
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
  // finall assembly of PathWithDistanceIndex -- caller must create valid fragment index.
  private constructor(path: CurveChain, fragments: PathFragment[]) {
    super();
    this._path = path;
    this._fragments = fragments;
    this._totalLength = fragments[fragments.length - 1].distance1;
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
    const children = this.children;
    if (children) {
      for (const c of children) {
        c.extendRange(rangeToExtend, transform);
      }
    }
  }

  /**
   *
   * @param primitives primitive array to be CAPTURED (not cloned)
   */
  public static createCapture(path: CurveChain, options?: StrokeOptions): CurveChainWithDistanceIndex {
    const fragments = PathIndexConstructionContext.createPathFragmentIndex(path, options);
    const result = new CurveChainWithDistanceIndex(path, fragments);
    return result;
  }
  /**
   * Resolve a fraction to a PathFragment
   * @param distance
   * @param allowExtrapolation
   */
  protected distanceToFragment(distance: number, allowExtrapolation: boolean = false): PathFragment | undefined {
    const numFragments = this._fragments.length;
    const fragments = this._fragments!;
    if (numFragments > 0) {
      if (distance < 0.0)
        return allowExtrapolation ? fragments[0] : undefined;
      if (distance >= numFragments)
        return allowExtrapolation ? fragments[numFragments - 1] : undefined;
      // humbug, linear search
      for (const fragment of fragments) {
        if (fragment.containsDistance(distance)) return fragment;
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

  /** Return the point (x,y,z) on the curve at fractional position.
   * @param fraction fractional position along the geometry.
   * @returns Returns a point on the curve.
   */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.distanceToFragment(distanceAlongPath, true)!;
    const curveFraction = fragment.distanceToCurveFraction(distanceAlongPath);
    return fragment.curve.fractionToPoint(curveFraction, result);
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
    const fragment = this.distanceToFragment(distanceAlongPath, true)!;
    const curveFraction = fragment.distanceToCurveFraction(distanceAlongPath);
    result = fragment.curve.fractionToPointAndDerivative(curveFraction, result);
    result.direction.scaleInPlace(fragment.fractionScaleFactor(this._totalLength));
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
    const fragment = this.distanceToFragment(distanceAlongPath, true)!;
    const curveFraction = fragment.distanceToCurveFraction(distanceAlongPath);
    return fragment.curve.fractionToPointAndDerivative(curveFraction, result);
  }
  /** Return a plane with
   *
   * * origin at fractional position along the curve
   * * vectorU is the first derivative, i.e. tangent vector with length equal to the rate of change with respect to the fraction.
   * * vectorV is the second derivative, i.e.derivative of vectorU.
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors | undefined {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.distanceToFragment(distanceAlongPath, true)!;
    const curveFraction = fragment.distanceToCurveFraction(distanceAlongPath);
    result = fragment.curve.fractionToPointAnd2Derivatives(curveFraction, result);
    if (result) {
      const derivativeScale = fragment.fractionScaleFactor(this._totalLength);
      result.vectorU.scaleInPlace(derivativeScale);
      result.vectorV.scaleInPlace(derivativeScale * derivativeScale);
    }
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
  }

}
