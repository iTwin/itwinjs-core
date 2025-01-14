/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

import { IndexedEdgeMatcher, SortableEdgeCluster } from "./IndexedEdgeMatcher";
import { IndexedPolyfaceVisitor } from "./IndexedPolyfaceVisitor";
import { IndexedPolyface } from "./Polyface";

/**
 * The `IndexedPolyfaceWalker` class supports navigation around facets, across edges, and around vertices in an
 * [[IndexedPolyface]].
 * * Compare to the [[IndexedPolyfaceVisitor]] class, which supports the iteration of facets in an `IndexedPolyface`.
 * * A one-time call to [[buildEdgeMateIndices]] creates and populates the `data.edgeMateIndex` array on the input.
 *   * This array essentially completes the topology of the `IndexedPolyface` by storing facet adjacency.
 * * After this setup, caller code can create `IndexedPolyfaceWalker` objects via:
 *   * `walker = IndexedPolyfaceWalker.createAtFacetIndex(polyface, facetIndex, offsetWithinFacet)`
 *   * `walker = IndexedPolyfaceWalker.createAtEdgeIndex(polyface, edgeIndex)`
 *   * `walker = IndexedPolyfaceWalker.createAtVisitor(visitor, offsetWithinFacet)`
 * * Once you have a walker object, you can traverse the face, edge, and vertex loops it references. For
 * example, if `walker.edgeIndex === A`, referring to the right edge of the upper left facet pictured below, then
 * the following are true:
 *   * `walker.nextAroundFacet().edgeIndex === B`
 *   * `walker.previousAroundFacet().edgeIndex === C`
 *   * `walker.edgeMate().edgeIndex === F`
 *   * `walker.nextAroundVertex().edgeIndex === E`
 *   * `walker.previousAroundVertex().edgeIndex === D`
 * * When facets are viewed so that the face loops stored in the [[PolyfaceData]] `pointIndex` array have
 * counterclockwise ordering, an edge "from A to B" has facet area to the left and the edge to the right. Likewise,
 * the edges "out of" locations B, C, E, F, D are directed as depicted below.
 * * With this conventional counterclockwise ordering of face loops, "next" is counterclockwise, and "previous" is
 * clockwise:
 *    * The [[nextAroundFacet]] step is counterclockwise around the facet.
 *    * The [[previousAroundFacet]] step is clockwise around the facet.
 *    * The [[nextAroundVertex]] step is counterclockwise around the vertex.
 *    * The [[previousAroundFacet]] step is clockwise around the facet.
 * * The `nextAroundFacet` steps for a walker and its [[edgeMate]] are in opposite directions along their shared edge,
 * when that edge is interior. Thus the `edgeMate` step can be seen to iterate an "edge loop" of two locations for an
 * interior edges. Exterior edges have exactly one adjacent facet; for these edges the `edgeMate` step returns a walker
 * with undefined position, for which [[isUndefined]] returns true. In the diagram below, the `edgeMate` of B is
 * undefined.
 * * See [[buildEdgeMateIndices]] for further description of the topological relations.
 * ```
 *      # --------- # --------- #
 *      |   < < < B | F         |
 *      |         ^ | v         |
 *      |         ^ | v         |
 *      |         ^ | v         |
 *      | C > > > A | D > > >   |
 *      # --------- # --------- #
 *      |   < < < E |           |
 *      |           |           |
 *      |           |           |
 *      |           |           |
 *      # --------- # --------- #
 * ```
 * @public
 */
export class IndexedPolyfaceWalker {
  /** The polyface being traversed. */
  private _polyface: IndexedPolyface;
  /** The current edgeIndex into that polyface. */
  private _edgeIndex: number | undefined;
  /** Constructor */
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
   * * This method is the opposite of [[isUndefined]].
   */
  public get isValid(): boolean { return this._edgeIndex !== undefined; }
  /**
   * Return true if the walker has an undefined edgeIndex.
   * * This can happen during a walk when the walker `w` reaches an exterior edge, for then `w.edgeMate(w).isUndefined === true`.
   * * This can also happen when methods that return a walker are given an invalid input.
   */
  public get isUndefined(): boolean { return this._edgeIndex === undefined; }
  /**
   * Create a walker for given polyface
   * * Create a walker which references the given IndexedPolyface.
   * * A reference to the the polyface is stored (captured) in the walker.
   * @param polyface reference to the client polyface.
   * @param edgeIndex optional indication of where to start the walker within the mesh.
   *   * If the initialPosition is a valid edgeIndex for the same IndexedPolyface, the new walker is started there.
   *   * If the initialPosition is undefined or an invalid numeric index, the walker starts with `undefined edgeIndex`
   */
  public static createAtEdgeIndex(polyface: IndexedPolyface, edgeIndex?: number): IndexedPolyfaceWalker {
    if (!polyface.data.isValidEdgeIndex(edgeIndex))
      edgeIndex = undefined;
    return new IndexedPolyfaceWalker(polyface, edgeIndex);
  }
  /** Create a walker at specified offset within a particular facet.
   * * If `facetIndex` or `offsetWithinFacet` is invalid, the returned walker is invalid (cf. [[isUndefined]]).
   * @param polyface the polyface to reference
   * @param facetIndex index of the facet to reference
   * @param offsetWithinFacet 0-based offset within the face loop of the facet.
   */
  public static createAtFacetIndex(polyface: IndexedPolyface, facetIndex: number, offsetWithinFacet: number = 0): IndexedPolyfaceWalker {
    if (polyface.isValidFacetIndex(facetIndex)) {
      const k0 = polyface.facetIndex0(facetIndex);
      const k1 = polyface.facetIndex1(facetIndex);
      if (0 <= offsetWithinFacet && k0 + offsetWithinFacet < k1)
        return new IndexedPolyfaceWalker(polyface, k0 + offsetWithinFacet);
    }
    return new IndexedPolyfaceWalker(polyface, undefined);
  }
  /**
   * Create a walker in the current facet held by an IndexedPolyfaceVisitor.
   * @param visitor visitor whose currentReadIndex identifies the facet.
   * @param offsetWithinFacet 0-based offset within the face loop of the facet.
   */
  public static createAtVisitor(visitor: IndexedPolyfaceVisitor, offsetWithinFacet: number = 0): IndexedPolyfaceWalker {
    const facetIndex = visitor.currentReadIndex();
    return IndexedPolyfaceWalker.createAtFacetIndex(visitor.clientPolyface(), facetIndex, offsetWithinFacet);
  }
  /**
   * Create a new IndexedPolyfaceWalker from the instance.
   * * The returned walker refers to the same polyface.
   * * If `edgeIndex` is undefined, the returned walker refers to the same edge as the instance.
   * * If `edgeIndex` is defined and valid, the returned walker refers to this edge.
   * * If `edgeIndex` is defined but invalid, return undefined.
   */
  public clone(edgeIndex?: number): IndexedPolyfaceWalker | undefined {
    if (edgeIndex === undefined)
      edgeIndex = this._edgeIndex;
    if (this._polyface.data.isValidEdgeIndex(edgeIndex))
      return new IndexedPolyfaceWalker(this._polyface, edgeIndex);
    return undefined;
  }
  /**
   * Load the walker's facet into the given visitor.
   * @returns true if the walker has a valid edge index.
   */
  public loadVisitor(visitor: IndexedPolyfaceVisitor): boolean {
    const facetIndex = this._polyface.edgeIndexToFacetIndex(this._edgeIndex);
    return (facetIndex !== undefined) ? visitor.moveToReadIndex(facetIndex) : false;
  }
  /**
   * Test if two walkers are at different edges in the same polyface.
   * * If either has undefined edge, return false.
   * * If they are in different polyfaces, return false.
   * * If they are the same edge in the same polyface, return false.
   * * Otherwise return true.
   */
  public isDifferentEdgeInSamePolyface(walker2: IndexedPolyfaceWalker): boolean {
    if (this.isUndefined || walker2.isUndefined)
      return false;
    return this._polyface === walker2._polyface && this._edgeIndex !== walker2.edgeIndex;
  }
  /**
   * Test if two walkers are in the same polyface at the same edge.
   * * If either has undefined edge, return false.
   * * If they are in different polyfaces, return false.
   * * If they are the same edge in the same polyface, return true.
   */
  public isSameEdge(walker2: IndexedPolyfaceWalker): boolean {
    return this._polyface === walker2._polyface && this.isValid && this._edgeIndex === walker2._edgeIndex;
  }

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
  /**
   * In the PolyfaceData object, build the edgeMate data array.
   * After this method:
   * * The array data.edgeMateIndex be present with the same length as the other index arrays.
   * * For each facet edge with a unique "edge mate", the query polyface.edgeIndexToEdgeMate will navigate to the edge mate on the an adjacent facet.
   * * The conditions for edgeMate matching are:
   *    * let k0 and k1 be the limit indices for a facet; that is for `k` in the range `k0 <=k< k1`
   *        the point indices around the facet are pointIndex[k].
   *    * Let kA be in that range and kB be its "successor" with cyclic wrap.  That is, `kB===kA+1` unless kA+1 is k1, in which case kB===k0.
   *    * Then `pointIndex[kA]` and `pointIndex[kB]` are the point indices at the beginning and end of an edge of that facet.
   *    * We call kA the _edgeIndex_ for that edge, and kB the _edgeIndex_ for the "next" edge around the facet.
   *    * If this is an interior edge in a "2-manifold" mesh with properly oriented facets, there is neighboring facet in which similarly "consecutive" edgeIndex values kC, kEnd
   *      reference the same two point indices in reverse order, i.e.
   *       * pointIndex[kA] = pointIndex[kD]
   *       * pointIndex[kB] = pointIndex[kC]
   *    * with this relationship, we say that edgeIndex values `kA` and `kC` are _edge mates_.
   *    * edges "on the boundary" have no edge mate.
   * * All pointIndex values that do not have this matching property are undefined.  This includes
   *    * "boundary" edges that have no mates at all
   *    * "non manifold" edges that have more than one mate, or a single mate that is in the wrong direction.
   * * These conditions are "just" the usual convention that each edge in a mesh has at most one partner with opposite orientation.
   * * Following the call to this method, the caller code can construct IndexedPolyfaceWalker objects to "walk" "across edges", "around faces", and "around vertices".
   * * Let walkerA be walker with edgeIndex value kA.
   *   * walkerC = walkerA.edgeMate () is a move "across the edge and to the other end" to edgeIndex kC.
   *   * walkerB = walkerA.nextAroundFacet() moves "around the facet" to edgeIndex kB.
   *   * walkerB.previousAroundFacet() moves from kB back to kA
   *   * walkerD = walkerA.previousAroundVertex() moves to kD.
   *   * walkerD1 = walkerC.nextAroundFacet () also moves to kD
   *   * walkerD.nextAroundVertex() moves from kD back to kA.
   */
  public static buildEdgeMateIndices(polyface: IndexedPolyface) {
    const matcher = new IndexedEdgeMatcher();
    const numFacet = polyface.facetCount;
    for (let facetIndex = 0; facetIndex < numFacet; facetIndex++) {
      const kStart = polyface.facetIndex0(facetIndex);
      const kEnd = polyface.facetIndex1(facetIndex);
      let k0 = kEnd - 1;
      for (let k1 = kStart; k1 < kEnd; k0 = k1, k1++) {
        matcher.addEdge(polyface.data.pointIndex[k0], polyface.data.pointIndex[k1], k0);
      }
    }
    const matchedPairs: SortableEdgeCluster[] = [];
    const singletons: SortableEdgeCluster[] = [];
    const nullEdges: SortableEdgeCluster[] = [];
    const allOtherClusters: SortableEdgeCluster[] = [];
    matcher.sortAndCollectClusters(matchedPairs, singletons, nullEdges, allOtherClusters);

    const numIndex = polyface.data.pointIndex.length;
    polyface.data.edgeMateIndex = new Array<number>(numIndex);
    for (let i = 0; i < numIndex; i++)
      polyface.data.edgeMateIndex[i] = undefined;
    for (const pair of matchedPairs) {
      if (Array.isArray(pair) && pair.length === 2) {
        const k0 = pair[0].facetIndex;
        const k1 = pair[1].facetIndex;
        polyface.data.edgeMateIndex[k0] = k1;
        polyface.data.edgeMateIndex[k1] = k0;
      }
    }
  }
}

