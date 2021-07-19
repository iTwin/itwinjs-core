
# Examples of `PolyfaceClip` methods

## Cut Fill

|  |  |
|---|---|
| red and green meshes  | ![>](./figs/PolyfaceClip/CutFillAInput.png) <br>  ![>](./figs/PolyfaceClip/CutFillAInputTransparent.png) |
| Compute "over and under" mesh parts <br> (red is meshA, green is meshB) | `const cutFill = PolyfaceClip.computeCutFill(meshA, meshB);` |
| `cutFill.meshAOverB` |![>](./figs/PolyfaceClip/CutFillARedOverGreen.png) `|
|`cutFill.meshBOverA` |![>](./figs/PolyfaceClip/CutFillAGreenOverRed.png) ` |

Unit Test

- source: imodeljs\core\geometry\src\test\clipping\PolyfaceClip.test.ts
- test name: "CutFill"
- output: imodeljs\core\geometry\src\test\output\PolyfaceClip\CutFill.imjs

## Section Cut

|  |  |
|---|---|
| grey: closed volume mesh <br> green: section plane  | ![>](./figs/PolyfaceClip/SectionCut/MeshVolumeAndPlane.png) |
| extract linework of section cut | `const section = PolyfaceClip.sectionPolyfaceClipPlane(facets, clipPlane);` |
| This produces an array of `LineString3d` | ![>](./figs/PolyfaceClip/SectionCut/SectionCutAsLines.png) |
| Clip the facet set and produce facets on the cut plane <br>
 `insideClip` is a boolean controlling which side of the cut is kept. |`  const clippedPolyface = PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(facets, clipPlane, insideClip, true);' |
 | Lower and upper parts | ![>](./figs/PolyfaceClip/SectionCut/LowerAndUpperParts.png)

Unit Test:

- source: imodeljs\core\geometry\src\test\clipping\PolyfaceClip.test.ts
- test name: "ClosedSection"
- output: imodeljs\core\geometry\src\test\output\PolyfaceClip\ClosedSection.imjs

## Clipping with ConvexClipPlaneSet or UnionOfConvexClipPlaneSet

|  |  |
|---|---|
| gray box is a closed volume mesh <br> Red shape is to be swept vertically   | ![>](./figs/PolyfaceClip/ClipSets/SlabWithCutter.png)  |
| Create `SweepContour` as intermediate step to `UnionOfConvexClipPlaneSets` for the clipping. | const contour = SweepContour.createForPolygon([Point3d.create(xA, yA), Point3d.create(xB, yA), Point3d.create(xA, yB), Point3d.create(xA, yA)])!; |
| Get the clipper out of the `SweepContour` |`const clipper = contourP0.sweepToUnionOfConvexClipPlaneSets()!;` |
| Create a `ClipBuilders` object for use in the clip |`const clipBuilders = ClippedPolyfaceBuilders.create(true, true, true);`|
| Do the clip |`PolyfaceClip.clipPolyfaceInsideOutside(facets, clipper, clipBuilders);` |
| Extract the inside part | `insidePart = clipBuilders.claimPolyface(0, true);` <br> ![>](./figs/PolyfaceClip/ClipSets/InsidePart.png)|
| Extract the outside part | `insidePart = clipBuilders.claimPolyface(1, true);` <br> ![>](./figs/PolyfaceClip/ClipSets/OutsidePart.png)|

Unit Test:

- source: imodeljs\core\geometry\src\test\clipping\PolyfaceClip.test.ts
- test name: "BoxClosureNonConvex"
- output: imodeljs\core\geometry\src\test\output\PolyfaceClip\BoxClosureNonConvex.imjs
