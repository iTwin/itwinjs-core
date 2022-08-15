---
publish: false
---
# NextVersion

## Ambient Occlusion Improvements

The ambient occlusion effect has undergone some quality improvements.

Changes:

- The shadows cast by ambient occlusion will decrease in size the more distant the geometry is.
- The maximum distance for applying ambient occlusion now defaults to 10,000 meters instead of 100 meters.
- The effect will now fade as it approaches the maximum distance.

Old effect, as shown below:

![AO effect is the same strength in the near distance and far distance](./assets/AOOldDistance.png)

New effect, shown below:

![AO effect fades in the distance; shadows decrease in size](./assets/AONewDistance.png)

For more details, see the new descriptions of the `texelStepSize` and `maxDistance` properties of [AmbientOcclusion.Props]($common).

## Deprecations

### @itwin/core-geometry

The B-spline API has several name changes for consistency:

| Deprecated                                                    | Replacement                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| [BSpline1dNd.testCloseablePolygon]($core-geometry)            | [BSpline1dNd.testClosablePolygon]($core-geometry)             |
| [BSpline2dNd.isClosable]($core-geometry)                      | [BSpline2dNd.isClosableUV]($core-geometry)                    |
| [BSpline2dNd.sumpoleBufferDerivativesForSpan]($core-geometry) | [BSpline2dNd.sumPoleBufferDerivativesForSpan]($core-geometry) |
| [BSplineSurface3dQuery.isClosable]($core-geometry)            | [BSplineSurface3dQuery.isClosableUV]($core-geometry)          |
| [UVSelect.VDirection]($core-geometry)                         | [UVSelect.vDirection]($core-geometry)                         |
