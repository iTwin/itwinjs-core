---
publish: false
---
# NextVersion

Table of contents:

- [Electron 22 support](#electron-22-support)
- [Display system](#display-system)
  - [Eye-dome lighting of Point Clouds](#eye-dome-lighting-of-point-clouds)
  - [Smooth viewport resizing](#smooth-viewport-resizing)
  - [Pickable view overlays](#pickable-view-overlays)
- [API promotions](#api-promotions)
- [API deprecations](#api-deprecations)

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

## API promotions

The following APIs have been promoted to `@public`, indicating they are now part of their respective packages' stability contract.

### @itwin/core-bentley

- [AccessToken]($bentley)

### @itwin/core-common

- [AuthorizationClient]($common)
- [FrustumPlanes]($common)

### @itwin/core-frontend

- [Viewport.queryVisibleFeatures]($frontend)
- [Viewport.lookAt]($frontend) and [ViewState3d.lookAt]($frontend)

## API deprecations

### @itwin/core-bentley

[ByteStream]($bentley)'s `next` property getters like [ByteStream.nextUint32]($bentley) and [ByteStream.nextFloat64]($bentley) have been deprecated and replaced with corresponding `read` methods like [ByteStream.readUint32]($bentley) and [ByteStream.readFloat64]($bentley). The property getters have the side effect of incrementing the stream's current read position, which can result in surprising behavior and may [trip up code optimizers](https://github.com/angular/angular-cli/issues/12128#issuecomment-472309593) that assume property access is free of side effects.

Similarly, [TransientIdSequence.next]($bentley) returns a new Id each time it is called. Code optimizers like [Angular](https://github.com/angular/angular-cli/issues/12128#issuecomment-472309593)'s may elide repeated calls to `next` assuming it will return the same value each time. Prefer to use the new [TransientIdSequence.getNext]($bentley) method instead.

### @itwin/core-frontend

[ScreenViewport.setEventController]($frontend) was only ever intended to be used by [ViewManager]($frontend). In the unlikely event that you are using it for some (probably misguided) purpose, it will continue to behave as before, but it will be removed in a future major version.

### @itwin/appui-react

[ModelsTree]($appui-react) and [CategoryTree]($appui-react) were moved to [@itwin/tree-widget-react](https://github.com/iTwin/viewer-components-react/tree/master/packages/itwin/tree-widget) package and deprecated in `@itwin/appui-react` packages. They will be removed from `@itwin/appui-react` in future major version.

[SpatialContainmentTree]($appui-react) were deprecated in favor of `SpatialContainmentTree` from [@itwin/breakdown-trees-react](https://github.com/iTwin/viewer-components-react/tree/master/packages/itwin/breakdown-trees) package. [SpatialContainmentTree]($appui-react) will be removed in future major version.
