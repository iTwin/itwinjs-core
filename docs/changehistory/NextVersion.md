---
publish: false
---

# NextVersion

Table of contents:

- [Electron 36 support](#electron-36-support)
- [API deprecations](#api-deprecations)
  - [@itwin/presentation-backend](#itwinpresentation-backend)
  - [@itwin/presentation-frontend](#itwinpresentation-frontend)
- [Preventing Doppelgangers](#preventing-doppelgangers)

## Electron 36 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 36](https://www.electronjs.org/blog/electron-36-0).

## Attach/detach db

Allow the attachment of an ECDb/IModel to a connection and running ECSQL that combines data from both databases.

```ts
[[include:IModelDb_attachDb.code]]
```

> Note: There are some reserve alias names that cannot be used. They are 'main', 'schema_sync_db', 'ecchange' & 'temp'

## API deprecations

### @itwin/presentation-backend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelDb]($core-backend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.

### @itwin/presentation-frontend

- The `PresentationManagerProps.schemaContextProvider` property has been deprecated. Starting with `5.0` release, `SchemaContext` is always available on [IModelConnection]($core-frontend), so this prop is no longer needed. If supplied, it will still be preferred over the iModel's schema context, until the property is removed completely in a future release.


## Preventing Doppelgangers

Previously, it was possible for an app to (mis)configure their dependencies such that they end up with multiple versions of single core package, known as doppelgangers, which can lead to a number of issues, including:

- _Non-single singletons_

- _Duplicate types_

- _Semantically different doppelgangers_

Read here for more details on the [consequences of doppelgangers](https://github.com/microsoft/rushstack-websites/blob/main/websites/rushjs.io/docs/pages/advanced/npm_doppelgangers.md#consequences-of-doppelgangers). To prevent this we have introduced [Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)s to core packages so if you try to load the same package twice, you will get a different instance of the package, which will throw a runtime error when you try to use it.
