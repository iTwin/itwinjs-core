
# Examples of Triangulation

## Delauney triangulation of many points in xy plane

|  |  |
|---|---|
| 25 points | ![>](./figs/Triangulation/PointTriangulation/ExampleA25Points.png) |
| compute convex hull of `points: Point3d[]` | `const hull: Point3d[] = [];`<br> `const interior: Point3d[] = [];` <br>`Point3dArray.computeConvexHullXY(points, hull, interior, true);` |
| | ![>](./figs/Triangulation/PointTriangulation/ExampleAConvexHullAndInsidePoints.png) |
| One step `points: Point3d[]` to Polyface | `const polyface = PolyfaceBuilder.pointsToTriangulatedPolyface(points);`|
| IndexedPolyface with all the points triangulated. | ![>](./figs/Triangulation/PointTriangulation/ExampleATriangulatedMesh.png) |

Unit Test

- source: core\geometry\src\test\topology\InsertAndRetriangulateContext.test.ts
- test name: "TriangulateInHull"
- output: core\geometry\src\test\output\InsertAndRetriangulateContext\TriangulateInHull.imjs

## Triangulate points "between linestrings"

|  |  |
|---|---|
| 4 and 6 sided polygons | ![>](./figs/Triangulation/GreedyTriangulationBetweenLineStrings/QuadAndHex.png) |
| Same polygons displayed with `<br>`handles to indicate the two linestrings have edge subdivision mismatch `<br>` in addition to the different cornering angles | ![>](./figs/Triangulation/GreedyTriangulationBetweenLineStrings/QuadAndHexWithHandlesA.png) |
| triangles constructed "between" the polygons | ![>](./figs/Triangulation/GreedyTriangulationBetweenLineStrings/MeshA.png) |
| Same polygons, another mix of points along edges | ![>](./figs/Triangulation/GreedyTriangulationBetweenLineStrings/QuadAndHexWithHandlesB.png) |
| triangles constructed "between" the polygons | ![>](./figs/Triangulation/GreedyTriangulationBetweenLineStrings/MeshB.png) |

Unit Test

- source: core\geometry\src\test\Polyface\GreedyTriangulationBetweenLineStrings.test.ts
- test set: `describe("GreedyTriangulationBetweenLineStrings"`
- test name: `quadStar`
- output: core\geometry\src\test\output\GreedyTriangulationBetweenLineStrings\quadStar.imjs
