---
publish: false
---

# NextVersion

Table of contents:

- [Quantity](#quantity)
- [Electron 32 support](#electron-32-support)

## Quantity

- The `minWidth` property on FormatProps now works as documented.
- The `spacer` property on FormatProps now indicates the space used between composite components, it defaults to a single space, and there is no longer a ':' prepended. If a ':' spacer is desired, `spacer` has to be set accordingly. This is to streamline the behavior with the documentation and native APIs.
- Added support for bearing and azimuth format types (e.g. bearing `N45°30'10"E`). A new phenomenon "Direction" for these will be added to our units library soon, but they work just as well with the angle phenomenon for now. Persistence values for both bearing and azimuth are to be provided counter-clockwise from an east-base (inspired by PowerPlatform).
- [Electron 32 support](#electron-32-support)
- [Geometry](#geometry)

## Electron 32 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 32](https://www.electronjs.org/blog/electron-32-0).

## Geometry

### Triangulating points

[PolyfaceBuilder.pointsToTriangulatedPolyface]($core-geometry), which creates a [Polyface]($core-geometry) from an xy-triangulation of input points, now uses the [StrokeOptions]($core-geometry) input setting `options.chordTol` to control the maximum xy-distance for equating points. This method preserves the highest z-coordinate among points equated in this manner. The default for this setting is [Geometry.smallMetricDistance]($core-geometry), however for typical DTM datasets, a larger tolerance can be used (e.g., 1-2mm) to eliminate extraneous "skirt" points that lie underneath the terrain boundary.

Pictured below are triangulations of a DTM dataset with skirt points. At top is the result using default tolerance. Due to the skirt points having xy-distance greater than the default tolerance from actual terrain sites, they are included in the triangulation, resulting in undesirable near-vertical facets. At bottom is the result using `options.chordTol = 0.002`, which is sufficiently large to remove these artifacts:

![Toleranced Triangulations](./assets/triangulate-points-tolerance.jpg "Toleranced Triangulations")