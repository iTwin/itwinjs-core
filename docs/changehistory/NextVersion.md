---
ignore: true
---
# NextVersion
<<<<<<< HEAD

## Geometry

* [PolyfaceBuilder.addGreedyTriangulationBetweenLineStrings]($geometry) method to build triangles "between" loosely related linestrings.
* [RegionOps.consolidateAdjacentPrimitives]($geometry) method to consolidate adjacent lines and linestrings, and adjacent arcs of the same underlying circle or ellipse.
* [RegionOps.rectangleEdgeTransform]($geometry) method to decide if a Loop object or point array is a simple rectangle.
* [Range2d.corners3d]($geometry) method to get a `Point3d[]` containing the range corners.
* [GrowableXYArray.length]($geometry) property is writable (e.g. to trim the array)
* [IndexedXYZCollection.getRange]($geometry) -- return the range of data in the collection.
* Support methods for using `PolyfaceVisitor` as staging area for new facets to be given to a `PolyfaceBuilder`
  * [PolyfaceVisitor.clearArray]($geometry) -- empty all arrays
  * [PolyfaceVisitor.pushDataFrom]($geometry) -- add new point, param, normal, color from indexed position in another `PolyfaceVisitor`
* [PolyfaceVisitor.pushInterpolatedDataFrom]($geometry) -- add new point, param, normal, color interpolated between two indexed positions in another `PolyfaceVisitor`
* `[PolyfaceQuery.cloneWithTVertexFixup]($geometry) -- clone a polyface, inserting vertices within edges that are incident to points on other facets.
* `[PolyfaceQuery.cloneWithColinearEdgeCleanup]($geometry) -- clone a polyface, removing mid-edge vertices that are interior to adjacent colinear edges and are _not_ used as non-colinear vertex on any other facet.


=======

>>>>>>> 25fb5ac98... 1.6.0
