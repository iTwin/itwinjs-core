/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../../Geometry";
import { FrameBuilder } from "../../geometry3d/FrameBuilder";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { XYAndZ } from "../../geometry3d/XYZProps";
import { Arc3d } from "../Arc3d";
import { AnyCurve } from "../CurveTypes";
import { BagOfCurves, CurveCollection } from "../CurveCollection";
import { CurveCurve } from "../CurveCurve";
import { CurvePrimitive } from "../CurvePrimitive";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { Loop } from "../Loop";
import { Path } from "../Path";
import { ChainTypes, RegionOps } from "../RegionOps";
import { StrokeOptions } from "../StrokeOptions";

/**
 * Manage a growing array of arrays of curve primitives that are to be joined "head to tail" in paths.
 * * The caller makes a sequence of calls to announce individual primitives.
 * * This collector (unlike the simpler [[ChainCollectorContext]]) expects to have inputs arriving in random order, leaving multiple open chains in play at any time.
 * * When all curves have been announced, the call to `grabResults` restructures the various active chains into Paths (and optionally, Loops).
 * * Chain formation is dependent upon input fragment order, as a greedy algorithm is employed.
 * * Usage pattern is
 *   * initialization: `context = new MultiChainCollector(gapTol, planeTol)`
 *   * many times:
 *       * `context.captureCurve(anyCurve)`
 *       * `context.captureCurvePrimitive(primitive)`
 *   * end: `result = context.grabResult(makeLoopIfClosed)`
 * @internal
 */
export class MultiChainCollector {
  /** accumulated chains */
  private _chains: CurvePrimitive[][];
  /** largest gap distance to close */
  private _gapTolerance: number;
  /** end point snap tolerance (assumed to be as tight or tighter than gapTolerance) */
  private _snapTolerance: number;
  /** tolerance for choosing Path or Loop. If undefined, always Path. */
  private _planeTolerance: number | undefined;

  private static _staticPointA: Point3d;
  private static _staticPointB: Point3d;
  private _xyzWork0?: Point3d;
  private _xyzWork1?: Point3d;

  /** Initialize with an empty array of chains.
   * @param gapTolerance tolerance for calling endpoints identical
   * @param planeTolerance tolerance for considering a closed chain to be planar. If undefined, only create Path. If defined, create Loops for closed chains within tolerance of a plane.
   */
  public constructor(gapTolerance = Geometry.smallMetricDistance, planeTolerance: number | undefined = Geometry.smallMetricDistance) {
    this._chains = [];
    this._gapTolerance = gapTolerance;
    this._snapTolerance = Geometry.smallMetricDistance;
    this._planeTolerance = planeTolerance;
  }
  /**
   * Find a chain (with index _other than_ exceptChainIndex) that starts or ends at xyz
   * @param xyz endpoint to check
   * @param tolerance absolute distance tolerance for equating endpoints
   * @param exceptChainIndex index of chain to ignore. Send -1 to consider all chains.
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
  /**
   * Insert a single curve primitive into the active chains.
   * * The primitive is captured (not cloned)
   * * The primitive may be reversed in place
   * @param candidate curve to add to the context
   */
  public captureCurvePrimitive(candidate: CurvePrimitive) {
    if (this._snapTolerance < this._gapTolerance) {
      if (this.attachPrimitiveToAnyChain(candidate, this._snapTolerance))
        return;
    }
    if (this.attachPrimitiveToAnyChain(candidate, this._gapTolerance))
      return;
    this._chains.push([candidate]);
  }
  /**
   * Insert any curve into the collection.
   * * This recurses into Path, Loop, BagOfCurves etc
   * * All primitives are captured, and may be reversed in place.
   * @param candidate curve to add to the context
   */
  public captureCurve(candidate: AnyCurve) {
    if (candidate instanceof CurvePrimitive)
      this.captureCurvePrimitive(candidate);
    else if (candidate instanceof CurveCollection && candidate.children !== undefined) {
      for (const c of candidate.children) {
        this.captureCurve(c as AnyCurve);
      }
    }
  }
  /** If allowed by the geometry type, move an endpoint. */
  private static simpleEndPointMove(curve: CurvePrimitive, atEnd: boolean, to: XYAndZ): boolean {
    if (curve instanceof (LineSegment3d)) {
      if (atEnd) {
        curve.point1Ref.setFrom(to);
      } else {
        curve.point0Ref.setFrom(to);
      }
      return true;
    } else if (curve instanceof LineString3d && curve.numPoints() > 0) {
      const i = atEnd ? curve.numPoints() - 1 : 0;
      curve.packedPoints.setAtCheckedPointIndex(i, to);
      return true;
    }
    return false;
  }
  /**
   * Try to move the end of curve0 and/or the start of curve1 to a common point.
   * * All z-coordinates are ignored.
   * @param curve0 first curve, assumed to end close to the start of curve1
   * @param curve1 second curve, assumed to start close to the end of curve0
   * @param gapTolerance max distance to move a curve start/end point
   * @returns whether curve start/end point(s) moved
   */
  private static moveHeadOrTail(curve0: CurvePrimitive, curve1: CurvePrimitive, gapTolerance: number): boolean {
    const xyz0 = curve0.endPoint();
    const xyz1 = curve1.startPoint();
    const minShift = Geometry.smallMetricDistance * 0.001;
    const d01 = xyz0.distanceXY(xyz1);
    if (d01 < minShift)
      return false;
    // try lines and linestrings
    if (d01 < gapTolerance) {
      if (this.simpleEndPointMove(curve1, false, xyz0) || this.simpleEndPointMove(curve0, true, xyz1))
        return true;
    }
    // try other primitive types
    const intersections = CurveCurve.intersectionXYPairs(curve0, true, curve1, true);
    const shiftFactor = 5.0;
    for (const pair of intersections) {
      const detail0 = pair.detailA;
      const detail1 = pair.detailB;
      const distance0 = detail0.point.distanceXY(xyz0);
      const distance1 = detail1.point.distanceXY(xyz1);
      if (distance0 < shiftFactor * gapTolerance && distance1 < shiftFactor * gapTolerance) {
        if (curve0 instanceof Arc3d && curve1 instanceof Arc3d) {
          const radians0End = curve0.sweep.fractionToRadians(detail0.fraction);
          curve0.sweep.setStartEndRadians(curve0.sweep.startRadians, radians0End);
          const radians1Start = curve1.sweep.fractionToRadians(detail1.fraction);
          curve1.sweep.setStartEndRadians(radians1Start, curve1.sweep.endRadians);
          return true;
        }
        // TODO: other combinations of types
      }
    }
    return false;
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
          MultiChainCollector.moveHeadOrTail(chain[index0], chain[index0 + 1], this._gapTolerance);
          this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
          return true;
        } else {
          candidate.reverseInPlace();
          const chain = this._chains[connect.chainIndex];
          chain.splice(0, 0, candidate);
          MultiChainCollector.moveHeadOrTail(chain[0], chain[1], this._gapTolerance);
          this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
          return true;
        }
      } else {
        this._xyzWork0 = candidate.endPoint(this._xyzWork0);
        connect = this.findAnyChainToConnect(this._xyzWork0, tolerance);
        if (connect) {
          if (connect.atEnd) {
            candidate.reverseInPlace();
            const chain = this._chains[connect.chainIndex];
            const index0 = chain.length - 1;
            this._chains[connect.chainIndex].push(candidate);
            MultiChainCollector.moveHeadOrTail(chain[index0], chain[index0 + 1], this._gapTolerance);
            this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
            return true;
          } else {
            const chain = this._chains[connect.chainIndex];
            chain.splice(0, 0, candidate);
            MultiChainCollector.moveHeadOrTail(chain[0], chain[1], this._gapTolerance);
            this.searchAndMergeChainIndex(connect.chainIndex, tolerance);
            return true;
          }
        }
      }
    }
    return false;
  }
  /**
   * Merge two entries in the chain array.
   * * Move each primitive from chainB to the end of chainA.
   * * Clear chainB.
   * * Move the final chain to chainB index.
   * * Decrement the array length.
   * @param chainIndexA index of chainA
   * @param chainIndexB index of chainB
   */
  private mergeChainsForwardForward(chainIndexA: number, chainIndexB: number) {
    const chainA = this._chains[chainIndexA];
    const chainB = this._chains[chainIndexB];
    for (const p of chainB) {
      chainA.push(p);
    }
    chainB.length = 0; // chainIndexB is unused
    const lastChainIndex = this._chains.length - 1;
    if (chainIndexB !== lastChainIndex)
      this._chains[chainIndexB] = this._chains[lastChainIndex];
    this._chains.pop();
  }
  /** Reverse the curve chain in place. */
  private reverseChain(chainIndex: number) {
    const chain = this._chains[chainIndex];
    chain.reverse();
    for (const p of chain)
      p.reverseInPlace();
  }
  /** See if the head or tail of chainIndex matches any existing chain. If so, merge the two chains. */
  private searchAndMergeChainIndex(chainIndex: number, tolerance: number): void {
    // ASSUME valid index of non-empty chain
    const chain = this._chains[chainIndex];
    const lastIndexInChain = chain.length - 1;
    this._xyzWork0 = chain[0].startPoint(this._xyzWork0);
    // try start with any other chain
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
  /**
   * Convert an array of curve primitives into the simplest possible strongly typed curve structure.
   * @param curves input array, assembled correctly into a single contiguous path, captured by returned object
   * @param makeLoopIfClosed whether to return a Loop from physically closed curves array, otherwise Path
   * @return Loop or Path if multiple curves; the primitive if only one curve; undefined if no curves
   */
  private promoteArrayToCurves(curves: CurvePrimitive[], makeLoopIfClosed: boolean): CurvePrimitive | Path | Loop | undefined {
    if (curves.length === 0)
      return undefined;
    if (makeLoopIfClosed) {
      const primitive0 = curves[0];
      const primitiveN = curves[curves.length - 1];
      MultiChainCollector._staticPointA = primitive0.startPoint(MultiChainCollector._staticPointA);
      MultiChainCollector._staticPointB = primitiveN.endPoint(MultiChainCollector._staticPointB);
      if (MultiChainCollector.moveHeadOrTail(primitiveN, primitive0, this._gapTolerance)) {
        // get the corrected coordinates
        MultiChainCollector._staticPointA = primitive0.startPoint(MultiChainCollector._staticPointA);
        MultiChainCollector._staticPointB = primitiveN.endPoint(MultiChainCollector._staticPointB);
      }
      if (MultiChainCollector._staticPointA.isAlmostEqual(MultiChainCollector._staticPointB, this._gapTolerance)) {
        const localToWorld = FrameBuilder.createRightHandedLocalToWorld(curves);
        if (localToWorld) {
          const worldToLocal = localToWorld.inverse();
          if (worldToLocal) {
            const range = RegionOps.curveArrayRange(curves, worldToLocal);
            if (this._planeTolerance !== undefined && range.zLength() <= this._planeTolerance) {
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
  /** Stroke the curve chain to a line string, de-duplicate the points. */
  private chainToLineString3d(chain: CurvePrimitive[], options?: StrokeOptions): LineString3d | undefined {
    if (chain.length === 0)
      return undefined;
    const linestring = LineString3d.create();
    for (const curve of chain)
      curve.emitStrokes(linestring, options);
    linestring.removeDuplicatePoints(this._gapTolerance);
    return linestring;
  }
  /** Return the collected results, structured as the simplest possible type. */
  public grabResult(makeLoopIfClosed: boolean = false): ChainTypes {
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
  /** Return chains as individual calls to announceChain. */
  public announceChainsAsLineString3d(announceChain: (ls: LineString3d) => void, options?: StrokeOptions): void {
    const chains = this._chains;
    if (chains.length === 1) {
      const ls = this.chainToLineString3d(chains[0], options);
      if (ls)
        announceChain(ls);
    } else if (chains.length > 1) {
      for (const chain of chains) {
        const ls = this.chainToLineString3d(chain, options);
        if (ls)
          announceChain(ls);
      }
    }
  }
}
