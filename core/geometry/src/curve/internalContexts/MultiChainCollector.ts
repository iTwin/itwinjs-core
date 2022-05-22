/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { Arc3d } from "../../curve/Arc3d";
import { AnyCurve } from "../../curve/CurveChain";
import { BagOfCurves, CurveCollection } from "../../curve/CurveCollection";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { Path } from "../../curve/Path";
import { ChainTypes, RegionOps } from "../../curve/RegionOps";
import { Geometry } from "../../Geometry";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveChainWireOffsetContext } from "./PolygonOffsetContext";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { XYAndZ } from "../../geometry3d/XYZProps";
import { FrameBuilder } from "../../geometry3d/FrameBuilder";

/**
 * Manage a growing array of arrays of curve primitives that are to be joined "head to tail" in paths.
 * * The caller makes a sequence of calls to announce individual primitives.
 * * This collector (unlike the simpler "ChainCollector") expects to have inputs arriving in random order, leaving multiple open chains in play at any time.
 *    * chainCollector.announceCurvePrimitive (curve, searchAllPaths).
 * * When all curves have been announced, the call to grab the paths option restructures the various active chains into Path and Loop objects.
 * * Usage pattern is
 *   * initialization: `context = new ChainCollectorContext (makeClones: boolean)`
 *   * many times
 *       * `   context.captureCurve (anyCurve, searchAllPaths)`
 *       * `   context.captureCurvePrimitive (primitive, searchAllPaths)`
 *   * end:        ` result = context.grabResults (formLoopsIfClosed)`
 * @internal
 */
export class MultiChainCollector {
  private _chains: CurvePrimitive[][];

  private static _staticPointA: Point3d;
  private static _staticPointB: Point3d;

  /** LOOSE tolerance for snap to end */
  private _endPointShiftTolerance: number;
  /** TIGHT tolerance for snap to end */
  private _endPointHitTolerance: number;
  /** tolerance for choosing Path or Loop.   If undefined, ALWAYS PATH */
  private _planarityTolerance: number | undefined;
  /** Initialize with an empty array of chains.
   * @param endPointShiftTolerance tolerance for calling endpoints identical
   * @param planeTolerance tolerance for considering a loop to be planar.  If undefined, only create Path.  If defined, create Loop curves are if within tolerance of a plane.
   */
  public constructor(endPointShiftTolerance = Geometry.smallMetricDistance, planeTolerance: number | undefined = Geometry.smallMetricDistance) {
    this._chains = [];
    this._endPointShiftTolerance = endPointShiftTolerance;
    this._endPointHitTolerance = Geometry.smallMetricDistance;
    this._planarityTolerance = planeTolerance;
  }

  private _xyzWork0?: Point3d;
  /**
   * Find a chain (with index _other than_ exceptChainIndex) that starts or ends at xyz
   * @param xyz
   * @param tolerance
   * @param exceptChainIndex index of chain to ignore.  Send -1 to consider all chains.
   */
  private findAnyChainToConnect(xyz: Point3d, tolerance: number, exceptChainIndex: number = -1): { chainIndex: number, atEnd: boolean } | undefined {

    for (let chainIndexA = 0; chainIndexA < this._chains.length; chainIndexA++) {
      if (exceptChainIndex === chainIndexA)
        continue;
      const chain = this._chains[chainIndexA];
      this._xyzWork1 = chain[chain.length - 1].endPoint(this._xyzWork1);
      if (this._xyzWork1.isAlmostEqual(xyz, tolerance))
        return { chainIndex: chainIndexA, atEnd: true };
      this._xyzWork1 = chain[0].startPoint(this._xyzWork1);
      if (this._xyzWork1.isAlmostEqual(xyz, tolerance))
        return { chainIndex: chainIndexA, atEnd: false };
    }
    return undefined;
  }

  private _xyzWork1?: Point3d;
  /**
   * Insert a single curve primitive into the active chains.
   * * The primitive is captured (not cloned)
   * * The primitive may be reversed in place
   * @param candidate
   */
  public captureCurvePrimitive(candidate: CurvePrimitive) {
    if (this.attachPrimitiveToAnyChain(candidate, this._endPointHitTolerance)) return;
    if (this.attachPrimitiveToAnyChain(candidate, this._endPointShiftTolerance)) return;
    this._chains.push([candidate]);
    return;
  }

  /**
   * Insert any curve into the collection.
   * * This recurses into Path, Loop, BagOfCurves etc
   * * The all primitives are captured, and may be reversed in place.
   * @param candidate
   */
  public captureCurve(candidate: GeometryQuery) {
    if (candidate instanceof CurvePrimitive)
      this.captureCurvePrimitive(candidate);
    else if (candidate instanceof CurveCollection && candidate.children !== undefined) {
      for (const c of candidate.children) {
        this.captureCurve(c);
      }
    }
  }

  /** Announce a curve primitive
   * * If a "nearby" connection is possible, insert the candidate in the chain and force endpoint match.
   * * Otherwise start a new chain.
   */
  private attachPrimitiveToAnyChain(candidate: CurvePrimitive, tolerance: number): boolean {
    if (candidate) {
      this._xyzWork0 = candidate.startPoint(this._xyzWork0);
      let connect = this.findAnyChainToConnect(this._xyzWork0, tolerance);
      if (connect) {
        if (connect.atEnd) {
          const chain = this._chains[connect.chainIndex];
          const index0 = chain.length - 1;
          this._chains[connect.chainIndex].push(candidate);
          OffsetHelpers.moveHeadOrTail(chain[index0], chain[index0 + 1], this._endPointShiftTolerance);
          this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
          return true;
        } else {
          candidate.reverseInPlace();
          const chain = this._chains[connect.chainIndex];
          chain.splice(0, 0, candidate);
          OffsetHelpers.moveHeadOrTail(chain[0], chain[1], this._endPointShiftTolerance);
          this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
          return true;
        }
      } else {
        this._xyzWork0 = candidate.endPoint(this._xyzWork0);
        connect = this.findAnyChainToConnect(this._xyzWork0, tolerance);
        if (connect) {  // START of new primitive ..
          if (connect.atEnd) {
            candidate.reverseInPlace();
            const chain = this._chains[connect.chainIndex];
            const index0 = chain.length - 1;
            this._chains[connect.chainIndex].push(candidate);
            OffsetHelpers.moveHeadOrTail(chain[index0], chain[index0 + 1], this._endPointShiftTolerance);
            this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
            return true;
          } else {
            const chain = this._chains[connect.chainIndex];
            chain.splice(0, 0, candidate);
            OffsetHelpers.moveHeadOrTail(chain[0], chain[1], this._endPointShiftTolerance);
            this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
            return true;
          }
        }
      }
    }
    return false;
  }
  /**
   * * Move each primitive from chainB to the end of  chainA.
   * * clear chainB.
   * * move the final chain to chainB index.
   * * reduce the _chain.length by 1.
   */
  private mergeChainsForwardForward(chainIndexA: number, chainIndexB: number) {
    const chainA = this._chains[chainIndexA];
    const chainB = this._chains[chainIndexB];
    for (const p of chainB) {
      chainA.push(p);
    }
    // chainIndexB is unused.
    chainB.length = 0;
    const lastChainIndex = this._chains.length - 1;
    if (chainIndexB !== lastChainIndex) {
      this._chains[chainIndexB] = this._chains[lastChainIndex];
      this._chains.pop();
    } else {
      this._chains.pop();
    }
  }
  private reverseChain(chainIndex: number) {
    const chain = this._chains[chainIndex];
    chain.reverse();
    for (const p of chain)
      p.reverseInPlace();
  }
  // see if the head or tail of chainIndex matches any existing chain.  If so, merge
  private searchAndMergeChainIndex(chainIndex: number, tolerance: number): void {
    // ASSUME valid index of non-empty chain
    const chain = this._chains[chainIndex];
    const lastIndexInChain = chain.length - 1;
    this._xyzWork0 = chain[0].startPoint(this._xyzWork0);
    // this start with any other chain ..
    let connect = this.findAnyChainToConnect(this._xyzWork0, tolerance, chainIndex);
    if (connect) {
      if (!connect.atEnd)
        this.reverseChain(connect.chainIndex);
      this.mergeChainsForwardForward(connect.chainIndex, chainIndex);
      return;
    }
    // try end with any other chain
    this._xyzWork0 = chain[lastIndexInChain].endPoint(this._xyzWork0);
    connect = this.findAnyChainToConnect(this._xyzWork0, tolerance, chainIndex);
    if (connect) {
      if (connect.atEnd)
        this.reverseChain(connect.chainIndex);
      this.mergeChainsForwardForward(chainIndex, connect.chainIndex);
      return;
    }
  }
  /** turn an array of curve primitives into the simplest possible strongly typed curve structure.
   * * The input array is assumed to be connected appropriately to act as the curves of a Path.
   * * When a path is created the curves array is CAPTURED.
   */
  private promoteArrayToCurves(curves: CurvePrimitive[], makeLoopIfClosed: boolean): CurvePrimitive | Path | Loop | undefined {
    if (curves.length === 0)
      return undefined;
    if (makeLoopIfClosed) {
      const primitive0 = curves[0];
      const primitiveN = curves[curves.length - 1];
      MultiChainCollector._staticPointA = primitive0.startPoint(MultiChainCollector._staticPointA);
      MultiChainCollector._staticPointB = primitiveN.endPoint(MultiChainCollector._staticPointB);
      const distanceAToB = MultiChainCollector._staticPointA.distance(MultiChainCollector._staticPointB);
      if (distanceAToB < this._endPointShiftTolerance) {
        // adjust for closure (and get the corrected coordinates)
        OffsetHelpers.moveHeadOrTail(primitiveN, primitive0, this._endPointShiftTolerance);
        MultiChainCollector._staticPointA = primitive0.startPoint(MultiChainCollector._staticPointA);
        MultiChainCollector._staticPointB = primitiveN.endPoint(MultiChainCollector._staticPointB);
      }
      if (MultiChainCollector._staticPointA.isAlmostEqual(MultiChainCollector._staticPointB)) {
        const localToWorld = FrameBuilder.createRightHandedLocalToWorld(curves);
        if (localToWorld) {
          const worldToLocal = localToWorld.inverse();
          if (worldToLocal) {
            const range = RegionOps.curveArrayRange(curves, worldToLocal);
            if (this._planarityTolerance !== undefined && range.zLength() <= this._planarityTolerance) {
              return Loop.createArray(curves);
            }
          }
        }
        return Path.createArray(curves);
      }
    }
    if (curves.length === 1)
      return curves[0];
    return Path.createArray(curves);
  }
  /** Return the collected results, structured as the simplest possible type. */
  public grabResult(makeLoopIfClosed: boolean = false): CurvePrimitive | Path | BagOfCurves | Loop | undefined {
    const chains = this._chains;
    if (chains.length === 0)
      return undefined;
    if (chains.length === 1)
      return this.promoteArrayToCurves(chains[0], makeLoopIfClosed);
    const bag = BagOfCurves.create();
    for (const chain of chains) {
      const q = this.promoteArrayToCurves(chain, makeLoopIfClosed);
      bag.tryAddChild(q);
    }
    return bag;
  }
}
// static methods to assist offset sequences ....
export class OffsetHelpers {
  // recursively sum lengths, allowing CurvePrimitive, CurveCollection, or array of such at any level.
  public static sumLengths(data: any): number {
    let mySum = 0;
    if (data instanceof CurvePrimitive) {
      mySum += data.curveLength();
    } else if (data instanceof CurveCollection) {
      mySum += data.sumLengths();
    } else if (Array.isArray(data)) {
      for (const data1 of data)
        mySum += this.sumLengths(data1);
    }
    return mySum;
  }
  // recursively sum lengths, allowing CurvePrimitive, CurveCollection, or array of such at any level.
  public static extendRange(range: Range3d, data: any): Range3d {
    if (data instanceof GeometryQuery) {
      data.extendRange(range);
    } else if (Array.isArray(data)) {
      for (const data1 of data)
        this.extendRange(range, data1);
    }
    return range;
  }

  // construct (separately) the offsets of each entry of data (Path, Loop, BagOfCurve, or Array of those)
  // push all offset geometry into the result array
  // return summed length
  public static appendOffsets(data: AnyCurve | AnyCurve[] | undefined, offset: number, result: GeometryQuery[], skipOffsetOfLoop: boolean): number {
    let summedLengths = 0;
    if (data instanceof CurvePrimitive) {
      const resultA = CurveChainWireOffsetContext.constructCurveXYOffset(Path.create(data), offset);
      if (resultA) {
        summedLengths += this.sumLengths(resultA);
        result.push(resultA);
      }
    } else if (data instanceof Loop || data instanceof Path) {
      if (false && skipOffsetOfLoop && data instanceof Loop) {
        // skip !!
      } else {
        const resultA = CurveChainWireOffsetContext.constructCurveXYOffset(data, offset);
        if (resultA) {
          summedLengths += this.sumLengths(resultA);
          result.push(resultA);
        }
      }
    } else if (data instanceof BagOfCurves) {
      for (const q of data.children)
        summedLengths += this.appendOffsets(q, offset, result, true);
    } else if (Array.isArray(data)) {
      for (const q of data)
        summedLengths += this.appendOffsets(q, offset, result, true);
    }
    return summedLengths;
  }

  /**
   * * Restructure curve fragments as chains and offsets
   * * Return object with named chains, insideOffsets, outsideOffsets
   * * BEWARE that if the input is not a loop the classification of outputs is suspect.
   * @param fragments fragments to be chained
   * @param offsetDistance offset distance.
   */
  public static collectInsideAndOutsideOffsets(fragments: GeometryQuery[], offsetDistance: number, gapTolerance: number): { insideOffsets: GeometryQuery[], outsideOffsets: GeometryQuery[], chains: ChainTypes } {
    const collector = new MultiChainCollector(gapTolerance);
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    const myChains = collector.grabResult(true);
    const myOffsetA: GeometryQuery[] = [];
    const myOffsetB: GeometryQuery[] = [];
    const offsetLengthA = OffsetHelpers.appendOffsets(myChains, offsetDistance, myOffsetA, false);
    const offsetLengthB = OffsetHelpers.appendOffsets(myChains, -offsetDistance, myOffsetB, true);
    if (offsetLengthA > offsetLengthB) {
      return { outsideOffsets: myOffsetA, insideOffsets: myOffsetB, chains: myChains };
    } else {
      return { insideOffsets: myOffsetA, outsideOffsets: myOffsetB, chains: myChains };
    }
  }
  /**
   * * Restructure curve fragments as chains and offsets
   * * Return object with named chains, insideOffsets, outsideOffsets
   * * BEWARE that if the input is not a loop the classification of outputs is suspect.
   * @param fragments fragments to be chained
   * @param gapTolerance distance to be treated as "effectively zero" when joining head-to-tail.
   */
  public static collectChains(fragments: GeometryQuery[], gapTolerance: number, planarTolerance: number = Geometry.smallMetricDistance): ChainTypes {
    const collector = new MultiChainCollector(gapTolerance, planarTolerance);
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    return collector.grabResult(true);
  }

  /** If allowed by the geometry type, move an endpoint.
   *
   */
  public static simpleEndPointMove(g: CurvePrimitive, atEnd: boolean, to: XYAndZ): boolean {
    if (g instanceof (LineSegment3d)) {
      if (atEnd) {
        g.point1Ref.setFrom(to);
      } else {
        g.point0Ref.setFrom(to);
      }
      return true;
    } else if (g instanceof LineString3d && g.numPoints() > 0) {
      const i = atEnd ? g.numPoints() - 1 : 0;
      g.packedPoints.setAtCheckedPointIndex(i, to);
      return true;
    }
    return false;
  }
  // Try to move move head (end) of g0 and tail (beginning) of g1 together.
  public static moveHeadOrTail(g0: CurvePrimitive, g1: CurvePrimitive, maxShift: number): boolean {
    const xyz0 = g0.endPoint();
    const xyz1 = g1.startPoint();
    const minShift = Geometry.smallMetricDistance * 0.001;
    const d01 = xyz0.distanceXY(xyz1);
    if (d01 < minShift)
      return true;
    if (this.simpleEndPointMove(g1, false, xyz0) || this.simpleEndPointMove(g0, true, xyz1))
      return true;
    //    const detail1On0 = g0.closestPoint(xyz1);
    //    const detail0On1 = g1.closestPoint(xyz0);
    const intersections = CurveCurve.intersectionXYPairs(g0, true, g1, true);
    const shiftFactor = 5.0;
    for (const pair of intersections) {
      const detail0 = pair.detailA;
      const detail1 = pair.detailB;
      const distance0 = detail0.point.distanceXY(xyz0);
      const distance1 = detail1.point.distanceXY(xyz1);
      if (distance0 < shiftFactor * maxShift && distance1 < shiftFactor * maxShift) {
        if (g0 instanceof Arc3d && g1 instanceof Arc3d) {
          const radians0End = g0.sweep.fractionToRadians(detail0.fraction);
          g0.sweep.setStartEndRadians(g0.sweep.startRadians, radians0End);
          const radians1Start = g1.sweep.fractionToRadians(detail1.fraction);
          g1.sweep.setStartEndRadians(radians1Start, g1.sweep.endRadians);
          return true;
        }
      }
    }
    return false;
  }
}
