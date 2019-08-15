---
ignore: true
---
# NextVersion

## Geometry

### Summary:
  * in/on/out test for x,y point in loop, parity region, or union region.

### Methods
* `Arc3d`
  * (static) `newArc = Arc3d.createFilletArc(point0: Point3d, point1: Point3d, point2: Point3d, radius: number): {
        arc: Arc3d;
        fraction10: number;
        fraction12: number;
    } | undefined`
    * create an arc tangent to two lines, with tangency fractions on each line.
* `CurveCollection`
  * (static) `newDetail = CurveCollection.createCurveLocationDetailOnAnyCurvePrimitive(source: GeometryQuery | undefined, fraction?: number): CurveLocationDetail | undefined;`
    * Find any `CurvePrimitive` within the collection and evaluate at some interior point.
* `CurveCurve`
  * Existing static method `IntersectionXY` returns a `CurveLocationDetailArrayPair`, i.e. 2 arrays of `CurveLocationDetail`
  * `IntersectionXY` is deprecated and replaced be a method whose return value is better structured for followup use.
  * The replacement static method `CurveCurve.intersectionXYPairs(geometryA: GeometryQuery, extendA: boolean, geometryB: GeometryQuery, extendB: boolean): CurveLocationDetailPair[];`
     * Each returned `CurveLocationDetailPair` directly matches details on a curve from `geometryA` with a curve from `geometryB`
* `CurvePrimitive` (base class for many curve types)
  * The base class has two new optional members `isCutAtStart` and `isCutAtEnd` for recording `CurveCurve` intersection status
* `RegionOps`
  * (static) `    static splitPathsByRegionInOnOutXY(curvesToCut: CurveCollection | CurvePrimitive | undefined, region: AnyRegion): {
        insideParts: AnyCurve[];
        outsideParts: AnyCurve[];
        coincidentParts: AnyCurve[];
    };`
    * split input curves into parts inside, outside, and coincident with boundaries of a region.
  * (static) `RegionOps.cloneCurvesWithXYSplitFlags(curvesToCut: CurvePrimitive | CurveCollection, cutterCurves: CurveCollection): CurveCollection | CurvePrimitive | undefined;`
    * Computes intersections of `curvesToCut` with `cutterCurves`
    * Creates a clone of the structure (e.g. paths and loops) of `curvesToCut`, but with all affected curve primitives split at the intersections.
  * (static) `RegionOps.splitToPathsBetweenFlagBreaks(source: CurveCollection | CurvePrimitive | undefined, makeClones: boolean): BagOfCurves | Path | CurvePrimitive | undefined;`
    * Creates copies of all `CurvePrimitive`s in source.
    * Chains them into `Path`s whose endpoints are either
      * dangling ends of original paths.
      * marked as intersections with cutter curves (e.g. by `RegionOps.cloneCurvesWithXYSplitFlags`)

