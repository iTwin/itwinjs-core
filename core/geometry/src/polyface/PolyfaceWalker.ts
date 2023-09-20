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
/**
 * @public
 */
export class IndexedPolyfaceWalker {
  /** The polyface being traversed. */
  private _polyface: IndexedPolyface;
  /** The current edgeIndex into that polyface. */
  private _edgeIndex: number | undefined;
  private constructor(polyface: IndexedPolyface, edgeIndex: number | undefined) {
    this._polyface = polyface;
    this._edgeIndex = edgeIndex;
  }
  /** Return the numeric (or undefined) edge index of this walker */
  public get edgeIndex(): number | undefined { return this._edgeIndex; }

  /** Return the polyface of this walker */
  public get polyface(): IndexedPolyface | undefined { return this._polyface; }
  /**
   * Return true if the walker has a defined edgeIndex.
   */
  public get isValid(): boolean { return this._edgeIndex !== undefined; }
  /**
   * Return true if the walker has an undefined edgeIndex.
   */
  public get isUndefined(): boolean { return this._edgeIndex === undefined; }
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
   * load the walker's facet into the given visitor.
   * @returns true if the walker has a valid edge index.
   */
  public loadVisitor(visitor: IndexedPolyfaceVisitor): boolean {
    const facetIndex = this._polyface.edgeIndexToFacetIndex(this._edgeIndex);
    if (facetIndex !== undefined) {
      return visitor.moveToReadIndex(facetIndex);
    }
    return false;
  }
  /**
   * test if two walkers are at different edges in the same polyface.
   * * If either has undefined edge, return false.
   * * If they are in different polyfaces, return false.
   * * If they are the same edge in the same polyface, return false.
   * * otherwise return true.
   */
  public isDifferentEdgeInSamePolyface(walker2: IndexedPolyfaceWalker): boolean {
    if (this.isUndefined || walker2.isUndefined)
      return false;
    return this._polyface === walker2._polyface
      && this._edgeIndex !== walker2.edgeIndex
      && this._edgeIndex !== undefined
      && walker2._edgeIndex !== undefined;
  }
  /**
   * test if walker `other` is in the same polyface but at a different edge.
   * * If either has undefined edge, return false.
   * * If they are in different polyfaces, return false.
   * * If they are the same edge in the same polyface, return true
   */
  public isSameEdge(walker2: IndexedPolyfaceWalker): boolean {
    return this._polyface === walker2._polyface
      && this._edgeIndex !== undefined
      && this._edgeIndex === walker2._edgeIndex;
    // equality test after testing this._edgeIndex !== undefined assures walker2._edgeIndex is defined.
  }

  //=========================================================================
  // "functional" moves returning new (or reused) walker.
  /**
   * Return a walker (new or reused) at the "next" place around the facet.
   * * "next" is in the order of indices in the PolyfaceData containing this facet.
   * * The calling walker may be used as the optional result, thus moving it to the new location.
   * * If the calling walker has undefined edgeIndex, the result also has undefined edgeIndex
   * @param result optional receiver for result.
   */
  public nextAroundFacet(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    const k = this._edgeIndex;
    if (k === undefined)
      return this.createResult(result, undefined);
    const facetIndex = this._polyface.edgeIndexToFacetIndex(k);
    if (facetIndex === undefined)
      return this.createResult(result, undefined);
    const k2 = this._polyface.facetIndex1(facetIndex);
    const k1 = k + 1;
    if (k1 < k2)
      return this.createResult(result, k1);
    return this.createResult(result, this._polyface.facetIndex0(facetIndex));
  }
  /**
   * Return a walker (new or reused) at the "previous" place around the facet.
   * * "next" is in the reverse order of indices in the PolyfaceData containing this facet.
   * * The calling walker may be used as the optional result, thus moving it to the new location.
   * * If the calling walker has undefined edgeIndex, the result also has undefined edgeIndex
   * @param result optional receiver for result.
   */
  public previousAroundFacet(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    let k = this._edgeIndex;
    if (k === undefined)
      return this.createResult(result, undefined);
    const facetIndex = this._polyface.edgeIndexToFacetIndex(k);
    if (facetIndex === undefined)
      return this.createResult(result, undefined);
    const k0 = this._polyface.facetIndex0(facetIndex);
    if (k === k0)
      k = this._polyface.facetIndex1(facetIndex) - 1;
    else
      k--;
    return this.createResult(result, k);
  }
  /** Return a walker (new or reused) for the edgeMate of this walker.
   * * This can have an undefined edgeIndex if
   *   * the calling walker is "on the boundary" (i.e. there is no facet on the other side of the edge.
   *   * the calling walker has undefined edgeIndex, the result also has undefined edgeIndex
   */
  public edgeMate(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    return this.createResult(result, this._polyface.data.edgeIndexToEdgeMateIndex(this._edgeIndex));
  }

  /** Return a walker (new or reused) the "next" outbound edge around the vertex at the base of this walker's edge.
   * * If the facet is viewed so that its "nextAroundFacet" direction appears counter clockwise,
   *    this "nextAroundVertex" step is to the next outbound edge counter clockwise around the base vertex.
   * * The direction to previous is defined as the end of two steps:
   *   * first step to the previous edge around this walker's facet
   *   * then step to the edgeMate
   * * This can have an undefined edgeIndex if
   *   * the previous edge in the calling walker is "on the boundary" (i.e. there is no facet on the other side of the previous edge.)
   *   * the calling walker has undefined edgeIndex, the result also has undefined edgeIndex
   */
  public nextAroundVertex(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    const result1 = this.previousAroundFacet(result);
    return result1.edgeMate(result1);
  }

  /** Return a walker (new or reused) the "previous" outbound edge around the vertex at the base of this walker's edge.
   * * If the facet is viewed so that its "nextAroundFacet" direction appears counter clockwise,
   *    this "previousAroundVertex" step is to the next outbound edge clockwise around the base vertex.
   * * The forward direction is defined as the end of two steps:
   *   * step to the edgeMate of the calling walker
   *   * then step to edgeMate's "nextAroundFacet"
   * * This can have an undefined edgeIndex if
   *   * the calling walker is "on the boundary" (i.e. there is no facet on the other side of the edge.)
   *   * the calling walker has undefined edgeIndex, the result also has undefined edgeIndex
   */
  public previousAroundVertex(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    // (undefined this._edgeIndex or subsequent edgeMate gets handled quietly at each step)
    const result1 = this.edgeMate(result);
    return result1.nextAroundFacet(result1);
  }
  /**
   * * Return a walker with
   *   * edgeIndex from the parameter
   *   * the same polyface as the calling instance
   * * If the `result` parameter is supplied, that walker is filled and returned
   * * If the `result` parameter is not supplied, a new walker is created.
   */
  private createResult(result: undefined | IndexedPolyfaceWalker, edgeIndex: undefined | number): IndexedPolyfaceWalker {
    if (result === undefined)
      return new IndexedPolyfaceWalker(this._polyface, edgeIndex);
    else {
      result._polyface = this._polyface;
      result._edgeIndex = edgeIndex;
      return result;
    }
  }
}

