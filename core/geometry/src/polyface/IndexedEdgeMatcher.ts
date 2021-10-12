/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

// For boundary sorting, an edge exists as a (packed!) Float64Array.
// Fixed entries are:
// 0:
/**
 * * For boundary sorting, an edge is a (packed!) Float64Array.
 * * Fixed entry positions are:
 *   * [0] is start vertex index (in CCW order around its facet)
 *   * [1] is end vertex index (in CCW order around its facet)
 *   * [2] is facet index.
 */
export class SortableEdge extends Float64Array {
  /** Return the vertex index that appears first in the order stored.  */
  public get vertexIndexA(): number { return this[0]; }
  /** Return the vertex index that appears second in the order stored.  */
  public get vertexIndexB(): number { return this[1]; }
  /** Return the facet index.  */
  public get facetIndex(): number { return this[2]; }
  /** return true if vertexIndexA is less than vertexIndexB */
  public get isLowHigh(): boolean { return this[0] < this[1]; }
  /** Return the vertex index with lower numeric value */
  public get lowVertexIndex(): number { return this[0] < this[1] ? this[0] : this[1]; }
  /** Return the vertex index with higher numeric value */
  public get highVertexIndex(): number { return this[0] > this[1] ? this[0] : this[1]; }
  /** Return true if the vertices edgeA and edgeB are the same vertex indices in opposite order */
  public static areDirectedPartners(edgeA: SortableEdge, edgeB: SortableEdge): boolean { return edgeA[0] === edgeB[1] && edgeA[1] === edgeB[0]; }
  /** Return true if the vertices edgeA and edgeB are the same vertex indices with no consideration of order */
  public static areUndirectedPartners(edgeA: SortableEdge, edgeB: SortableEdge): boolean {
    return (edgeA[0] === edgeB[0] && edgeA[1] === edgeB[1]) || ((edgeA[0] === edgeB[1] && edgeA[1] === edgeB[0]));
  }
  /** Return numeric relationship of edgeA and edgeB:
   * * 1 if they share start and end in the same order
   * * -1 if they share start and end in reversed order
   * * 0 otherwise.
   */
  public static relativeOrientation(edgeA: SortableEdge, edgeB: SortableEdge): number {
    if (edgeA[0] === edgeB[0] && edgeA[1] === edgeB[1]) return 1;
    if (edgeA[0] === edgeB[1] && edgeA[1] === edgeB[0]) return -1;
    return 0;
  }

  public get isNullEdge(): boolean { return this[0] === this[1]; }
  /**
   * lexical comparison of two edges.
   * * If the edges have the same vertex pair (in same or opposite order) they will end up adjacent in a sort
   * * If the edges have 0 or 1 shared vertex indices, the one with lowest low comes first.
   * @param edgeA first edge
   * @param edgeB second edge
   */
  public static lessThan(edgeA: SortableEdge, edgeB: SortableEdge): number {
    // primary compare is based on indirect indices
    const lowA = edgeA.lowVertexIndex;
    const lowB = edgeB.lowVertexIndex;
    if (lowA < lowB)
      return -1;
    if (lowB < lowA)
      return 1;
    const highA = edgeA.highVertexIndex;
    const highB = edgeB.highVertexIndex;
    if (highA < highB)
      return -1;
    if (highB < highA)
      return 1;
    // undirected indices match ... use directed vertexIndexA
    return edgeA.vertexIndexA - edgeB.vertexIndexA;
  }
  public constructor(vertexA: number, vertexB: number, facetIndex: number) {
    super(3);
    this[0] = vertexA;
    this[1] = vertexB;
    this[2] = facetIndex;
  }
  public toJSON(): any { return [this[0], this[1], this[2]]; }
  public static clusterToJSON(data: SortableEdgeCluster): any {
    if (data instanceof SortableEdge)
      return data.toJSON();

    const result = [];
    for (const edge of data) result.push(edge.toJSON());
  }
  public static clusterArrayToJSON(data: SortableEdgeCluster[]) {
    const result = [];
    for (const cluster of data)
      result.push(SortableEdge.clusterToJSON(cluster));
    return result;
  }
}

export type SortableEdgeCluster = SortableEdge | SortableEdge[];
/**
 * An IndexedEdgeMatcher carries an array (`edges`) of edges start & end indices for sorting and subsequent analyses (such as testing for closed mesh)
 */
export class IndexedEdgeMatcher {
  public edges: SortableEdge[];

  constructor() {
    this.edges = [];
  }
  /**
   * push a new edge.
   * @returns the edge (as emplaced at the back of the sortableEdge array)
   * @param vertexA start vertex
   * @param vertexB end vertex
   * @param facetIndex facet index
   */
  public addEdge(vertexA: number, vertexB: number, facetIndex: number): SortableEdge {
    const edge = new SortableEdge(vertexA, vertexB, facetIndex);
    this.edges.push(edge);
    return edge;
  }
  /**
   * Push edges all around a facet, returning to vertexArray[0]
   * @param vertexArray array of vertex indices around facet
   * @param facetIndex
   */
  public addPath(vertexArray: number[], facetIndex: number, closeLoop: boolean = true) {
    if (vertexArray.length === 0) return;
    const m = vertexArray.length - 1;
    for (let i = 0; i < m; i++) {
      this.addEdge(vertexArray[i], vertexArray[i + 1], facetIndex);
    }
    if (closeLoop)
      this.addEdge(vertexArray[m], vertexArray[0], facetIndex);
  }
  /** Sort the edge index array. */
  public sort() {
    this.edges.sort(SortableEdge.lessThan);
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
   * sort the edges, and look for three categories of paired edges:
   * * caller must allocate all result arrays of interest.
   * * Any combination of the result arrays may be `undefined`, indicating that category is to be ignored.
   * * Any combination of the result arrays may be aliased as the same target, in which case those to categories are merged into the target.
   * * For instance, to ignore manifold pairs and collect all others (singleton and other) as a single array `allOther`, create `const allOther = []` as an empty array and call
   * `sortAndCollectClusters (undefined, allOther, allOther);`
   * @param manifoldPairs optional array to receive pairs of properly mated SortableEdgePairs, i.e. simple interior edges adjacent to two facets in opposing directions.
   * @param singletons optional array to receive edges that are simple boundary edges.
   * @param nullEdges clusters with null edges (same start and end vertex)
   * @param allOtherClusters optional array to receive arrays in which all the edges are partners in an undirected sense but not a simple directed pair.
   */
  public sortAndCollectClusters(manifoldPairs: SortableEdgeCluster[] | undefined, singletons: SortableEdgeCluster[] | undefined, nullEdges: SortableEdgeCluster[] | undefined, allOtherClusters: SortableEdgeCluster[] | undefined) {
    this.sort();
    if (manifoldPairs) manifoldPairs.length = 0;
    if (singletons) singletons.length = 0;
    if (nullEdges) nullEdges.length = 0;
    if (allOtherClusters) allOtherClusters.length = 0;
    const n = this.edges.length;
    let clusterLength;
    for (let index0 = 0; index0 < n; index0 += clusterLength) {
      const baseEdge = this.edges[index0];
      clusterLength = 1;
      for (let index1 = index0 + 1; index1 < n && SortableEdge.areUndirectedPartners(baseEdge, this.edges[index1]); index1++) {
        clusterLength++;
      }
      if (this.edges[index0].isNullEdge) {
        this.collectSortableEdgeCluster(index0, index0 + clusterLength, nullEdges);
      } else if (clusterLength === 2 && SortableEdge.areDirectedPartners(baseEdge, this.edges[index0 + 1])) {
        this.collectSortableEdgeCluster(index0, index0 + clusterLength, manifoldPairs);
      } else if (clusterLength === 1) {
        this.collectSortableEdgeCluster(index0, index0 + 1, singletons);
      } else {
        this.collectSortableEdgeCluster(index0, index0 + clusterLength, allOtherClusters);
      }
    }
  }
}
