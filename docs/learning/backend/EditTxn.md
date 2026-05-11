# EditTxn: Explicit Editing Transactions

## Fast migration path

If you already know the existing write APIs and just need to keep shipping, do this first:

1. Wrap each write workflow in [withEditTxn]($backend).
2. Replace deprecated write calls with txn-first overloads.
3. Use `txn.saveChanges(...)` only when you want an intermediate commit and keep writing in the same transaction scope.
4. If you are using direct `EditTxn` (not [withEditTxn]($backend)), use `txn.end("save")` to finish, or `txn.end("abandon")` to discard pending edits.
5. In dependency callbacks, use the callback argument's `indirectEditTxn` instead of creating a new transaction.

## Old API to new API mapping

| Existing pattern | EditTxn pattern |
| --- | --- |
| `element.insert()` | `element.insert(txn)` |
| `element.update()` | `element.update(txn)` |
| `element.delete()` | `element.delete(txn)` |
| `iModel.saveChanges("desc")` | `txn.saveChanges("desc")` |
| `iModel.abandonChanges()` | `txn.abandonChanges()` |
| `Model.insert(...)` | `Model.insert(txn, ...)` |
| `Relationship.insert(...)` | `Relationship.insert(txn, ...)` |

When possible, start with [withEditTxn]($backend) and migrate call sites one workflow at a time.

## Background

SQLite executes reads and writes within transactions. A read transaction sees a stable view of the database until that read transaction ends, so commits made by other connections are not visible until the next transaction starts.

iTwin.js builds on top of that behavior. Each [IModelDb]($backend) has a native-managed implicit transaction that keeps query behavior consistent even when another connection changes the file.

Historically, legacy write APIs also used that implicit transaction. That made writing convenient, but it could blur transaction boundaries: unrelated edits could accumulate into one unit of work and then be saved or undone together.

## Why EditTxn

[EditTxn]($backend) introduces explicit transaction boundaries so callers can define a deliberate unit of work:

- Start editing when you intend to begin the unit of work.
- Make one or more changes through that transaction.
- Save or abandon that exact scope.

This improves clarity and reduces accidental coupling between unrelated edits.

It also makes undo behavior more predictable. Without explicit boundaries, unrelated edits can be combined into the same implicit unit of work, and a later undo can reverse those combined changes unexpectedly.

## Migration model

Migration is incremental:

- Legacy implicit-write APIs remain available during the transition and are deprecated in favor of explicit APIs.
- New write paths should use explicit [EditTxn]($backend) APIs.
- Existing code can migrate call sites gradually to txn-first overloads or [withEditTxn]($backend).

The target end state is explicit write transactions for all writes, with the implicit transaction used only for read behavior.

### Temporary deprecation-lint containment

If this change introduces too many deprecation lint errors at once, you can temporarily silence specific call sites while you keep shipping.

Prefer narrow suppression on individual lines and always add a TODO marker you can search for later.

```ts
// TODO(EditTxn-migration): replace with insert(txn)/withEditTxn
// eslint-disable-next-line deprecation/deprecation
element.insert();
```

For short migration windows, you can suppress a small block, but keep the TODO scoped and explicit.

```ts
/* TODO(EditTxn-migration): remove suppression after migrating this workflow.
eslint-disable deprecation/deprecation */
legacyWriteFlow(iModel);
/* eslint-enable deprecation/deprecation */
```

Recommended follow-up:

1. Track these TODOs in a migration issue or backlog item.
2. Search for `TODO(EditTxn-migration)` before release and remove suppressions as call sites are migrated.

## Common failure modes

- Transaction is not active: start the transaction (`txn.start()`) before writing, or use [withEditTxn]($backend).
- Another transaction is active: only one explicit transaction can be active per iModel at a time.
- Unsaved changes exist before `start()`: in practice this usually means legacy implicit-write APIs have already produced pending changes on the iModel; save or abandon those changes before starting a new explicit transaction.
- In indirect dependency callbacks, a new transaction is created instead of reusing the callback transaction: use the callback argument's `indirectEditTxn`.

## implicitWriteEnforcement

[EditTxn.implicitWriteEnforcement]($backend), initialized from [IModelHostOptions.implicitWriteEnforcement]($backend), controls how legacy implicit writes behave while you migrate:

1. `allow`: keep implicit writes working.
2. `log`: allow implicit writes but log `implicit-txn-write-disallowed` errors to help identify remaining migration work.
3. `throw`: reject implicit writes and require explicit [EditTxn]($backend) usage.

`log` can be noisy in applications that have not started migration, because each implicit write path emits an error log.

## Indirect change callbacks

During indirect dependency processing callbacks (for example relationship callbacks), use the callback argument's `indirectEditTxn` to access the active transaction for that scope.

## Examples

### Recommended scoped pattern with `withEditTxn`

```ts
withEditTxn(iModel, "Create model contents", (txn) => {
	const modelId = PhysicalModel.insert(txn, parentSubjectId, "My Model");
	const element = MySpatialElement.create({ model: modelId, category, code }, iModel);
	element.insert(txn);
});
```

This is the preferred migration pattern for most existing write workflows.

### More complete `withEditTxn` flow

```ts
await withEditTxn(iModel, { description: "Import external source", source: "my-importer" }, async (txn) => {
	// Create or find prerequisites in the same transaction scope.
	const modelId = PhysicalModel.insert(txn, parentSubjectId, "Imported Model");

	// Insert several related entities; all are part of one unit of work.
	for (const row of importedRows) {
		const element = MySpatialElement.create({ model: modelId, category, code: row.code }, iModel);
		element.insert(txn);
	}

	// You can make additional writes after async work.
	const metadataElement = MyImportMetadata.create({ model: modelId, summary: importedRows.length }, iModel);
	metadataElement.insert(txn);
});
// If the callback succeeds, changes are saved.
// If it throws, withEditTxn abandons the transaction and re-throws.
```

Assume `parentSubjectId`, `category`, and `importedRows` are already resolved by your workflow.

### Direct `EditTxn` usage

```ts
const txn = new EditTxn(iModel, "Create model contents");
txn.start();

const modelId = PhysicalModel.insert(txn, parentSubjectId, "My Model");
txn.saveChanges("Saved first batch"); // Commits current edits and keeps this EditTxn active.

const element = MySpatialElement.create({ model: modelId, category, code }, iModel);
element.insert(txn);

txn.end("save", "Saved second batch and closed transaction");
```

## How EditCommand uses EditTxn

In editing workflows, backend [EditCommand]($editor-backend) uses [EditTxn]($backend) as its write surface.

- Each command instance creates its own `EditTxn`.
- `beginEditing()` starts the command transaction.
- Command writes are expected to use that transaction (`this.txn`) so edits stay grouped by command source.
- `saveChanges()` on the command commits pending edits but keeps the command transaction active.
- `endEdits()` saves and ends the transaction; `abandonEdits()` abandons and ends it.

This pattern helps keep an editing session coherent by ensuring one active command owns one active transaction scope at a time.

### EditCommand migration checklist

1. Call `beginEditing()` before the first write.
2. Route all writes through `this.txn`.
3. Use `saveChanges()` for intermediate checkpoints when needed.
4. Call `endEdits()` when work completes successfully.
5. Call `abandonEdits()` when work is cancelled or invalid.

## Related APIs

- [EditTxn]($backend)
- [withEditTxn]($backend)
- [OnDependencyArg]($backend)
- [OnElementDependencyArg]($backend)
- [IModelHostOptions.implicitWriteEnforcement]($backend)
- [EditCommand]($editor-backend)

## References

- https://www.sqlite.org/lang_transaction.html
- https://www.sqlite.org/isolation.html
