---
ignore: true
---
# NextVersion

## Geometry

### Summary
  * New class `CurveFactory` to hold future static methods that construct multi-component curves.
     * First method: CurveFactory.createFilletsInLineString
  * `PolyfaceBuilder` static method to build xy triangulation of array of points.
  * `PolyfaceClip` static method to compute cut-fill between 2.5D meshes.
### Details
  * `Arc3d`
    * (static) `Arc3d.createFilletArc(point0: Point3d, point1: Point3d, point2: Point3d, radius: number): ArcBlendData;`
      * Create (if possible) a single arc that is a fillet between line segment from `point0` to `point` and `point1` to `point`.
      * Annotated return with fractional position of tangent, fractions from middle point outward along segments.
      * `point1` (middle points) is commonly called the PI (point of inflection) for the linestring being filleted.
      * See new support interface `ArcBlendData`
  * `CurveFactory`
    * (static) `CurveFactory.createFilletsInLineString(points: LineString3d | IndexedXYZCollection | Point3d[], radius: number, allowBackupAlongEdge?: boolean): Path | undefined;`
      * Create a path with alternating lines and tangent arcs.
  * `CurveCollection`
    * (static) `static createCurveLocationDetailOnAnyCurvePrimitive(source: GeometryQuery | undefined, fraction?: number): CurveLocationDetail | undefined;`
      * Find any curve primitive in the collection.  Evaluate it at a fractional position.
  * `CurveCurve`
    * (static) `CurveCurve.intersectionXYPairs(geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean): CurveLocationDetailPair[]`
      * Same as existing (deprecated) `CurveCurve.intersectionXY`, but bundles pairs of `CurveLocationDetailPair` in single array more useful for processing.
  * `Point3dArray`
    * (static) `Point3dArray.static computeConvexHullXY(points: Point3d[], hullPoints: Point3d[], insidePoints: Point3d[], addClosurePoint?: boolean): void;`
      * Return `hullPoints` in CCW order around the hull
      * Return all non-hull points in `insidePoints`
  * `PolyfaceBuilder`
    * (static) `PolyfaceBuilder.pointsToTriangulatedPolyface(points: Point3d[]): IndexedPolyface | undefined;`
      * Return triangulated mesh within the convex hull around the points.
  * `PolyfaceClip`
    * (static)
  * `ClipPlane` and `ConvexClipPlaneSet` support
    * `myClipPlane.convexPolygonSplitInsideOutsideGrowableArrays(xyz: GrowableXYZArray, xyzIn: GrowableXYZArray, xyzOut: GrowableXYZArray, altitudeRange: Range1d): void;`
       * Split a polygon across a plane; optimized for `GrowableXYZArray` storage.
    * (static) `ClipPlane.createNormalAndPointXYZXYZ(normalX: number, normalY: number, normalZ: number, originX: number, originY: number, originZ: number, invisible?: boolean, interior?: boolean, result?: ClipPlane): ClipPlane | undefined;`
       * (preexisting) added optional `result` parameter
  * `Ray3d`
    * `interval = myRay.intersectionWithRange3d(range: Range3d, result?: Range1d): Range1d`
      * return fractions (along the ray `myRay`) where the `myRay` enters and exits a `Range3d`, or null `Range1d` if no in intersection.
