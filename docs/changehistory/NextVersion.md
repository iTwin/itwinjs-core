---
ignore: true
---
# NextVersion

## Geometry

### Ellipsoid
 *
 * New instance method:   `ellipsoid.localToWorld(localPoint: XYAndZ, result?: Point3d): Point3d`
 * New instance method:   `worldToLocal(worldPoint: XYAndZ, result?: Point3d): Point3d | undefined`
 * `local` image of a world point is in the coordinate system of a unit sphere.
   * the point is (inside,on,outside) the ellipsoid if its local point magnitude (distance from local origin) is respectively (less than, equal to, greater than) one.

### PolyfaceQuery
  * (existing) static methods for area booleans of polygons have added (optional) argument to request triangulation of results.
    * `polygonXYAreaUnionLoopsToPolyface`
    * `polygonXYAreaDifferenceLoopsToPolyface`
    * `polygonXYAreaIntersectLoopsToPolyface`
  * New (static) method:  `cloneByFacetDuplication(source: Polyface, includeSingletons: boolean, clusterSelector: DuplicateFacetClusterSelector): Polyface`
    * Copy facets from source to a new polyface
    * `includeSingletons` controls inclusion of facets that appear only once
    * `clusterSelector` indicates
      * omit all duplicated facets
      * include single representative among each cluster of duplicates
      * omit all if even count, retain one if odd count. (Parity rules)
      * include all within clusters of duplicates
    * supporting methods to announce and collect arrays of clustered facet indices:
      * `PolyfaceQuery.announceDuplicateFacetIndices(polyface: Polyface, announceCluster: (clusterFacetIndices: number[]) => void): void`
      * `PolyfaceQuery.collectDuplicateFacetIndices(polyface: Polyface, includeSingletons?: boolean): number[][]`




