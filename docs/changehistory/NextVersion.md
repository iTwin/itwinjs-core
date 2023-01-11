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
- [Deprecations](#deprecations)
  - [@itwin/core-bentley](#itwincore-bentley)
  - [@itwin/core-frontend](#itwincore-frontend)

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

## WAL (Write-Ahead Logging) mode for briefcases

Previously, iTwin.js used [DELETE](https://www.sqlite.org/pragma.html#pragma_journal_mode) journal mode for writes to local briefcase files. It now uses [WAL](https://www.sqlite.org/wal.html) mode (see SQLite documentation for details). This change should be invisible to applications, other than performance of [IModelDb.saveChanges]($backend) should improve in most cases. However, there are a few subtle implications of this change that may affect existing applications:

- Multiple writeable connections will now fail on open. Previously it was possible to open the same briefcase for write more than once, and one or the other would fail on its first write. Now, the second attempt to open for write will fail.

- Failure to close a writeable briefcase may leave a "-wal" file. Previously, if a program crashed or exited with an open briefcase, it would leave the briefcase file as-of its last call to `IModelDb.saveChanges`. Now, there will be another file with the name of the briefcase with "-wal" appended. This is not a problem and the briefcase is completely intact, except that the briefcase file itself is not sufficient for copying (it will not include recent changes.) The "-wal" file will be used by future connections and will be deleted the next time the briefcase is successfully closed.

- Attempting to copy an open-for-write briefcase file may not include recent changes. This scenario generally only arises for tests. If you wish to copy an open-for-write briefcase file, you must now call [IModelDb.performCheckpoint]($backend).


## Deprecations

### @itwin/core-bentley

[ByteStream]($bentley)'s `next` property getters like [ByteStream.nextUint32]($bentley) and [ByteStream.nextFloat64]($bentley) have been deprecated and replaced with corresponding `read` methods like [ByteStream.readUint32]($bentley) and [ByteStream.readFloat64]($bentley). The property getters have the side effect of incrementing the stream's current read position, which can result in surprising behavior and may [trip up code optimizers](https://github.com/angular/angular-cli/issues/12128#issuecomment-472309593) that assume property access is free of side effects.

### @itwin/core-frontend

[ScreenViewport.setEventController]($frontend) was only ever intended to be used by [ViewManager]($frontend). In the unlikely event that you are using it for some (probably misguided) purpose, it will continue to behave as before, but it will be removed in a future major version.
