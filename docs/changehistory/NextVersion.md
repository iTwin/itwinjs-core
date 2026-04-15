---
publish: false
---
# NextVersion

## Backend

### [ECChangesetReader]($backend) — native EC-typed changeset reader

The new [ECChangesetReader]($backend) (`@beta`) provides a lower-level, higher-fidelity replacement for the deprecated `ChangesetECAdaptor` / `SqliteChangesetReader` stack. It reads EC-typed change data natively from a changeset file, a group of changeset files, a saved transaction, or local un-pushed changes, and emits one typed [ECNativeChangeInstance]($backend) per SQLite table row.

The companion [ECNativePartialChangeUnifier]($backend) merges the per-table partial rows back into complete EC instances that span all tables mapped to a single EC entity.

#### Reader factory methods

| Method | Description |
| ------ | ----------- |
| [ECChangesetReader.openFile]($backend) | Read a single pushed changeset file |
| [ECChangesetReader.openGroup]($backend) | Read several changeset files as one logical stream |
| [ECChangesetReader.openLocalChanges]($backend) | Read pending (not yet pushed) local changes |
| [ECChangesetReader.openInMemoryChanges]($backend) | Read in-memory (not yet saved) changes |
| [ECChangesetReader.openTxn]($backend) | Read a single saved transaction by id |

#### Example — inspect inserted elements from a changeset file

```ts
import { ECChangesetReader, ECNativePartialChangeUnifier, ECNativeChangeUnifierCache } from "@itwin/core-backend";

using reader = ECChangesetReader.openFile({ db: iModelDb, fileName: changesetPathname });
using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());

while (reader.step()) {
  pcu.appendFrom(reader);
}

for (const instance of pcu.instances) {
  if (instance.$meta.op === "Inserted") {
    console.log(instance.ECInstanceId, iModelDb.getClassNameFromId(instance.ECClassId));
  }
}
```

#### Example — filter to a specific table and inspect raw per-row values

```ts
using reader = ECChangesetReader.openFile({ db: iModelDb, fileName: changesetPathname });

reader.setOpCodeFilters(new Set(["Updated"]));

while (reader.step()) {
  if (reader.tableName !== "bis_Element")
    continue;
  const before = reader.deleted; // pre-change snapshot
  const after  = reader.inserted; // post-change snapshot
  if (before && after) {
    console.log(`Element ${after.ECInstanceId}: model changed from ${before.Model?.Id} → ${after.Model?.Id}`);
  }
}
```

When a row does not match an active filter it is skipped entirely — the reader automatically advances to the next row.

[ECChangesetReader.deleted]($backend) and [ECChangesetReader.inserted]($backend) carry an `$meta.changeFetchedPropNames` set that lists exactly which properties were read directly from the changeset binary (vs. resolved from the live iModel), making it straightforward to determine what actually changed.

For a full explanation of the reader–unifier pipeline, modes, row options, and filtering APIs, see [ECChangesetReader](../learning/backend/ECChangesetReader.md).

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
