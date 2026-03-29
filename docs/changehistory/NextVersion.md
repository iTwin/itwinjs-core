---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [WithQueryReader API](#withqueryreader-api)
    - [iTwin settings workspace](#itwin-settings-workspace)
      - [New APIs](#new-apis)
      - [Usage examples](#usage-examples)
      - [Configuration requirements](#configuration-requirements)
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

### iTwin settings workspace

Applications can now store and load named settings dictionaries in an iTwin-scoped workspace.

Under the hood, that workspace uses a [SettingsDb]($backend), which is a settings-formatted [WorkspaceDb]($backend) named `settings-db`. In that db, each string resource is one settings dictionary:

- Resource name: dictionary name
- Resource value: JSON dictionary content

Developers still read and write settings dictionaries by name, while container management, versioning, and cloud sync follow the standard workspace model.


#### New APIs

- [EditableWorkspaceContainer.withEditableDb]($backend): Acquire a write lock, get or create an editable tip WorkspaceDb, run an operation, then close and release. Automatically creates a new prerelease version if the tip is already published.
- [IModelHost.getITwinWorkspace]($backend): Load an iTwin-level workspace with all named settings dictionaries.
- [IModelHost.saveSettingDictionary]($backend) and [IModelHost.deleteSettingDictionary]($backend): Save and remove named settings dictionaries in the iTwin's settings container.

These methods read and write dictionaries in the underlying [SettingsDb]($backend). The dictionary name becomes the resource name, allowing multiple independent dictionaries to coexist in the same container. This mirrors the existing [IModelDb.saveSettingDictionary]($backend) / [IModelDb.deleteSettingDictionary]($backend) pattern.

#### Usage examples

Save a settings dictionary to an iTwin:

[[include:WorkspaceExamples.SaveITwinSettings]]

Read it back:

[[include:WorkspaceExamples.GetITwinWorkspace]]

Delete it:

[[include:WorkspaceExamples.DeleteITwinSetting]]

See the [Workspace documentation]($docs/learning/backend/Workspace.md) for full details.

## Display

### Fixes

- Fixed reality data geometry not being reprojected correctly when the reality data is in a different CRS than the iModel.

## Electron 41 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 41](https://www.electronjs.org/blog/electron-41-0).

## Quantity Formatting

### Reverted default metric engineering length in QuantityFormatter

The default metric engineering length format introduced in iTwin.js 5.7.0 has been reverted. Applications using [QuantityFormatter]($frontend) with [QuantityType.LengthEngineering]($frontend) will once again display metric engineering lengths in **meters with 4 decimal places** (e.g. `1000 m`) rather than millimeters.
