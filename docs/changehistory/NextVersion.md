---
ignore: true
---
# NextVersion

## Geometry

### Summary

* PolyfaceQuery method to partition by connectivity
* Optimize triangle flipping

### Details

* `PolyfaceQuery` methods
  * (static) `PolyfaceQuery.partitionFacetIndicesByEdgeConnectedComponent(polyface: Polyface | PolyfaceVisitor): number[][]`
    * Return arrays of facet indices
    * Within each array, each facet has an edge in common with others in the same array.
  * (static) `PolyfaceQuery.partitionFacetIndicesByVertexConnectedComponent(polyface: Polyface | PolyfaceVisitor): number[][]`
    * Return arrays of facet indices
    * Within each array, each facet has (at least) a vertex in common with others in the same array.
  * (static) `PolyfaceQuery.clonePartitions(polyface: Polyface | PolyfaceVisitor, partitions: number[][]): Polyface[]`
    * Return an array of polyfaces
    * Each polyface has all the facets from one of the input facet index arrays.
  * `PolyfaceVisitor`
    * `myVisitor.setNumWrap (numWrap: number)`
      * set numWrap for subsequent visits.
  * `PolyfaceBuilder`
    * `myBuilder.reversed: boolean`
      * read property to query the state controlled by `myBuilder.toggleReversedFlag`
      * Carry `twoSided` flag through polyface builder actions.
  * `PolyfaceQuery`
    * (static) `PolyfaceQuery.partitionFacetIndicesByVertexConnectedComponent(polyface: Polyface | PolyfaceVisitor): number[][]`
  * `UnionFindContext`
    * New class to implement the UnionFind algorithm on a set of integers.
  * `HalfEdge`
    * [HalfEdge.setMaskAroundEdge]($geometry)
    * [HalfEdge.clearMaskAroundEdge]($geometry)
  * `HalfEdgeGraph`
    * [HalfEdgeGraph.grabMask]($geometry)
    * [HalfEdgeGraph.grabMask]($geometry)
  * `Triangulation`
    * [Triangulation.flipTrianglesInEdgeSet]($geometry)
