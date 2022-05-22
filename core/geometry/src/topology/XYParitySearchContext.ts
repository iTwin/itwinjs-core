/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

/**
 * * XYParitySearchContext is an internal class for callers that can feed points (without extracting to array structures)
 * * Most will be via static methods which handle a specific data source.
 *   * PolygonOps.classifyPointInPolygon (x,y,points: XAndY[])
 *   * HalfEdgeGraphSearch.pointInOrOnFaceXY (halfEdgeOnFace, x, y)
 * Use pattern:
 * * Caller must be able walk around polygon producing x,y coordinates (possibly transformed from actual polygon)
 * * Caller announce edges to tryStartEdge until finding one acceptable to the search.
 * * Caller then passes additional points up to and including both x0,y0 and x1, y1 of the accepted start edge.
 * Call sequence is:
 *    `context = new XYParitySearchContext`
 *    `repeat {  acquire edge (x0,y0) (x1,y1)} until context.tryStartEdge (x0,y0,x1,y1);`
 *    `for each (x,y) beginning AFTER x1,y1 and ending with (x1,y1) context.advance (x,y)`
 *  `return context.classifyCounts ();`
 */
export class XYParitySearchContext {
  public xTest: number;
  public yTest: number;
  public u0: number; // local coordinates of recent point with nonzero v.  Usually "second last point" but points can be skipped if y1 is zero
  public v0: number;
  public u1: number; // local coordinates of most recent point
  public v1: number;
  public numLeftCrossing: number;
  public numRightCrossing: number;
  public numHit: number;
  /**
   * Create a new searcher for specified test point.
   * @param xTest x coordinate of test point
   * @param yTest y coordinate of test point
   */
  public constructor(xTest: number, yTest: number) {
    this.xTest = xTest;
    this.yTest = yTest;
    this.u0 = this.v0 = this.u1 = this.v1 = 0; // Not valid for search -- caller must satisfy tryStartEdge !!!
    this.numLeftCrossing = this.numRightCrossing = 0;
    this.numHit = 0;
  }
  /**
   * test if x,y is a safe first coordinate to start the search.
   * * safe start must have non-zero y so that final point test (return to x0,y0) does not need look back for exact crossing logic.
   * @param x
   * @param y
   */
  public tryStartEdge(x0: number, y0: number, x1: number, y1: number): boolean {
    if (y0 !== this.yTest) {
      this.u0 = x0 - this.xTest;
      this.v0 = y0 - this.yTest;
      this.u1 = x1 - this.xTest;
      this.v1 = y1 - this.yTest;
      return true;
    }
    return false;
  }
  /** Return true if parity accumulation proceeded normally.
   * Return false if interrupted for exact hit.
   */
  public advance(x: number, y: number): boolean {
    const u = x - this.xTest;
    const v = y - this.yTest;
    const p = v * this.v1;
    if (p > 0) {
      // The common case -- skittering along above or below the x axis . . .
      this.u0 = this.u1;
      this.v0 = this.v1;
      this.u1 = u;
      this.v1 = v;
      return true;
    }
    if (p < 0) {
      // crossing within (u1,v1) to (u,v)
      // both v values are nonzero and of opposite sign, so this division is safe . . .
      const fraction = -this.v1 / (v - this.v1);
      const uCross = this.u1 + fraction * (u - this.u1);
      if (uCross === 0.0) {
        this.numHit++;
        return false;
      }
      if (uCross > 0)
        this.numRightCrossing++;
      else
        this.numLeftCrossing++;
      this.u0 = this.u1;
      this.v0 = this.v1;
      this.u1 = u;
      this.v1 = v;
      return true;
    }
    // hard stuff -- one or more exact hits . . .
    if (v === 0.0) {
      if (this.v1 === 0.0) {
        // uh oh -- moving along x axis.  Does it pass through xTest:
        if (u * this.u1 <= 0.0) {
          this.numHit++;
          return false;
        }
        // quietly moving along the scan line, both xy and x1y1 to same side of test point ...
        // u0 and u1 remain unchanged !!!
        this.u1 = u;
        this.v1 = v;
        return true;
      }
      // just moved onto the scan line ...
      this.u0 = this.u1;
      this.v0 = this.v1;
      this.u1 = u;
      this.v1 = v;
      return true;
    }
    // fall out with v1 = 0
    // both v0 and v are nonzero.
    // any along-0 v values that have passed through are on the same side of xTest, so u1 determines crossing
    const q = this.v0 * v;
    if (this.u1 > 0) {
      if (q < 0)
        this.numRightCrossing++;
    } else {
      if (q < 0)
        this.numLeftCrossing++;
    }
    this.u0 = this.u1;
    this.v0 = this.v1;
    this.u1 = u;
    this.v1 = v;
    return true;
  }
  /**
   * Return classification as ON, IN, or OUT according to hit and crossing counts.
   * * Any nonzero hit count is ON
   * * Otherwise IN if left crossing count is odd.
   * @return 0 if ON, 1 if IN, -1 if OUT
   */
  public classifyCounts(): number | undefined {
    if (this.numHit > 0)
      return 0;
    const parity = this.numLeftCrossing & 0x01;
    return (parity === 1) ? 1 : -1;
  }
}
