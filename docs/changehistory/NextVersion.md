---
publish: false
---
# NextVersion

## Backend

### Explicit editing transactions with `EditTxn`

The backend now provides [EditTxn]($backend) as the preferred way to perform writes to an iModel. This introduces an explicit transaction boundary around a unit of work: start editing, make one or more changes through the transaction, and then either save or abandon that scope.

This change is meant to replace the long-standing implicit write pattern in which APIs that add, delete, or modify database content wrote through an always-available transaction owned by the iModel. That implicit model remains available for backwards compatibility during migration, but all legacy APIs that add, delete, or modify database content are now deprecated in favor of new `WithTxn` methods and helper APIs built around [EditTxn]($backend).

#### What changed

- New explicit-write APIs are available across backend editing surfaces, including elements, models, relationships, aspects, file properties, etc.
- Existing implicit-write APIs remain available for now, and all are now marked `@deprecated` and point to `WithTxn` replacements.
- [withEditTxn]($backend) provides a convenient scoped wrapper that starts an [EditTxn]($backend), passes it to a callback, saves on success, and abandons on failure.
- [IModelDb.getIndirectChangesTxn]($backend) can be used inside indirect-change callbacks, such as relationship dependency propagation, to obtain the active [EditTxn]($backend) for that callback scope.

#### Migration guidance

When updating existing code:

1. Replace calls to legacy APIs that add, delete, or modify database content (for example `insert()`, `update()`, `delete()`, `saveChanges()`, and container-specific insert/update/delete helpers) with their `WithTxn` equivalents.
2. Group related edits into a single [EditTxn]($backend) so they succeed or fail together.
3. Prefer [withEditTxn]($backend) for new code unless manual `start()` / `end()` control is necessary.
4. If code runs inside indirect dependency processing callbacks, use [IModelDb.getIndirectChangesTxn]($backend) for indirect changes.

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
	const modelId = PhysicalModel.insertWithTxn(txn, parentSubjectId, "My Model");
	const element = MySpatialElement.create({ model: modelId, category, code }, iModel);
	element.insertWithTxn(txn);
});
```
A single [EditTxn]($backend) can create multiple saved transactions, because `txn.saveChanges` does not end the transaction:

```ts
const txn = new EditTxn(iModel, "Create model contents");
txn.start();

const modelId = PhysicalModel.insertWithTxn(txn, parentSubjectId, "My Model");
txn.saveChanges("Saved first batch"); // Commits current edits and keeps this EditTxn active.

const element = MySpatialElement.create({ model: modelId, category, code }, iModel);
element.insertWithTxn(txn);

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

