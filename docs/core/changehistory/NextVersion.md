---
ignore: true
---
# NextVersion

## Improved drawing grid appearance and performance

![grid example](./grid.png "Example showing drawing grid")

## Geometry


* Summary:
  * Triangulate cut faces in polyface clip.
  * Variant point data parse.
  * Bilinear Patch ray intersection
  * polyline small feature filtering
  * compute WireMoment on curves

* When clipping a polyface with a plane, new method optionally outputs triangulation of the cut plane face.
  * (static) `clipPolyfaceClipPlaneWithClosureFace(polyface: Polyface, clipper: ClipPlane, insideClip?: boolean, buildClosureFace?: boolean): Polyface;`
* Methods that support points loosely structured as type MultiLineStringDataVariant
  * Many point variants are parsed:
    * point as Point3d
    * point as [1,2,3]
    * point as {x:1, y:2, z:3}
    * Array [] of any of the above
    * GrowableXYZArray with points packed (x,y,z,  x,y,z,  x,y,z, ...)
  * Methods to convert the variant structures to specific preferred types:
    * (static) `GrowableXYZArray.createArrayOfGrowableXYZArrayFromVariantData (data: MultiLineStringDataVariant): GrowableXYZArray[];`
       * Return array of GrowableXYZArray.
    * (static) `LineString3d.createArrayOfLineString3dFromVariantData (data: MultiLineStringDataVariant): LineString3d[];`
    * (static) `Range3d.createFromVariantData(data: MultiLineStringDataVariant):Range3d`
    * (static) `Point3dArray.convertVariantDataToDeepXYZNumberArrays(data: MultiLineStringDataVariant): any[];`
    * (static) `Point3dArray.convertVariantDataToDeepXYZNumberArrays(data: MultiLineStringDataVariant): any[];`
* (static) `FrameBuilder.createFrameWithCCWPolygon (points: Point3d[])`
  * Create a transform in the plane of points.
  * flip Z directed so the polygon has CCW orientation.
* `GrowableXYZArray` instance methods to access individual x,y,z by point index without creating Point3d object:
  * `myGrowableXYZArray.getXAtUncheckedPointIndex (pointIndex: number) : number;`
  * `myGrowableXYZArray.getYAtUncheckedPointIndex (pointIndex: number) : number;`
  * `myGrowableXYZArray.getZAtUncheckedPointIndex (pointIndex: number) : number;`
  * `myGrowableXYZArray.length`
  * `GrowableXYZArray.moveIndexToIndex (fromIndex, toIndex)`
* `ParityRegion` methods to facilitate adding or creating with (strongly typed) loop objects
  * For both `create` or `add`, data presented as possibly deep arrays of arrays of loops is flattened to the ParityRegion form of a single array of Loops.
  * `(static) createLoops(data?: Loop | Loop[] | Loop[][]): Loop | ParityRegion;`
    * Note that in the single-loop case this returns a Loop object rather than ParityRegion.
  * `myParityRegion.addLoops(data?: Loop | Loop[] | Loop[][]): void;`
* `BilinearPatch` methods
  * Method to compute points of intersection with a ray:
    * intersectRay(ray: Ray3d): CurveAndSurfaceLocationDetail[] | undefined;
* `LineString3d` methods
  * method to create capture a GrowableXYZArray as the packed points of a LineString3d:
    * (static) `createCapture(points: GrowableXYZArray): LineString3d;`
* `NumberArray` methods
  * In existing static method `NumberArray.maxAbsDiff`, allow both `number[]` and `Float64Array`, viz
    * (static) `NumberArray.maxAbsDiff(dataA: number[] | Float64Array, dataB: number[] | Float64Array): number;`
* `PolyfaceBuilder` methods
  * convert a single loop polygon to triangulated facets.
    * (static) `PolyfaceBuilder.polygonToTriangulatedPolyface(points: Point3d[], localToWorld?: Transform): IndexedPolyface | undefined;`
* `SweepContour` methods
  * (static) `SweepContour.createForPolygon(points: MultiLineStringDataVariant, defaultNormal?: Vector3d): SweepContour | undefined;`
* `Range3d` methods
  * Existing methods with input type `Point3d[]` allow `GrowableXYZArray` with packed x,y,z content
    * (static) `Range3d.createInverseTransformedArray<T extends Range3d>(transform: Transform, points: Point3d[] | GrowableXYZArray): T;`
    * (static) `Range3d.createTransformedArray<T extends Range3d>(transform: Transform, points: Point3d[] | GrowableXYZArray): T;`
* `XYZ` methods (become visible in both Point3d and Vector3d)
  * `myPoint.subtractInPlace (vector: XYAndZ);
* Numerics
  * Gaussian elimination step for inplace updated of subset of a row `rowB[i] += a * rowA[i]` for `i > pivotIndex`
     * (static) `eliminateFromPivot(rowA: Float64Array, pivotIndex: number, rowB: Float64Array, a: number): boolean;`
  * Solve up to 4 roots of a pair of bilinear equations
     * (static) `solveBilinearPair(a0: number, b0: number, c0: number, d0: number, a1: number, b1: number, c1: number, d1: number): Point2d[] | undefined;`
* `PolylineOps` new methods
  * (static) `PolylineOps.compressByPerpendicularDistance(source: Point3d[], maxDistance: number, numPass?: number): Point3d[]`
  * (static) `PolylineOps,compressShortEdges(source: Point3d[], maxEdgeLength: number): Point3d[]]`
  * (static) `PolylineOps.compressSmallTriangles(source: Point3d[], maxTriangleArea: number): Point3d[]`
* `RegionOps` new methods
  * (static) `RegionOps.computeXYZWireMomentSums(root: AnyCurve): MomentData | undefined`

