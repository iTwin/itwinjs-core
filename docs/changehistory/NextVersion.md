---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-bentley](#itwincore-bentley)
    - [BeUnorderedEvent](#beunorderedevent)
  - [@itwin/core-backend](#itwincore-backend)
    - [WithQueryReader API](#withqueryreader-api)
    - [Bulk element deletion with `deleteElements`](#bulk-element-deletion-with-deleteelements)
    - [Dedicated SettingsDb for workspace settings](#dedicated-settingsdb-for-workspace-settings)
      - [Why SettingsDb?](#why-settingsdb)
      - [New APIs](#new-apis)
      - [Usage examples](#usage-examples)
        - [Creating a local SettingsDb](#creating-a-local-settingsdb)
      - [Container type convention](#container-type-convention)
      - [Container separation and lock isolation](#container-separation-and-lock-isolation)
  - [Backend](#backend)
    - [Explicit editing transactions with `EditTxn`](#explicit-editing-transactions-with-edittxn)
      - [What changed](#what-changed)
      - [Migration guidance](#migration-guidance)
      - [`implicitWriteEnforcement`](#implicitwriteenforcement)
    - [iTwin settings workspace](#itwin-settings-workspace)
      - [New APIs](#new-apis-1)
      - [Usage examples](#usage-examples-1)
      - [Configuration requirements](#configuration-requirements)
  - [Quantity Formatting](#quantity-formatting)
    - [Quantity Formatter improvements](#quantity-formatter-improvements)
      - [New APIs](#new-apis-2)
        - [`@itwin/core-quantity`](#itwincore-quantity)
        - [`@itwin/core-frontend`](#itwincore-frontend)
      - [Bug fixes](#bug-fixes)
      - [Behavioral changes](#behavioral-changes)

## @itwin/core-bentley

### BeUnorderedEvent

**`BeUnorderedEvent<T>`** and **`BeUnorderedUiEvent<T>`** are new Set-backed event classes where listeners can safely add or remove themselves during event emission. Useful for patterns where many independent subscribers need to react to the same event without worrying about concurrent modification.

**Closure-only unsubscription:** Unlike [BeEvent]($bentley), `BeUnorderedEvent` does not expose `has()` or `removeListener()`. The only way to unsubscribe is to call the closure returned by `addListener()` or `addOnce()`:

```typescript
const remove = myEvent.addListener((args) => { /* ... */ });
// later:
remove(); // O(1) removal
```

This is intentional — it avoids a class of bugs where `removeListener()` silently fails to match due to inline closures or binding mismatches (e.g. `event.addListener(() => this.onFoo())` followed by `event.removeListener(() => this.onFoo())` removes nothing because the two arrow functions are different objects). Capturing the returned closure is a reliable unsubscription pattern and enables O(1) removal via `Set.delete`.

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

### Bulk element deletion with `deleteElements`

[EditTxn.deleteElements]($backend) is a new `@beta` API that efficiently deletes many elements in a single native operation when removing trees of elements, partitions, or mixes of ordinary and definition elements.
It is intended as the preferred replacement for [EditTxn.deleteElement]($backend)

**What it does that `deleteElement` does not:**

- Automatically cascades into the full parent-child subtree of every requested element — you only need to pass root IDs.
- Cascades into sub-models: deleting a partition element also removes the entire sub-model and all elements inside it.
- Handles intra set constraint violations without failing.
- Handles `DefinitionElement` usage checks inline — no need to call `deleteDefinitionElements` separately.
- Returns a `Id64Set` of IDs that **could not** be deleted due to constraint violations (e.g. code-scope dependencies held by elements outside the delete set), rather than throwing.
- Better performance when deleting elements in bulk.

**Basic usage:**

```typescript
const failed: Id64Set = txn.deleteElements([idA, idB, idC]);
if (failed.size > 0) {
  // These elements were blocked by an integrity constraint — inspect `failed` to decide how to proceed.
}
```

See [Bulk Element Deletion]($docs/learning/backend/BulkElementDeletion.md) for full documentation including constraint violation details and lifecycle callback behavior.

### Dedicated SettingsDb for workspace settings

A new [SettingsDb]($backend) type has been added to the workspace system, providing a dedicated database for storing JSON settings as key-value pairs, separate from general-purpose [WorkspaceDb]($backend) resource storage.

#### Why SettingsDb?

Previously, settings and binary resources (fonts, textures, templates) were stored together in `WorkspaceDb` containers. This coupling created issues:

- **Lookup**: Finding which containers hold settings required opening each one
- **Granularity**: Settings updates required republishing entire containers with large binary resources
- **Separation of concerns**: Settings (JSON key-value) and resources (binary blobs) have different access patterns

#### New APIs

- [SettingsDb]($backend): Read-only interface with `getSetting()` and `getSettings()` for accessing settings stored in a dedicated database
- `EditableSettingsDb`: Write interface with `updateSetting()`, `removeSetting()`, and `updateSettings()` for modifying settings within a SettingsDb
- [SettingsEditor]($backend): Write interface for creating and managing SettingsDb containers
- `Workspace.getSettingsDb`: Method to open a SettingsDb from a previously-loaded container by its `containerId` and desired priority

#### Usage examples

See [SettingsDb]($docs/learning/backend/Workspace.md#settingsdb) for full documentation.

#### Container type convention

SettingsDb containers use `containerType: "settings"` in their cloud metadata, enabling them to be discovered independently of any iModel.

#### Container separation and lock isolation

Settings containers are deliberately separate from workspace containers. Both extend the new [CloudSqliteContainer]($backend) base interface, but `EditableSettingsCloudContainer` does not extend [WorkspaceContainer]($backend). This means:

- **Independent write locks**: Editing settings does not lock out workspace resource editors, and vice versa.
- **Clean API surface**: Settings containers do not inherit workspace-db read/write methods (`getWorkspaceDb`, `addWorkspaceDb`, etc.), exposing only settings-specific operations.
- **Type safety**: Code that receives an `EditableSettingsCloudContainer` cannot accidentally add or retrieve `WorkspaceDb`s from it.

## Backend

### Explicit editing transactions with `EditTxn`

The backend now provides [EditTxn]($backend) as the preferred way to perform writes to an iModel. This introduces an explicit transaction boundary around a unit of work: start editing, make one or more changes through the transaction, and then either save or abandon that scope.

This change is meant to replace the long-standing implicit write pattern in which APIs that add, delete, or modify database content wrote through an always-available transaction owned by the iModel. That implicit model remains available for backwards compatibility during migration, but all legacy APIs that add, delete, or modify database content are now deprecated in favor of txn-first overloads and helper APIs built around [EditTxn]($backend).

#### What changed

- New explicit-write APIs are available across backend editing surfaces, including elements, models, relationships, aspects, file properties, etc.
- Existing implicit-write APIs remain available for now, and all are now marked `@deprecated` and point to txn-first replacements.
- [withEditTxn]($backend) provides a convenient scoped wrapper that starts an [EditTxn]($backend), passes it to a callback, saves on success, and abandons on failure.
- Indirect-change callbacks now receive the active [EditTxn]($backend) via callback args (`indirectEditTxn`), such as [OnDependencyArg]($backend) and [OnElementDependencyArg]($backend).

#### Migration guidance

When updating existing code:

1. Replace calls to legacy APIs that add, delete, or modify database content (for example `insert()`, `update()`, `delete()`, `saveChanges()`, and container-specific insert/update/delete helpers) with the corresponding txn-first overloads.
2. Group related edits into a single [EditTxn]($backend) so they succeed or fail together.
3. Prefer [withEditTxn]($backend) for new code unless manual `start()` / `end()` control is necessary.
4. If code runs inside indirect dependency processing callbacks, use the callback argument's `indirectEditTxn` for indirect changes.

Before:

```ts
const modelId = PhysicalModel.insert(iModel, parentSubjectId, "My Model");
const element = MySpatialElement.create({ model: modelId, category, code }, iModel);
element.insert();
iModel.saveChanges("Create model contents");
```

After:

```ts
withEditTxn(iModel, "Create model contents", (txn) => {
const modelId = PhysicalModel.insert(txn, parentSubjectId, "My Model");
const element = MySpatialElement.create({ model: modelId, category, code }, iModel);
element.insert(txn);
});
```
A single [EditTxn]($backend) can create multiple saved transactions, because `txn.saveChanges` does not end the transaction:

```ts
const txn = new EditTxn(iModel, "Create model contents");
txn.start();

const modelId = PhysicalModel.insert(txn, parentSubjectId, "My Model");
txn.saveChanges("Saved first batch"); // Commits current edits and keeps this EditTxn active.

const element = MySpatialElement.create({ model: modelId, category, code }, iModel);
element.insert(txn);

txn.end("save", "Saved second batch and closed transaction");
```

#### `implicitWriteEnforcement`

[EditTxn.implicitWriteEnforcement]($backend) and [IModelHostOptions.implicitWriteEnforcement]($backend) control how legacy implicit writes behave while callers migrate:

| Value | Behavior |
| ----- | -------- |
| `"allow"` | Preserve existing behavior and allow implicit writes. |
| `"log"` | Allow implicit writes, but emit `implicit-txn-write-disallowed` errors to help inventory remaining migration work. |
| `"throw"` | Reject implicit writes and require explicit [EditTxn]($backend) usage. |

These levels are intended to support incremental adoption. Applications can start with `"allow"`, move to `"log"` to discover remaining legacy paths, and then switch to `"throw"` once those call sites have been migrated.

For more guidance and additional examples, see [EditTxn transaction model and migration guidance](../learning/backend/EditTxn.md).

### iTwin settings workspace

*Applications* can now store and load named settings dictionaries in an iTwin-scoped workspace, separate from iModel-level settings so the same values can be shared across iModels in that iTwin.

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

#### Configuration requirements

To use iTwin-scoped settings dictionaries, configure [IModelHost.authorizationClient]($backend) and [BlobContainer.service]($backend) so the backend can query and update the iTwin settings workspace container.

See the [Workspace documentation]($docs/learning/backend/Workspace.md) for full details.

## Quantity Formatting

### Quantity Formatter improvements

#### New APIs

##### `@itwin/core-quantity`

- **`Units` namespace** — Typed constants for commonly used unit names (e.g., `Units.M`, `Units.FT`, `Units.RAD`). Eliminates magic strings when referencing units programmatically.
- **`findPersistenceUnitForPhenomenon()`** — Maps phenomenon names to their canonical SI persistence unit.
- **`FormatsChangedArgs.impliedUnitSystem`** — Allows a `FormatsProvider` to indicate which unit system its format set implies.

##### `@itwin/core-frontend`

- **[QuantityFormatter.onBeforeFormattingReady]($frontend)** — Pre-ready event that fires before [QuantityFormatter.onFormattingReady]($frontend). Providers use it to register async work (e.g., loading domain formats) via the [FormattingReadyCollector]($quantity) passed to listeners. The formatter awaits all pending work (with a 20-second default timeout) before emitting `onFormattingReady`.
- **[FormattingReadyCollector]($quantity)** — Collector class passed to `onBeforeFormattingReady` listeners. Call `addPendingWork(promise)` to register async work that must complete before the formatter is considered ready.
- **[QuantityFormatter.onFormattingReady]($frontend)** — Terminal "ready" signal that fires after every reload path completes and all `onBeforeFormattingReady` work has settled. Uses `BeUnorderedUiEvent` (Set-backed) for safe concurrent modification and O(1) unsubscription.
- **[QuantityFormatter.isReady]($frontend)** — Synchronous check for whether the formatter is ready.
- **[QuantityFormatter.whenInitialized]($frontend)** — One-shot promise that resolves after the first successful initialization.
- **[FormatSpecHandle]($quantity)** — Cacheable handle to formatting specs that auto-refreshes on reload. Created via `QuantityFormatter.getFormatSpecHandle()`. Now accepts an optional `system` parameter to pin the handle to a specific unit system.
- **[QuantityFormatter.getFormatSpecHandle]($frontend)** — Factory for `FormatSpecHandle` instances. Now accepts an optional `system` parameter.
- **[QuantityFormatter.getSpecsByNameAndUnit]($frontend)** — Now accepts a single [FormattingSpecArgs]($quantity) object with `name`, `persistenceUnitName`, and an optional `system` to retrieve specs for a specific unit system instead of only the active system.
- **[QuantityFormatter.addFormattingSpecsToRegistry]($frontend)** — Now accepts an optional `system` parameter to register specs for a specific unit system.
- **`FormatsProvider.getFormat(name, system?)`** — Optional `system` parameter for per-system KindOfQuantity format resolution.

#### Bug fixes

- **Fixed listener leak in `FormatsProviderManager`** — Replacing `IModelApp.formatsProvider` multiple times no longer stacks listeners. Old listeners are properly removed before new ones are added.

#### Behavioral changes

- **Three-level spec registry** — `_formatSpecsRegistry` is now keyed by KoQ name, persistence unit, and unit system (`[koqName][persistenceUnit][unitSystem]`). The same KoQ with different persistence units or different unit systems can coexist. This is a **protected member type change** — subclasses accessing this field directly will need to update.
- **`getSpecsByName()` return type changed** — Now returns `Map<string, FormattingSpecEntry> | undefined` instead of `FormattingSpecEntry | undefined`.
- **Two-phase ready flow** — Formatting readiness now follows a two-phase pattern: `onBeforeFormattingReady` fires first (providers register async work via the collector), and the formatter awaits all pending work with a 20-second default timeout before emitting `onFormattingReady`. Rejections are logged as warnings but do not prevent the formatter from becoming ready.

For detailed usage documentation and code examples, see [QuantityFormatter Lifecycle & Integration](../quantity-formatting/usage/QuantityFormatterAdvanced.md).
