---
publish: false
---
# NextVersion

Table of contents:

- [API support policies](#api-support-policies)
- [Electron 22 support](#electron-22-support)
- [Display system](#display-system)
  - [Eye-dome lighting of Point Clouds](#eye-dome-lighting-of-point-clouds)
  - [Smooth viewport resizing](#smooth-viewport-resizing)
  - [Pickable view overlays](#pickable-view-overlays)
  - [Element clipping example](#element-clipping-example)
  - [Support larger terrain meshes](#support-larger-terrain-meshes)
- [Geometry](#geometry)
  - [Query mesh convexity](#query-mesh-convexity)
- [Deprecations](#deprecations)
  - [@itwin/core-bentley](#itwincore-bentley)
  - [@itwin/core-frontend](#itwincore-frontend)
  - [@itwin/appui-react](#itwinappui-react)

## API support policies

iTwin.js now documents the [official policies](../learning/api-support-policies.md) defining the level of stability and support afforded to its public APIs and each major release.

## Electron 22 support

In addition to already supported Electron versions, iTwin.js now supports [Electron 22](https://www.electronjs.org/blog/electron-22-0).

## Display system

### Eye-Dome Lighting of Point Clouds

You can now apply eye-dome lighting (EDL) to point cloud reality models. This effect helps accentuate the depth, shape, and surface of a point cloud model. This is particularly helpful when a point cloud model lacks color data and would otherwise appear fully monochrome. The EDL settings are specified independently for each point cloud.

Note: EDL only applies when camera is enabled in the view.

To apply eye-dome lighting to a point cloud, you must apply a [RealityModelDisplaySettings]($common) to the model, customizing its point cloud display settings to utilize the eye-dome lighting properties, described below:

- [PointCloudDisplaySettings.edlMode]($common) specifies the mode to use for EDL. This defaults to "off". See [PointCloudEDLMode]($common) for more details.
- [PointCloudDisplaySettings.edlStrength]($common) specifies the strength value for the EDL effect, a positive floating point number. This defaults to 5.0.
- [PointCloudDisplaySettings.edlRadius]($common) specifies a radius value for the EDL effect, a positive floating point number which determines how far away in pixels to sample for depth change. This defaults to 2.0.
- [PointCloudDisplaySettings.edlFilter]($common) specifies a flag for whether or not to apply a filtering pass in the EDL effect; this only applies if edlMode is "full". This defaults to 1.0.
- [PointCloudDisplaySettings.edlMixWts1]($common) specifies a weighting value (a floating point number between 0 and 1 inclusive) to apply to the full image when combining it with the half and quarter sized ones; this only applies if edlMode is "full". This defaults to 1.0.
- [PointCloudDisplaySettings.edlMixWts2]($common) specifies a weighting value (a floating point number between 0 and 1 inclusive) to apply to the half image when combining it with the full and quarter sized ones; this only applies if edlMode is "full". This defaults to 0.5.
- [PointCloudDisplaySettings.edlMixWts4]($common) specifies a weighting value (a floating point number between 0 and 1 inclusive) to apply to the full image when combining it with the full and half sized ones; this only applies if edlMode is "full". This defaults to 0.25.

### Smooth viewport resizing

Previously, when a [Viewport]($frontend)'s canvas was resized there would be a delay of up to one second during which the viewport's contents would appear stretched or squished, before they were redrawn to match the new canvas dimensions. This was due to the unavailability of [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) in some browsers. Now that `ResizeObserver` is supported by all major browsers, we are able to use it to make the contents of the viewport update smoothly during a resize operation.

### Pickable view overlays

A bug preventing users from interacting with [pickable decorations](../learning/frontend/ViewDecorations.md#pickable-view-graphic-decorations) defined as [GraphicType.ViewOverlay]($frontend) has been fixed.

### Element clipping example

In some cases it is useful to apply a [clipping volume](https://www.itwinjs.org/reference/core-common/views/viewdetails/clipvector/) to a view that mimics the shape of one or more elements. For example, you may have a view displaying a reality mesh captured from a real-world asset like a factory, and a design model representing the same asset, and wish to isolate the portions of the reality mesh corresponding to a series of pipe elements in the design model.

display-test-app now provides an [example tool](https://github.com/iTwin/itwinjs-core/blob/master/test-apps/display-test-app/src/frontend/ViewClipByElementGeometryTool.ts) demonstrating how this can be achieved. It uses [IModelConnection.generateElementMeshes]($frontend) to produce [Polyface]($core-geometry)s from one or more elements; decomposes them into a set of convex hulls using [VHACD.js](https://www.npmjs.com/package/vhacd-js); and creates a clipping volume from the hulls via [ConvexClipPlaneSet.createConvexPolyface]($core-geometry). The example tool can be accessed in display-test-app using the keyin `dta clip element geometry`.

### Support larger terrain meshes

Previously, [RealityMeshParams]($frontend) only supported 16-bit vertex indices, which limited the number of vertices that could be produced by a [TerrainMeshProvider]($frontend). That limit has been extended to 32 bits (the maximum supported by WebGL). The code has also been optimized to allocate only as many bytes per vertex index as required. For example, if a mesh contains fewer than 256 vertices, only one byte will be allocated per vertex index.

## Geometry

### Query mesh convexity

A new method [PolyfaceQuery.isConvexByDihedralAngleCount]($core-geometry) permits testing the convexity of a mesh by inspecting the dihedral angles of all of its edges. For an example of its usage, see the [element clipping example](#element-clipping-example).

## Deprecations

### @itwin/core-bentley

[ByteStream]($bentley)'s `next` property getters like [ByteStream.nextUint32]($bentley) and [ByteStream.nextFloat64]($bentley) have been deprecated and replaced with corresponding `read` methods like [ByteStream.readUint32]($bentley) and [ByteStream.readFloat64]($bentley). The property getters have the side effect of incrementing the stream's current read position, which can result in surprising behavior and may [trip up code optimizers](https://github.com/angular/angular-cli/issues/12128#issuecomment-472309593) that assume property access is free of side effects.

Similarly, [TransientIdSequence.next]($bentley) returns a new Id each time it is called. Code optimizers like [Angular](https://github.com/angular/angular-cli/issues/12128#issuecomment-472309593)'s may elide repeated calls to `next` assuming it will return the same value each time. Prefer to use the new [TransientIdSequence.getNext]($bentley) method instead.

### @itwin/core-frontend

[ScreenViewport.setEventController]($frontend) was only ever intended to be used by [ViewManager]($frontend). In the unlikely event that you are using it for some (probably misguided) purpose, it will continue to behave as before, but it will be removed in a future major version.

### @itwin/appui-react

[ModelsTree]($appui-react) and [CategoryTree]($appui-react) were moved to [@itwin/tree-widget-react](https://github.com/iTwin/viewer-components-react/tree/master/packages/itwin/tree-widget) package and deprecated in `@itwin/appui-react` packages. They will be removed from `@itwin/appui-react` in future major version.

[SpatialContainmentTree]($appui-react) were deprecated in favor of `SpatialContainmentTree` from [@itwin/breakdown-trees-react](https://github.com/iTwin/viewer-components-react/tree/master/packages/itwin/breakdown-trees) package. [SpatialContainmentTree]($appui-react) will be removed in future major version.
