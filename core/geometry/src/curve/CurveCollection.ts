/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { assert } from "@itwin/core-bentley";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { CurveExtendMode, CurveExtendOptions, VariantCurveExtendParameter } from "./CurveExtendMode";
import { CurveLocationDetail } from "./CurveLocationDetail";
import { CurvePrimitive, TangentOptions } from "./CurvePrimitive";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { AnyCurve, type AnyRegion } from "./CurveTypes";
import { GeometryQuery } from "./GeometryQuery";
import { AnnounceTangentStrokeHandler } from "./internalContexts/AnnounceTangentStrokeHandler";
import { CloneCurvesContext } from "./internalContexts/CloneCurvesContext";
import { CloneWithExpandedLineStrings } from "./internalContexts/CloneWithExpandedLineStrings";
import { CountLinearPartsSearchContext } from "./internalContexts/CountLinearPartsSearchContext";
import { GapSearchContext } from "./internalContexts/GapSearchContext";
import { PlaneAltitudeRangeContext } from "./internalContexts/PlaneAltitudeRangeContext";
import { SumLengthsContext } from "./internalContexts/SumLengthsContext";
import { TransformInPlaceContext } from "./internalContexts/TransformInPlaceContext";
import { LineString3d } from "./LineString3d";
import { ProxyCurve } from "./ProxyCurve";
import { StrokeOptions } from "./StrokeOptions";

import type { Path } from "./Path";
import type { Loop } from "./Loop";

/** Note: CurveChain and BagOfCurves classes are located in this file to prevent circular dependency. */

/**
 * Describes the concrete type of a [[CurveCollection]]. Each type name maps to a specific subclass and can be
 * used in conditional statements for type-switching.
 *    - "loop" => [[Loop]]
 *    - "path" => [[Path]]
 *    - "unionRegion" => [[UnionRegion]]
 *    - "parityRegion" => [[ParityRegion]]
 *    - "bagOfCurves" => [[BagOfCurves]]
 * @public
 */
export type CurveCollectionType = "loop" | "path" | "unionRegion" | "parityRegion" | "bagOfCurves";

/**
 * A `CurveCollection` is an abstract (non-instantiable) class for various sets of curves with particular structures:
 * - [[CurveChain]] - a non-instantiable intermediate class for a sequence of [[CurvePrimitive]] joining head-to-tail.
 * The two instantiable forms of `CurveChain` are:
 *   - [[Path]] - a chain of curves. Does not have to be closed or planar. A closed `Path` is not treated as bounding a surface.
 *   - [[Loop]] - a closed and planar chain of curves. A `Loop` is treated as bounding a planar area.
 * - [[ParityRegion]] - a collection of coplanar `Loop`, with "in/out" classification by parity rules.
 * - [[UnionRegion]] - a collection of coplanar `Loop` and/or `ParityRegion`, with "in/out" classification by union rules.
 * - [[BagOfCurves]] - a collection of [[AnyCurve]] with no implied structure.
 *
 * @see [Curve Collections]($docs/learning/geometry/CurveCollection.md) learning article.
 * @public
 */
export abstract class CurveCollection extends GeometryQuery {
  /** String name for schema properties */
  public readonly geometryCategory = "curveCollection";
  /** Type discriminator. */
  public abstract readonly curveCollectionType: CurveCollectionType;
  /** Flag for inner loop status. Only used by `Loop`. */
  public isInner: boolean = false;
  /** Return the curve children. */
  public abstract override get children(): AnyCurve[];
  /** Return the sum of the lengths of all contained curves. */
  public sumLengths(): number {
    return SumLengthsContext.sumLengths(this);
  }
  private computeClosestPoint(
    spacePoint: Point3d, extend: VariantCurveExtendParameter = false, result?: CurveLocationDetail, xyOnly: boolean = false,
  ): CurveLocationDetail | undefined {
    let detailA: CurveLocationDetail | undefined;
    const detailB = new CurveLocationDetail();
    let ext = this.isAnyRegion() ? false : extend;
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      if (this.isPath()) {
        // head only extends at start; tail only at end. NOTE: child may be both head and tail!
        const mode0 = (i === 0) ? CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 0) : CurveExtendMode.None;
        const mode1 = (i === this.children.length - 1) ? CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extend, 1) : CurveExtendMode.None;
        ext = [mode0, mode1];
      }
      const cp = xyOnly ? child.closestPointXY(spacePoint, ext, detailB) : child.closestPoint(spacePoint, ext, detailB);
      if (cp) {
        const smaller = CurveLocationDetail.chooseSmallerA(detailA, detailB);
        assert(undefined !== smaller, "expect defined because detailB is always defined");
        detailA = result = smaller.clone(result);
      }
    }
    return detailA;
  }
  /**
   * Return the closest point on the contained curves.
   * @param spacePoint point in space.
   * @param extend extend applicable only to [[Path]] and [[BagOfCurves]]. Default value `false`.
   * @param result (optional) pre-allocated detail to populate and return.
   * @returns details of the closest point.
   */
  public closestPoint(
    spacePoint: Point3d, extend: VariantCurveExtendParameter = false, result?: CurveLocationDetail,
  ): CurveLocationDetail | undefined {
    return this.computeClosestPoint(spacePoint, extend, result);
  }
  /**
   * Return the closest point on the contained curves as viewed in the xy-plane (ignoring z).
   * @param spacePoint point in space.
   * @param extend (optional) extend applicable only to [[Path]] and [[BagOfCurves]]. Default value `false`.
   * @param result (optional) pre-allocated detail to populate and return.
   * @returns details of the closest point.
   */
  public closestPointXY(
    spacePoint: Point3d, extend: VariantCurveExtendParameter = false, result?: CurveLocationDetail,
  ): CurveLocationDetail | undefined {
    return this.computeClosestPoint(spacePoint, extend, result, true);
  }
  /**
   * Announce all points `P` on the contained curves such that the line containing `spacePoint` and `P` is tangent to
   * the contained curves in the view defined by `options.vectorToEye`.
   * * Strictly speaking, each tangent line lies in the plane through `P` whose normal is the cross product of the curve
   * tangent at `P` and `options.vectorToEye`. This is equivalent to tangency as seen in a view plane perpendicular to
   * `options.vectorToEye`.
   * @param spacePoint point in space.
   * @param announceTangent callback to announce each computed tangent. The received [[CurveLocationDetail]] is reused
   * internally, so it should be cloned in the callback if it needs to be saved.
   * @param options (optional) options for computing tangents. See [[TangentOptions]] for defaults.
   */
  public emitTangents(
    spacePoint: Point3d, announceTangent: (tangent: CurveLocationDetail) => any, options?: TangentOptions,
  ): void {
    const strokeHandler = new AnnounceTangentStrokeHandler(spacePoint, announceTangent, options);
    if (this.children !== undefined) {
      for (const child of this.children) {
        if (child instanceof CurvePrimitive)
          child.emitStrokableParts(strokeHandler, options?.strokeOptions);
        else if (child instanceof CurveCollection)
          child.emitTangents(spacePoint, announceTangent, options);
      }
    }
  }
  /**
   * Return all points `P` on the contained curves such that the line containing `spacePoint` and `P` is tangent to the
   * contained curves in the view defined by `options.vectorToEye`.
   * * See [[emitTangents]] for the definition of tangency employed.
   * @param spacePoint point in space.
   * @param options (optional) options for computing tangents. See [[TangentOptions]] for defaults.
   * @returns an array of details of all tangent points or undefined if no tangent was found.
   */
  public allTangents(spacePoint: Point3d, options?: TangentOptions): CurveLocationDetail[] | undefined {
    const tangents: CurveLocationDetail[] = [];
    this.emitTangents(spacePoint, (t: CurveLocationDetail) => tangents.push(t.clone()), options);
    return (tangents.length === 0) ? undefined : tangents;
  }
  /**
   * Return the point `P` on the contained curves such that the line containing `spacePoint` and `P` is tangent to the
   * contained curves in the view defined by `options.vectorToEye`, and `P` is closest to `options.hintPoint` in this view.
   * * See [[emitTangents]] for the definition of tangency employed.
   * @param spacePoint point in space.
   * @param options (optional) options for computing tangents. See [[TangentOptions]] for defaults.
   * @returns the detail of the closest tangent point or undefined if no tangent was found.
   */
  public closestTangent(spacePoint: Point3d, options?: TangentOptions): CurveLocationDetail | undefined {
    const hint = options?.hintPoint ?? spacePoint;
    let toLocal: Matrix3d | undefined;
    if (options?.vectorToEye && !options.vectorToEye.isExactEqual({ x: 0, y: 0, z: 1 }))
      toLocal = Matrix3d.createRigidViewAxesZTowardsEye(options.vectorToEye.x, options.vectorToEye.y, options.vectorToEye.z);
    const measureHintDist2 = (pt: Point3d): number => { // measure distance to hint in view plane coordinates
      return toLocal?.multiplyTransposeXYZ(hint.x - pt.x, hint.y - pt.y, hint.z - pt.z).magnitudeSquaredXY() ?? pt.distanceSquaredXY(hint);
    };
    let closestTangent: CurveLocationDetail | undefined;
    let closestDist2 = Geometry.largeCoordinateResult;
    const collectClosestTangent = (tangent: CurveLocationDetail) => {
      const dist2 = measureHintDist2(tangent.point);
      if (!closestTangent || dist2 < closestDist2) {
        closestTangent = tangent.clone(closestTangent);
        closestDist2 = dist2;
      }
    };
    this.emitTangents(spacePoint, collectClosestTangent, options);
    return closestTangent;
  }
  /** Reverse the collection's data so that each child curve's fractional stroking moves in the opposite direction. */
  public reverseInPlace(): void {
    for (const curve of this.children)
      curve.reverseInPlace();
  }
  /**
   * Return the max gap between adjacent primitives in Path and Loop collections.
   * * In a Path, gaps are computed between consecutive primitives.
   * * In a Loop, gaps are computed between consecutive primitives and between last and first.
   * * Gaps are NOT computed between consecutive CurvePrimitives in "unstructured" collections. The type is
   * "unstructured" so gaps should not be semantically meaningful.
   */
  public maxGap(): number {
    return GapSearchContext.maxGap(this);
  }
  /** Return true if the curve collection has any primitives other than LineSegment3d and LineString3d  */
  public checkForNonLinearPrimitives(): boolean {
    return CountLinearPartsSearchContext.hasNonLinearPrimitives(this);
  }
  /** Apply transform recursively to children */
  public tryTransformInPlace(transform: Transform): boolean {
    return TransformInPlaceContext.tryTransformInPlace(this, transform);
  }
  /** Return a deep copy. */
  public override clone(): CurveCollection {
    return CloneCurvesContext.clone(this) as CurveCollection;
  }
  /** Create a deep copy of transformed curves. */
  public override cloneTransformed(transform: Transform): CurveCollection | undefined {
    return CloneCurvesContext.clone(this, transform);
  }
  /** Create a deep copy with all linestrings broken down into multiple LineSegment3d. */
  public cloneWithExpandedLineStrings(): CurveCollection {
    return CloneWithExpandedLineStrings.clone(this);
  }
  /**
   * Push all CurvePrimitives contained in the instance onto the `results` array.
   * * This method is recursive. For example, if the CurveCollection contains a Loop, all CurvePrimitives
   * of the Loop are pushed onto `results`.
   */
  private collectCurvePrimitivesGo(
    results: CurvePrimitive[], smallestPossiblePrimitives: boolean, explodeLinestrings: boolean = false,
  ): void {
    if (this.children) {
      for (const child of this.children) {
        if (child instanceof CurvePrimitive)
          child.collectCurvePrimitivesGo(results, smallestPossiblePrimitives, explodeLinestrings);
        else if (child instanceof CurveCollection)
          child.collectCurvePrimitivesGo(results, smallestPossiblePrimitives, explodeLinestrings);
      }
    }
  }
  /**
   * Return an array containing all CurvePrimitives in the instance.
   * * This method is recursive. For example, if the CurveCollection contains a Loop, all CurvePrimitives of
   * the Loop are pushed onto the returned array.
   * @param collectorArray optional array to receive primitives. If present, new primitives are ADDED (without
   * clearing the array).
   * @param smallestPossiblePrimitives if false, CurvePrimitiveWithDistanceIndex returns only itself. If true,
   * it recurses to its (otherwise hidden) children.
   */
  public collectCurvePrimitives(
    collectorArray?: CurvePrimitive[], smallestPossiblePrimitives: boolean = false, explodeLineStrings: boolean = false,
  ): CurvePrimitive[] {
    const results: CurvePrimitive[] = collectorArray === undefined ? [] : collectorArray;
    this.collectCurvePrimitivesGo(results, smallestPossiblePrimitives, explodeLineStrings);
    return results;
  }
  /**
   * Return true for planar region types:
   * * `Loop`
   * * `ParityRegion`
   * * `UnionRegion`
   * @see isAnyRegion
   */
  public get isAnyRegionType(): boolean {
    return this.dgnBoundaryType() === 2 || this.dgnBoundaryType() === 4 || this.dgnBoundaryType() === 5;
  }
  /** Type guard for AnyRegion */
  public isAnyRegion(): this is AnyRegion {
    return this.isAnyRegionType;
  }
  /**
   * Return true for a `Path`, i.e. a chain of curves joined head-to-tail
   * @see isPath
   */
  public get isOpenPath(): boolean {
    return this.dgnBoundaryType() === 1;
  }
  /** Type guard for Path */
  public isPath(): this is Path {
    return this.isOpenPath;
  }
  /**
   * Return true for a single-loop planar region type, i.e. `Loop`.
   * * This is NOT a test for physical closure of a `Path`.
   * @see isLoop
   */
  public get isClosedPath(): boolean {
    return this.dgnBoundaryType() === 2;
  }
  /** Type guard for Loop */
  public isLoop(): this is Loop {
    return this.isClosedPath;
  }

  /** Return a CurveCollection with the same structure but all curves replaced by strokes. */
  public abstract cloneStroked(options?: StrokeOptions): CurveCollection;
  /** Support method for ICurvePrimitive ... one line call to specific announce method . . */
  public abstract announceToCurveProcessor(processor: RecursiveCurveProcessor): void;
  /** Clone an empty collection. */
  public abstract cloneEmptyPeer(): CurveCollection;
  /**
   * Return the boundary type of a corresponding MicroStation CurveVector.
   * * Derived class must implement.
   */
  public abstract dgnBoundaryType(): number;
  /**
   * Try to add a child.
   * @param child child to add.
   * @return true if child is an acceptable type for this collection.
   */
  public abstract tryAddChild(child: AnyCurve | undefined): boolean;
  /** Return a child identified by by index */
  public abstract getChild(i: number): AnyCurve | undefined;
  /**
   * Extend (increase) the given range as needed to encompass all curves in the curve collection.
   * @param rangeToExtend the given range.
   * @param transform if supplied, the range is extended with transformed curves.
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
   * Find any CurvePrimitive in the source and evaluate it at the given fraction.
   * * The first CurvePrimitive found is evaluated. Any other CurvePrimitives are ignored.
   * @param source containing `CurvePrimitive` or `CurveCollection`
   * @param fraction fraction to use in `curve.fractionToPoint(fraction)`
   */
  public static createCurveLocationDetailOnAnyCurvePrimitive(
    source: GeometryQuery | undefined, fraction: number = 0.5,
  ): CurveLocationDetail | undefined {
    if (!source)
      return undefined;
    if (source instanceof CurvePrimitive) {
      return CurveLocationDetail.createCurveEvaluatedFraction(source, fraction);
    } else if (source instanceof CurveCollection && source.children !== undefined)
      for (const child of source.children) {
        const detail = this.createCurveLocationDetailOnAnyCurvePrimitive(child, fraction);
        if (detail)
          return detail;
      }
    return undefined;
  }
  /**
   * Project instance geometry (via dispatch) onto the given ray, and return the extreme fractional parameters
   * of projection.
   * @param ray ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with zero origin.
   * @param lowHigh optional receiver for output
   * @returns range of fractional projection parameters onto the ray, where 0.0 is start of the ray and 1.0 is the
   * end of the ray.
   */
  public projectedParameterRange(ray: Vector3d | Ray3d, lowHigh?: Range1d): Range1d | undefined {
    return PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(this, ray, lowHigh);
  }
  /** Return the immediate parent of the input curve in the instance, or undefined if it is not a descendant. */
  public findParentOfDescendant(descendant: AnyCurve): CurveCollection | undefined {
    for (const child of this.children) {
      if (child === descendant)
        return this;
      if (child instanceof CurveCollection) {
        const parent = child.findParentOfDescendant(descendant);
        if (parent)
          return parent;
      }
    }
    return undefined;
  };
}

/**
 * Shared base class for use by both open and closed paths.
 * * A `CurveChain` contains only CurvePrimitives. No other paths, loops, or regions allowed.
 * * The specific derived classes are `Path` and `Loop`.
 * * `CurveChain` is an intermediate class. It is not instantiable on its own.
 * * The related class `CurveChainWithDistanceIndex` is a `CurvePrimitive` whose API presents well-defined mappings
 * from fraction to xyz over the entire chain, but in fact does all the calculations over multiple primitives.
 * @see [Curve Collections]($docs/learning/geometry/CurveCollection.md) learning article.
 * @public
 */
export abstract class CurveChain extends CurveCollection {
  /** The curve primitives in the chain. */
  protected _curves: CurvePrimitive[];
  /** Constructor */
  protected constructor() {
    super();
    this._curves = [];
  }
  /** Return the array of `CurvePrimitive` */
  public override get children(): CurvePrimitive[] {
    return this._curves;
  }
  /** Return the start point of the curve chain (start point of the first child). */
  public startPoint(result?: Point3d): Point3d | undefined {
    const firstChild = this.getChild(0);
    if (firstChild)
      return firstChild.fractionToPoint(0.0, result);
    else
      return undefined;
  }
  /** Return the end point of the curve chain (end point of the last child). */
  public endPoint(result?: Point3d): Point3d | undefined {
    const lastChild = this.getChild(this._curves.length - 1);
    if (lastChild)
      return lastChild.fractionToPoint(1.0, result);
    else
      return undefined;
  }
  /**
   * Whether the chain start and end points are defined and within tolerance.
   * * Does not check for planarity or degeneracy.
   * @param tolerance optional distance tolerance (default is [[Geometry.smallMetricDistance]])
   * @param xyOnly if true, ignore z coordinate (default is `false`)
   */
  public isPhysicallyClosedCurve(tolerance: number = Geometry.smallMetricDistance, xyOnly: boolean = false): boolean {
    const p0 = this.startPoint();
    const p1 = this.endPoint();
    return p0 !== undefined && p1 !== undefined && (xyOnly ? p0.isAlmostEqualXY(p1, tolerance) : p0.isAlmostEqual(p1, tolerance));
  }
  /**
   * Return the start point and derivative of the first child of the curve chain.
   * * For queries interior to the chain, use [[CurveChainWithDistanceIndex.fractionToPointAndDerivative]].
   */
  public startPointAndDerivative(result?: Ray3d): Ray3d | undefined {
    const firstChild = this.getChild(0);
    if (firstChild)
      return firstChild.fractionToPointAndDerivative(0.0, result);
    else
      return undefined;
  }
  /**
   * Return the end point and derivative of the last child of the curve chain.
   * * For queries interior to the chain, use [[CurveChainWithDistanceIndex.fractionToPointAndDerivative]].
   */
  public endPointAndDerivative(result?: Ray3d): Ray3d | undefined {
    const lastChild = this.getChild(this._curves.length - 1);
    if (lastChild)
      return lastChild.fractionToPointAndDerivative(1.0, result);
    else
      return undefined;
  }
  /**
   * Return the curve primitive at the given `index`, optionally using `modulo` to map `index` to the cyclic indexing.
   * * In particular, `-1` is the final curve.
   * @param index cyclic index
   * @param cyclic whether to employ modulo operator for wrap-around indexing. Default is `true`.
   */
  public cyclicCurvePrimitive(index: number, cyclic: boolean = true): CurvePrimitive | undefined {
    const n = this.children.length;
    if (n === 0)
      return undefined;
    if (index >= 0 && index < n) // try simplest non-cyclic access first
      return this.children[index];
    if (cyclic) {
      const index2 = Geometry.modulo(index, n);
      return this.children[index2];
    }
    return undefined;
  }
  /**
   * Stroke the chain into a simple xyz array.
   * @param options tolerance parameters controlling the stroking.
   */
  public getPackedStrokes(options?: StrokeOptions): GrowableXYZArray | undefined {
    /**
     * The object returned by "cloneStroked" has the same type (Loop or Path) but instead of a chain of
     * CurvePrimitives as children, it has a single LineString3d child. "getPackedStrokes" just returns
     * the points of that LineString3d using "packedPoints".
     */
    const tree = this.cloneStroked(options);
    if (tree instanceof CurveChain) {
      const children = tree.children;
      if (children.length === 1) {
        const ls = children[0];
        if (ls instanceof LineString3d)
          return ls.packedPoints;
      }
    }
    return undefined;
  }
  /** Return a structural clone, with CurvePrimitive objects stroked. */
  public abstract override cloneStroked(options?: StrokeOptions): CurveChain;
  /**
   * Add a child curve.
   * @param child curve to add to the chain. The curve is captured by this instance.
   * @return whether the child was added
   */
  public tryAddChild(child: AnyCurve | undefined): boolean {
    if (child && child instanceof CurvePrimitive) {
      this._curves.push(child);
      return true;
    }
    return false;
  }
  /** Return a child by index */
  public getChild(i: number): CurvePrimitive | undefined {
    if (i < this._curves.length) return this._curves[i];
    return undefined;
  }
  /** Invoke `curve.extendRange(range, transform)` for each child  */
  public override extendRange(range: Range3d, transform?: Transform): void {
    for (const curve of this._curves)
      curve.extendRange(range, transform);
  }
  /**
   * Reverse each child curve (in place).
   * Reverse the order of the children array.
   */
  public reverseChildrenInPlace(): void {
    for (const curve of this._curves)
      curve.reverseInPlace();
    this._curves.reverse();
  }
  /** Same as [[reverseChildrenInPlace]]. */
  public override reverseInPlace(): void {
    this.reverseChildrenInPlace();
  }
  /**
   * Return the index where target is found in the array of children.
   * @param alsoSearchProxies whether to also check proxy curves of the children
   */
  public childIndex(target: CurvePrimitive | undefined, alsoSearchProxies?: boolean): number | undefined {
    for (let i = 0; i < this._curves.length; i++) {
      if (this._curves[i] === target)
        return i;
    }
    if (alsoSearchProxies ?? false) {
      for (let i = 0; i < this._curves.length; i++) {
        const childCurve = this._curves[i];
        if (childCurve instanceof ProxyCurve) {
          if (childCurve.proxyCurve === target)
            return i;
        }
      }
    }
    return undefined;
  }
  /** Evaluate an indexed curve at a fraction. Return as a CurveLocationDetail that indicates the primitive. */
  public primitiveIndexAndFractionToCurveLocationDetailPointAndDerivative(
    index: number, fraction: number, cyclic: boolean = false, result?: CurveLocationDetail,
  ): CurveLocationDetail | undefined {
    const primitive = this.cyclicCurvePrimitive(index, cyclic);
    if (primitive) {
      return CurveLocationDetail.createCurveEvaluatedFractionPointAndDerivative(primitive, fraction, result);
    }
    return undefined;
  }
}

/**
 * * A `BagOfCurves` object is a collection of `AnyCurve` objects.
 * * A `BagOfCurves` has no implied properties such as being planar.
 * @public
 */
export class BagOfCurves extends CurveCollection {
  /** String name for schema properties */
  public readonly curveCollectionType = "bagOfCurves";
  /** Test if `other` is an instance of `BagOfCurves` */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof BagOfCurves;
  }
  /**
   * Array of children.
   * * No restrictions on type.
   */
  protected _children: AnyCurve[];
  /** Construct an empty `BagOfCurves` */
  public constructor() {
    super();
    this._children = [];
  }
  /** Return the (reference to) array of children */
  public override get children(): AnyCurve[] {
    return this._children;
  }
  /** Create with given curves. */
  public static create(...data: AnyCurve[]): BagOfCurves {
    const result = new BagOfCurves();
    for (const child of data) {
      result.tryAddChild(child);
    }
    return result;
  }
  /** Return the boundary type (0) of a corresponding  MicroStation CurveVector */
  public dgnBoundaryType(): number {
    return 0;
  }
  /** Invoke `processor.announceBagOfCurves(this, indexInParent);` */
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceBagOfCurves(this, indexInParent);
  }
  /** Clone all children in stroked form. */
  public cloneStroked(options?: StrokeOptions): BagOfCurves {
    const clone = new BagOfCurves();
    let child;
    for (child of this.children) {
      if (child instanceof CurvePrimitive) {
        const ls = LineString3d.create();
        child.emitStrokes(ls, options);
        if (ls)
          clone.children.push(ls);
      } else if (child instanceof CurveCollection) {
        const childStrokes = child.cloneStroked(options);
        if (childStrokes)
          clone.children.push(childStrokes);
      }
    }
    return clone;
  }
  /** Return an empty `BagOfCurves` */
  public cloneEmptyPeer(): BagOfCurves {
    return new BagOfCurves();
  }
  /** Add a child  */
  public tryAddChild(child: AnyCurve | undefined): boolean {
    if (child)
      this._children.push(child);
    return true;
  }
  /** Get a child by index */
  public getChild(i: number): AnyCurve | undefined {
    if (i < this._children.length)
      return this._children[i];
    return undefined;
  }
  /** Second step of double dispatch:  call `handler.handleBagOfCurves(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBagOfCurves(this);
  }
}
