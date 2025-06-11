---
publish: false
---

# NextVersion

Table of contents:

- [Electron 36 support](#electron-36-support)
- [Google Photorealistic 3D Tiles support](#google-photorealistic-3d-tiles-support)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)

## Electron 36 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 36](https://www.electronjs.org/blog/electron-36-0).

## Google Photorealistic 3D Tiles support

iTwin.js now supports displaying Google Photorealistic 3D Tiles (GP3DT) via the new `RealityDataSourceGP3DTProvider`. See [this article](../learning/frontend/GooglePhotorealistic3DTiles.md) for more details.

![Google Photorealistic 3D Tiles - Exton](../learning/frontend/google-photorealistic-3d-tiles-1.jpg "Google Photorealistic 3D Tiles - Exton")

![Google Photorealistic 3D Tiles - Philadelphia](../learning/frontend/google-photorealistic-3d-tiles-2.jpg "Google Photorealistic 3D Tiles - Philadelphia")

## API deprecations

### @itwin/presentation-backend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelDb]($core-backend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.

### @itwin/presentation-frontend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelConnection]($core-frontend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
