/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

/**
 * Represent an [[IndexedPolyface]] edge as:
 * * vertex start index and vertex end index (CCW order around its facet)
 * * an additional number to associate with the edge (e.g., facet index)
 * @public
 */
export class SortableEdge {
  private _v: number[];
  private _a: number;

  /** Constructor. */
  public constructor(startVertex: number, endVertex: number, facetIndex: number) {
    this._v = [startVertex, endVertex];
    this._a = facetIndex;
  }
  /** Clone the edge. */
  public clone(): SortableEdge {
    return new SortableEdge(this._v[0], this._v[1], this._a);
  }
  /** Return the vertex index that appears first in the order stored.  */
  public get startVertex(): number {
    return this._v[0];
  }
  /** Return the vertex index that appears second in the order stored.  */
  public get endVertex(): number {
    return this._v[1];
  }
  /**
   * Return the facet index.
   * * This value is carried along during matching. Typically it is a facet index, but it does not have to be.
   */
  public get facetIndex(): number {
    return this._a;
  }
  /** return true if `startVertex` is less than `endVertex`. */
  public get isLowHigh(): boolean {
    return this._v[0] < this._v[1];
  }
  /** Return the vertex index with lower numeric value. */
  public get lowVertex(): number {
    return this.isLowHigh ? this._v[0] : this._v[1];
  }
  /** Return the vertex index with higher numeric value. */
  public get highVertex(): number {
    return this.isLowHigh ? this._v[1] : this._v[0];
  }
  /** Return true if edgeA and edgeB traverse the same edge in the same direction. */
  private static areSameEdge(edgeA: SortableEdge, edgeB: SortableEdge): boolean {
    return edgeA._v[0] === edgeB._v[0] && edgeA._v[1] === edgeB._v[1];
  }
  /** Return true if edgeA and edgeB traverse the same edge in opposite directions. */
  public static areDirectedPartners(edgeA: SortableEdge, edgeB: SortableEdge): boolean {
    return edgeA._v[0] === edgeB._v[1] && edgeA._v[1] === edgeB._v[0];
  }
  /** Return true if edgeA and edgeB traverse the same edge in the same or opposite directions. */
  public static areUndirectedPartners(edgeA: SortableEdge, edgeB: SortableEdge): boolean {
    return this.areSameEdge(edgeA, edgeB) || this.areDirectedPartners(edgeA, edgeB);
  }
  /**
   * Return numeric identifier for the relationship between edgeA and edgeB:
   * * 1 if they share start and end vertex indices in the same order.
   * * -1 if they share start and end vertex indices in reversed order.
   * * 0 otherwise.
   */
  public static relativeOrientation(edgeA: SortableEdge, edgeB: SortableEdge): number {
    if (this.areSameEdge(edgeA, edgeB))
      return 1;
    if (this.areDirectedPartners(edgeA, edgeB))
      return -1;
    return 0;
  }
  /** Whether the start and end vertex indices are equal. */
  public get isNullEdge(): boolean {
    return this._v[0] === this._v[1];
  }
  /**
   * Lexical comparison of two edges.
   * * If the edges have the same vertex index pair (in same or opposite order) they will end up adjacent in a sort.
   * @param edgeA first edge
   * @param edgeB second edge
   */
  public static lessThan(edgeA: SortableEdge, edgeB: SortableEdge): number {
    // primary compare is based on indirect indices
    const lowA = edgeA.lowVertex;
    const lowB = edgeB.lowVertex;
    if (lowA < lowB)
      return -1;
    if (lowB < lowA)
      return 1;
    const highA = edgeA.highVertex;
    const highB = edgeB.highVertex;
    if (highA < highB)
      return -1;
    if (highB < highA)
      return 1;
    // undirected indices match ... use directed vertexIndexA
    return edgeA.startVertex - edgeB.startVertex;
  }
  /** Return the edge data as a JSON array. */
  public toJSON(): any {
    return [this._v[0], this._v[1], this._a];
  }
  /** Return the edge cluster in JSON format.  */
  public static clusterToJSON(data: SortableEdgeCluster): any {
    if (data instanceof SortableEdge)
      return data.toJSON();
    const result = [];
    for (const edge of data)
      result.push(edge.toJSON());
  }
  /** Return the edge cluster array in JSON format. */
  public static clusterArrayToJSON(data: SortableEdgeCluster[]) {
    const result = [];
    for (const cluster of data)
      result.push(SortableEdge.clusterToJSON(cluster));
    return result;
  }
}

/**
 * Union type for a single [[SortableEdge]] or a (matched) array of them.
 * @public
 */
export type SortableEdgeCluster = SortableEdge | SortableEdge[];

/**
 * An IndexedEdgeMatcher carries an array of edge start and end indices for sorting and subsequent analyses,
 * such as testing for closed mesh.
 * @public
 */
export class IndexedEdgeMatcher {
  /** The array of edges to be sorted. */
  public edges: SortableEdge[];
  /** Constructor. Call [[addEdge]] or [[addPath]] to populate `edges`. */
  public constructor() {
    this.edges = [];
  }
  /**
   * Push a new edge.
   * @param vertexA start vertex
   * @param vertexB end vertex
   * @param facetIndex value to carry along during matching
   * @returns the edge pushed onto the `edges` array
   */
  public addEdge(vertexA: number, vertexB: number, facetIndex: number): SortableEdge {
    const edge = new SortableEdge(vertexA, vertexB, facetIndex);
    this.edges.push(edge);
    return edge;
  }
  /**
   * Push edges along a path.
   * * Typically used to add edges around a facet.
   * @param vertexIndices array of vertex indices along an open or closed path.
   * @param facetIndex value to set on each edge pushed.
   * @param closeLoop true to add an edge from last to first vertex.
   */
  public addPath(vertexIndices: number[], facetIndex: number, closeLoop: boolean) {
    if (vertexIndices.length === 0)
      return;
    const m = vertexIndices.length - 1;
    for (let i = 0; i < m; i++)
      this.addEdge(vertexIndices[i], vertexIndices[i + 1], facetIndex);
    if (closeLoop)
      this.addEdge(vertexIndices[m], vertexIndices[0], facetIndex);
  }
  /** Sort the edges. */
  public sort() {
    this.edges.sort((edgeA, edgeB) => SortableEdge.lessThan(edgeA, edgeB));
  }
  /** Create a single or compound SortableEdgeCluster in dest. */
  private collectSortableEdgeCluster(index0: number, index1: number, dest: SortableEdgeCluster[] | undefined) {
    if (dest !== undefined && index1 > index0) {
      if (index1 === index0 + 1) {
        dest.push(this.edges[index0]);
      } else {
        const cluster = [];
        for (let i = index0; i < index1; i++)
          cluster.push(this.edges[i]);
        dest.push(cluster);
      }
    }
  }
  /**
   * Sort the edges, and collect up to four categories of edges: manifold pairs, singletons, null edges,
   * and everything else.
   * * Caller should allocate arrays of interest.
   * * Any combination of the arrays may be `undefined`, indicating that category is to be ignored.
   * * Any combination of the arrays may be aliased as the same target, in which case the aliased categories are
   * merged into the target.
   * * For instance, to ignore manifold pairs and collect all other edges in a single array:
   * `const foo = []; matcher.sortAndCollectClusters(undefined, foo, foo, foo);`
   * @param manifoldPairs array to receive pairs of properly mated edges, i.e. mesh interior edges.
   * @param singletons array to receive edges that have no partner, i.e., mesh boundary edges.
   * @param nullEdges array to receive arrays of matched null edges, for which start === end vertex index.
   * @param allOtherClusters array to receive arrays of edges that are partners in an undirected, non-manifold sense.
   */
  public sortAndCollectClusters(
    manifoldPairs?: SortableEdgeCluster[],
    singletons?: SortableEdgeCluster[],
    nullEdges?: SortableEdgeCluster[],
    allOtherClusters?: SortableEdgeCluster[],
  ): void {
    this.sort();
    if (manifoldPairs)
      manifoldPairs.length = 0;
    if (singletons)
      singletons.length = 0;
    if (nullEdges)
      nullEdges.length = 0;
    if (allOtherClusters)
      allOtherClusters.length = 0;
    const n = this.edges.length;
    let clusterLength;
    for (let index0 = 0; index0 < n; index0 += clusterLength) {
      const baseEdge = this.edges[index0];
      clusterLength = 1;
      for (let index1 = index0 + 1; index1 < n &&
        SortableEdge.areUndirectedPartners(baseEdge, this.edges[index1]); index1++) {
        clusterLength++;
      }
      if (this.edges[index0].isNullEdge)
        this.collectSortableEdgeCluster(index0, index0 + clusterLength, nullEdges);
      else if (clusterLength === 2 && SortableEdge.areDirectedPartners(baseEdge, this.edges[index0 + 1]))
        this.collectSortableEdgeCluster(index0, index0 + clusterLength, manifoldPairs);
      else if (clusterLength === 1)
        this.collectSortableEdgeCluster(index0, index0 + 1, singletons);
      else
        this.collectSortableEdgeCluster(index0, index0 + clusterLength, allOtherClusters);
    }
  }
}
