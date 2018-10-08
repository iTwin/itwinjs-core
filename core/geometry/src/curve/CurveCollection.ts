/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
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
import { GrowableXYZArray } from "../geometry3d/GrowableArray";
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
  // specialized cloners override this (and allow announceCurvePrimitive to insert to parent)
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
 * * * `Path` - a sequence of `CurvePrimitive` joining head-to-tail (but not required to close, and not enclosing a planar area)
 * * * `Loop` - a sequence of coplanar `CurvePrimitive` joining head-to-tail, and closing from last to first so that they enclose a planar area.
 * * * `ParityRegion` -- a colletion of coplanar `Loop`s, with "in/out" classification by parity rules
 * * * `UnionRegion` -- a colletion of coplanar `Loop`s, with "in/out" classification by union rules
 * * * `BagOfCurves` -- a collection of `AnyCurve` with no implied structure.
 */
export abstract class CurveCollection extends GeometryQuery {
  /* tslint:disable:variable-name no-empty*/
  // Only used by the Loop class, which is needed during a check in DGNJS writing
  public isInner: boolean = false;
  /** Return the sum of the lengths of all contained curves. */
  public sumLengths(): number { return SumLengthsContext.sumLengths(this); }
  /** return the max gap between adjacent primitives in Path and Loop collctions.
   *
   * * In a Path, gaps are computed between consecutive primitives.
   * * In a Loop, gaps are comptued between consecutvie primtives and between last and first.
   * * gaps are NOT computed between consecutive CurvePrimitives in "unstructured" collections.  The type is "unstructured" so gaps should not be semantically meaningful.
   */
  public maxGap(): number { return GapSearchContext.maxGap(this); }
  /** return true if the curve collection has any primitives other than LineSegment3d and LineString3d  */
  public checkForNonLinearPrimitives(): boolean { return CountLinearPartsSearchContext.hasNonLinearPrimitives(this); }
  public tryTransformInPlace(transform: Transform): boolean { return TransformInPlaceContext.tryTransformInPlace(this, transform); }
  public clone(): CurveCollection | undefined {
    return CloneCurvesContext.clone(this);
  }
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
  /** Support method for ICurvePrimtive ... one line call to specific announce method . . */
  public abstract announceToCurveProcessor(processor: RecursiveCurveProcessor): void;
  /** clone an empty collection. */
  public abstract cloneEmptyPeer(): CurveCollection;
  // return the BOUNDARY_TYPE integer from DGN CurveVector representations ...
  public abstract dgnBoundaryType(): number;
  /**
   * Try to add a child.
   * @param child child to add.
   * @return true if child is an acceptable type for this collection.
   */
  public abstract tryAddChild(child: AnyCurve): boolean;
  public abstract getChild(i: number): AnyCurve | undefined;
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
}
/** Shared base class for use by both open and closed paths.
 * A curveChain contains only curvePrimitives.  No other paths, loops, or regions allowed.
 */
export abstract class CurveChain extends CurveCollection {

  protected _curves: CurvePrimitive[];
  protected constructor() { super(); this._curves = []; }
  // _curves should be initialized in ctor.  But it doesn't happen.
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
  public cloneStroked(options?: StrokeOptions): AnyCurve {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return strokes;
  }
  public tryAddChild(child: AnyCurve): boolean {
    if (child instanceof CurvePrimitive) {
      this._curves.push(child);
      return true;
    }
    return false;
  }
  public getChild(i: number): CurvePrimitive | undefined {
    if (i < this._curves.length) return this._curves[i];
    return undefined;
  }
  public extendRange(range: Range3d, transform?: Transform): void {
    for (const curve of this._curves)
      curve.extendRange(range, transform);
  }
}

/**
 * * A `BagOfCurves` object is a collection of `AnyCurve` objects.
 * * A `BagOfCurves` is not a planar region.
 */
export class BagOfCurves extends CurveCollection {
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof BagOfCurves; }
  protected _children: AnyCurve[];
  public constructor() { super(); this._children = []; }
  public get children(): AnyCurve[] { return this._children; }
  public static create(...data: AnyCurve[]): BagOfCurves {
    const result = new BagOfCurves();
    for (const child of data) {
      result.tryAddChild(child);
    }
    return result;
  }
  public dgnBoundaryType(): number { return 0; }
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceBagOfCurves(this, indexInParent);
  }
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
  public cloneEmptyPeer(): BagOfCurves { return new BagOfCurves(); }
  public tryAddChild(child: AnyCurve): boolean {
    this._children.push(child);
    return true;
  }
  public getChild(i: number): AnyCurve | undefined {
    if (i < this._children.length)
      return this._children[i];
    return undefined;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBagOfCurves(this);
  }
}
