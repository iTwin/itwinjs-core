/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";

/** @packageDocumentation
 * @module Topology
 */

/**
 * Context for building a half edge graph from loops defined only by indices.
 * * Direct use case:
 *   * Create the context.
 *   * Repeatedly call insertLoop(indicesAroundLoop) to announce various loops.
 *   * Finish by accessing the graph property.
 * @internal
 */
export class HalfEdgeGraphFromIndexedLoopsContext {
  public constructor(){
    this._unmatchedEdges = new Map ();
    this._graph = new HalfEdgeGraph ();
    this._halfEdgesAroundCurrentLoop = [];
  }
  private _unmatchedEdges: Map<string, HalfEdge>;
  private _graph: HalfEdgeGraph;
  public get graph(): HalfEdgeGraph {return this._graph;}

  // for multiple uses by insert loop.
  private _halfEdgesAroundCurrentLoop: HalfEdge[];
  private indexPairToString(index0: number, index1: number): string{
    return `${index0.toString()},${index1.toString()}`;
  }
  /** Create a loop with specified indices at its vertices.
   * * For an edge with index pair [indexA, indexB]:
   *   * if [indexB, indexA] has never appeared, a HalfEdge mated pair is created.
   *      * One of that mated pair becomes a HalfEdge in this loop.
   *      * The other is "unmatched" and gets the EXTERIOR mask.
   *      * When announceMatedHalfEdges(halfEdge) is called:
   *         * halfEdge and its mate are "new"
   *         * all coordinates are zeros.
   *         * each contains (as its `i` property) one index of the [indexA,indexB] pair.
   *         * those coordinates and indices will never be referenced again by this construction sequence -- the caller is free to mutate them as needed.
   *   * if [indexB, indexA] appeared previously (and its outer HalfEdge was left "unmatched"),
   *     the "unmatched" HalfEdge is used in the loop being constructed, and its EXTERIOR mask is cleared.
   * @param indices Array of indices around the edge.  This is accessed cyclically, so first and last indices should be different.
   * @param announceMatedHalfEdges optional function to be called as mated pairs are created. At the call,
   *     the given HalfEdge and its mate will have a pair of successive indices from the array.
   */
  public insertLoop(indices: number[], announceMatedHalfEdges?: (halfEdge: HalfEdge) => void): HalfEdge | undefined{
    const n = indices.length;
    if (n > 2) {
      let index0 = indices[indices.length - 1];
      this._halfEdgesAroundCurrentLoop.length = 0;
      for (const index1 of indices){
        const insideString = this.indexPairToString (index0, index1);
        const halfEdgePreviouslyConstructedFromOppositeSide: HalfEdge | undefined = this._unmatchedEdges.get (insideString);
        if (halfEdgePreviouslyConstructedFromOppositeSide === undefined){
          // This is the first appearance of this edge in either direction.
          const outsideString = this.indexPairToString (index1, index0); // string referencing the "other" side of the new edge.
          const newHalfEdgeAroundLoop = this._graph.createEdgeIdId (index0, index1);
          if (announceMatedHalfEdges !== undefined)
            announceMatedHalfEdges (newHalfEdgeAroundLoop);
          this._unmatchedEdges.set (outsideString, newHalfEdgeAroundLoop.edgeMate);
          this._halfEdgesAroundCurrentLoop.push (newHalfEdgeAroundLoop);
          newHalfEdgeAroundLoop.edgeMate.setMask (HalfEdgeMask.EXTERIOR);
        } else {
          this._halfEdgesAroundCurrentLoop.push (halfEdgePreviouslyConstructedFromOppositeSide);
          halfEdgePreviouslyConstructedFromOppositeSide.clearMask (HalfEdgeMask.EXTERIOR);
        }
        index0 = index1;
      }
      let halfEdgeA = this._halfEdgesAroundCurrentLoop[this._halfEdgesAroundCurrentLoop.length - 1];
      for (const halfEdgeB of this._halfEdgesAroundCurrentLoop){
        const halfEdgeC = halfEdgeA.faceSuccessor;
        HalfEdge.pinch (halfEdgeB, halfEdgeC);
        halfEdgeA = halfEdgeB;
      }
      return this._halfEdgesAroundCurrentLoop[0];
    }
    return undefined;
  }
}
