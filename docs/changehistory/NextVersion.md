---
publish: false
---

# NextVersion

Table of contents:

- [Quantity](#quantity)
- [Electron 32 support](#electron-32-support)
- [Geometry](#geometry)

## Quantity

- The `minWidth` property on FormatProps now works as documented.
- The `spacer` property on FormatProps now indicates the space used between composite components, it defaults to a single space, and there is no longer a ':' prepended. If a ':' spacer is desired, `spacer` has to be set accordingly. This is to streamline the behavior with the documentation and native APIs.
- Added support for bearing and azimuth format types (e.g. bearing `N45°30'10"E`). A new phenomenon "Direction" for these will be added to our units library soon, but they work just as well with the angle phenomenon for now. Persistence values for both bearing and azimuth are to be provided counter-clockwise from an east-base (inspired by PowerPlatform).
- [Electron 32 support](#electron-32-support)
- [Geometry](#geometry)

## Electron 32 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 32](https://www.electronjs.org/blog/electron-32-0).

## Geometry

### Approximating an elliptical arc with a circular arc chain

[Arc3d.constructCircularArcChainApproximation]($core-geometry) returns a [CurveChain]($core-geometry) of circular arcs that approximates the elliptical instance arc. Each arc in the chain starts and ends on the ellipse. The ellipse major/minor axis points and tangents are also interpolated, as well as those at the elliptical arc start/end, and the arcs are arranged to preserve ellipse symmetry. Various settings in the optional [EllipticalArcApproximationOptions]($core-geometry) input object control the approximation accuracy. The default method is [EllipticalArcSampleMethod.AdaptiveSubdivision]($core-geometry), which is controlled by a maximum error distance, `options.maxError`. Other values of `options.sampleMethod` interpolate the ellipse in other ways, controlled by the number of points interpolated in a given quadrant, `options.numSamplesInQuadrant`. For a fixed number of samples, the default method usually yields the most accurate approximation.

Pictured below in order of decreasing error are some example approximations in blue, with ellipses in black, sample sites circled, and maximum error segment in red.

Approximation using `options.sampleMethod = EllipticalArcSampleMethod.UniformCurvature` and `options.numSamplesInQuadrant = 5`, yielding error 0.18:

![Uniform Curvature](./assets/approximate-ellipse-uniform-curvature.jpg "Uniform Curvature")

Approximation using `options.sampleMethod = EllipticalArcSampleMethod.UniformParameter` and `options.numSamplesInQuadrant = 5`, yielding error 0.12:

![Uniform Parameter](./assets/approximate-ellipse-uniform-parameter.jpg "Uniform Parameter")

Approximation using `options.sampleMethod = EllipticalArcSampleMethod.NonUniformCurvature`, `options.remapFunction = (x) => x*x`, and `options.numSamplesInQuadrant = 5`, yielding error 0.05:

![Quadratic Curvature](./assets/approximate-ellipse-quadratic-curvature.jpg "Quadratic Curvature")

Approximation using `options.sampleMethod = EllipticalArcSampleMethod.AdaptiveSubdivision` and `options.maxError === 0.05`, yielding error 0.03:

![Adaptive Subdivision](./assets/approximate-ellipse-adaptive-subdivision.jpg "Adaptive Subdivision")

### Triangulating points

[PolyfaceBuilder.pointsToTriangulatedPolyface]($core-geometry), which creates a [Polyface]($core-geometry) from an xy-triangulation of input points, now uses the [StrokeOptions]($core-geometry) input setting `options.chordTol` to control the maximum xy-distance for equating points. This method preserves the highest z-coordinate among points equated in this manner. The default for this setting is [Geometry.smallMetricDistance]($core-geometry), however for typical DTM datasets, a larger tolerance can be used (e.g., 1-2mm) to eliminate extraneous "skirt" points that lie underneath the terrain boundary.

Pictured below are triangulations of a DTM dataset with skirt points. At top is the result using default tolerance. Due to the skirt points having xy-distance greater than the default tolerance from actual terrain sites, they are included in the triangulation, resulting in undesirable near-vertical facets. At bottom is the result using `options.chordTol = 0.002`, which is sufficiently large to remove these artifacts:

![Toleranced Triangulations](./assets/triangulate-points-tolerance.jpg "Toleranced Triangulations")

### Revert timeline changes

Currently the only way we can undo a faulty changeset is to delete it from imodel hub. This can have many side effects. A more elegant way to do it is to invert the changeset in timeline and push that as new changeset on timeline. This new method is still intrusive and require schema lock. But is safe as it can be again reverted to reinstate existing changes and thus nothing is ever lost from timeline.

[IModelDb.revertAndPushChanges]($core-backend) Allow to push a single changeset that undo all changeset from tip to specified changeset in history.

Some detail and requirements are as following.

- When calling the iModel must not have any local changes.
- The operation is atomic and if fail it will return db to previous state.
- Revert operation requires schema lock (exclusive lock on imodel). As it does not take lock on individual element that will be affected by revert.
- After revert if no description is provided, it will create a default description for changeset and push it. This release schema lock.
- Schema changes are not reverted in case of SchemaSync or can also optionally skipped when not using schema sync.
