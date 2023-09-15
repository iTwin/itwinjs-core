---
publish: false
---

# NextVersion

Table of contents:

- [Geometry](#geometry)
  - [Clip any curve](#clip-any-curve)
- [Electron 26 support](#electron-26-support)
- [API Deprecations](#api-deprecations)
- [API Alpha Removals](#api-deprecations)

## Geometry

### Clip any curve

The new [ClipUtils.clipAnyCurve] clips any `CurvePrimitive`, `Path`, or `BagOfCurves` and any region including any `Loop`, `ParityRegion`, or `UnionRegion`. One just needs to pass `AnyCurve` and a `Clipper` and the functions collect portions of any curve that are within the clipper into an array of any curves and returns the array.

## Electron 26 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 26](https://www.electronjs.org/blog/electron-26-0).

## API deprecations

### @itwin/appui-abstract

[UiEvent]($appui-abstract) is a duplicate of [BeUiEvent]($bentley). [UiEventDispatcher]($appui-abstract) is only consumed internally from [SyncUiEventDispatcher]($appui-react) in @itwin/appui-react, which should be used in its place. Similarly, [UiSyncEventArgs]($appui-abstract) and [UiSyncEvent] have been also moved to appui-react.

[PointProps]($appui-abstract) was created primarily to avoid a dependency on @itwin/core-geometry, which contains an identical interface named [XAndY]($core-geometry). PointProps is now deprecated in favor of XAndY, or your own simple implementation. Similarly, [UiAdmin.createXAndY]($appui-abstract) has been deprecated.

## Alpha API Removals

### @itwin/appui-abstract

`isLetter` has been removed. Should you need that functionality, please implement it in your own code.
