---
publish: false
---

# NextVersion

Table of contents:

- [Electron 36 support](#electron-36-support)
- [Google Photorealistic 3D Tiles support](#google-photorealistic-3d-tiles-support)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)

## Electron 36 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 36](https://www.electronjs.org/blog/electron-36-0).

## Google Photorealistic 3D Tiles support

iTwin.js now supports displaying Google Photorealistic 3D Tiles via the new `Google3dTilesProvider`. See [this article](../learning/frontend/GooglePhotorealistic3dTiles.md) for more details.

![Google Photorealistic 3D Tiles - Exton](../learning/frontend/google-photorealistic-3d-tiles-1.jpg "Google Photorealistic 3D Tiles - Exton")

![Google Photorealistic 3D Tiles - Philadelphia](../learning/frontend/google-photorealistic-3d-tiles-2.jpg "Google Photorealistic 3D Tiles - Philadelphia")

## API deprecations

### @itwin/presentation-common

- `UnitSystemFormat`, `FormatsMap` and `KoqPropertyValueFormatter` constructor using the latter type have been deprecated. Instead, the constructor overload with "props" object should be used. The props object allows passing an optional `FormatsProvider` to use for finding formatting props for different types of values. When not specified, the `SchemaFormatsProvider` is used by default, so the behavior stays the same as before. Ideally, it's expected that frontend apps will pass `IModelApp.formatsProvider` for this prop.

### @itwin/presentation-backend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelDb]($core-backend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the new `formatsProvider` property.

### @itwin/presentation-frontend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelConnection]($core-frontend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the `FormatsProvider` now being available on [IModelApp.formatsProvider]($core-frontend).

## Schedule Script Editing Mode

A new editing mode has been added to `DisplayStyle3dState` for working with `RenderSchedule.Script`. This allows dynamic editing of schedule scripts in real time, with immediate visual feedback using dynamic tiles, without requiring a full tile tree refresh for every change.

Use `setScheduleEditing(script)` to apply a schedule script in editing mode. Once all edits are complete, call `commitScheduleEditing()` to finalize the changes and trigger a full refresh.

See [code examples](../example-code/snippets/src/frontend/ScheduleScriptEditing.ts) for more details
