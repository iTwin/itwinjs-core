
# Examples of Triangulation

## Triangulate points

|  |  |
|---|---|
| 25 points | ![>](./figs/Triangulation/PointTriangulation/ExampleA25Points.png) |
| compute convex hull of `points: Point3d[]` | `        const hull: Point3d[] = [];`<br> `        const interior: Point3d[] = [];` <br>`        Point3dArray.computeConvexHullXY(points, hull, interior, true);` |
| | ![>](./figs/Triangulation/PointTriangulation/ExampleAConvexHullAndInsidePoints.png) |
| One step `points: Point3d[]` to Polyface | `const polyface = PolyfaceBuilder.pointsToTriangulatedPolyface(points);`|
| IndexedPolyface with all the points triangulated. | ![>](./figs/Triangulation/PointTriangulation/ExampleATriangulatedMesh.png) |




Unit Test
  * source: imodeljs\core\geometry\src\test\topology\InsertAndRetriangulateContext.test.ts
  * test name: "TriangulateInHull"
  * output: imodeljs\core\geometry\src\test\output\InsertAndRetriangulateContext\TriangulateInHull.imjs