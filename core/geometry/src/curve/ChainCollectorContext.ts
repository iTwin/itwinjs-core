/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */
import { Point3d } from "../geometry3d/Point3dVector3d";
import { BagOfCurves } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { Path } from "./Path";
/**
 * Manage a growing array of arrays of curve primitives that are to be joined "head to tail" in paths.
 * * The caller makes a sequence of calls to announce individual primitives.
 * * Ordering so "head to tail" is obvious is the caller's responsibility.
 * * This class manages the tedium of distinguishing isolated primitives, paths, and multiple paths.
 * * Construction logic makes each chain internally continuous, i.e. suitable for being a Path.
 * * Chaining only occurs between primitives that are consecutive in the announcement stream.
 * * Usage pattern is
 *   * initialization: `context = new ChainCollectorContext (makeClones: boolean)`
 *   * many times: `   context.announceCurvePrimitive (primitive)`
 *   * end:        ` result = context.grabResults ()`
 * @internal
 */
export class ChainCollectorContext {
  private _chains: CurvePrimitive[][];
  private _makeClones: boolean;
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
  /** Initialize with an empty array of chains.
   * @param makeClones if true, all CurvePrimitives sent to `announceCurvePrimitive` is immediately cloned.  If false, the reference to the original curve is maintained.
   */
  public constructor(makeClones: boolean) {
    this._chains = [];
    this._makeClones = makeClones;
  }
  /** Announce a curve primitive
   * * If possible, append it to the current chain.
   * * Otherwise start a new chain.
   */
  public announceCurvePrimitive(candidate: CurvePrimitive) {
    if (candidate) {
      if (this._makeClones) {
        const candidate1 = candidate.clone();
        if (!candidate1 || !(candidate1 instanceof CurvePrimitive))
          return;
        this.transferMarkup(candidate, candidate1);
        candidate = candidate1;
      }
      const activeChain = this.findOrCreateTailChain();
      if (activeChain.length === 0 || !ChainCollectorContext.needBreakBetweenPrimitives(activeChain[activeChain.length - 1], candidate))
        activeChain.push(candidate);
      else
        this.pushNewChain(candidate);
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
  private promoteArrayToCurves(curves: CurvePrimitive[]): CurvePrimitive | Path | undefined {
    if (curves.length === 0)
      return undefined;
    if (curves.length === 1)
      return curves[0];
    return Path.createArray(curves);
  }
  /** Return the collected results, structured as the simplest possible type. */
  public grabResult(): CurvePrimitive | Path | BagOfCurves | undefined {
    const chains = this._chains;
    if (chains.length === 0)
      return undefined;
    if (chains.length === 1)
      return this.promoteArrayToCurves(chains[0]);
    const bag = BagOfCurves.create();
    for (const chain of chains) {
      const q = this.promoteArrayToCurves(chain);
      bag.tryAddChild(q);
    }
    return bag;
  }
  private static _workPointA?: Point3d;
  private static _workPointB?: Point3d;
  /** test if there is a break between primitiveA and primitiveB, due to any condition such as
   * * primitiveA.isCutAtEnd
   * * primitiveB.isCutAtStart
   * * physical gap between primitives.
   */
  private static needBreakBetweenPrimitives(primitiveA: CurvePrimitive, primitiveB: CurvePrimitive, isXYOnly: boolean = false): boolean {
    if (primitiveA === undefined)
      return true;
    if (primitiveB === undefined)
      return true;
    if (primitiveA.endCut !== undefined)
      return true;
    if (primitiveB.startCut !== undefined)
      return true;
    ChainCollectorContext._workPointA = primitiveA.endPoint(ChainCollectorContext._workPointA);
    ChainCollectorContext._workPointB = primitiveA.startPoint(ChainCollectorContext._workPointB);
    return isXYOnly
      ? ChainCollectorContext._workPointA.isAlmostEqualXY(ChainCollectorContext._workPointB)
      : ChainCollectorContext._workPointA.isAlmostEqual(ChainCollectorContext._workPointB);
  }
}
