# Bulk ElementAspect Operations

[EditTxn.insertAspects]($backend), [EditTxn.updateAspects]($backend) and [EditTxn.deleteAspects]($backend) write many [ElementAspect]($backend)s in one call. The aspects can belong to any number of elements and classes, and [ElementUniqueAspect]($backend)s and [ElementMultiAspect]($backend)s can be mixed.

They are faster than calling [EditTxn.insertAspect]($backend), [EditTxn.updateAspect]($backend) or [EditTxn.deleteAspect]($backend) once per aspect because:

- Each owning element is loaded and updated once per call, no matter how many of its aspects are written.
- The exclusive lock of each owning element is checked once per call, instead of once per aspect.

These methods are `@beta`.

Each operation is **all-or-nothing**: either every row is written, or - if any row is invalid - nothing is written and the invalid rows are reported.

## Basic usage

```typescript
interface MyAspectProps extends ElementAspectProps {
  label: string;
}

const rows: MyAspectProps[] = [
  { classFullName: "MySchema:MyMultiAspect", element: { id: elementId }, label: "a" },
  { classFullName: "MySchema:MyUniqueAspect", element: { id: elementId }, label: "b" },
];
const inserted: BulkInsertElementAspectsResult = txn.insertAspects(rows);
if (inserted.status === BulkElementAspectsStatus.ValidationFailed) {
  // Some rows are invalid, so nothing was written and no handlers were called.
  // Inspect inserted.failures, fix those rows, and retry.
  const details = inserted.failures.map((failure) => `row ${failure.index}: ${BulkElementAspectFailureReason[failure.reason]}`);
  throw new Error(`Invalid aspects: ${details.join(", ")}`);
}

// inserted.ids[i] is the Id of the aspect inserted for row i.
const updates: MyAspectProps[] = [
  { classFullName: "MySchema:MyMultiAspect", element: { id: elementId }, id: inserted.ids[0], label: "a2" },
  { classFullName: "MySchema:MyUniqueAspect", element: { id: elementId }, label: "b2" },
];
txn.updateAspects(updates);

txn.deleteAspects([inserted.ids[0]]);
```

- `updateAspects` finds an [ElementMultiAspect]($backend) by `id`, and an [ElementUniqueAspect]($backend) by `element` and `classFullName`. `classFullName` may name a base class of the aspect's class; only the properties of that class are updated, and the others keep their values. Rows that name the same aspect are applied in order.
- `insertAspects` replaces an existing [ElementUniqueAspect]($backend) of the same class on the same element. If the same element and class appear more than once in a call, the last row wins.
- `deleteAspects` deletes duplicate ids once. Like [EditTxn.deleteElements]($backend), it ignores ids that do not identify an aspect, such as aspects that were already deleted. It throws an [ITwinError]($bentley) before writing anything if an id is not a well-formed, valid [Id64String]($bentley).

## Results

Each method returns a [BulkElementAspectsResult]($backend). `insertAspects` returns a [BulkInsertElementAspectsResult]($backend), which adds `ids`.

| Field | Description |
|---|---|
| `status` | [BulkElementAspectsStatus]($backend): `Success` or `ValidationFailed` |
| `failures` | [BulkElementAspectFailure]($backend) entries, only populated on `ValidationFailed`: the row `index` in the input, the aspect `id` when known, and a [BulkElementAspectFailureReason]($backend) |
| `ids` | `insertAspects` only: on `Success`, the Id of the aspect inserted for each row. Empty on `ValidationFailed` |

Every row is validated before anything is modified, so `ValidationFailed` always leaves the iModel - and the current txn - untouched. `failures` lists every invalid row, in ascending index order.

| Reason | Cause |
|---|---|
| `InvalidProps` | The row is not an object, has no `classFullName`, or its properties cannot be converted to the aspect class. |
| `InvalidId` | The aspect id (for an update) or the owning element id is missing or not a valid [Id64String]($bentley), as tested by [Id64.isValidId64]($bentley). |
| `ClassNotFound` | `classFullName` does not name a class in the iModel, e.g. because its schema has not been imported. |
| `NotAnAspectClass` | The class exists but is not an [ElementUniqueAspect]($backend) or [ElementMultiAspect]($backend) class. |
| `ElementNotFound` | The owning element does not exist. |
| `AspectNotFound` | The aspect to update does not exist, is not owned by `element`, or is not of the class named by `classFullName` or a subclass of it. Also returned by `updateAspects` for an aspect class with a native handler, which cannot be updated as a generic aspect (the same limitation as [EditTxn.updateAspect]($backend)). `deleteAspects` ignores ids that do not identify an aspect instead. |

## Handlers

Each method calls batch handlers once per aspect class:

| Method | Before writing | After writing |
|---|---|---|
| `insertAspects` | `ElementAspect.onBulkInsert` | `ElementAspect.onBulkInserted` |
| `updateAspects` | `ElementAspect.onBulkUpdate` | `ElementAspect.onBulkUpdated` |
| `deleteAspects` | `ElementAspect.onBulkDelete` | `ElementAspect.onBulkDeleted` |

`arg.aspects` lists the aspects of that class in input order. `onBulkDelete` and `onBulkDeleted` supply the owning element of each aspect.

The default handlers call the per-aspect handlers (`onInsert`, `onInserted`, `onUpdate`, ...) for each aspect, so existing overrides still run. Override a batch handler only to replace that loop with something faster, and call `super`.

Each owning element is updated once per call, so its `onUpdated` handler and its parent's `onChildUpdate` and `onChildUpdated` handlers are called once per element, not once per aspect. They are called at the same points as with the single-aspect methods: the parent's `onChildUpdate` and the element's `onUpdated` run before the element's aspects are written or deleted, and the parent's `onChildUpdated` runs after. Owning elements are updated one after the other, so when the element's `onUpdated` runs, the aspects of the elements updated before it have already been written or deleted. To act on the outcome of the whole call, use the "after" aspect handlers (`onBulkInserted`, `onBulkUpdated`, `onBulkDeleted`, or the per-aspect handlers they call), which run once every aspect has been written or deleted.

## Errors

- If a "before" handler throws, nothing is written and the method throws.
- If a write fails unexpectedly (e.g. a SQLite error), the method throws an [IModelError]($common) and no "after" handlers are called.
- If a write, the update of an owning element or an "after" handler fails, aspects already written stay in the [EditTxn]($backend), as with the single-aspect methods. Call [EditTxn.abandonChanges]($backend) to discard them.

## Batch size

The caller chooses the batch size. The cost per aspect does not depend much on the size of the call, but a call holds the owning elements and the properties of all its aspects in memory at once. Batches of up to a few thousand aspects (for example, the aspects of about 1,000 elements) are recommended.

Group the aspects of one element into the same call when possible: the owning element is then updated once instead of once per call.
