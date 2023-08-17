---
publish: false
---
# NextVersion

Table of contents:

- [Geometry](#geometry)
  - [Clip any curve](#clip-any-curve)


## Geometry

### Clip any curve

The new [ClipUtils.clipAnyCurve]($core-geometry) clips any `CurvePrimitive`, `Path`, or `BagOfCurves` and any region including any `Loop`, `ParityRegion`, or `UnionRegion`. One just needs to pass `AnyCurve` and a `Clipper` and the functions collect portions of any curve that are within the clipper into an array of any curves and retunrs the array.