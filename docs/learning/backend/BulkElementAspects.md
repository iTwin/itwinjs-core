# Bulk ElementAspect Operations

[EditTxn.insertAspects]($backend), [EditTxn.updateAspects]($backend) and [EditTxn.deleteAspects]($backend) write many [ElementAspect]($backend)s in one call. The aspects can belong to any number of elements and classes, and [ElementUniqueAspect]($backend)s and [ElementMultiAspect]($backend)s can be mixed.

They are faster than calling [EditTxn.insertAspect]($backend), [EditTxn.updateAspect]($backend) or [EditTxn.deleteAspect]($backend) once per aspect because:

- Each owning element is loaded and updated once per call, no matter how many of its aspects are written.
- Lock and channel checks run once per owning element and model.

These methods are `@beta`.

## Basic usage

```typescript
const inserted: BulkInsertElementAspectsResult = txn.insertAspects([
  { classFullName: "MySchema:MyMultiAspect", element: { id: elementId }, label: "a" },
  { classFullName: "MySchema:MyUniqueAspect", element: { id: elementId }, label: "b" },
]);
// inserted.ids[i] is the Id of the aspect inserted for row i, or Id64.invalid if row i failed.

txn.updateAspects([
  { classFullName: "MySchema:MyMultiAspect", element: { id: elementId }, id: inserted.ids[0], label: "a2" },
  { classFullName: "MySchema:MyUniqueAspect", element: { id: elementId }, label: "b2" },
]);

txn.deleteAspects([inserted.ids[0]]);
```

- `updateAspects` finds an [ElementMultiAspect]($backend) by `id`, and an [ElementUniqueAspect]($backend) by `element` and `classFullName`.
- `insertAspects` replaces an existing [ElementUniqueAspect]($backend) of the same class on the same element. If the same element and class appear more than once in a call, the last row wins.
- `deleteAspects` deletes duplicate ids once. It throws an [ITwinError]($bentley) before writing anything if an id is not a well-formed, valid [Id64String]($bentley).

## Results

Each method returns a [BulkElementAspectsResult]($backend). `insertAspects` returns a [BulkInsertElementAspectsResult]($backend), which adds `ids`.

| Field | Description |
|---|---|
| `status` | [BulkElementAspectsStatus]($backend), see below |
| `failures` | One [BulkElementAspectFailure]($backend) per failed row: its `index` in the input, an [IModelStatus]($bentley) and a `message` |
| `ids` | `insertAspects` only: the Id of the aspect inserted for each row, or `Id64.invalid` for a failed row |

| Status | Meaning |
|---|---|
| `Success` | Every row succeeded, or the input was empty. |
| `PartialSuccess` | Some rows failed. The other rows were written. |
| `Failed` | Every row failed. |
| `ValidationFailed` | Only with `FailFast`: some rows were invalid, so nothing was written. |

Common row failures:

| IModelStatus | Cause |
|---|---|
| `BadArg` | The row is not an object or has no `classFullName`. |
| `BadSchema` | `classFullName` does not name a class in the iModel, e.g. because its schema has not been imported. |
| `WrongClass` | The class exists but is not an [ElementUniqueAspect]($backend) or [ElementMultiAspect]($backend). |
| `InvalidId`, `MissingId` | The owning element id is invalid, or the element does not exist. |
| `NotFound` | The aspect to update or delete does not exist, or an updated [ElementMultiAspect]($backend) belongs to a different element than `element`. |

## Modes

By default ([BulkElementAspectsMode.BestEffort]($backend)), invalid rows are reported and the other rows are written.

With [BulkElementAspectsMode.FailFast]($backend), every row is validated first. If any row is invalid, nothing is written, no handlers are called, and the status is `ValidationFailed`. `failures` lists only the invalid rows.

```typescript
const result = txn.insertAspects(aspectProps, { mode: BulkElementAspectsMode.FailFast });
if (result.status === BulkElementAspectsStatus.ValidationFailed) {
  for (const failure of result.failures)
    console.log(`Row ${failure.index}: ${failure.message}`);
}
```

FailFast only covers validation: unknown classes, missing owning elements, and, for update and delete, aspects that are not found. A failure that only shows up while writing, such as a database error, is still reported per row with `PartialSuccess` or `Failed`, and the other rows are written.

## Handlers

Each method calls batch handlers once per aspect class:

| Method | Before writing | After writing |
|---|---|---|
| `insertAspects` | `ElementAspect.onBulkInsert` | `ElementAspect.onBulkInserted` |
| `updateAspects` | `ElementAspect.onBulkUpdate` | `ElementAspect.onBulkUpdated` |
| `deleteAspects` | `ElementAspect.onBulkDelete` | `ElementAspect.onBulkDeleted` |

`arg.aspects` lists the aspects of that class in input order. The "after" handlers only get the aspects that were written. `onBulkDelete` and `onBulkDeleted` supply the owning element of each aspect.

The default handlers call the per-aspect handlers (`onInsert`, `onInserted`, `onUpdate`, ...) for each aspect, so existing overrides still run. Override a batch handler only to replace that loop with something faster, and call `super`.

Each owning element is updated once per call, so its `onUpdated` handler (and its parent's `onChildUpdate` handler) is called once, after the aspects are written.

## Errors

- If a "before" handler throws, nothing is written and the method throws.
- If the update of an owning element or an "after" handler throws, the method throws, but aspects already written stay in the [EditTxn]($backend), as with the single-aspect methods. Call [EditTxn.abandonChanges]($backend) to discard them.

## Batch size

The caller chooses the batch size. The cost per aspect does not depend much on the size of the call, but a call holds the owning elements and the properties of all its aspects in memory at once. Batches of up to a few thousand aspects (for example, the aspects of about 1,000 elements) are recommended.

Group the aspects of one element into the same call when possible: the owning element is then updated once instead of once per call.
