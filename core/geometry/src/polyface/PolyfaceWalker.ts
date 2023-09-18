/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

/* eslint-disable @typescript-eslint/naming-convention, no-empty */
import { IndexedPolyfaceVisitor } from "./IndexedPolyfaceVisitor";
import { IndexedPolyface } from "./Polyface";

export class IndexedPolyfaceWalker {
  /** The polyface being traversed. */
  private _polyface: IndexedPolyface;
  /** The current edgeIndex into that polyface. */
  private _edgeIndex: number;
  private constructor(polyface: IndexedPolyface, edgeIndex: number) {
    this._polyface = polyface;
    this._edgeIndex = edgeIndex;
  }
  public get currentEdgeIndex() { return this._edgeIndex; }
  /**
   * Create a walker for given polyface
   * * Create a walker which references the given IndexedPolyface.
   * * A reference to the the polyface is stored (captured) in the walker.
   * * If the polyface does not have an edgeMateEdgeIndex array, one is created by calling polyface.buildEdgeMateIndices
   * @param polyface reference to the client polyface.
   * @param initialPosition optional indication of where to start the walker within the mesh.
   *   * If the initialPosition is a valid edgeIndex for the same IndexedPolyface, the new walker is started there.
   *   * If the initialPosition is undefined, the walker starts at the first vertex of the first facet of the polyface.
   *   * If initialPosition is not a valid edgeIndex for that polyface, undefined is returned.
   */
  public static create(polyface: IndexedPolyface, initialPosition?: number): IndexedPolyfaceWalker | undefined {
    if (polyface.data.edgeMateIndex === undefined)
      polyface.buildEdgeMateIndices();
    if (initialPosition === undefined)
      initialPosition = 0;
    if (polyface.data.isValidEdgeIndex(initialPosition))
      return new IndexedPolyfaceWalker(polyface, initialPosition);
    return undefined;
  }
  /** Create a new IndexedPolyfaceWalker which
   * * references the same polyface as this instance
   * * if the edgeIndex parameter is undefined, use the edgeIndex from the calling instance
   * * if the edgeIndex parameter is valid for the polyface, starts at that edgeIndex
   * * if the edgeIndex parameter is not valid for the polyface, return undefined.
   */
  public clone(edgeIndex?: number): IndexedPolyfaceWalker | undefined {
    if (edgeIndex === undefined)
      edgeIndex = this._edgeIndex;
    if (this._polyface.data.isValidEdgeIndex(edgeIndex))
      return new IndexedPolyfaceWalker(this._polyface, edgeIndex);
    return undefined;
  }
  /**
   * move to the next position (corner of facet) around the same facet.
   */
  public moveToSuccessorAroundFacet(): boolean {
    const newEdgeIndex = this._polyface.edgeIndexToSuccessorAroundFacet(this._edgeIndex);
    if (newEdgeIndex !== undefined) {
      this._edgeIndex = newEdgeIndex;
      return true;
    }
    return false;
  }
  /**
   * move to the previous position (corner of facet) around the same facet.
   */
  public moveToPredecessorAroundFacet(): boolean {
    const newEdgeIndex = this._polyface.edgeIndexToPredecessorAroundFacet(this._edgeIndex);
    if (newEdgeIndex !== undefined) {
      this._edgeIndex = newEdgeIndex;
      return true;
    }
    return false;
  }
  /**
   * move to the next facet sharing the vertex of the current position.
   * With the usual convention that successorAroundFacet is counterclockwise, the successorAroundVertex is also counterclockwise around the vertex.
   */
  public moveToSuccessorAroundVertex(): boolean {
    const newEdgeIndex = this._polyface.edgeIndexToSuccessorAroundVertex(this._edgeIndex);
    if (newEdgeIndex !== undefined) {
      this._edgeIndex = newEdgeIndex;
      return true;
    }
    return false;
  }
  /**
   * move to the next facet sharing the vertex of the current position.
   * With the usual convention that successorAroundFacet is counterclockwise, the predecessorAroundVertex is clockwise around the vertex.
   */
  public moveToPredecessorAroundVertex(): boolean {
    const newEdgeIndex = this._polyface.edgeIndexToPredecessorAroundVertex(this._edgeIndex);
    if (newEdgeIndex !== undefined) {
      this._edgeIndex = newEdgeIndex;
      return true;
    }
    return false;
  }
  /**
   * move across the edge from the current position.
   * the new position is in the (unique) adjacent facet and at the opposite end of the same edge.
   */
  public moveToEdgeMate(): boolean {
    const newEdgeIndex = this._polyface.edgeIndexToEdgeMate(this._edgeIndex);
    if (newEdgeIndex !== undefined) {
      this._edgeIndex = newEdgeIndex;
      return true;
    }
    return false;
  }
  public loadVisitor(visitor: IndexedPolyfaceVisitor): boolean {
    const facetIndex = this._polyface.edgeIndexToFacetIndex(this._edgeIndex);
    if (facetIndex !== undefined) {
      return visitor.moveToReadIndex(facetIndex);
    }
    return false;
  }
}
