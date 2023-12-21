/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

/**
 * `XYParitySearchContext` is an internal class for callers that can feed points (without extracting to array structures)
 * * Most will be via static methods which handle a specific data source.
 *   * PolygonOps.classifyPointInPolygon(x,y,points: XAndY[])
 *   * HalfEdgeGraphSearch.pointInOrOnFaceXY(halfEdgeOnFace, x, y)
 * Use pattern:
 * * Caller must be able to walk around polygon producing x,y coordinates (possibly transformed from actual polygon).
 * * Caller announce edges to tryStartEdge until finding one acceptable to the search.
 * * Caller then passes additional points up to and including both x0,y0 and x1, y1 of the accepted start edge.
 * Call sequence is:
 *   * `context = new XYParitySearchContext`
 *   * `repeat { acquire edge (x0,y0) (x1,y1) } until context.tryStartEdge(x0,y0,x1,y1);`
 *   * `for each (x,y) beginning AFTER x1,y1 and ending with (x1,y1) context.advance (x,y)`
 *   * `return context.classifyCounts();`
 */
export class XYParitySearchContext {
  public xTest: number;
  public yTest: number;
  // local coordinates of recent point with nonzero v. Usually "second last point" but points can be skipped if y1 is zero
  public u0: number;
  public v0: number;
  // local coordinates of most recent point
  public u1: number;
  public v1: number;
  public numLeftCrossing: number;
  public numRightCrossing: number;
  public numHit: number;
  /**
   * Create a new searcher for specified test point.
   * @param xTest x coordinate of test point.
   * @param yTest y coordinate of test point.
   */
  public constructor(xTest: number, yTest: number) {
    this.xTest = xTest;
    this.yTest = yTest;
    this.u0 = this.v0 = this.u1 = this.v1 = 0; // not valid for search; caller must satisfy tryStartEdge
    this.numLeftCrossing = this.numRightCrossing = 0;
    this.numHit = 0;
  }
  /**
   * Test if (x0,y0) is a safe first coordinate to start the search.
   * * Safe start must have `y0` different form `this.yTest`.
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
  /** Update uv0 values with uv1 and update uv1 values with uv2. */
  private updateUV01(u2: number, v2: number) {
    this.u0 = this.u1;
    this.v0 = this.v1;
    this.u1 = u2;
    this.v1 = v2;
    return true;
  }
  /**
   * Check the test point coordinates wrt points (x1,y1) and (x2,y2) in order to count number of edge hits as well as
   * number of right/left crossings. This would specify the position of test point wtt the face loop.
   * @returns `true` if we have proceeded normally and `false` if we have exact hit.
   */
  public advance(x2: number, y2: number): boolean {
    const u2 = x2 - this.xTest;
    const v2 = y2 - this.yTest;
    const p = v2 * this.v1;
    // test point is above/below both y = y1 and y = y2 lines (the common case)
    if (p > 0) {
      return this.updateUV01(u2, v2);
    }
    // test point is between y = y1 and y = y2 lines
    if (p < 0) {
      // both v values are nonzero and of opposite sign so this division is safe
      const fractionY = -this.v1 / (v2 - this.v1); // always 0 < fractionY < 1
      const uCross = this.u1 + fractionY * (u2 - this.u1);
      // we know fractionX = -u1/(u2-u1) and fractionY = -v1/(v2-v1). If the test point is on the line segment from
      // (x1,y1) to (x2,y2) (i.e., point is on an edge) then fractionX = fractionY or uCross = u1 + fractionY(u2-u1) = 0
      if (uCross === 0.0) {
        this.numHit++;
        return false;
      }
      // if the test point is on the left side of the line segment from (x1,y1) to (x2,y2) (i.e., we have right crossing)
      // then fractionX < fractionY or uCross = u1 + fractionY(u2-u1) > 0
      if (uCross > 0)
        this.numRightCrossing++;
      else
        this.numLeftCrossing++;
      return this.updateUV01(u2, v2);
    }
    // p = 0; test point is on the line y=y1 or y=y2
    if (v2 === 0.0) {
      if (this.v1 === 0.0) { // y1 = y2
        // test point is on the horizontal line segment from (x1,y1) to (x2,y2)
        if (u2 * this.u1 <= 0.0) {
          this.numHit++;
          return false;
        }
        // test point on the line y=y1 (or y=y2) but outside the line segment from (x1,y1) to (x2,y2)
        this.u1 = u2;
        this.v1 = v2;
        return true;
      }
      return this.updateUV01(u2, v2);
    }
    // v1 === 0; v0 and v2 are both non-zero
    const q = this.v0 * v2;
    if (q < 0) { // both (x0,y0) and (x2,y2) are on the same side of line y=y1
      if (this.u1 > 0)
        this.numRightCrossing++;
      else
        this.numLeftCrossing++;
    }
    return this.updateUV01(u2, v2);
  }
  /**
   * Return classification as ON, IN, or OUT according to hit and crossing counts.
   * * Any nonzero hit count is ON.
   * * Otherwise IN if left crossing count is odd.
   * @return 0 if ON, 1 if IN, -1 if OUT.
   */
  public classifyCounts(): number | undefined {
    if (this.numHit > 0)
      return 0;
    const parity = this.numLeftCrossing & 0x01; // parity = 1 iff numLeftCrossing is odd
    // if the test point is inside the face, number of left crossing is always odd
    return (parity === 1) ? 1 : -1;
  }
}
