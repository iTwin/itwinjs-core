---
ignore: true
---
# NextVersion

## Geometry

### Ellipsoid
 * New instance method:   `ellipsoid.localToWorld(localPoint: XYAndZ, result?: Point3d): Point3d`
 * New instance method:   `worldToLocal(worldPoint: XYAndZ, result?: Point3d): Point3d | undefined`
 * `local` image of a world point is in the coordinate system of a unit sphere.
   * the point is (inside,on,outside) the ellipsoid if its local point magnitude (distance from local origin) is respectively (less than, equal to, greater than) one.
* New instance method:  `ellipsoid.silhouette (eyePoint:Point4d): Arc3d | undefined`

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

  ### Arc3d
   * Allow undefined center in create methods
     * `Arc3d.create(center: Point3d | undefined, vector0: Vector3d, vector90: Vector3d, sweep?: AngleSweep, result?: Arc3d): Arc3d;`
     * `Arc3d.createCenterNormalRadius(center: Point3d | undefined, normal: Vector3d, radius: number, result?: Arc3d): Arc3d;`
   * `Arc3d.createScaledXYColumns(center: Point3d | undefined, matrix: Matrix3d, radius0: number, radius90: number, sweep?: AngleSweep, result?: Arc3d): Arc3d;`
   * in `myArc.extendRange(range, transform)`, compute exact (rather than sampled) range.

### Matrix3d
  * New instance method: `matrix.multiplyInverseXYZW(x: number, y: number, z: number, w: number, result?: Point4d): Point4d | undefined;`

### Point4d
   * New instance method: `point4d.crossWeightedMinusPoint3d(other: Point3d, result?: Vector3d): Vector3d;`
   * New instance method: `point4d.realPointOrVector (): Point3d | Vector3d;`

### Transform
   * New instance method:   `multiplyInversePoint4d(weightedPoint: Point4d, result?: Point4d): Point4d | undefined;`

### IModelSchemaLoader
  * New utility class in @bentley/imodeljs-backend to retrieve full Schema information from an iModel.
  * Requires the @bentley/ecschema-metadata package to be installed.  This package contains the EC Schema metadata classes which are the building blocks of the schema returned from the iModel.
  * Contains two methods for Schema retrieval.
    * `getSchema` Gets a Schema by name from the iModel and throws an exception if it cannot be found or loaded.
    * `tryGetSchema` Attempts to retrieve a Schema by name from the iModel.  Returns `undefined` if it cannot be found.

### Point3d and Vector3d
  * New instance method `data.setAt(index, value)` to address x,y,z by index (in `XYZ` base class)

### ConvexClipPlaneSet
  * allow undefined (zero) tilt in construction `ConvexClipPlaneSet.createSweptPolyline(points: Point3d[], upVector: Vector3d, tiltAngle?: Angle): ConvexClipPlaneSet | undefined`
