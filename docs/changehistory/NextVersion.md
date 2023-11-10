---
publish: false
---
# NextVersion

Table of contents:

- [Geometry](#geometry)
  - [Clip any curve](#clip-any-curve)
- [ECSQL instance properties](#ecsql-instance-properties)
- [Electron 27 support](#electron-27-support)

## Geometry

### Clip any curve

The new [ClipUtils.clipAnyCurve]($core-geometry) clips any `CurvePrimitive`, `Path`, or `BagOfCurves` and any region including any `Loop`, `ParityRegion`, or `UnionRegion`. One just needs to pass `AnyCurve` and a `Clipper` and the functions collect portions of any curve that are within the clipper into an array of any curves and returns the array.

## ECSQL Instance properties

ECSQL supports querying instance properties, which are any property in a class selected in ECSql or its derived classes.

[**ECSQL Instance Properties Documentation**](../learning/ECSQLTutorial/InstanceProps.md)

## Electron 27 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 27](https://www.electronjs.org/blog/electron-27-0).
