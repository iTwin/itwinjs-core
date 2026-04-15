---
publish: false
---
# NextVersion

## Backend

### Lightweight briefcases for server and agent workflows (`LiteBriefcaseDb`)

The backend now supports opening a V2 checkpoint as a lightweight, writable briefcase via the new [LiteBriefcaseDb]($backend) class and [OpenLiteBriefcaseArgs]($backend) interface. Unlike a traditional `BriefcaseDb`, a lite briefcase **never downloads the full iModel** to disk — blocks are streamed on demand from the cloud container. This makes it ideal for short-lived edit sessions in server and agent workflows where only a small number of targeted changes are needed and full disk space is not available or practical.

#### What's new

- **`LiteBriefcaseDb`** (`@alpha`): a new `BriefcaseDb` subclass designed for lightweight, agent-friendly edit sessions. The full iModel is never downloaded; blocks stream from a V2 checkpoint container on demand. Local writes stay in a small local cache and are never uploaded back to the checkpoint container. Changesets can be pushed to iModelHub normally.
- **`LiteBriefcaseDb.openCloud(args)`** (`@alpha`): static factory method that attaches the checkpoint container, acquires (or reuses) a briefcase ID, opens the database in read-write mode against the cloud container, and sets up SAS token refresh.
- **`OpenLiteBriefcaseArgs`** (`@alpha`): arguments interface for `openCloud`, accepting a `CheckpointProps` and an optional pre-acquired `briefcaseId`.
- **`CloudSqlite.hasLocalChanges(container)`** (`@alpha`): helper to check whether a cloud container has uncommitted local changes that have not been uploaded.
- **`V2CheckpointManager.attachForBriefcase(checkpoint)`** (`@alpha`): attaches a V2 checkpoint and returns both the `dbName` and the live `CloudContainer`, throwing if a mock container is used (mocks do not support lite briefcase mode).

#### Key characteristics

- **No full download**: only the blocks actually read during your edits are fetched from the cloud.
- **Minimal disk footprint**: local storage is limited to changed blocks and the local cache — suitable for ephemeral server/agent environments.
- **Short-lived sessions**: designed for targeted edits (seconds to minutes), not long-running or full-file access workflows.
- **Agent/server friendly**: no BCV daemon required; blocks are fetched directly from Azure Blob Storage.

#### Constraints

- Local changes **must** be pushed to iModelHub before the briefcase is closed. Any unpushed changes are lost on close or crash — `LiteBriefcaseDb.close()` logs a warning if pending transactions exist.
- The checkpoint blob container is **never** modified; this is a read-from-cloud, write-local-only pattern.
- Pull/merge operations may trigger on-demand block fetching from the cloud container.
- Not suitable for workflows that read or modify large portions of the iModel — use a traditional `BriefcaseDb` in those cases.

#### Usage

```ts
import { LiteBriefcaseDb, withEditTxn } from "@itwin/core-backend";

const db = await LiteBriefcaseDb.openCloud({
  accessToken,
  checkpoint: {
    accessToken,
    iTwinId,
    iModelId,
    changeset: { id: changesetId },
    expectV2: true,        // fail fast if no V2 checkpoint is available
    allowPreceding: true,  // accept the nearest preceding checkpoint
  },
});

// Make targeted edits — only needed blocks are fetched from the cloud
withEditTxn(db, "Add property", (txn) => {
  txn.saveFileProperty({ namespace: "MyApp", name: "key" }, "value");
});

// Push changesets to iModelHub when ready
await db.pushChanges({ accessToken, description: "My changes" });

db.close();
```

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
