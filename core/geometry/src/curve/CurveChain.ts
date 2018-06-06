/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Curve */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

// import { Point3d, Vector3d, RotMatrix } from "../PointVector";
import { Geometry } from "../Geometry";
import { StrokeOptions } from "../curve/StrokeOptions";
import { CurvePrimitive, GeometryQuery } from "./CurvePrimitive";
import { Point3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { RecursiveCurveProcessor } from "./CurveProcessor";
import { GrowableXYZArray } from "../GrowableArray";
import { GeometryHandler } from "../GeometryHandler";
import { SumLengthsContext, GapSearchContext, CountLinearPartsSearchContext, CloneCurvesContext, TransformInPlaceContext } from "./CurveSearches";
export type AnyCurve = CurvePrimitive | Path | Loop | ParityRegion | UnionRegion | BagOfCurves | CurveCollection;
export type AnyRegion = Loop | ParityRegion | UnionRegion;

import { LineString3d } from "./LineString3d";
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
  public hasNonLinearPrimitives(): boolean { return CountLinearPartsSearchContext.hasNonLinearPrimitives(this); }

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
  public isAnyRegionType(): boolean {
    return this.dgnBoundaryType() === 2 || this.dgnBoundaryType() === 5 || this.dgnBoundaryType() === 4;
  }
  /** Return true for a `Path`, i.e. a chain of curves joined head-to-tail
   */
  public isOpenPath(): boolean {
    return this.dgnBoundaryType() === 1;
  }
  /** Return true for a single-loop planar region type, i.e. `Loop`.
   * * This is _not- a test for physical closure of a `Path`
   */
  public isClosedPath(): boolean {
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
  /** Construct a CurveCollection with the same structure as collectionA and collectionB, with primitives constructed by the caller-supplied primitiveMutator function.
   * @returns Returns undefined if there is any type mismatch between the two collections.
   */
  public static mutatePartners(collectionA: CurveCollection, collectionB: CurveCollection,
    primitiveMutator: (primitiveA: CurvePrimitive, primitiveB: CurvePrimitive) => CurvePrimitive | undefined): CurveCollection | undefined {
    if (!collectionA.isSameGeometryClass(collectionB)) return undefined;
    if (collectionA instanceof CurveChain && collectionB instanceof CurveChain) {
      const chainA = collectionA as CurveChain;
      const chainB = collectionB as CurveChain;
      const chainC = chainA.cloneEmptyPeer() as CurveChain;
      const childrenA = chainA.children;
      const childrenB = chainB.children;
      if (childrenA.length !== childrenA.length) return undefined;
      for (let i = 0; i < childrenA.length; i++) {
        const newChild = primitiveMutator(childrenA[i], childrenB[i]);
        if (!newChild) return undefined;
        chainC.children.push(newChild);
      }
      return chainC;
    } else if (collectionA instanceof CurveCollection && collectionB instanceof CurveCollection) {
      const collectionC = collectionA.cloneEmptyPeer();
      const childrenA = collectionA.children;
      const childrenB = collectionB.children;
      const childrenC = collectionC.children;

      if (!childrenA || !childrenB || !childrenC) return undefined;
      for (let i = 0; i < childrenA.length; i++) {
        const childA = childrenA[i];
        const childB = childrenB[i];
        if (childA instanceof CurvePrimitive && childB instanceof CurvePrimitive) {
          const newPrimitive = primitiveMutator(childA, childB);
          if (!newPrimitive) return undefined;
          childrenC.push(newPrimitive);
        } else if (childA instanceof CurveCollection && childB instanceof CurveCollection) {
          const newChild = this.mutatePartners(childA, childB, primitiveMutator);
          if (!newChild) return undefined;
          if (newChild instanceof CurveCollection)
            childrenC.push(newChild);
        }
      }
      return collectionC;
    }
    return undefined;
  }
}

/** Shared base class for use by both open and closed paths.
 * A curveChain contains curvePrimitives.
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
 * * A `Path` object is a collection of curves that join head-to-tail to form a path.
 * * A `Path` object does not bound a planar region.
 */
export class Path extends CurveChain {

  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof Path; }
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announcePath(this, indexInParent);
  }

  public constructor() { super(); }
  public static create(...curves: CurvePrimitive[]): Path {
    const result = new Path();
    for (const curve of curves) { result.children.push(curve); }
    return result;
  }
  public cloneStroked(options?: StrokeOptions): AnyCurve {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return Path.create(strokes);
  }

  public dgnBoundaryType(): number { return 1; }
  public cyclicCurvePrimitive(index: number): CurvePrimitive | undefined {
    if (index >= 0 && index < this.children.length)
      return this.children[index];
    return undefined;
  }
  public cloneEmptyPeer(): Path { return new Path(); }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handlePath(this);
  }
}
/**
 * A `Loop` is a curve chain that is the boundary of a closed (planar) loop.
 */
export class Loop extends CurveChain {
  public isInner: boolean = false;
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof Loop; }
  public constructor() { super(); }

  public static create(...curves: CurvePrimitive[]): Loop {
    const result = new Loop();
    for (const curve of curves) { result.children.push(curve); }
    return result;
  }
  public static createPolygon(points: Point3d[]): Loop {
    const linestring = LineString3d.create(points);
    linestring.addClosurePoint();
    return Loop.create(linestring);
  }
  public cloneStroked(options?: StrokeOptions): AnyCurve {
    const strokes = LineString3d.create();
    for (const curve of this.children)
      curve.emitStrokes(strokes, options);
    return Loop.create(strokes);
  }

  public dgnBoundaryType(): number { return 2; }  // (2) all "Loop" become "outer"

  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceLoop(this, indexInParent);
  }
  public cyclicCurvePrimitive(index: number): CurvePrimitive | undefined {
    const n = this.children.length;
    if (n >= 1) {
      index = Geometry.modulo(index, this.children.length);
      return this.children[index];
    }
    return undefined;
  }
  public cloneEmptyPeer(): Loop { return new Loop(); }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLoop(this);
  }
}
/**
 * * A `ParityRegion` is a collection of `Loop` objects.
 * * The loops collectively define a planar region.
 * * A point is "in" the composite region if it is "in" an odd number of the loops.
 */
export class ParityRegion extends CurveCollection {

  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof ParityRegion; }
  protected _children: Loop[];
  public get children(): Loop[] { return this._children; }
  public constructor() { super(); this._children = []; }

  public static create(...data: Loop[]): ParityRegion {
    const result = new ParityRegion();
    for (const child of data) { result.children.push(child); }
    return result;
  }
  public dgnBoundaryType(): number { return 4; }

  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceParityRegion(this, indexInParent);
  }
  public clone(): ParityRegion {
    const clone = new ParityRegion();
    let child;
    for (child of this.children) {
      const childClone = child.clone();
      if (childClone instanceof Loop)
        clone.children.push(childClone);
    }
    return clone;
  }
  public cloneStroked(options?: StrokeOptions): ParityRegion {
    const clone = new ParityRegion();
    let child;
    for (child of this.children) {
      const childStrokes = child.cloneStroked(options) as Loop;
      if (childStrokes)
        clone.children.push(childStrokes);
    }
    return clone;
  }
  public cloneEmptyPeer(): ParityRegion { return new ParityRegion(); }
  public tryAddChild(child: AnyCurve): boolean {
    if (child instanceof Loop) {
      this._children.push(child);
      return true;
    }
    return false;
  }
  public getChild(i: number): Loop | undefined {
    if (i < this._children.length) return this._children[i];
    return undefined;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleParityRegion(this);
  }
}
/**
 * * A `UnionRegion` is a collection of other planar region types -- `Loop` and `ParityRegion`.
 * * The composite is the union of the contained regions.
 * * A point is "in" the composite if it is "in" one or more of the contained regions.
 */
export class UnionRegion extends CurveCollection {
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof UnionRegion; }
  protected _children: Array<ParityRegion | Loop>;
  public get children(): Array<ParityRegion | Loop> { return this._children; }
  public constructor() { super(); this._children = []; }
  public static create(...data: Array<ParityRegion | Loop>): UnionRegion {
    const result = new UnionRegion();
    for (const child of data) { result.tryAddChild(child); }
    return result;
  }
  public dgnBoundaryType(): number { return 5; }
  public announceToCurveProcessor(processor: RecursiveCurveProcessor, indexInParent: number = -1): void {
    return processor.announceUnionRegion(this, indexInParent);
  }

  public cloneStroked(options?: StrokeOptions): UnionRegion {
    const clone = new UnionRegion();
    let child;
    for (child of this._children) {
      const childStrokes = child.cloneStroked(options) as ParityRegion | Loop;
      if (childStrokes)
        clone.children.push(childStrokes);
    }
    return clone;
  }
  public cloneEmptyPeer(): UnionRegion { return new UnionRegion(); }
  public tryAddChild(child: AnyCurve): boolean {
    if (child instanceof ParityRegion || child instanceof Loop) {
      this._children.push(child);
      return true;
    }
    return false;
  }
  public getChild(i: number): Loop | ParityRegion | undefined {
    if (i < this._children.length) return this._children[i];
    return undefined;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleUnionRegion(this);
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
    for (const child of data) { result.tryAddChild(child); }
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
    if (i < this._children.length) return this._children[i];
    return undefined;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBagOfCurves(this);
  }
}
