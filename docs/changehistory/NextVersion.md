---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-bentley](#itwincore-bentley)
    - [BeUnorderedEvent](#beunorderedevent)
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
    - [Quantity Formatter improvements](#quantity-formatter-improvements)
      - [New APIs](#new-apis-1)
        - [`@itwin/core-quantity`](#itwincore-quantity)
        - [`@itwin/core-frontend`](#itwincore-frontend)
      - [Bug fixes](#bug-fixes)
      - [Behavioral changes](#behavioral-changes)

## @itwin/core-bentley

### BeUnorderedEvent

**`BeUnorderedEvent<T>`** and **`BeUnorderedUiEvent<T>`** are new Set-backed event classes where listeners can safely add or remove themselves during event emission. Useful for patterns where many independent subscribers need to react to the same event without worrying about concurrent modification.

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

### Quantity Formatter improvements

#### New APIs

##### `@itwin/core-quantity`

- **`Units` namespace** — Typed constants for commonly used unit names (e.g., `Units.M`, `Units.FT`, `Units.RAD`). Eliminates magic strings when referencing units programmatically.
- **`findPersistenceUnitForPhenomenon()`** — Maps phenomenon names to their canonical SI persistence unit.
- **`FormatsChangedArgs.impliedUnitSystem`** — Allows a `FormatsProvider` to indicate which unit system its format set implies.

##### `@itwin/core-frontend`

- **[QuantityFormatter.onBeforeFormattingReady]($frontend)** — Pre-ready event that fires before [onFormattingReady]($frontend). Providers use it to register async work (e.g., loading domain formats) via the [FormattingReadyCollector]($quantity) passed to listeners. The formatter awaits all pending work (with a 10-second timeout) before emitting `onFormattingReady`.
- **[FormattingReadyCollector]($quantity)** — Collector class passed to `onBeforeFormattingReady` listeners. Call `addPendingWork(promise)` to register async work that must complete before the formatter is considered ready.
- **[QuantityFormatter.onFormattingReady]($frontend)** — Terminal "ready" signal that fires after every reload path completes and all `onBeforeFormattingReady` work has settled. Subscribe to this event to know when formatting specs are available.
- **[QuantityFormatter.onFormattingReadyUnordered]($frontend)** — Unordered variant using `BeUnorderedUiEvent` (Set-backed) for safe concurrent modification.
- **[QuantityFormatter.isReady]($frontend)** — Synchronous check for whether the formatter is ready.
- **[QuantityFormatter.whenInitialized]($frontend)** — One-shot promise that resolves after the first successful initialization.
- **[FormatSpecHandle]($frontend)** — Cacheable handle to formatting specs that auto-refreshes on reload. Created via `QuantityFormatter.getFormatSpecHandle()`. Now accepts an optional `system` parameter to pin the handle to a specific unit system.
- **[QuantityFormatter.getFormatSpecHandle]($frontend)** — Factory for `FormatSpecHandle` instances. Now accepts an optional `system` parameter.
- **[QuantityFormatter.getSpecsByNameAndUnit]($frontend)** — Now accepts a single [FormattingSpecArgs]($quantity) object with `name`, `persistenceUnitName`, and an optional `system` to retrieve specs for a specific unit system instead of only the active system.
- **[QuantityFormatter.addFormattingSpecsToRegistry]($frontend)** — Now accepts an optional `system` parameter to register specs for a specific unit system.
- **`FormatsProvider.getFormat(name, system?)`** — Optional `system` parameter for per-system KindOfQuantity format resolution.

#### Bug fixes

- **Fixed listener leak in `FormatsProviderManager`** — Replacing `IModelApp.formatsProvider` multiple times no longer stacks listeners. Old listeners are properly removed before new ones are added.

#### Behavioral changes

- **Three-level spec registry** — `_formatSpecsRegistry` is now keyed by KoQ name, persistence unit, and unit system (`[koqName][persistenceUnit][unitSystem]`). The same KoQ with different persistence units or different unit systems can coexist. This is a **protected member type change** — subclasses accessing this field directly will need to update.
- **`getSpecsByName()` return type changed** — Now returns `Map<string, FormattingSpecEntry> | undefined` instead of `FormattingSpecEntry | undefined`.
- **Two-phase ready flow** — Formatting readiness now follows a two-phase pattern: `onBeforeFormattingReady` fires first (providers register async work via the collector), and the formatter awaits all pending work with a 10-second timeout before emitting `onFormattingReady`. Rejections are logged as warnings but do not prevent the formatter from becoming ready.

For detailed usage documentation and code examples, see [QuantityFormatter Lifecycle & Integration](../quantity-formatting/usage/QuantityFormatterAdvanced.md).
