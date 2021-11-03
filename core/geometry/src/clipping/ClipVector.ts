/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { assert } from "@itwin/core-bentley";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Geometry } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Segment1d } from "../geometry3d/Segment1d";
import { Transform } from "../geometry3d/Transform";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { ClipPlane } from "./ClipPlane";
import { AnnounceNumberNumber, AnnounceNumberNumberCurvePrimitive} from "../curve/CurvePrimitive";
import { ClipMaskXYZRangePlanes, ClipPrimitive, ClipPrimitiveProps, ClipShape } from "./ClipPrimitive";
import { Clipper, ClipPlaneContainment } from "./ClipUtils";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";
import { BooleanClipNodeIntersection } from "./BooleanClipNode";
import { Arc3d } from "../curve/Arc3d";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { GrowableXYZArrayCache } from "../geometry3d/ReusableObjectCache";

/** Wire format describing a [[ClipVector]].
 * @public
 */
export type ClipVectorProps = ClipPrimitiveProps[];

/** Class holding an array structure of shapes defined by `ClipPrimitive`
 * * The `ClipVector` defines an intersection of the member `ClipPrimitive` regions.
 * * In the most common usage, one of the `ClipPrimitive` will be an outer region, and all others are holes with marker flag indicating that they outside of each hole is live.
 * @public
 */
export class ClipVector implements Clipper {
  private _clips: ClipPrimitive[];
  /** range acting as first filter.
   * * This is understood as overall range limit, not as precise planes.
   * * applying any rotation to the whole ClipVector generally expands this range, rather than exactly transforming its planes.
   */
  public boundingRange: Range3d = Range3d.createNull();

  /** Returns a reference to the array of ClipShapes. */
  public get clips() { return this._clips; }

  private constructor(clips?: ClipPrimitive[]) {
    this._clips = clips ? clips : [];
  }

  /** Returns true if this ClipVector contains a ClipPrimitive. */
  public get isValid(): boolean { return this._clips.length > 0; }

  /** Create a ClipVector with an empty set of ClipShapes. */
  public static createEmpty(result?: ClipVector): ClipVector {
    if (result) {
      result._clips.length = 0;
      return result;
    }
    return new ClipVector();
  }

  /** Create a ClipVector from an array of ClipPrimitives (or derived classes) (capture the pointers) */
  public static createCapture(clips: ClipPrimitive[], result?: ClipVector): ClipVector {
    if (result) {
      result._clips = clips;
      return result;
    }
    return new ClipVector(clips);
  }

  /** Create a ClipVector from (clones of) an array of ClipPrimitives */
  public static create(clips: ClipPrimitive[], result?: ClipVector): ClipVector {
    const clipClones: ClipPrimitive[] = [];
    for (const clip of clips)
      clipClones.push(clip.clone());
    return ClipVector.createCapture(clipClones, result);
  }

  /** Create a deep copy of another ClipVector */
  public clone(result?: ClipVector): ClipVector {
    const retVal = result ? result : new ClipVector();
    retVal._clips.length = 0;
    for (const clip of this._clips) {
      retVal._clips.push(clip.clone());
    }
    retVal.boundingRange.setFrom(this.boundingRange);
    return retVal;
  }

  /** Parse this ClipVector into a JSON object. */
  public toJSON(): ClipVectorProps {
    if (!this.isValid)
      return [];

    return this.clips.map((clip) => clip.toJSON());
  }

  /** Parse a JSON object into a new ClipVector. */
  public static fromJSON(json: ClipVectorProps | undefined, result?: ClipVector): ClipVector {
    result = result ? result : new ClipVector();
    result.clear();
    if (!Array.isArray(json))
      return result;

    try {
      for (const clip of json) {
        const clipPrim = ClipPrimitive.fromJSON(clip);
        if (clipPrim)
          result._clips.push(clipPrim);
      }
    } catch (e) {
      result.clear();
    }

    return result;
  }

  /** Empties out the array of ClipShapes. */
  public clear() {
    this._clips.length = 0;
  }

  /** Append a deep copy of the given ClipPrimitive to this ClipVector. */
  public appendClone(clip: ClipPrimitive) {
    this._clips.push(clip.clone());
  }

  /** Append a reference of the given ClipPrimitive to this ClipVector. */
  public appendReference(clip: ClipPrimitive) {
    this._clips.push(clip);
  }

  /** Create and append a new ClipPrimitive to the array given a shape as an array of points. Returns true if successful. */
  public appendShape(shape: Point3d[], zLow?: number, zHigh?: number,
    transform?: Transform, isMask: boolean = false, invisible: boolean = false): boolean {
    const clip = ClipShape.createShape(shape, zLow, zHigh, transform, isMask, invisible);
    if (!clip)
      return false;
    this._clips.push(clip);
    return true;
  }

  /** Returns true if the given point lies inside all of this ClipVector's ClipShapes (by rule of intersection).*/
  public pointInside(point: Point3d, onTolerance: number = Geometry.smallMetricDistanceSquared): boolean {
    return this.isPointOnOrInside(point, onTolerance);
  }

  /** Method from [[Clipper]] interface.
   * * Implement as dispatch to clipPlaneSets as supplied by derived class.
   */
  public isPointOnOrInside(point: Point3d, onTolerance: number = Geometry.smallMetricDistanceSquared): boolean {
    if (!this.boundingRange.isNull && !this.boundingRange.containsPoint(point))
      return false;

    for (const clip of this._clips) {
      if (!clip.pointInside(point, onTolerance))
        return false;
    }
    return true;
  }
  // Proxy object to implement line and arc clip.
  private _clipNodeProxy?: BooleanClipNodeIntersection;
  private ensureProxyClipNode(): boolean{
    if (this._clipNodeProxy)
      return true;
    this._clipNodeProxy = new BooleanClipNodeIntersection(true);
    let numChildren = 0;
    for (const child of this._clips) {
      const q = child.fetchClipPlanesRef();
      if (q) {
        numChildren++;
        this._clipNodeProxy.captureChild(q);
      }
    }
    return numChildren > 0;
  }
  /** Method from [[Clipper]] interface.
   * * Implement as dispatch to clipPlaneSets as supplied by derived class.
   */
  public announceClippedSegmentIntervals(f0: number, f1: number, pointA: Point3d, pointB: Point3d, announce?: AnnounceNumberNumber): boolean {
    this.ensureProxyClipNode();
    if (this._clipNodeProxy)
      return this._clipNodeProxy.announceClippedSegmentIntervals(f0, f1, pointA, pointB, announce);
    return false;
  }
  /** Method from [[Clipper]] interface.
   * * Implement as dispatch to clipPlaneSets as supplied by derived class.
   */
  public announceClippedArcIntervals(arc: Arc3d, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    this.ensureProxyClipNode();
    if (this._clipNodeProxy)
      return this._clipNodeProxy.announceClippedArcIntervals(arc, announce);
    return false;
  }
/** Execute polygon clip as intersection of the child primitives. */
  public appendPolygonClip(
    xyz: GrowableXYZArray,
    insideFragments: GrowableXYZArray[],
    outsideFragments: GrowableXYZArray[],
    arrayCache: GrowableXYZArrayCache) {
      this.ensureProxyClipNode();
      if (this._clipNodeProxy)
        this._clipNodeProxy.appendPolygonClip(xyz, insideFragments, outsideFragments, arrayCache);
      }
 /** Transforms this ClipVector to a new coordinate-system.
   * Note that if the transform has rotate and scale the boundingRange member expands.
   * Returns true if successful.
   */
  public transformInPlace(transform: Transform): boolean {
    for (const clip of this._clips)
      if (clip.transformInPlace(transform) === false)
        return false;

    if (!this.boundingRange.isNull)
      transform.multiplyRange(this.boundingRange, this.boundingRange);

    return true;
  }

  /**
   * A simple way of packaging this ClipVector's ClipShape points into a multidimensional array, while also
   * taking into account each ClipPrimitive's individual transforms.
   *
   * ClipPrimitives OTHER THAN ClipShape are ignored.
   *
   * Information out:
   *  - All of the loop points are stored in the multidimensional Point3d array given (will return unchanged upon failure)
   *  - If given a transform, will be set from the transformFromClip of the first ClipPrimitive
   *  - The ClipMask of the final ClipPrimitive is stored in the returned array at index 0
   *  - The last valid zLow found is stored in the returned array at index 1
   *  - The last valid zHigh found is stored in the returned array at index 2
   */
  public extractBoundaryLoops(loopPoints: Point3d[][], transform?: Transform): number[] {
    let clipM = ClipMaskXYZRangePlanes.None;
    let zBack = -Number.MAX_VALUE;
    let zFront = Number.MAX_VALUE;
    const retVal: number[] = [];
    let nLoops = 0;

    if (this._clips.length === 0)
      return retVal;
    let firstClipShape: ClipShape | undefined;
    const deltaTrans = Transform.createIdentity();

    for (const clip of this._clips) {
      if (clip instanceof ClipShape) {
        if (firstClipShape !== undefined && clip !== firstClipShape) {      // Is not the first iteration
          let fwdTrans = Transform.createIdentity();
          let invTrans = Transform.createIdentity();

          if (firstClipShape.transformValid && clip.transformValid) {
            fwdTrans = clip.transformFromClip!.clone();
            invTrans = firstClipShape.transformToClip!.clone();
          }
          deltaTrans.setFrom(invTrans.multiplyTransformTransform(fwdTrans));
        }
        if (!firstClipShape)
          firstClipShape = clip;
        loopPoints[nLoops] = [];

        if (clip.polygon !== undefined) {
          clipM = ClipMaskXYZRangePlanes.XAndY;

          if (clip.zHighValid) {
            clipM = clipM | ClipMaskXYZRangePlanes.ZHigh;
            zFront = clip.zHigh!;
          }
          if (clip.zLowValid) {
            clipM = clipM | ClipMaskXYZRangePlanes.ZLow;
            zBack = clip.zLow!;
          }

          for (const point of clip.polygon)
            loopPoints[nLoops].push(point.clone());
          deltaTrans.multiplyPoint3dArray(loopPoints[nLoops], loopPoints[nLoops]);
          nLoops++;
        }
      }
    }

    retVal.push(clipM);
    retVal.push(zBack);
    retVal.push(zFront);

    if (transform && firstClipShape)
      transform.setFrom(firstClipShape.transformFromClip!);

    return retVal;
  }

  /** Sets this ClipVector and all of its members to the visibility specified. */
  public setInvisible(invisible: boolean) {
    for (const clip of this._clips)
      clip.setInvisible(invisible);
  }

  /** For every clip, parse the member point array into the member clip plane object (only for clipPlanes member, not the mask) */
  public parseClipPlanes() {
    for (const clip of this._clips)
      clip.fetchClipPlanesRef();
  }

  /**
   * Multiply all ClipPlanes DPoint4d by matrix.
   * @param matrix matrix to apply.
   * @param invert if true, use in verse of the matrix.
   * @param transpose if true, use the transpose of the matrix (or inverse, per invert parameter)
   * * Note that if matrixA is applied to all of space, the matrix to send to this method to get a corresponding effect on the plane is the inverse transpose of matrixA
   * * Callers that will apply the same matrix to many planes should pre-invert the matrix for efficiency.
   * * Both params default to true to get the full effect of transforming space.
   * @param matrix matrix to apply
   * @returns false if matrix inversion fails.
   */
  public multiplyPlanesByMatrix4d(matrix: Matrix4d, invert: boolean = true, transpose: boolean = true): boolean {
    if (invert) {  // form inverse once here, reuse for all planes
      const inverse = matrix.createInverse();
      if (!inverse)
        return false;
      return this.multiplyPlanesByMatrix4d(inverse, false, transpose);
    }
    // no inverse necessary -- lower level cannot fail.
    for (const clip of this._clips)
      clip.multiplyPlanesByMatrix4d(matrix, false, transpose);
    return true;
  }

  /**
   * Determines whether the given points fall inside or outside this set of ClipShapes. If any set is defined by masking planes,
   * checks the mask planes only, provided that ignoreMasks is false. Otherwise, checks the _clipPlanes member.
   */
  public classifyPointContainment(points: Point3d[], ignoreMasks: boolean = false): ClipPlaneContainment {
    let currentContainment = ClipPlaneContainment.Ambiguous;

    for (const primitive of this._clips) {
      const thisContainment = primitive.classifyPointContainment(points, ignoreMasks);

      if (ClipPlaneContainment.Ambiguous === thisContainment)
        return ClipPlaneContainment.Ambiguous;

      if (ClipPlaneContainment.Ambiguous === currentContainment)
        currentContainment = thisContainment;
      else if (currentContainment !== thisContainment)
        return ClipPlaneContainment.Ambiguous;
    }
    return currentContainment;
  }

  /**
   * Determines whether a 3D range lies inside or outside this set of ClipShapes. If any set is defined by masking planes,
   * checks the mask planes only, provided that ignoreMasks is false. Otherwise, checks the clip planes member.
   */
  public classifyRangeContainment(range: Range3d, ignoreMasks: boolean): ClipPlaneContainment {
    const corners: Point3d[] = range.corners();
    return this.classifyPointContainment(corners, ignoreMasks);
  }

  /**
   * For an array of points (making up a LineString), tests whether the segment between each point lies inside the ClipVector.
   * If true, returns true immediately.
   */
  public isAnyLineStringPointInside(points: Point3d[]): boolean {
    for (const clip of this._clips) {
      const clipPlaneSet = clip.fetchClipPlanesRef();
      if (clipPlaneSet !== undefined) {
        for (let i = 0; i + 1 < points.length; i++) {
          const segment = LineSegment3d.create(points[i], points[i + 1]);
          if (clipPlaneSet.isAnyPointInOrOnFromSegment(segment))
            return true;
        }
      }
    }
    return false;
  }

  /** Note: Line segments are used to represent 1 dimensional intervals here, rather than segments. */
  public sumSizes(intervals: Segment1d[], begin: number, end: number): number {
    let s = 0.0;
    for (let i = begin; i < end; i++)
      s += (intervals[i].x1 - intervals[i].x0);
    return s;
  }

  private static readonly _TARGET_FRACTION_SUM = 0.99999999;
  /**
   * For an array of points that make up a LineString, develops a line segment between each point pair,
   * and returns true if all segments lie inside this ClipVector.
   */
  public isLineStringCompletelyContained(points: Point3d[]): boolean {
    const clipIntervals: Segment1d[] = [];

    for (let i = 0; i + 1 < points.length; i++) {
      const segment = LineSegment3d.create(points[i], points[i + 1]);
      let fractionSum = 0.0;
      let index0 = 0;

      for (const clip of this._clips) {
        const clipPlaneSet = clip.fetchClipPlanesRef();
        if (clipPlaneSet !== undefined) {
          clipPlaneSet.appendIntervalsFromSegment(segment, clipIntervals);
          const index1 = clipIntervals.length;
          fractionSum += this.sumSizes(clipIntervals, index0, index1);
          index0 = index1;
          // ASSUME primitives are non-overlapping...
          if (fractionSum >= ClipVector._TARGET_FRACTION_SUM)
            break;
        }
      }
      if (fractionSum < ClipVector._TARGET_FRACTION_SUM)
        return false;
    }
    return true;
  }

  /** Serializes this ClipVector to a compact string representation appropriate for transmission as part of a URL.
   * Chiefly used for requesting [Tile]($frontend)s with section cut facets.
   * UnionOfConvexClipPlaneSets is obtained for each ClipPrimitive. The encoding is as follows:
   *  ClipVector:
   *    ClipPrimitive[]
   *    _
   *  ClipPrimitive:
   *    invisible: 0|1
   *    ConvexClipPlaneSet[]
   *    _
   *  ConvexClipPlaneSet:
   *    ClipPlane[]
   *    _
   *  ClipPlane:
   *    flags: 0|1|2|3, where 1=invisible and 2=interior
   *    inwardNormal: Number[3]
   *    distance: Number
   *  Number:
   *    number
   *    _
   */
  public toCompactString(): string {
    function formatNumber(num: number) {
      return `${num.toString()}_`;
    }

    function formatVector3d(vec: Vector3d) {
      return `${formatNumber(vec.x)}${formatNumber(vec.y)}${formatNumber(vec.z)}`;
    }

    function formatFlags(flags: number) {
      const f = flags.toString();
      assert(1 === f.length);
      return f;
    }

    function formatPlane(plane: ClipPlane) {
      let flags = plane.invisible ? 1 : 0;
      flags |= (plane.interior ? 2 : 0);
      return `${formatFlags(flags)}${formatVector3d(plane.inwardNormalRef)}${formatNumber(plane.distance)}`;
    }

    function formatPlaneSet(set: ConvexClipPlaneSet) {
      let planes = "";
      for (const plane of set.planes)
        planes = `${planes}${formatPlane(plane)}`;

      return `${planes}_`;
    }

    function formatPrimitive(prim: ClipPrimitive) {
      const flags = prim.invisible ? 1 : 0;
      let str = flags.toString();
      assert(1 === str.length);

      const union = prim.fetchClipPlanesRef();
      if (union) {
        for (const s of union.convexSets)
          str = `${str}${formatPlaneSet(s)}`;
      }

      return `${str}_`;
    }

    let result = "";
    for (const primitive of this.clips)
      result = `${result}${formatPrimitive(primitive)}`;

    return `${result}_`;
  }
}

/** Bundles a [[ClipVector]] with its compact string representation.
 * @note The string representation is computed once; the ClipVector is assumed not to be subsequently modified.
 * @see [[StringifiedClipVector.fromClipVector]] to create from a ClipVector.
 * @see [[ClipVector.toCompactString]] for a description of the string representation.
 * @alpha
 */
export type StringifiedClipVector = ClipVector & { readonly clipString: string };

/** Bundles a ClipVector with its compact string representation.
 * @note The string representation is computed once; the ClipVector is assumed not to be subsequently modified.
 * @alpha
 */
export namespace StringifiedClipVector { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Create from a ClipVector.
   * @param clip The ClipVector to stringify.
   * @returns The input ClipVector with its compact string representation, or undefined if the input is undefined or empty.
   * @note The string representation is computed once; the ClipVector is assumed not to be subsequently modified.
   */
  export function fromClipVector(clip?: ClipVector): StringifiedClipVector | undefined {
    if (!clip || !clip.isValid)
      return undefined;

    const ret = clip as any;
    if (undefined === ret.clipString)
      ret.clipString = clip.toCompactString();

    const stringified = ret as StringifiedClipVector;
    assert(undefined !== stringified.clipString);
    return stringified;
  }
}
