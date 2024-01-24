/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { assert } from "@itwin/core-bentley";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { StrokeCountMap } from "../curve/Query/StrokeCountMap";
import { Geometry } from "../Geometry";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { CurveChain } from "./CurveCollection";
import { CurveExtendMode, CurveExtendOptions, VariantCurveExtendParameter } from "./CurveExtendMode";
import { CurveLocationDetail, CurveLocationDetailPair } from "./CurveLocationDetail";
import { GeometryQuery } from "./GeometryQuery";
import { PlaneAltitudeRangeContext } from "./internalContexts/PlaneAltitudeRangeContext";
import { LineString3d } from "./LineString3d";
import { OffsetOptions } from "./OffsetOptions";
import { Path } from "./Path";
import { StrokeOptions } from "./StrokeOptions";

/**
 * Annotation of a fragment, i.e. an interval of a curve.
 * * The interval is marked with two pairs of numbers:
 * * * fraction0, fraction1 = fraction parameters along the child curve.
 * * * distance0, distance1 = distances within containing CurveChainWithDistanceIndex.
 * @public
 */
export class PathFragment {
  /** Distance along parent to this fragment start. */
  public chainDistance0: number;
  /** Distance along parent to this fragment end. */
  public chainDistance1: number;
  /** The start of this `PathFragment`, as a local fractional parameter of `this.childCurve`. */
  public childFraction0: number;
  /** The end of this `PathFragment`, as a local fractional parameter of `this.childCurve`. */
  public childFraction1: number;
  /** Curve primitive of this fragment, as presented in stroker. Note that this might have become a proxy. */
  public childCurve: CurvePrimitive;
  /** Optional range */
  public range?: Range3d;
  /** Working var for use in searches. */
  public a: number;
  /** Create a fragment with complete fraction, distance, and child data. */
  public constructor(
    childFraction0: number,
    childFraction1: number,
    distance0: number,
    distance1: number,
    childCurve: CurvePrimitive,
    range?: Range3d,
  ) {
    this.childFraction0 = childFraction0;
    this.childFraction1 = childFraction1;
    this.chainDistance0 = distance0;
    this.chainDistance1 = distance1;
    this.childCurve = childCurve;
    this.range = range;
    this.a = 0;
  }
  /** Return true if the distance is within the distance limits of this fragment. */
  public containsChainDistance(distance: number): boolean {
    return distance >= this.chainDistance0 && distance <= this.chainDistance1;
  }
  /**
   * Return a quick minimum distance from spacePoint to the curve.
   * * The returned distance is to the curve's range box if defined; otherwise, the true distance is computed.
   * * Thus the returned distance may be SMALLER than the true distance to the curve, but not larger.
   */
  public quickMinDistanceToChildCurve(spacePoint: Point3d): number {
    if (this.range)
      return this.range.distanceToPoint(spacePoint);
    const detail = this.childCurve.closestPoint(spacePoint, false);
    if (detail)
      return detail.a;
    return 0;
  }
  /**
   * Return an array with (references to) all the input path fragments, sorted smallest to largest on the "a" value,
   * initialized with `quickMinDistanceToChildCurve`
   */
  public static collectSortedQuickMinDistances(fragments: PathFragment[], spacePoint: Point3d): PathFragment[] {
    const sortedFragments: PathFragment[] = [];
    for (const frag of fragments) {
      frag.a = frag.quickMinDistanceToChildCurve(spacePoint);
      sortedFragments.push(frag);
    }
    sortedFragments.sort((frag1: PathFragment, frag2: PathFragment) => frag1.a - frag2.a);
    return sortedFragments;
  }
  /** Return true if `this` fragment addresses `curve` and brackets `fraction`. */
  public containsChildCurveAndChildFraction(curve: CurvePrimitive, fraction: number): boolean {
    return this.childCurve === curve && fraction >= this.childFraction0 && fraction <= this.childFraction1;
  }
  /**
   * Convert distance to local fraction and apply that to interpolate between the stored curve fractions.
   * Note that proportional calculation does NOT account for non-uniform parameterization in the child curve.
   */
  public chainDistanceToInterpolatedChildFraction(distance: number): number {
    return Geometry.inverseInterpolate(
      this.childFraction0,
      this.chainDistance0,
      this.childFraction1,
      this.chainDistance1,
      distance,
      this.childFraction0,
    )!; // the interval must have nonzero length so division should be safe
  }
  /** Convert the given chainDistance to a fraction along this childCurve using `moveSignedDistanceFromFraction`. */
  public chainDistanceToAccurateChildFraction(chainDistance: number, allowExtrapolation?: boolean): number {
    const childDetail = this.childCurve.moveSignedDistanceFromFraction(
      this.childFraction0, chainDistance - this.chainDistance0, allowExtrapolation ?? false,
    );
    return childDetail.fraction;
  }
  /**
   * Return the scale factor to map childCurve fraction derivatives to chain fraction derivatives.
   * @param globalDistance total length of the global curve
   */
  public fractionScaleFactor(globalDistance: number): number {
    return globalDistance * (this.childFraction1 - this.childFraction0) / (this.chainDistance1 - this.chainDistance0);
  }
  /**
   * Reverse the fraction and distance data.
   * * Each child fraction `f` is replaced by `1-f`
   * * Each `chainDistance` is replaced by `totalDistance - chainDistance`
   * @param totalDistance the total distance
   */
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
  /** @deprecated in 3.x. Use `PathFragment.childFractionToChainDistance`. */
  public childFractionTChainDistance(fraction: number): number {
    return this.childFractionToChainDistance(fraction);
  }
  /**
   * Convert a fractional position on the childCurve of this fragment to distance on the curve chain.
   * * Return value is SIGNED and will be negative when `fraction < this.childFraction0`.
   * @param fraction the fractional position on the childCurve of this fragment
   */
  public childFractionToChainDistance(fraction: number): number {
    let d = this.childCurve.curveLengthBetweenFractions(this.childFraction0, fraction);
    if (fraction < this.childFraction0)
      d = -d;
    return this.chainDistance0 + d;
  }
}

/** Non-instantiable class to build a distance index for a curve chain. */
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
  public announcePointTangent(_xyz: Point3d, _fraction: number, _tangent: Vector3d) { }
  public announceSegmentInterval(
    cp: CurvePrimitive, point0: Point3d, point1: Point3d, numStrokes: number, fraction0: number, fraction1: number,
  ): void {
    const fragmentPoint0 = point0.clone();
    const fragmentPoint1 = point1.clone();
    let d0 = this._accumulatedDistance;
    if (numStrokes <= 1) {
      this._accumulatedDistance += point0.distance(point1);
      this._fragments.push(new PathFragment(fraction0, fraction1, d0, this._accumulatedDistance, cp,
        Range3d.create(fragmentPoint0, fragmentPoint1)));
    } else {
      let f1;
      for (let i = 1, f0 = fraction0; i <= numStrokes; i++, f0 = f1) {
        f1 = Geometry.interpolate(fraction0, i / numStrokes, fraction1);
        point0.interpolate(f1, point1, fragmentPoint1);
        d0 = this._accumulatedDistance;
        this._accumulatedDistance += (Math.abs(f1 - f0) * point0.distance(point1));
        this._fragments.push(new PathFragment(f0, f1, d0, this._accumulatedDistance, cp,
          Range3d.create(fragmentPoint0, fragmentPoint1)));
        fragmentPoint0.setFrom(fragmentPoint1);
      }
    }
  }
  public announceIntervalForUniformStepStrokes(
    cp: CurvePrimitive, numStrokes: number, fraction0: number, fraction1: number,
  ): void {
    let f1, d, d0;
    for (let i = 1, f0 = fraction0; i <= numStrokes; i++, f0 = f1) {
      f1 = Geometry.interpolate(fraction0, i / numStrokes, fraction1);
      d = cp.curveLengthBetweenFractions(f0, f1);
      d0 = this._accumulatedDistance;
      this._accumulatedDistance += d;
      const range = cp.rangeBetweenFractions(f0, f1);
      this._fragments.push(new PathFragment(f0, f1, d0, this._accumulatedDistance, cp, range));
    }
  }
  public needPrimaryGeometryForStrokes?(): boolean {
    return true;
  }
  /** Create an array of PathFragment from input curve chain. */
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
 * * For example if the total length of the chain is `L`, then the distance along the chain from parameters `t0`
 * to `t1` is easily computed as `L*(t1-t0)`.
 * * The curve chain can be any type derived from `CurveChain`, i.e., either a `Path` or a `Loop`.
 * @public
 */
export class CurveChainWithDistanceIndex extends CurvePrimitive {
  /** String name for schema properties */
  public readonly curvePrimitiveType = "curveChainWithDistanceIndex";
  private readonly _path: CurveChain;
  private readonly _fragments: PathFragment[];
  private readonly _totalLength: number; // matches final fragment distance1.
  private static _numCalls = 0;
  private static _numTested = 0;
  private static _numAssigned = 0;
  private static _numCandidate = 0;
  /** Test if `other` is a `CurveChainWithDistanceIndex` */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof CurveChainWithDistanceIndex;
  }
  // final assembly of CurveChainWithDistanceIndex -- caller must create valid fragment index.
  private constructor(path: CurveChain, fragments: PathFragment[]) {
    super();
    this._path = path;
    this._fragments = fragments;
    this._totalLength = fragments.length > 0 ? fragments[fragments.length - 1].chainDistance1 : 0;
  }
  /**
   * Create a clone, transformed and with its own distance index.
   * @param transform transform to apply in the clone.
   */
  public cloneTransformed(transform: Transform): CurveChainWithDistanceIndex | undefined {
    const c = this._path.clone();
    if (c instanceof CurveChain && c.tryTransformInPlace(transform))
      return CurveChainWithDistanceIndex.createCapture(c);
    return undefined;
  }
  /**
   * Reference to the contained path.
   * * Do not modify the path. The distance index will be wrong.
   */
  public get path(): CurveChain {
    return this._path;
  }
  /**
   * Reference to the fragments array.
   * * Do not modify.
   */
  public get fragments(): PathFragment[] {
    return this._fragments;
  }
  /** Return a deep clone */
  public clone(): CurveChainWithDistanceIndex {
    const c = this._path.clone() as CurveChain;
    return CurveChainWithDistanceIndex.createCapture(c);
  }
  /** Return a deep clone */
  public override clonePartialCurve(fractionA: number, fractionB: number): CurveChainWithDistanceIndex | undefined {
    if (fractionA === fractionB)
      return undefined;
    let fracA = fractionA;
    let fracB = fractionB;
    const reversed = fractionA > fractionB;
    if (reversed) {
      fracA = fractionB;
      fracB = fractionA;
    }
    const chainDistanceA = fracA * this._totalLength;
    const chainDistanceB = fracB * this._totalLength;
    const fragmentA = this.chainDistanceToFragment(chainDistanceA, true);
    if (undefined === fragmentA)
      return undefined;
    const fragmentB = this.chainDistanceToFragment(chainDistanceB, true);
    if (undefined === fragmentB)
      return undefined;
    const childCurveIndexA = this._path.childIndex(fragmentA.childCurve, true);
    if (undefined === childCurveIndexA)
      return undefined;
    const childCurveIndexB = this._path.childIndex(fragmentB.childCurve, true);
    if (undefined === childCurveIndexB)
      return undefined;
    const childFractionA = fragmentA.chainDistanceToAccurateChildFraction(chainDistanceA, true);
    const childFractionB = fragmentB.chainDistanceToAccurateChildFraction(chainDistanceB, true);
    // add a (possibly reversed) partial clone to newPath
    const newPath = Path.create();
    const addPartialChild = (
      childCurve: CurvePrimitive, childFraction0: number, childFraction1: number, reversedClone: boolean,
    ): boolean => {
      if (childFraction0 === childFraction1)
        return false;
      let newCurve;
      if (childFraction0 === 0.0 && childFraction1 === 1.0) {
        newCurve = childCurve.clone();
        if (reversedClone)
          newCurve.reverseInPlace();
      } else {
        newCurve = reversedClone ?
          childCurve.clonePartialCurve(childFraction1, childFraction0)
          : childCurve.clonePartialCurve(childFraction0, childFraction1);
      }
      if (newCurve) {
        newPath.children.push(newCurve);
        return true;
      }
      return false;
    };
    if (fragmentA.childCurve === fragmentB.childCurve) {
      // the two distances are within the same curve.
      if (addPartialChild(fragmentA.childCurve, childFractionA, childFractionB, reversed))
        return CurveChainWithDistanceIndex.createCapture(newPath); // singleton -- children[] does not need to be reversed.
      return undefined;
    }
    addPartialChild(this._path.children[childCurveIndexA], childFractionA, 1.0, reversed);
    // at least two distinct children are impacted ....
    for (let childIndex = childCurveIndexA + 1; childIndex < childCurveIndexB; childIndex++) {
      addPartialChild(this._path.children[childIndex], 0.0, 1.0, reversed);
    }
    addPartialChild(this._path.children[childCurveIndexB], 0.0, childFractionB, reversed);
    // This reverses array entries but not orientation within each curve ...
    if (reversed)
      newPath.children.reverse();
    return CurveChainWithDistanceIndex.createCapture(newPath);
  }
  /**
   * Ask if the curve is within tolerance of a plane.
   * @returns Returns true if the curve is completely within tolerance of the plane.
   */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    for (const c of this._path.children) {
      if (!c.isInPlane(plane))
        return false;
    }
    return true;
  }
  /** Return the start point of `this` curve. */
  public override startPoint(result?: Point3d): Point3d {
    const c = this._path.cyclicCurvePrimitive(0);
    if (c)
      return c.startPoint(result);
    return Point3d.createZero(result);
  }
  /** Return the end point of of `this` curve. */
  public override endPoint(result?: Point3d): Point3d {
    const c = this._path.cyclicCurvePrimitive(-1);
    if (c)
      return c.endPoint(result);
    return Point3d.createZero(result);
  }
  /** Add strokes to caller-supplied linestring */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    for (const c of this._path.children) {
      c.emitStrokes(dest, options);
    }
  }
  /**
   * Ask the curve to announce points and simple subcurve fragments for stroking.
   * See IStrokeHandler for description of the sequence of the method calls.
   */
  public emitStrokableParts(dest: IStrokeHandler, options?: StrokeOptions): void {
    for (const c of this._path.children) {
      c.emitStrokableParts(dest, options);
    }
  }
  /**
   * Return the stroke count required for given options.
   * @param options StrokeOptions that determine count
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    let numStroke = 0;
    for (const c of this._path.children) {
      numStroke += c.computeStrokeCountForOptions(options);
    }
    return numStroke;
  }
  /**
   * Return an array containing only the curve primitives.
   * @param collectorArray array to receive primitives (pushed -- the array is not cleared)
   * @param smallestPossiblePrimitives if true, recurse on the children. If false, only push `this`.
   * @param explodeLinestrings (if smallestPossiblePrimitives is true) whether to push a [[LineSegment3d]] for each
   * segment of a [[LineString3d]] child. If false, push only the [[LineString3d]].
   */
  public override collectCurvePrimitivesGo(
    collectorArray: CurvePrimitive[], smallestPossiblePrimitives: boolean = false, explodeLineStrings: boolean = false,
  ): void {
    if (smallestPossiblePrimitives) {
      for (const c of this._path.children) {
        c.collectCurvePrimitivesGo(collectorArray, smallestPossiblePrimitives, explodeLineStrings);
      }
    } else {
      collectorArray.push(this);
    }
  }
  /**
   * Construct StrokeCountMap for each child, accumulating data to stroke count map for this primitive.
   * @param options StrokeOptions that determine count
   * @param parentStrokeMap evolving parent map.
   */
  public override computeAndAttachRecursiveStrokeCounts(options?: StrokeOptions, parentStrokeMap?: StrokeCountMap) {
    const myMap = StrokeCountMap.createWithCurvePrimitiveAndOptionalParent(this, parentStrokeMap);
    for (const c of this._path.children) {
      c.computeAndAttachRecursiveStrokeCounts(options, myMap);
    }
    CurvePrimitive.installStrokeCountMap(this, myMap, parentStrokeMap);
  }
  /**
   * Second step of double dispatch: call `this._path.dispatchToGeometryHandler (handler)`
   * * Note that this exposes the children individually to the handler.
   */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleCurveChainWithDistanceIndex(this);
  }
  /** Extend `rangeToExtend` as needed to include these curves (optionally transformed) */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    this._path.extendRange(rangeToExtend, transform);
  }
  /** Return a (high accuracy and positive) length of the curve between fractional positions */
  public override curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
    return Math.abs(fraction1 - fraction0) * this._totalLength;
  }
  /** Flatten CurveChainWithDistanceIndex children in the input chain.
   * @return cloned flattened CurveChain, or reference to the input chain if no nesting
  */
  private static flattenNestedChains(chain: CurveChain): CurveChain {
    if (-1 === chain.children.findIndex((child: CurvePrimitive) => { return child instanceof CurveChainWithDistanceIndex; }))
      return chain;
    const flatChain = chain.clone() as CurveChain;
    const flatChildren = flatChain.children.flatMap((child: CurvePrimitive) => {
      if (child instanceof CurveChainWithDistanceIndex)
        return child.path.children;
      else
        return [child];
      },
    );
    flatChain.children.splice(0, Infinity, ...flatChildren);
    return flatChain;
  }
  /**
   * Capture (not clone) a path into a new `CurveChainWithDistanceIndex`
   * @param path primitive array to be CAPTURED (not cloned)
   */
  public static createCapture(path: CurveChain, options?: StrokeOptions): CurveChainWithDistanceIndex {
    path = this.flattenNestedChains(path);  // nested chains not allowed
    const fragments = DistanceIndexConstructionContext.createPathFragmentIndex(path, options);
    const result = new CurveChainWithDistanceIndex(path, fragments);
    return result;
  }
  /**
   * Return the PathFragment object at the given `distance` along the chain.
   * @param distance distance along the chain.
   * @param allowExtrapolation if `true`, returns first fragment for negative distances and returns last fragment
   * for distances larger than curve length. If `false` returns `undefined` for those out of bound distances.
   */
  public chainDistanceToFragment(distance: number, allowExtrapolation: boolean = false): PathFragment | undefined {
    const i = this.chainDistanceToFragmentIndex(distance, allowExtrapolation);
    if (undefined !== i)
      return this._fragments[i];
    return undefined;
  }
  /**
   * Return the index of the PathFragment at the given `distance` along the chain.
   * @param distance distance along the chain.
   * @param allowExtrapolation if `true`, returns 0 for negative distances and returns last fragment index for
   * distances larger than curve length. If `false` returns `undefined` for those out of bound distances.
   */
  protected chainDistanceToFragmentIndex(distance: number, allowExtrapolation: boolean = false): number | undefined {
    const numFragments = this._fragments.length;
    const fragments = this._fragments;
    if (numFragments > 0) {
      if (distance < 0.0)
        return allowExtrapolation ? 0 : undefined;
      if (distance > this._totalLength)
        return allowExtrapolation ? (numFragments - 1) : undefined;
      // linear search (opportunity for improvement)
      for (let i = 0; i < numFragments; i++) {
        if (fragments[i].containsChainDistance(distance))
          return i;
      }
    }
    return undefined;
  }
  /**
   * Convert distance along the chain to fraction along the chain.
   * @param distance distance along the chain.
   */
  public chainDistanceToChainFraction(distance: number): number {
    return distance / this._totalLength;
  }
  /** Return the PathFragment object containing the point at the given `fraction` of the given child curve. */
  public curveAndChildFractionToFragment(curve: CurvePrimitive, fraction: number): PathFragment | undefined {
    const numFragments = this._fragments.length;
    const fragments = this._fragments;
    if (numFragments > 0) {
      if (fraction < 0)
        return fragments[0];
      if (fraction > 1.0)
        return fragments[numFragments - 1];
      // linear search (opportunity for improvement)
      for (const fragment of fragments) {
        if (fragment.containsChildCurveAndChildFraction(curve, fraction))
          return fragment;
      }
    }
    return undefined;
  }
  /** Returns the total length of `this` curve. */
  public override curveLength(): number {
    return this._totalLength;
  }
  /**
   * Returns the total length of the path.
   * * This is exact (and simple property lookup) because the true lengths were summed at construction time.
   */
  public quickLength(): number {
    return this._totalLength;
  }
  /**
   * Return the point (x,y,z) on the curve at fractional position along the chain.
   * @param fraction fractional position along the curve.
   * @returns a point on the curve.
   */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.chainDistanceToFragment(distanceAlongPath, true);
    if (fragment) {
      const childFraction = fragment.chainDistanceToAccurateChildFraction(distanceAlongPath, true);
      return fragment.childCurve.fractionToPoint(childFraction, result);
    }
    assert(false); // we never expect to get here
    // no fragment found. just return the first point on the curve.
    return this._fragments[0].childCurve.fractionToPoint(0.0, result);
  }
  /**
   * Return the point (x,y,z) and derivative on the curve at fractional position.
   * * Note that the derivative is "derivative of xyz with respect to fraction".
   * * The derivative shows the speed of the "fractional point" moving along the curve.
   * * The derivative is not generally a unit vector. Use `fractionToPointAndUnitTangent` for a unit vector.
   * @param fraction fractional position along the geometry.
   * @param result optional receiver for the result.
   * @returns a ray whose origin is the curve point and direction is the derivative with respect to the fraction.
   */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.chainDistanceToFragment(distanceAlongPath, true)!;
    const childFraction = fragment.chainDistanceToAccurateChildFraction(distanceAlongPath, true);
    result = fragment.childCurve.fractionToPointAndDerivative(childFraction, result);
    // Recall the standard arclength formula s(t) for the curve C = C(t), with derivative s'(t) = ||C'||.
    // Define fractional arclength for C by f = f(t) = s(t)/L, where L is the total length of C. Then f' = ||C'||/L.
    // Denote the inverse of f by t = t(f). Then C = C(t(f)) is a parameterization of C by its fractional arclength f.
    // Since the derivative of t is t'=1/f'=L/||C'||, the derivative we seek is d/df(C(t(f))) = C' t' = C' L/||C'||.
    // The fragment gives us C', so we're just a scale away.
    // Math details can be found at core/geometry/internaldocs/Curve.md
    const a = this._totalLength / result.direction.magnitude(); // L/||C'||
    result.direction.scaleInPlace(a);
    return result;
  }
  /**
   * Return the point (x,y,z) and normalized derivative on the curve at fractional position.
   * * Note that the derivative is "derivative of xyz with respect to fraction".
   * * The un-normalized derivative shows the speed of the "fractional point" moving along the curve.
   * * To find the un-normalized derivative, use `fractionToPointAndDerivative`.
   * @param fraction fractional position on the curve
   * @param result optional receiver for the result.
   * @returns a ray whose origin is the curve point and direction is the normalized derivative with respect to
   * the fraction.
   */
  public override fractionToPointAndUnitTangent(fraction: number, result?: Ray3d): Ray3d {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.chainDistanceToFragment(distanceAlongPath, true)!;
    const childFraction = fragment.chainDistanceToAccurateChildFraction(distanceAlongPath, true);
    result = fragment.childCurve.fractionToPointAndDerivative(childFraction, result);
    result.direction.normalizeInPlace();
    return result;
  }
  /**
   * Return a plane with
   * * origin at fractional position along the curve
   * * vectorU is the first derivative, i.e. tangent vector with length equal to the rate of change with respect to
   * the fraction.
   * * vectorV is the second derivative, i.e. derivative of vectorU which points in the direction of the curve's
   * derivative's change.
   */
  public fractionToPointAnd2Derivatives(
    fraction: number, result?: Plane3dByOriginAndVectors,
  ): Plane3dByOriginAndVectors | undefined {
    const distanceAlongPath = fraction * this._totalLength;
    const fragment = this.chainDistanceToFragment(distanceAlongPath, true)!;
    const childFraction = fragment.chainDistanceToAccurateChildFraction(distanceAlongPath, true);
    result = fragment.childCurve.fractionToPointAnd2Derivatives(childFraction, result);
    if (!result)
      return undefined;
    // See fractionToPointAndDerivative, where we show d/df(C(t(f))) = L C'/||C'||.
    // Here we seek the 2nd derivative. We'll use the quotient rule, and the identities
    // d/dt||x(t)|| = x.x'/||x|| and ||x||^2 = x.x, where "." is the dot product.
    // d2/df2(C(t(f))) = L d/df(C'/||C'||) = L (||C'|| d/df(C') - C' d/df||C'||) / ||C'||^2
    //  = L (||C'|| C" L/||C'|| - C' C'.C"/||C'|| L/||C'||) / ||C'||^2
    //  = (L/||C'||)^2 (C" - C' C'.C"/C'.C' ), where C' and C" are given by the fragment.
    // The second derivative that fractionToPointAnd2Derivatives returns is C", so the second
    // derivative we seek is just few scales away.
    // Math details can be found at core/geometry/internaldocs/Curve.md
    const magU = result.vectorU.magnitude(); // ||C'||
    const dotUU = magU * magU; // ||C'||^2
    const dotUV = result.vectorU.dotProduct(result.vectorV); // C'.C"
    result.vectorV.addScaledInPlace(result.vectorU, -dotUV / dotUU); // add -(C'*C'.C")/(||C'||^2) to vectorV
    const scale = this._totalLength / magU; // L/||C'||
    result.vectorU.scaleInPlace(scale); // scale vectorU by L/||C'||
    result.vectorV.scaleInPlace(scale * scale); // scale vectorV by (L/||C'(t)||)^2
    return result;
  }
  /**
   * Attempt to transform in place.
   * * Warning: If any child transform fails, `this` object becomes invalid but that should never happen.
   * @param transform the transform to be applied.
   * @returns true if all of child transforms succeed and false otherwise.
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
    for (const fragment of this._fragments) {
      fragment.reverseFractionsAndDistances(this._totalLength);
    }
    this._fragments.reverse();
  }
  /**
   * Test for equality conditions.
   * * Mismatched total length is a quick exit condition.
   * * If total length matches, recurse to the path for matching primitives.
   */
  public override isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof CurveChainWithDistanceIndex) {
      return Geometry.isSameCoordinate(this._totalLength, other._totalLength) && this._path.isAlmostEqual(other._path);
    }
    return false;
  }
  /**
   * (Attempt to) find a position on the curve at a signed distance from start fraction.
   * * See `CurvePrimitive.moveSignedDistanceFromFraction` for parameter details.
   * * The returned location directly identifies fractional position along the CurveChainWithDistanceIndex and
   * has pointer to an additional detail for the child curve.
   */
  public override moveSignedDistanceFromFraction(
    startFraction: number, signedDistance: number, allowExtension: boolean, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    const distanceA = startFraction * this._totalLength;
    const distanceB = distanceA + signedDistance;
    const fragmentB = this.chainDistanceToFragment(distanceB, true)!;
    const childDetail = fragmentB.childCurve.moveSignedDistanceFromFraction(
      fragmentB.childFraction0, distanceB - fragmentB.chainDistance0, allowExtension, result?.childDetail,
    ); // local detail related to the child curve
    const endFraction = startFraction + (signedDistance / this._totalLength);
    const chainDetail = CurveLocationDetail.createConditionalMoveSignedDistance(
      allowExtension, this, startFraction, endFraction, signedDistance, result,
    ); // global detail related to the curve chain
    chainDetail.childDetail = childDetail;
    return chainDetail;
  }
  /**
   * Return an object summarizing closest point test counts.
   * The returned object has
   * * numCalls = number of times closestPoint was called.
   * * numCurvesTested = number of curves tested with full closestPoint.
   * * numAssigned = number of times a new minimum value was recorded.
   * * numCandidate = number of curves that would be tested in worst case.
   * @param clear if true, counts are cleared after the return object is formed.
   */
  public static getClosestPointTestCounts(
    clear: boolean = true,
  ): { numCalls: number, numTested: number, numAssigned: number, numCandidate: number } {
    const a = {
      numCalls: this._numCalls,
      numTested: this._numTested,
      numAssigned: this._numAssigned,
      numCandidate: this._numCandidate,
    };
    if (clear) {
      this._numTested = this._numAssigned = this._numCandidate = 0;
    }
    return a;
  }
  /**
   * Search for the curve point that is closest to the spacePoint.
   * * The CurveChainWithDistanceIndex invokes the base class CurvePrimitive method, which (via a handler)
   * determines a CurveLocation detail among the children.
   * * The returned detail directly identifies fractional position along the CurveChainWithDistanceIndex and
   * has pointer to an additional detail for the child curve.
   * @param spacePoint point in space
   * @param extend true to extend the curve
   * @returns a CurveLocationDetail structure that holds the details of the close point.
   */
  public override closestPoint(spacePoint: Point3d, extend: VariantCurveExtendParameter): CurveLocationDetail | undefined {
    let childDetail: CurveLocationDetail | undefined;
    let aMin = Number.MAX_VALUE;
    const numChildren = this.path.children.length;
    if (numChildren === 1) {
      childDetail = this.path.children[0].closestPoint(spacePoint, extend);
    } else {
      const sortedFragments = PathFragment.collectSortedQuickMinDistances(this._fragments, spacePoint);
      const extend0 = [
        CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 0),
        CurveExtendMode.None,
      ];
      const extend1 = [
        CurveExtendMode.None,
        CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 1),
      ];
      const fragment0 = this._fragments[0];
      const fragment1 = this._fragments[this._fragments.length - 1];
      CurveChainWithDistanceIndex._numCalls++;
      CurveChainWithDistanceIndex._numCandidate += sortedFragments.length;
      let detailA: CurveLocationDetail | undefined;
      for (const sortedFragment of sortedFragments) {
        if (sortedFragment.a > aMin)
          // sortedFragments help early exit because it is likely that one of the first few fragments
          // in sortedFragments is the fragment with minimum distance from space point to the curve.
          break;
        CurveChainWithDistanceIndex._numTested++;
        const child = sortedFragment.childCurve;
        detailA = child.closestPoint(
          spacePoint, sortedFragment === fragment0 ? extend0 : sortedFragment === fragment1 ? extend1 : false, detailA,
        );
        if (detailA && detailA.a < aMin) {
          aMin = detailA.a;
          childDetail = detailA.clone(childDetail);
          CurveChainWithDistanceIndex._numAssigned++;
        }
      }
    }
    if (!childDetail)
      return undefined;
    return this.computeChainDetail(childDetail);
  }
  /**
   * Construct an offset of each child as viewed in the xy-plane (ignoring z).
   * * No attempt is made to join the offset children. Use RegionOps.constructCurveXYOffset to return a fully
   * joined offset.
   * @param offsetDistanceOrOptions offset distance (positive to left of the instance curve) or offset options object.
   */
  public override constructOffsetXY(
    offsetDistanceOrOptions: number | OffsetOptions,
  ): CurvePrimitive | CurvePrimitive[] | undefined {
    const options = OffsetOptions.create(offsetDistanceOrOptions);
    const offsets: CurvePrimitive[] = [];
    for (const prim of this.collectCurvePrimitives(undefined, true, true)) {
      const offset = prim.constructOffsetXY(options);
      if (offset !== undefined) {
        if (offset instanceof CurvePrimitive)
          offsets.push(offset);
        else if (Array.isArray(offset))
          offset.forEach((cp) => offsets.push(cp));
      }
    }
    return offsets;
  }
  /**
   * Project instance geometry (via dispatch) onto the given ray, and return the extreme fractional parameters of
   * projection.
   * @param ray ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with zero origin.
   * @param lowHigh optional receiver for output.
   * @returns range of fractional projection parameters onto the ray, where 0.0 is start of the ray and 1.0 is the
   * end of the ray.
   */
  public override projectedParameterRange(ray: Vector3d | Ray3d, lowHigh?: Range1d): Range1d | undefined {
    return PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(this, ray, lowHigh);
  }
  /**
   * Compute the global chain detail corresponding to a local child detail.
   * @param childDetail the local (fragment) detail, captured.
   * @returns newly allocated global (chain) detail with `childDetail` field pointing to the input, and `a` field copied from the input
   */
  public computeChainDetail(childDetail: CurveLocationDetail): CurveLocationDetail | undefined {
    if (!childDetail.curve)
      return undefined;
    const fragment = this.curveAndChildFractionToFragment(childDetail.curve, childDetail.fraction);
    if (fragment) {
      const chainDistance = fragment.childFractionToChainDistance(childDetail.fraction);
      const chainFraction = this.chainDistanceToChainFraction(chainDistance);
      const chainDetail = CurveLocationDetail.createCurveFractionPoint(this, chainFraction, childDetail.point);
      chainDetail.childDetail = childDetail;
      chainDetail.a = childDetail.a;
      return chainDetail;
    }
    return undefined;
  }
  /**
   * Given a parent chain, convert the corresponding child details in the specified pairs.
   * * Converted details refer to the chain's global parameterization instead of the child's.
   * * It is assumed that for all i >= index0, `pairs[i].detailA.curve` is a child of chainA (similarly for chainB).
   * @param pairs array to mutate
   * @param index0 convert details of pairs in the tail of the array, starting at index0
   * @param chainA convert each specified detailA to the global parameterization of chainA
   * @param chainB convert each specified detailB to the global parameterization of chainB
   * @param compressAdjacent whether to remove adjacent duplicate pairs after conversion
   * @return the converted array
   * @internal
   */
  public static convertChildDetailToChainDetail(pairs: CurveLocationDetailPair[], index0: number, chainA?: CurveChainWithDistanceIndex, chainB?: CurveChainWithDistanceIndex, compressAdjacent?: boolean): CurveLocationDetailPair[] {
    for (let i = index0; i < pairs.length; ++i) {
      const childDetailPair = pairs[i];
      if (chainA) {
        const chainDetail = chainA.computeChainDetail(childDetailPair.detailA);
        if (chainDetail)
          childDetailPair.detailA = chainDetail;
      }
      if (chainB) {
        const chainDetail = chainB.computeChainDetail(childDetailPair.detailB);
        if (chainDetail)
          childDetailPair.detailB = chainDetail;
      }
    }
    if (compressAdjacent)
      pairs = CurveLocationDetailPair.removeAdjacentDuplicates(pairs, index0);
    return pairs;
  }

}
