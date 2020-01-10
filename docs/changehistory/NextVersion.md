---
ignore: true
---
# NextVersion

## Geometry

* new public methods in RegionOps:

  * RegionOps.sortOuterAndHoleLoopsXY
  * apply parity logic to determine containment of holes in parents (or holes in islands)
  * RegionOps.constructAllXYRegionLoops
    * Compute intersections among unstructured input curves
    * Construct areas bounded by those inputs.
  * RegionOps.curveArrayRange
    * construct range of unstructured array of curves.
  * RegionOps.expandLineStrings
    * In an array of curve primitives, replace each LineString3d with expansion to LineSegment3d

* (new method) CurveCurve.allIntersectionsAmongPrimitivesXY
  * Supporting changes in CurveCurveIntersectionXY context class.
* CurveLocationDetail
  * new method to ask if fraction1 is present (i.e. this is an interval rather than single point.
* Make implementations of CurvePrimitive and CurveCollection methods to collect leaf primitives and strokes more consistent:

  * collectCurvePrimitives method
    * new optional args for (a) preallocated collector, (b) controlling expansion of CurveChainWithDistanceIndex
    * public entry RegionOps.collectCurvePrimitives
    * internal entries in CurveCollection, CurvePrimitive
    * internal "Go" methods in: CurveChainWithDistanceIndex,
  * CurveChain.cloneStroked is abstract (implemented by Path, Loop, CurveChainWithDistanceIndex
* CurveFactory
  * New method to create xy rectangles with optional fillets.

