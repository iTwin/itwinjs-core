/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { CurveLocationDetail } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { AnyCurve, type AnyRegion } from "./CurveTypes";
import { GeometryQuery } from "./GeometryQuery";
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
  /** Return the closest point on the contained curves */
  public closestPoint(spacePoint: Point3d): CurveLocationDetail | undefined {
    let detailA: CurveLocationDetail | undefined;
    if (this.children !== undefined) {
      for (const child of this.children) {
        if (child instanceof CurvePrimitive) {
          const detailB = child.closestPoint(spacePoint, false);
          detailA = CurveLocationDetail.chooseSmallerA(detailA, detailB);
        } else if (child instanceof CurveCollection) {
          const detailB = child.closestPoint(spacePoint);
          detailA = CurveLocationDetail.chooseSmallerA(detailA, detailB);
        }
      }
    }
    return detailA;
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
  /**
   * Return the curve primitive at the given `index`, optionally using `modulo` to map `index` to the cyclic indexing.
   * * In particular, `-1` is the final curve.
   * @param index cyclic index
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
   * * Returns false if the given child is not a CurvePrimitive.
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
   * Reverse each child curve (in place)
   * Reverse the order of the children in the CurveChain array.
   */
  public reverseChildrenInPlace(): void {
    for (const curve of this._curves)
      curve.reverseInPlace();
    this._curves.reverse();
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
