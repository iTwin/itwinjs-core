---
publish: false
---

# NextVersion

Table of contents:

- [Electron 36 support](#electron-36-support)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)

## Electron 36 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 36](https://www.electronjs.org/blog/electron-36-0).

## API deprecations

### @itwin/presentation-common

- `UnitSystemFormat`, `FormatsMap` and `KoqPropertyValueFormatter` constructor using the latter type have been deprecated. Instead, the constructor overload with "props" object should be used. The props object allows passing an optional `FormatsProvider` to use for finding formatting props for different types of values. When not specified, the `SchemaFormatsProvider` is used by default, so the behavior stays the same as before. Ideally, it's expected that frontend apps will pass `IModelApp.formatsProvider` for this prop.

### @itwin/presentation-backend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelDb]($core-backend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the new `formatsProvider` property.

### @itwin/presentation-frontend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelConnection]($core-frontend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.
- The `PresentationManagerProps.defaultFormats` property has been deprecated in favor of the `FormatsProvider` now being available on [IModelApp.formatsProvider]($core-frontend).
