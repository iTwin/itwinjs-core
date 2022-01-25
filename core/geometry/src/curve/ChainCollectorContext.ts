/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */
import { Point3d } from "../geometry3d/Point3dVector3d";
import { BagOfCurves } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { Loop } from "./Loop";
import { Path } from "./Path";

/**
 * Manage a growing array of arrays of curve primitives that are to be joined "head to tail" in paths.
 * * The caller makes a sequence of calls to announce individual primitives.
 *    * The collector has 2 use cases in mind, controlled by `searchAllPaths` flag on `chainCollectorContext.announceCurvePrimitive`
 *    * (a) "simple chains" -- the caller has the curve primitives in order and just needs to have them monitored for coordinate breaks that indicate transition to a new chain.
 *        * The collector needs to watch for connection to the most recent path but not search for prior paths to join to instead.
 *    * (b)  "mixed" primitives -- primitive order is NOT significant for chain assembly.
 *        * The collector needs to search all prior paths at both start and end, and consider connection to both the start and end of each new primitive.
 * * The per-curve announcement is
 *    * chainCollector.announceCurvePrimitive (curve, searchAllPaths).
 * * When all curves have been announced, the call to grab the paths option
 *    * formLoopsIfClosed
 *       * If true, convert closed paths to `Loop`, open paths to `Path`
 *       * If false, convert all paths (open or not) to `Path`
 * * Usage pattern is
 *   * initialization: `context = new ChainCollectorContext (makeClones: boolean)`
 *   * many times: `   context.announceCurvePrimitive (primitive, searchAllPaths)`
 *   * end:        ` result = context.grabResults (formLoopsIfClosed)`
 * @internal
 */
export class ChainCollectorContext {
  private _chains: CurvePrimitive[][];
  private _makeClones: boolean;

  private static _staticPointA: Point3d;
  private static _staticPointB: Point3d;

  /**
   * Push a new chain with an optional first primitive.
   */
  private pushNewChain(primitive?: CurvePrimitive) {
    const chain = [];
    if (primitive)
      chain.push(primitive);
    this._chains.push(chain);
  }
  private findOrCreateTailChain(): CurvePrimitive[] {
    if (this._chains.length === 0)
      this.pushNewChain();
    return this._chains[this._chains.length - 1];
  }
  private _xyzWork0?: Point3d;
  private findAnyChainToConnect(xyz: Point3d): { chainIndex: number, atEnd: boolean } | undefined {

    for (let chainIndexA = 0; chainIndexA < this._chains.length; chainIndexA++) {
      const path = this._chains[chainIndexA];
      this._xyzWork1 = path[path.length - 1].endPoint(this._xyzWork1);
      if (this._xyzWork1.isAlmostEqual(xyz))
        return { chainIndex: chainIndexA, atEnd: true };
      this._xyzWork1 = path[0].startPoint(this._xyzWork1);
      if (this._xyzWork1.isAlmostEqual(xyz))
        return { chainIndex: chainIndexA, atEnd: false };
    }
    return undefined;
  }

  /** Initialize with an empty array of chains.
   * @param makeClones if true, all CurvePrimitives sent to `announceCurvePrimitive` is immediately cloned.  If false, the reference to the original curve is maintained.
   */
  public constructor(makeClones: boolean) {
    this._chains = [];
    this._makeClones = makeClones;
  }

  private _xyzWork1?: Point3d;

  /** Announce a curve primitive
   * * searchAllChains controls the extent of search for connecting points.
   *   * false ==> only consider connection to most recent chain.
   *   * true ==> search for any connection, reversing direction as needed.
   * * Otherwise start a new chain.
   */
  public announceCurvePrimitive(candidate: CurvePrimitive, searchAllChains: boolean = false) {
    if (candidate) {
      if (this._makeClones) {
        const candidate1 = candidate.clone();
        if (!candidate1 || !(candidate1 instanceof CurvePrimitive))
          return;
        this.transferMarkup(candidate, candidate1);
        candidate = candidate1;
      }
      if (!searchAllChains) {
        const activeChain = this.findOrCreateTailChain();
        if (activeChain.length === 0 || !ChainCollectorContext.needBreakBetweenPrimitives(activeChain[activeChain.length - 1], candidate))
          activeChain.push(candidate);
        else
          this.pushNewChain(candidate);
      } else {
        this._xyzWork0 = candidate.startPoint(this._xyzWork0);
        let connect = this.findAnyChainToConnect(this._xyzWork0);
        if (connect) {
          if (connect.atEnd) {
            this._chains[connect.chainIndex].push(candidate);
          } else {
            candidate.reverseInPlace();
            this._chains[connect.chainIndex].splice(0, 0, candidate);
          }
        } else {
          this._xyzWork0 = candidate.endPoint(this._xyzWork0);
          connect = this.findAnyChainToConnect(this._xyzWork0);
          if (connect) {  // START of new primitive ..
            if (connect.atEnd) {
              candidate.reverseInPlace();
              this._chains[connect.chainIndex].push(candidate);
            } else {
              this._chains[connect.chainIndex].splice(0, 0, candidate);
            }
          } else {
            this._chains.push([candidate]);
          }
        }
      }
    }
  }
  /** Transfer markup (e.g. isCutAtStart, isCutAtEnd) from source to destination */
  private transferMarkup(source: CurvePrimitive, dest: CurvePrimitive) {
    if (source && dest) {
      dest.startCut = source.startCut;
      dest.endCut = source.endCut;
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
      ChainCollectorContext._staticPointA = curves[0].startPoint(ChainCollectorContext._staticPointA);
      ChainCollectorContext._staticPointB = curves[curves.length - 1].endPoint(ChainCollectorContext._staticPointB);
      if (ChainCollectorContext._staticPointA.isAlmostEqual(ChainCollectorContext._staticPointB))
        return Loop.createArray(curves);
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
  /** test if there is a break between primitiveA and primitiveB, due to any condition such as
   * * primitiveA.isCutAtEnd
   * * primitiveB.isCutAtStart
   * * physical gap between primitives.
   */
  public static needBreakBetweenPrimitives(primitiveA: CurvePrimitive | undefined, primitiveB: CurvePrimitive | undefined, isXYOnly: boolean = false): boolean {
    if (primitiveA === undefined)
      return true;
    if (primitiveB === undefined)
      return true;
    if (primitiveA.endCut !== undefined)
      return true;
    if (primitiveB.startCut !== undefined)
      return true;
    ChainCollectorContext._staticPointA = primitiveA.endPoint(ChainCollectorContext._staticPointA);
    ChainCollectorContext._staticPointB = primitiveB.startPoint(ChainCollectorContext._staticPointB);
    return isXYOnly
      ? !ChainCollectorContext._staticPointA.isAlmostEqualXY(ChainCollectorContext._staticPointB)
      : !ChainCollectorContext._staticPointA.isAlmostEqual(ChainCollectorContext._staticPointB);
  }
}
