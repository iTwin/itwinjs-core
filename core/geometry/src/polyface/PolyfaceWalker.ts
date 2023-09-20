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
  private _edgeIndex: number | undefined;
  private constructor(polyface: IndexedPolyface, edgeIndex: number | undefined) {
    this._polyface = polyface;
    this._edgeIndex = edgeIndex;
  }
  public get edgeIndex(): number | undefined { return this._edgeIndex; }
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
   */
  public static areDifferentEdgesInSamePolyface(walker1: IndexedPolyfaceWalker, walker2: IndexedPolyfaceWalker): boolean {
    if (walker1.isUndefined || walker2.isUndefined)
      return false;
    return walker1._polyface === walker2._polyface
      && walker1._edgeIndex !== walker2.edgeIndex
      && walker1._edgeIndex !== undefined
      && walker2._edgeIndex !== undefined;
  }
  public static areSameEdge(walker1: IndexedPolyfaceWalker, walker2: IndexedPolyfaceWalker): boolean {
    return walker1._polyface === walker2._polyface
      && walker1._edgeIndex !== undefined
      && walker1._edgeIndex === walker2._edgeIndex;
    // equality test after testing walker1._edgeIndex !== undefined assures walker2._edgeIndex is defined.
  }

  //=========================================================================
  // "functional" moves returning new (or reused) walker.
  public nextAroundFacet(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    const k = this._edgeIndex;
    if (k === undefined)
      return this.setResult(result, undefined);
    const facetIndex = this._polyface.edgeIndexToFacetIndex(k);
    if (facetIndex === undefined)
      return this.setResult(result, undefined);
    const k2 = this._polyface.facetIndex1(facetIndex);
    const k1 = k + 1;
    if (k1 < k2)
      return this.setResult(result, k1);
    return this.setResult(result, this._polyface.facetIndex0(facetIndex));
  }
  public previousAroundFacet(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    let k = this._edgeIndex;
    if (k === undefined)
      return this.setResult(result, undefined);
    const facetIndex = this._polyface.edgeIndexToFacetIndex(k);
    if (facetIndex === undefined)
      return this.setResult(result, undefined);
    const k0 = this._polyface.facetIndex0(facetIndex);
    if (k === k0)
      k = this._polyface.facetIndex1(facetIndex) - 1;
    else
      k--;
    return this.setResult(result, k);
  }
  /** Return a walker (new or reused) for the edgeMate of this walker.
   * This can have an undefined edgeIndex if
   * * `this.edgeIndex` is undefined
   * * this is a boundary edge (which has no edge mate)
   */
  public edgeMate(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    return this.setResult(result, this._polyface.data.edgeIndexToEdgeMateIndex(this._edgeIndex));
  }

  public nextAroundVertex(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    const result1 = this.previousAroundFacet(result);
    return result1.edgeMate(result1);
  }

  public previousAroundVertex(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    // (undefined this._edgeIndex or subsequent edgeMate gets handled quietly at each step)
    const result1 = this.edgeMate(result);
    return result1.nextAroundFacet(result1);
  }

  public setResult(result: undefined | IndexedPolyfaceWalker, edgeIndex: undefined | number): IndexedPolyfaceWalker {
    if (result === undefined)
      return new IndexedPolyfaceWalker(this._polyface, edgeIndex);
    else {
      result._polyface = this._polyface;
      result._edgeIndex = edgeIndex;
      return result;
    }
  }
}

