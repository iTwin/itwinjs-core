/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */
// cspell:word FSFP
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";

// Search services for HalfEdgeGraph
/**
 * HalfEdgePointerInspector has methods to check HalfEdge objects for pointer errors.
 * * For a one-step test of the whole graph.
 */
export class HalfEdgePointerInspector {
  public numUndefinedEdgeMate: number = 0;
  public numUndefinedFS: number = 0;
  public numUndefinedFP: number = 0;
  public numFSFPError: number = 0;
  public numMatePairError: number = 0;
  public numTested: number = 0;
  public numWithMatchedEdgeMate: number = 0;
  /** Clear all counts. */
  public clearCounts() {
    this.numUndefinedEdgeMate = 0;
    this.numUndefinedFP = 0;
    this.numUndefinedFS = 0;
    this.numFSFPError = 0;
    this.numMatePairError = 0;
    this.numWithMatchedEdgeMate = 0;
    this.numTested = 0;
  }
  /** Inspect a single half edge. Increment counters according to the half edge's pointers. */
  public inspectHalfEdge(he: HalfEdge) {
    this.numTested++;
    if (he.facePredecessor === undefined)
      this.numUndefinedFP++;
    else if (he.facePredecessor.faceSuccessor !== he)
      this.numFSFPError++;

    if (he.faceSuccessor === undefined)
      this.numUndefinedFS++;
    else if (he.faceSuccessor.facePredecessor !== he)
      this.numFSFPError++;

    if (he.edgeMate === undefined)
      this.numUndefinedEdgeMate++;
    else if (he.edgeMate.edgeMate === he)
      this.numWithMatchedEdgeMate++;
    else
      this.numMatePairError++;
  }
  /**
   * Return true if all pointer pairings are correct for a closed half edge graph (with no boundary):
   * * For each he:  `he.edgeMate.edgeMate === he`
   * * For each he:  `he.faceSuccessor.facePredecessor === he`
   * * For each he:  `he.facePredecessor.faceSuccessor === he`
   */
  public get isValidClosedHalfEdgeGraph(): boolean {
    return this.numWithMatchedEdgeMate === this.numTested
      && this.numUndefinedFS === 0
      && this.numUndefinedFP === 0
      && this.numFSFPError === 0
      && this.numMatePairError === 0;
  }
  /**
   * Return true if all pointer pairings are correct for a half edge graph with possible boundary:
   * * For each he:  `he.edgeMate.edgeMate === he`
   * * For each he:  `he.faceSuccessor.facePredecessor === he`
   * * For each he:  `he.facePredecessor.faceSuccessor === he`
   */
  public get isValidHalfEdgeGraphAllowRaggedBoundary(): boolean {
    return this.numWithMatchedEdgeMate + this.numUndefinedEdgeMate === this.numTested
      && this.numUndefinedFS === 0
      && this.numUndefinedFP === 0
      && this.numFSFPError === 0
      && this.numMatePairError === 0;
  }
  /**
   * Inspect all half edges of graph.
   * * All pointer counts are left in member vars for later inspection.
   */
  public inspectHalfEdges(graph: HalfEdgeGraph) {
    this.clearCounts();
    for (const he of graph.allHalfEdges)
      this.inspectHalfEdge(he);
  }
  /**
   * Inspect a graph's pointer properties.
   * @param expectAllMates true for "complete" graph.
   * @returns true if all pointers are valid.
   */
  public static inspectGraph(graph: HalfEdgeGraph, expectAllMates: boolean): boolean {
    const inspector = new HalfEdgePointerInspector();
    inspector.inspectHalfEdges(graph);
    if (expectAllMates)
      return inspector.isValidClosedHalfEdgeGraph;
    return inspector.isValidHalfEdgeGraphAllowRaggedBoundary;
  }
}
/** Static methods to inspect mask consistency properties in HalfEdgeGraph. */
export class HalfEdgeMaskValidation {
  /**
   * Test if a mask is used consistently around faces.
   * * At the low level, there is no actual traversal around faces. It is only necessary to verify that the mask
   * matches for each HalfEdge and its faceSuccessor.
   * @returns Return true if mask is "all or nothing around all faces"
   */
  public static isMaskConsistentAroundAllFaces(graph: HalfEdgeGraph, mask: HalfEdgeMask): boolean {
    for (const he of graph.allHalfEdges) {
      if (he.faceSuccessor.getMask(mask) !== he.getMask(mask))
        return false;
    }
    return true;
  }
}
