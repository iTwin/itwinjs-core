---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [WithQueryReader API](#withqueryreader-api)
    - [Dedicated SettingsDb for workspace settings](#dedicated-settingsdb-for-workspace-settings)
      - [Why SettingsDb?](#why-settingsdb)
      - [New APIs](#new-apis)
      - [Usage examples](#usage-examples)
        - [Creating a local SettingsDb](#creating-a-local-settingsdb)
      - [Container type convention](#container-type-convention)
      - [Container separation and lock isolation](#container-separation-and-lock-isolation)
  - [Display](#display)
    - [Fixes](#fixes)
  - [Electron 41 support](#electron-41-support)
  - [Quantity Formatting](#quantity-formatting)
    - [Reverted default metric engineering length in QuantityFormatter](#reverted-default-metric-engineering-length-in-quantityformatter)

## @itwin/core-backend

### WithQueryReader API

A new [withQueryReader]($docs/learning/backend/WithQueryReaderCodeExamples.md) method has been added to both [ECDb]($backend) and [IModelDb]($backend), providing true row-by-row behavior for ECSQL queries with synchronous execution. This API introduces a new [ECSqlSyncReader]($backend) through the [ECSqlRowExecutor]($backend) and supports configuration via [SynchronousQueryOptions]($backend).

**Key Features:**

- **True row-by-row streaming**: Unlike the existing async reader APIs, `withQueryReader` provides synchronous row-by-row access to query results
- **Consistent API across databases**: The same interface is available on both `ECDb` and `IModelDb` instances
- **Configurable behavior**: Support for various query options through `SynchronousQueryOptions`

**Usage Examples:**

```typescript
// ECDb usage
db.withQueryReader("SELECT ECInstanceId, UserLabel FROM bis.Element LIMIT 100", (reader) => {
  while (reader.step()) {
    const row = reader.current;
    console.log(`ID: ${row.id}, Label: ${row.userLabel}`);
  }
});

// IModelDb usage with options
iModelDb.withQueryReader(
  "SELECT ECInstanceId, CodeValue FROM bis.Element",
  (reader) => {
    while (reader.step()) {
      const row = reader.current;
      processElement(row);
    }
  }
);
```

**Migration from deprecated APIs:**

This API serves as the recommended replacement for synchronous query scenarios previously handled by the deprecated `ECSqlStatement` for read-only operations:

```typescript
// Before - using deprecated ECSqlStatement
db.withPreparedStatement(query, (stmt) => {
  while (stmt.step() === DbResult.BE_SQLITE_ROW) {
    const row = stmt.getRow();
    processRow(row);
  }
});

// Now - using withQueryReader
db.withQueryReader(query, (reader) => {
  while (reader.step()) {
    const row = reader.current;
    processRow(row);
  }
});
```

### Dedicated SettingsDb for workspace settings

A new [SettingsDb]($backend) type has been added to the workspace system, providing a dedicated database for storing JSON settings as key-value pairs, separate from general-purpose [WorkspaceDb]($backend) resource storage.

#### Why SettingsDb?

Previously, settings and binary resources (fonts, textures, templates) were stored together in `WorkspaceDb` containers. This coupling created issues:

- **Lookup**: Finding which containers hold settings required opening each one
- **Granularity**: Settings updates required republishing entire containers with large binary resources
- **Separation of concerns**: Settings (JSON key-value) and resources (binary blobs) have different access patterns

#### New APIs

- [SettingsDb]($backend): Read-only interface with `getSetting()` and `getSettings()` for accessing settings stored in a dedicated database
- [EditableSettingsDb]($backend): Write interface with `updateSetting()`, `removeSetting()`, and `updateSettings()` for modifying settings within a SettingsDb
- [SettingsEditor]($backend): Write interface for creating and managing SettingsDb containers
- [Workspace.getSettingsDb]($backend): Method to open a SettingsDb from a previously-loaded container by its `containerId` and desired priority

#### Usage examples

##### Creating a local SettingsDb

[[include:SettingsDb.createLocal]]

See [SettingsDb]($docs/learning/backend/Workspace.md#settingsdb) for full documentation.

#### Container type convention

SettingsDb containers use `containerType: "settings"` in their cloud metadata, enabling them to be discovered independently of any iModel.

#### Container separation and lock isolation

Settings containers are deliberately separate from workspace containers. Both extend the new [CloudSqliteContainer]($backend) base interface, but [EditableSettingsCloudContainer]($backend) does not extend [WorkspaceContainer]($backend). This means:

- **Independent write locks**: Editing settings does not lock out workspace resource editors, and vice versa.
- **Clean API surface**: Settings containers do not inherit workspace-db read/write methods (`getWorkspaceDb`, `addWorkspaceDb`, etc.), exposing only settings-specific operations.
- **Type safety**: Code that receives an `EditableSettingsCloudContainer` cannot accidentally add or retrieve `WorkspaceDb`s from it.

## Display

### Fixes

- Fixed reality data geometry not being reprojected correctly when the reality data is in a different CRS than the iModel.

## Electron 41 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 41](https://www.electronjs.org/blog/electron-41-0).

## Quantity Formatting

### Reverted default metric engineering length in QuantityFormatter

The default metric engineering length format introduced in iTwin.js 5.7.0 has been reverted. Applications using [QuantityFormatter]($frontend) with [QuantityType.LengthEngineering]($frontend) will once again display metric engineering lengths in **meters with 4 decimal places** (e.g. `1000 m`) rather than millimeters.
