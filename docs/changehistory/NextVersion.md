---
publish: false
---

# NextVersion

Table of contents:

- [Electron 32 support](#electron-32-support)
- [Geometry](#geometry)

## Electron 32 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 32](https://www.electronjs.org/blog/electron-32-0).

## Geometry

### Triangulating points

[PolyfaceBuilder.pointsToTriangulatedPolyface]($core-geometry), which creates a [Polyface]($core-geometry) from an xy-triangulation of input points, now uses the [StrokeOptions]($core-geometry) input setting `options.chordTol` to control the maximum xy-distance for equating points. This method preserves the highest z-coordinate among points equated in this manner. The default for this setting is [Geometry.smallMetricDistance]($core-geometry), however for typical DTM datasets, a larger tolerance can be used (e.g., 1-2mm) to eliminate extraneous "skirt" points that lie underneath the terrain boundary.
