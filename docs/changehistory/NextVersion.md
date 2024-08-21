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
