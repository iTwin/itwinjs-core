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
 * * Once you have a walker object, you can traverse the facet, edge, and vertex loops it references. For
 * example, if `walker.edgeIndex === A`, referring to the right edge of the upper left facet pictured below, then
 * the following are true:
 *   * `walker.nextAroundFacet().edgeIndex === B`
 *   * `walker.previousAroundFacet().edgeIndex === C`
 *   * `walker.edgeMate().edgeIndex === F`
 *   * `walker.nextAroundVertex().edgeIndex === E`
 *   * `walker.previousAroundVertex().edgeIndex === D`
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
* * When facets are viewed so that the face loops stored in the [[PolyfaceData]] `pointIndex` array have
 * counterclockwise ordering, an edge "from A to B" has facet area to the left and the edge to the right. Likewise,
 * the edges "out of" locations B, C, E, F, D are directed as depicted above.
 * * With this conventional counterclockwise ordering of face loops, "next" is counterclockwise, and "previous" is
 * clockwise:
 *   * The [[nextAroundFacet]] step is counterclockwise around the facet.
 *   * The [[previousAroundFacet]] step is clockwise around the facet.
 *   * The [[nextAroundVertex]] step is counterclockwise around the vertex.
 *   * The [[previousAroundVertex]] step is clockwise around the vertex.
 * * The `nextAroundFacet` steps for a walker and its [[edgeMate]] are in opposite directions along their shared edge,
 * when that edge is interior. Thus the `edgeMate` step can be seen to iterate an "edge loop" of two locations for an
 * interior edge.
 * * Invalid Walkers:
 *   * An invalid walker has undefined [[edgeIndex]]. For these walkers, [[isUndefined]] returns true, and [[isValid]]
 * returns false. Traversal operations on an invalid walker return an invalid walker.
 *   * Invalid walkers are expected during traversals of a mesh with boundary edges, so calling code must be prepared.
 * Boundary edges have exactly one adjacent facet, so for these edges the `edgeMate` step returns an invalid walker.
 * In the diagram above, the `edgeMate` of boundary edge B is undefined.
 *   * Invalid walkers can occur while traversing boundary vertices as well. If an edge lacks an `edgeMate`, then the
 * `previousAroundVertex` step yields an invalid walker, because `previousAroundVertex` is implemented as `edgeMate`
 * followed by `nextAroundFacet`. In the diagram above, the `previousAroundVertex` step at boundary edge B yields
 * undefined walker. Similarly, the `nextAroundVertex` step at edge F yields undefined walker.
 *   * Invalid walkers can also occur while traversing a non-manifold mesh. Such meshes feature edge(s) with more than
 * two adjacent facets, or with two adjacent facets that have opposite orientations. These meshes are uncommon, and
 * usually indicate a construction problem.
 *   * Note that a null edge, for which the start and end vertex is the same, does not yield an invalid walker.
 * * See [[buildEdgeMateIndices]] for further description of the topological relations.
 * @public
 */
export class IndexedPolyfaceWalker {
  /** The polyface being traversed. */
  private _polyface: IndexedPolyface;
  /** The current edgeIndex into the polyface. */
  private _edgeIndex: number | undefined;
  /** Constructor */
  private constructor(polyface: IndexedPolyface, edgeIndex: number | undefined) {
    this._polyface = polyface;
    this._edgeIndex = edgeIndex;
  }
  /**
   * Return the edge index of this walker.
   * * This is an index into the polyface's `data.pointIndex` array.
   * * Can be undefined.
   */
  public get edgeIndex(): number | undefined {
    return this._edgeIndex;
  }

  /** Return the polyface of this walker. */
  public get polyface(): IndexedPolyface {
    return this._polyface;
  }
  /**
   * Return true if the walker's edgeIndex is defined.
   * * This method is the opposite of [[isUndefined]].
   */
  public get isValid(): boolean {
    return this._edgeIndex !== undefined;
  }
  /**
   * Return true if the walker's edgeIndex is undefined.
   * * This method is the opposite of [[isValid]].
   * * This can happen during a walk when the walker `w` reaches an exterior edge, for then
   * `w.edgeMate(w).isUndefined === true`.
   * * This can also happen when methods that return a walker receive invalid input.
   */
  public get isUndefined(): boolean {
    return this._edgeIndex === undefined;
  }
  /** Whether the walker is at a null edge, i.e. an edge with no length. */
  public get isNull(): boolean {
    return this.isValid && this._polyface.data.edgeIndexToEdgeMateIndex(this._edgeIndex) === this._edgeIndex;
  }
  /**
   * Create a walker for a given polyface at an optional edge.
   * @param polyface reference to the client polyface. This reference is captured (the polyface is not copied).
   * @param edgeIndex optional indication of where to start the walker within the mesh.
   * * If the edgeIndex is valid for the input polyface, the new walker is started there.
   * * If the edgeIndex is undefined or invalid for the input polyface, the walker returns true for [[isUndefined]].
   */
  public static createAtEdgeIndex(polyface: IndexedPolyface, edgeIndex?: number): IndexedPolyfaceWalker {
    if (!polyface.data.isValidEdgeIndex(edgeIndex))
      edgeIndex = undefined;
    return new IndexedPolyfaceWalker(polyface, edgeIndex);
  }
  /**
   * Create a walker for a given polyface at a specified facet.
   * * If `facetIndex` or `offsetWithinFacet` is invalid for the input polyface, the walker returns true for
   * [[isUndefined]].
   * @param polyface the polyface to reference
   * @param facetIndex index of the facet to reference
   * @param offsetWithinFacet optional 0-based offset within the face loop of the facet (default 0). This allows
   * the caller to start the walker at a particular edge of the facet.
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
   * Create a walker at the facet specified by a visitor.
   * @param visitor visitor whose currentReadIndex identifies the facet.
   * @param offsetWithinFacet optional 0-based offset within the face loop of the facet (default 0). This allows
   * the caller to start the walker at a particular edge of the facet.
   */
  public static createAtVisitor(visitor: IndexedPolyfaceVisitor, offsetWithinFacet: number = 0): IndexedPolyfaceWalker {
    const facetIndex = visitor.currentReadIndex();
    return IndexedPolyfaceWalker.createAtFacetIndex(visitor.clientPolyface(), facetIndex, offsetWithinFacet);
  }
  /**
   * Create a new IndexedPolyfaceWalker from the instance.
   * * The returned walker refers to the same polyface and edge as the instance.
   * @param result optional receiver to modify and return.
   */
  public clone(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    if (result) {
      result._polyface = this._polyface;
      result._edgeIndex = this._edgeIndex;
      return result;
    }
    return new IndexedPolyfaceWalker(this._polyface, this._edgeIndex);
  }
  /**
   * Load the walker's facet into the given visitor.
   * @returns true if the visitor and walker reference the same polyface and the walker has a valid edge index.
   */
  public loadVisitor(visitor: IndexedPolyfaceVisitor): boolean {
    if (visitor.clientPolyface() !== this._polyface)
      return false;
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
  public isDifferentEdgeInSamePolyface(other: IndexedPolyfaceWalker): boolean {
    if (this.isUndefined || other.isUndefined)
      return false;
    return this._polyface === other._polyface && this._edgeIndex !== other.edgeIndex;
  }
  /**
   * Test if two walkers are in the same polyface at the same edge.
   * * If either has undefined edge, return false.
   * * If they are in different polyfaces, return false.
   * * If they are the same edge in the same polyface, return true.
   */
  public isSameEdge(other: IndexedPolyfaceWalker): boolean {
    return this._polyface === other._polyface && this.isValid && this._edgeIndex === other._edgeIndex;
  }

  /**
   * Return a walker with given edgeIndex and polyface from the calling instance.
   * * If `result` is supplied, that walker is filled and returned.
   * * If `result` is not supplied, a new walker is created.
   */
  private createResult(result: undefined | IndexedPolyfaceWalker, edgeIndex: undefined | number): IndexedPolyfaceWalker {
    if (result === undefined)
      return new IndexedPolyfaceWalker(this._polyface, edgeIndex);
    result._polyface = this._polyface;
    result._edgeIndex = edgeIndex;
    return result;
  }
  /**
   * Return a walker (new or reused) at the next edge around the facet.
   * * "Next" is in the order of indices in the face loop of this facet.
   * * If the instance has undefined edgeIndex, the result also has undefined edgeIndex.
   * @param result optional receiver to modify and return. May be the same as `this` to move the instance walker
   * to the new location and return it.
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
   * Return a walker (new or reused) at the previous edge around the facet.
   * * "Previous" is in the reverse order of indices in the face loop of this facet.
   * * If the instance has undefined edgeIndex, the result also has undefined edgeIndex.
   * @param result optional receiver to modify and return. May be the same as `this` to move the instance walker
   * to the new location and return it.
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
  /**
   * Return a walker (new or reused) at the edge mate of this walker's edge.
   * * The returned walker has undefined edgeIndex if:
   *   * the instance is at a boundary edge, i.e., there is no facet on the other side, or
   *   * the instance has undefined edgeIndex.
   * @param result optional receiver to modify and return. May be the same as `this` to move the instance walker
   * to the new location and return it.
   */
  public edgeMate(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    return this.createResult(result, this._polyface.data.edgeIndexToEdgeMateIndex(this._edgeIndex));
  }
  /**
   * Return a walker (new or reused) at the next outbound edge around the vertex at the base of this walker's edge.
   * * If the facet is viewed so that its "nextAroundFacet" direction appears counterclockwise, then the "next"
   * outbound edge is counterclockwise around the base vertex.
   * * The returned walker has undefined edgeIndex if:
   *   * the previous edge around the facet is a boundary edge, i.e., there is no facet on the other side, or
   *   * the instance has undefined edgeIndex.
   * @param result optional receiver to modify and return. May be the same as `this` to move the instance walker
   * to the new location and return it.
   */
  public nextAroundVertex(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    const result1 = this.previousAroundFacet(result);
    return result1.edgeMate(result1);
  }
  /**
   * Return a walker (new or reused) at the previous outbound edge around the vertex at the base of this walker's edge.
   * * If the facet is viewed so that its "nextAroundFacet" direction appears counterclockwise, then the "previous"
   * outbound edge is clockwise around the base vertex.
   * * The returned walker has undefined edgeIndex if:
   *   * the instance edge is a boundary edge, i.e., there is no facet on the other side, or
   *   * the instance has undefined edgeIndex.
   * @param result optional receiver to modify and return. May be the same as `this` to move the instance walker
   * to the new location and return it.
   */
  public previousAroundVertex(result?: IndexedPolyfaceWalker): IndexedPolyfaceWalker {
    const result1 = this.edgeMate(result);
    return result1.nextAroundFacet(result1);
  }

  /**
   * Build the edgeMate index array into the polyface's [[PolyfaceData]].
   * After this method:
   * * The array `polyface.data.edgeMateIndex` is defined with the same length as the other PolyfaceData index arrays.
   * * For each interior edge, `polyface.data.edgeIndexToEdgeMateIndex` returns the edge index on the other side of the
   * edge in the adjacent facet.
   * * The conditions for edgeMate matching are:
   *   * Given facetIndex f, let `k0 = polyface.facetIndex0(f)` and `k1 = polyface.facetIndex1(f)`.
   *   * Every edge index k in the face loop of facet f satisfies `k0 <= k < k1`.
   *   * The edge with edge index k starts at the point with index `polyface.data.pointIndex[k]`.
   *   * Let kA be an edge index in this range [k0,k1), and let kB be its in-range successor with cyclic wrap, i.e.,
   * `kB === (kA + 1 === k1) ? k0 : kA + 1`.
   *   * Then `polyface.data.pointIndex[kA]` and `polyface.data.pointIndex[kB]` are the indices of the points at the
   * start and end of an edge of that facet.
   *   * We call kA the _edge index_ for that edge, and kB the _edge index_ for the next edge around the facet.
   *   * If kA is a positive-length interior edge in a 2-manifold mesh with properly oriented facets, then there is
   * an adjacent facet whose face loop contains edge indices kC and kD referencing the same edge vertices in reverse
   * order, i.e.,
   *     * `polyface.data.pointIndex[kA] === polyface.data.pointIndex[kD]`
   *     * `polyface.data.pointIndex[kB] === polyface.data.pointIndex[kC]`
   *   * We call the edge indices kA and kC _edge mates_, denoted in the `edgeMateIndex` array by:
   *     * `polyface.data.edgeMateIndex[kA] === kC`
   *     * `polyface.data.edgeMateIndex[kC] === kA`
   *   * If kA is zero-length interior edge, i.e, it has the same start and end point indices, then we call it a _null
   * edge_, and its edge mate is itself.
   * * A non-interior edge either lies on the boundary of the mesh, or is non-manifold (having more than 2 adjacent
   * facets, or 1 with the wrong orientation). These edges have no edge mate, represented as `undefined` in
   * the `edgeMateIndex` array.
   * * These conditions define a conventional manifold mesh where each edge of a facet has at most one partner edge with
   * opposite orientation in an adjacent facet.
   * * After calling this method, the caller can construct `IndexedPolyfaceWalker` objects to traverse the mesh by
   * walking across edges, around faces, and around vertices. Let walkerA have edge index value kA. Then with the
   * aforementioned edge indices:
   *   * `walkerC = walkerA.edgeMate()` moves across the edge to its other end, at kC.
   *   * `walkerB = walkerA.nextAroundFacet()` moves around the facet to the next edge, at kB.
   *   * `walkerB.previousAroundFacet()` moves from kB back to kA.
   *   * `walkerD = walkerA.previousAroundVertex()` moves around the vertex to the next edge kD.
   *   * `walkerD1 = walkerC.nextAroundFacet()` also moves to kD.
   *   * `walkerD.nextAroundVertex()` moves from kD back to kA.
   */
  public static buildEdgeMateIndices(polyface: IndexedPolyface): void {
    const matcher = new IndexedEdgeMatcher();
    const numFacet = polyface.facetCount;
    for (let facetIndex = 0; facetIndex < numFacet; facetIndex++) {
      const kStart = polyface.facetIndex0(facetIndex);
      const kEnd = polyface.facetIndex1(facetIndex);
      let k0 = kEnd - 1;
      // sneaky: addEdge 3rd arg is edge index k0 instead of facetIndex; it gets carried around during matching
      for (let k1 = kStart; k1 < kEnd; k0 = k1, k1++)
        matcher.addEdge(polyface.data.pointIndex[k0], polyface.data.pointIndex[k1], k0);
    }
    const matchedPairs: SortableEdgeCluster[] = [];
    const nullEdges: SortableEdgeCluster[] = [];
    matcher.sortAndCollectClusters(matchedPairs, undefined, nullEdges, undefined);
    const numIndex = polyface.data.pointIndex.length;
    polyface.data.edgeMateIndex = new Array<number | undefined>(numIndex);
    for (let i = 0; i < numIndex; i++)
      polyface.data.edgeMateIndex[i] = undefined; // boundary and non-manifold edges have no mate
    for (const pair of matchedPairs) {
      if (Array.isArray(pair) && pair.length === 2) {
        const edgeIndex0 = pair[0].facetIndex;
        const edgeIndex1 = pair[1].facetIndex;
        polyface.data.edgeMateIndex[edgeIndex0] = edgeIndex1; // paired edges point to each other
        polyface.data.edgeMateIndex[edgeIndex1] = edgeIndex0;
      }
    }
    for (const nullEdgeOrCluster of nullEdges) {
      const nullCluster = Array.isArray(nullEdgeOrCluster) ? nullEdgeOrCluster : [nullEdgeOrCluster];
      for (const nullEdge of nullCluster) {
        const edgeIndex = nullEdge.facetIndex;
        polyface.data.edgeMateIndex[edgeIndex] = edgeIndex; // a null edge points to itself
      }
    }
  }
}

