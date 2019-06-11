/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */
import { StrokeOptions } from "./StrokeOptions";
import { GeometryQuery } from "./GeometryQuery";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { RecursiveCurveProcessor, RecursiveCurveProcessorWithStack } from "./CurveProcessor";
import { AnyCurve } from "./CurveChain";
import { CurvePrimitive } from "./CurvePrimitive";
import { LineSegment3d } from "./LineSegment3d";
import { LineString3d } from "./LineString3d";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { GeometryHandler } from "../geometry3d/GeometryHandler";

// import { SumLengthsContext, GapSearchContext, CountLinearPartsSearchContext, CloneCurvesContext, TransformInPlaceContext } from "./CurveSearches";

/** Algorithmic class: Accumulate maximum gap between adjacent primitives of CurveChain.
 */
class GapSearchContext extends RecursiveCurveProcessorWithStack {
  public maxGap: number;
  constructor() { super(); this.maxGap = 0.0; }
  public static maxGap(target: CurveCollection): number {
    const context = new GapSearchContext();
    target.announceToCurveProcessor(context);
    return context.maxGap;
  }
  public announceCurvePrimitive(curve: CurvePrimitive, _indexInParent: number): void {
    if (this._stack.length > 0) {
      const parent = this._stack[this._stack.length - 1];
      if (parent instanceof CurveChain) {
        const chain = parent as CurveChain;
        const nextCurve = chain.cyclicCurvePrimitive(_indexInParent + 1);
        if (curve !== undefined && nextCurve !== undefined) {
          this.maxGap = Math.max(this.maxGap, curve.endPoint().distance(nextCurve.startPoint()));
        }
      }
    }
  }
}

/** Algorithmic class: Count LineSegment3d and LineString3d primitives.
 */
class CountLinearPartsSearchContext extends RecursiveCurveProcessorWithStack {
  public numLineSegment: number;
  public numLineString: number;
  public numOther: number;
  constructor() {
    super();
    this.numLineSegment = 0;
    this.numLineString = 0;
    this.numOther = 0;
  }
  public static hasNonLinearPrimitives(target: CurveCollection): boolean {
    const context = new CountLinearPartsSearchContext();
    target.announceToCurveProcessor(context);
    return context.numOther > 0;
  }
  public announceCurvePrimitive(curve: CurvePrimitive, _indexInParent: number): void {
    if (curve instanceof LineSegment3d)
      this.numLineSegment++;
    else if (curve instanceof LineString3d)
      this.numLineString++;
    else
      this.numOther++;
  }
}

/** Algorithmic class: Transform curves in place.
 */
class TransformInPlaceContext extends RecursiveCurveProcessor {
  public numFail: number;
  public numOK: number;
  public transform: Transform;
  constructor(transform: Transform) { super(); this.numFail = 0; this.numOK = 0; this.transform = transform; }
  public static tryTransformInPlace(target: CurveCollection, transform: Transform): boolean {
    const context = new TransformInPlaceContext(transform);
    target.announceToCurveProcessor(context);
    return context.numFail === 0;
  }
  public announceCurvePrimitive(curvePrimitive: CurvePrimitive, _indexInParent: number): void {
    if (!curvePrimitive.tryTransformInPlace(this.transform))
      this.numFail++;
    else
      this.numOK++;
  }
}
/** Algorithmic class: Sum lengths of curves */
class SumLengthsContext extends RecursiveCurveProcessor {
  private _sum: number;
  private constructor() { super(); this._sum = 0.0; }
  public static sumLengths(target: CurveCollection): number {
    const context = new SumLengthsContext();
    target.announceToCurveProcessor(context);
    return context._sum;
  }
  public announceCurvePrimitive(curvePrimitive: CurvePrimitive, _indexInParent: number): void {
    this._sum += curvePrimitive.curveLength();
  }
}
/**
 * Algorithmic class for cloning curve collections.
 * * recurse through collection nodes, building image nodes as needed and inserting clones of children.
 * * for individual primitive, invoke doClone (protected) for direct clone; insert into parent
 */
class CloneCurvesContext extends RecursiveCurveProcessorWithStack {
  private _result: CurveCollection | undefined;
  private _transform: Transform | undefined;
  private constructor(transform?: Transform) {
    super();
    this._transform = transform;
    this._result = undefined;
  }
  public static clone(target: CurveCollection, transform?: Transform): CurveCollection | undefined {
    const context = new CloneCurvesContext(transform);
    target.announceToCurveProcessor(context);
    return context._result;
  }
  public enter(c: CurveCollection) {
    if (c instanceof CurveCollection)
      super.enter(c.cloneEmptyPeer());
  }
  public leave(): CurveCollection | undefined {
    const result = super.leave();
    if (result) {
      if (this._stack.length === 0) // this should only happen once !!!
        this._result = result as BagOfCurves;
      else // push this result to top of stack.
        this._stack[this._stack.length - 1].tryAddChild(result);
    }
    return result;
  }
  // specialized clone methods override this (and allow announceCurvePrimitive to insert to parent)
  protected doClone(primitive: CurvePrimitive): CurvePrimitive {
    if (this._transform)
      return primitive.cloneTransformed(this._transform) as CurvePrimitive;
    return primitive.clone() as CurvePrimitive;
  }

  public announceCurvePrimitive(primitive: CurvePrimitive, _indexInParent: number): void {
    const c = this.doClone(primitive);
    if (c && this._stack.length > 0) {
      const parent = this._stack[this._stack.length - 1];
      if (parent instanceof CurveChain) {
        parent.tryAddChild(c);
      } else if (parent instanceof BagOfCurves) {
        parent.tryAddChild(c);
      }
    }
  }
}

/**
 * * A `CurveCollection` is an abstract (non-instantiable) class for various sets of curves with particular structures:
 *   * `CurveChain` is a (non-instantiable) intermediate class for a sequence of `CurvePrimitive ` joining head-to-tail.  The two instantiable forms of `CurveChain` are
 *     * `Path` - A chain not required to close, and not enclosing a planar area
 *     * `Loop` - A chain required to close from last to first so that a planar area is enclosed.
 *   * `ParityRegion` -- a collection of coplanar `Loop`s, with "in/out" classification by parity rules
 *   * `UnionRegion` -- a collection of coplanar `Loop`s, with "in/out" classification by union rules
 *   * `BagOfCurves` -- a collection of `AnyCurve` with no implied structure.
 * @public
 */
export abstract class CurveCollection extends GeometryQuery {
  /* tslint:disable:variable-name no-empty*/
  /**  Flag for inner loop status. Only used by `Loop`. */
  public isInner: boolean = false;
  /** Return the sum of the lengths of all contained curves. */
  public sumLengths(): number { return SumLengthsContext.sumLengths(this); }
  /** return the max gap between adjacent primitives in Path and Loop collections.
   *
   * * In a Path, gaps are computed between consecutive primitives.
   * * In a Loop, gaps are computed between consecutive primitives and between last and first.
   * * gaps are NOT computed between consecutive CurvePrimitives in "unstructured" collections.  The type is "unstructured" so gaps should not be semantically meaningful.
   */
  public maxGap(): number { return GapSearchContext.maxGap(this); }
  /** return true if the curve collection has any primitives other than LineSegment3d and LineString3d  */
  public checkForNonLinearPrimitives(): boolean { return CountLinearPartsSearchContext.hasNonLinearPrimitives(this); }
  /** Apply transform recursively to children */
  public tryTransformInPlace(transform: Transform): boolean { return TransformInPlaceContext.tryTransformInPlace(this, transform); }
  /** Return a deep copy. */
  public clone(): CurveCollection | undefined {
    return CloneCurvesContext.clone(this);
  }
  /** Create a deep copy of transformed curves. */
  public cloneTransformed(transform: Transform): CurveCollection | undefined {
    return CloneCurvesContext.clone(this, transform);
  }
  /** Return true for planar region types:
   * * `Loop`
   * * `ParityRegion`
   * * `UnionRegion`
   */
  public get isAnyRegionType(): boolean {
    return this.dgnBoundaryType() === 2 || this.dgnBoundaryType() === 5 || this.dgnBoundaryType() === 4;
  }
  /** Return true for a `Path`, i.e. a chain of curves joined head-to-tail
   */
  public get isOpenPath(): boolean {
    return this.dgnBoundaryType() === 1;
  }
  /** Return true for a single-loop planar region type, i.e. `Loop`.
   * * This is _not- a test for physical closure of a `Path`
   */
  public get isClosedPath(): boolean {
    return this.dgnBoundaryType() === 2;
  }
  /** Return a CurveCollection with the same structure but all curves replaced by strokes. */
  public abstract cloneStroked(options?: StrokeOptions): AnyCurve;
  /** Support method for ICurvePrimitive ... one line call to specific announce method . . */
  public abstract announceToCurveProcessor(processor: RecursiveCurveProcessor): void;
  /** clone an empty collection. */
  public abstract cloneEmptyPeer(): CurveCollection;
  /** Return the boundary type of a corresponding  MicroStation CurveVector.
   * * Derived class must implement.
   */
  public abstract dgnBoundaryType(): number;
  /**
   * Try to add a child.
   * @param child child to add.
   * @return true if child is an acceptable type for this collection.
   */
  public abstract tryAddChild(child: AnyCurve): boolean;
  /** Return a child identified by by index */
  public abstract getChild(i: number): AnyCurve | undefined;
  /** Extend (increase) `rangeToExtend` as needed to include these curves (optionally transformed) */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    const children = this.children;
    if (children) {
      for (const c of children) {
        c.extendRange(rangeToExtend, transform);
      }
    }
  }
}
/** Shared base class for use by both open and closed paths.
 * * A `CurveChain` contains only curvePrimitives.  No other paths, loops, or regions allowed.
 * * A single entry in the chain can in fact contain multiple curve primitives if the entry itself is (for instance) `CurveChainWithDistanceIndex`
 *   which presents itself (through method interface) as a CurvePrimitive with well defined mappings from fraction to xyz, but in fact does all the
 *    calculations over multiple primitives.
 * * The specific derived classes are `Path` and `Loop`
 * * `CurveChain` is an intermediate class.   It is not instantiable on its own.
 * @public
 */
export abstract class CurveChain extends CurveCollection {
  /** The curve primitives in the chain. */
  protected _curves: CurvePrimitive[];
  protected constructor() { super(); this._curves = []; }
  /** Return the array of `CurvePrimitive` */
  public get children(): CurvePrimitive[] {
    if (this._curves === undefined)
      this._curves = [];
    return this._curves;
  }
  /**
   * Return curve primitive by index, interpreted cyclically if the Chain is a Loop.
   *
   * *  For a path, return undefined for any out-of-bounds index
   * *  For a loop, an out-of-bounds index is mapped cyclically into bounds.
   * @param index index to array
   */
  public abstract cyclicCurvePrimitive(index: number): CurvePrimitive | undefined;
  /** Stroke the chain into a simple xyz array.
   * @param options tolerance parameters controlling the stroking.
   */
  public getPackedStrokes(options?: StrokeOptions): GrowableXYZArray | undefined {
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
  public cloneStroked(options?: StrokeOptions): AnyCurve {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return strokes;
  }
  /** add a child curve.
   * * Returns false if the given child is not a CurvePrimitive.
   */
  public tryAddChild(child: AnyCurve): boolean {
    if (child instanceof CurvePrimitive) {
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
  /** invoke `curve.extendRange(range, transform)` for each child  */
  public extendRange(range: Range3d, transform?: Transform): void {
    for (const curve of this._curves)
      curve.extendRange(range, transform);
  }
  /**
   * Reverse each child curve (in place)
   * Reverse the order of the children in the CurveChain array.
   */
  public reverseChildrenInPlace() {
    for (const curve of this._curves)
      curve.reverseInPlace();
    this._curves.reverse();
  }
}

/**
 * * A `BagOfCurves` object is a collection of `AnyCurve` objects.
 * * A `BagOfCurves` has no implied properties such as being planar.
 * @public
 */
export class BagOfCurves extends CurveCollection {
  /** test if `other` is an instance of `BagOfCurves` */
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof BagOfCurves; }
  /** Array of children.
   * * No restrictions on type.
   */
  protected _children: AnyCurve[];
  /** Construct an empty `BagOfCurves` */
  public constructor() { super(); this._children = []; }
  /** Return the (reference to) array of children */
  public get children(): AnyCurve[] { return this._children; }
  /** create with given curves. */
  public static create(...data: AnyCurve[]): BagOfCurves {
    const result = new BagOfCurves();
    for (const child of data) {
      result.tryAddChild(child);
    }
    return result;
  }
  /** Return the boundary type (0) of a corresponding  MicroStation CurveVector */
  public dgnBoundaryType(): number { return 0; }
  /** invoke `processor.announceBagOfCurves(this, indexInParent);` */
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
        (child as CurvePrimitive).emitStrokes(ls, options);
        if (ls)
          clone.children.push(ls);
      } else if (child instanceof CurveCollection) {
        const childStrokes = (child as CurveCollection).cloneStroked(options);
        if (childStrokes)
          clone.children.push(childStrokes);
      }
    }
    return clone;
  }
  /** Return an empty `BagOfCurves` */
  public cloneEmptyPeer(): BagOfCurves { return new BagOfCurves(); }
  /** Add a child  */
  public tryAddChild(child: AnyCurve): boolean {
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
