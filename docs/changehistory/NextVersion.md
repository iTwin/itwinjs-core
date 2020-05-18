---
ignore: true
---
# NextVersion

## Geometry

* New methods to reorder and reverse curves to form chains and offset loops.
  * `RegionOps.collectChains(fragments: GeometryQuery[], gapTolerance: number)`
    * For use case where there is no set expectation of whether there are one or many chains.
  * `RegionOps.collectInsideAndOutsideOffsets(fragments: GeometryQuery[], offsetDistance: number, gapTolerance: number)`
    * For use case where inputs are expected to form a loop, with clear sense of inside and outside offsetting.
