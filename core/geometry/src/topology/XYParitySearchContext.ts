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
  /** local x-coordinate of the start of the previous (or earlier) edge */
  public u0: number;
  /** local y-coordinate of the start of the previous (or earlier) edge */
  public v0: number;
  /** local x-coordinate of the end of the previous edge (and start of current edge) */
  public u1: number;
  /** local y-coordinate of the end of the previous edge (and start of current edge) */
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
  /** Test if parity processing can begin with this edge. */
  public tryStartEdge(x0: number, y0: number, x1: number, y1: number): boolean {
    if (y0 !== this.yTest) {
      this.u0 = x0 - this.xTest;
      this.v0 = y0 - this.yTest;
      this.u1 = x1 - this.xTest;
      this.v1 = y1 - this.yTest;
      return true;  // we won't need wraparound logic to process the final edge ending at (x0,y0)
    }
    return false;
  }
  /** Update local coordinates: the current edge becomes the previous edge. */
  private updateUV01(u2: number, v2: number) {
    this.u0 = this.u1;
    this.v0 = this.v1;
    this.u1 = u2;
    this.v1 = v2;
    return true;
  }
  /**
   * Process the current edge ending at (x2,y2).
   * * Accumulate left/right parity of the test point wrt to the polygon. These counts track the number of polygon crossings
   *   of the left and right horizontal rays emanating from the test point. After all edges are processed, if either count is
   *   odd/even, the test point is inside/outside the polygon (see [[classifyCounts]]).
   * * Check whether the test point lies on the edge.
   * @returns whether caller should continue processing with the next edge. In particular, `false` if we have an exact hit.
   */
  public advance(x2: number, y2: number): boolean {
    // In this method we use local u,v coordinates obtained by translating the test point to the origin.
    // This simplifies our computations:
    // * left (right) parity is incremented if the current edge crosses the u-axis at u<0 (u>0)
    // * we have an exact hit if the current edge crosses the u-axis at u=0
    const u2 = x2 - this.xTest;
    const v2 = y2 - this.yTest;
    const p = v2 * this.v1;
    if (p > 0) {
      // Current edge does not cross u-axis.
      return this.updateUV01(u2, v2);
    }
    if (p < 0) {
      // Current edge crosses the u-axis at edge parameter 0 < lambda < 1 by the Intermediate Value Theorem.
      // Solve for lambda in 0 = v1 + lambda (v2 - v1), then use it to compute the u-value of the crossing.
      const lambda = -this.v1 / (v2 - this.v1);
      const uCross = this.u1 + lambda * (u2 - this.u1);
      if (uCross === 0.0) {
        this.numHit++;  // Current edge crosses at the origin.
        return false;
      }
      if (uCross > 0)
        this.numRightCrossing++;
      else
        this.numLeftCrossing++;
      return this.updateUV01(u2, v2);
    }
    // At this point, at least one endpoint of the current edge lies on the u-axis.
    if (v2 === 0.0) {
      if (this.v1 === 0.0) {
        if (u2 * this.u1 <= 0.0) {
          this.numHit++;  // Current edge lies on u-axis and contains the origin.
          return false;
        }
        // Current edge lies on the u-axis to one side of the origin.
        // This edge doesn't contribute to parity computations, so advance past it.
        this.u1 = u2;
        this.v1 = v2;
        return true;
      }
      if (u2 === 0.0) {
        this.numHit++;  // Current edge ends at the origin.
        return false;
      }
      // Current edge ends on the u-axis away from the origin.
      return this.updateUV01(u2, v2);
    }
    // At this point, the current edge starts at the u-axis.
    if (this.u1 === 0.0) {
      this.numHit++;  // Current edge starts at the origin.
      return false;
    }
    // At this point, the current edge starts on the u-axis away from the origin.
    const q = this.v0 * v2;
    if (q < 0) {
      // The current edge and the previous edge lie on opposite sides of the u-axis, so we have a parity change.
      if (this.u1 > 0)
        this.numRightCrossing++;
      else
        this.numLeftCrossing++;
    }
    // The current edge and the previous edge lie on the same sides of the u-axis, so no parity change.
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
    const parity = this.numLeftCrossing & 0x01;
    return (parity === 1) ? 1 : -1;
  }
}
