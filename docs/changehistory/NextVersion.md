---
ignore: true
---
# NextVersion

## Geometry

PolyfaceQuery methods to support edge visibility markup.
* PolyfaceQuery.setSingleEdgeVisibility (polyface, facetIndex, vertexIndex, value)
   * within indicated facet, mark visibility of edge that starts with indicated vertexIndex
* PolyfaceQuery.markPairedEdgesInvisible (polyface, sharpEdgeAngle?)
   * Mark all unpaired edges visible
   * Also marked paired edges with large angle across the edge visible.
   * mark all other paired edges invisible
* PolyfaceQuery.computeFacetUnitNormal (visitor, facetIndex, result?): Vector3d | undefined
   * move the visitor to the indicated facet and compute a unit normal with `PolygonOps.unitNormal`
* PolyfaceQuery.markAllEdgeVisibility (mesh, value : boolean)
   * mark all edges of all facets visible (true) or invisible (false)

