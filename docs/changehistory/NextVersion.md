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
      - [Usage example](#usage-example)
      - [Container type convention](#container-type-convention)
      - [Container separation and lock isolation](#container-separation-and-lock-isolation)

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

A new [SettingsDb]($backend) type has been added to the workspace system, providing a dedicated database for storing JSON settings dictionaries, separate from general-purpose [WorkspaceDb]($backend) resource storage.

#### Why SettingsDb?

Previously, settings dictionaries and binary resources (fonts, textures, templates) were stored together in `WorkspaceDb` containers. This coupling created issues:

- **Lookup**: Finding which containers hold settings required opening each one
- **Granularity**: Settings updates required republishing entire containers with large binary resources
- **Separation of concerns**: Settings (JSON key-value) and resources (binary blobs) have different access patterns

#### New APIs

- [SettingsDb]($backend): Read-only interface for accessing settings dictionaries stored in a dedicated database
- [SettingsEditor]($backend): Write interface for creating and managing SettingsDb containers
- [EditableSettingsDb]($backend): Write interface for modifying settings within a SettingsDb
- [Workspace.getSettingsDb]($backend): Lookup method to find SettingsDb containers by iTwin/iModel scope

#### Usage examples

##### Creating a local SettingsDb

[[include:SettingsDb.createLocal]]

##### Working with multiple dictionaries

[[include:SettingsDb.multipleDictionaries]]

See [SettingsDb]($docs/learning/backend/Workspace.md#settingsdb) for full documentation.

#### Container type convention

SettingsDb containers use `containerType: "settings"` in their cloud metadata, enabling discovery via `BlobContainer.service.queryContainersMetadata({ containerType: "settings" })`.

#### Container separation and lock isolation

Settings containers are deliberately separate from workspace containers. Both extend the new [CloudSqliteContainer]($backend) base interface, but [EditableSettingsContainer]($backend) no longer extends [WorkspaceContainer]($backend). This means:

- **Independent write locks**: Editing settings does not lock out workspace resource editors, and vice versa.
- **Clean API surface**: Settings containers do not inherit workspace-db read/write methods (`getWorkspaceDb`, `addWorkspaceDb`, etc.), exposing only settings-specific operations.
- **Type safety**: Code that receives an `EditableSettingsContainer` cannot accidentally add or retrieve `WorkspaceDb`s from it.
