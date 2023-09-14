---
publish: false
---
# NextVersion

Table of contents:

- [Geometry](#geometry)
  - [Clip any curve](#clip-any-curve)
- [Electron 26 support](#electron-26-support)


## Geometry

### Clip any curve

The new [ClipUtils.clipAnyCurve] clips any `CurvePrimitive`, `Path`, or `BagOfCurves` and any region including any `Loop`, `ParityRegion`, or `UnionRegion`. One just needs to pass `AnyCurve` and a `Clipper` and the functions collect portions of any curve that are within the clipper into an array of any curves and returns the array.

## Electron 26 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 26](https://www.electronjs.org/blog/electron-26-0).
