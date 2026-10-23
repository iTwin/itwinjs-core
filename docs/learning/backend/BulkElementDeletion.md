# Bulk Element Deletion

[EditTxn.deleteElements]($backend) provides an efficient way to delete many elements in one call. `deleteElements` expands parent-child hierarchies, cascades into sub-models, checks and prunes constraint violators, fires lifecycle callbacks, NULLs dangling non-constraint references, and cleans up link-table relationships - all in a single native operation.

## Basic usage

Pass an array of element IDs to delete. The method returns a [BulkDeleteElementsResult]($backend) that describes the outcome: which elements were deleted, which could not be deleted due to integrity constraints, and the overall status.

```typescript
const result: BulkDeleteElementsResult = txn.deleteElements([idA, idB, idC]);

switch (result.status) {
  case BulkDeleteElementsStatus.Success:
    // All requested elements were deleted.
    break;
  case BulkDeleteElementsStatus.PartialSuccess:
    // RemoveFKViolators mode only: some elements were deleted, others were blocked - inspect result.failures.
    for (const failure of result.failures)
      console.log(`Could not delete ${failure.elementId}: ${BulkDeleteFailureReason[failure.reason]} ${failure.detail ?? ""}`);
    break;
  case BulkDeleteElementsStatus.ConstraintViolation:
    // FailFast mode only: at least one element is still referenced, so nothing was deleted - inspect result.failures.
    console.log(`Bulk delete failed due to constraint violations in:\n`);
    for (const failure of result.failures)
      console.log(`${failure.elementId}: ${BulkDeleteFailureReason[failure.reason]} ${failure.detail ?? ""}\n`);
    break;
  case BulkDeleteElementsStatus.DeletionFailed:
    // An unexpected SQLite error occurred (see result.sqlDeleteStatus). The iModel may be partially modified:
    // abandon the current txn.
    break;
}
```

The `result` object has these fields:

| Field | Description |
|---|---|
| `status` | [BulkDeleteElementsStatus]($backend): `Success`, `PartialSuccess`, `ConstraintViolation` or `DeletionFailed` |
| `failures` | [BulkDeleteFailure]($backend) entries: the element, a [BulkDeleteFailureReason]($backend) (`ReferencedByForeignKey`, `DefinitionInUse`, `BlockedByRelative`) and a `detail` (the referencing `table.column`, or the id of the blocking relative) |
| `sqlDeleteStatus` | Raw `DbResult` from the underlying SQL DELETE statement; only meaningful for `DeletionFailed` |
| `failedIds` | _Deprecated._ The unique set of element ids appearing in `failures` |

## Delete modes

[BulkDeleteElementsArgs.deleteMode]($backend) controls what happens when an element in the delete set is still referenced from outside the set:

| Mode | Behaviour |
|---|---|
| `RemoveFKViolators` (current default) | Best effort. Violators and their logical subtree inside the set are skipped; everything else is deleted. Status is `PartialSuccess` when anything was skipped. |
| `FailFast` | All-or-nothing. If any violator exists, nothing is deleted and the status is `ConstraintViolation`. |

```typescript
const result = txn.deleteElements(ids, { deleteMode: BulkDeleteMode.FailFast });
```

> The default will change to `FailFast` in a future release. Pass `deleteMode` explicitly to be insulated from that change.

In both modes the validation pass runs before anything is modified, so `PartialSuccess` and `ConstraintViolation` always leave the iModel in a consistent state.

You do **not** need to call [EditTxn.deleteDefinitionElements]($backend) for DefinitionElements. `deleteElements` handles both ordinary elements and DefinitionElements and performs the same usage checks for definitions.
The only behavioral difference is that `deleteDefinitionElements` silently ignores non-definition elements in the input, whereas `deleteElements` will attempt to delete everything it can.

## What gets deleted

### Child elements - automatic cascade

You only need to supply root IDs. `deleteElements` recursively walks every element's parent-child tree and includes all descendants in the delete set automatically. Passing a child that is already a descendant of another element in the input is safe; the duplicate element is de-duplicated internally.

```typescript
// Deleting a parent automatically removes all of its children and grandchildren.
txn.deleteElements([parentId]);
```

### Sub-models - automatic cascade

If a deleted element is the modeled element of a sub-model (i.e., it is a _partition element_ or any element that acts as a model root), the entire sub-model, including every element inside it is also deleted. The corresponding `Model` row is removed as well.

```typescript
// Deleting a partition deletes its PhysicalModel and all elements inside that model.
txn.deleteElements([partitionId]);
```

### DefinitionElements

DefinitionElements (categories, subcategories, geometry parts, render materials, textures, display styles, view definitions, etc.) can only be deleted when they are no longer referenced by elements outside the delete set. `deleteElements` performs the necessary usage checks automatically. Definition elements that are still in use outside the delete set are excluded from deletion and returned in the failed set.

Importantly, _intra-set_ usages are resolved correctly: if element A references element B and both are in the input, neither blocks the other.

```typescript
// Delete a ViewDefinition together with the CategorySelector, ModelSelector and DisplayStyle it owns - all intra-set references are resolved automatically.
txn.deleteElements([viewId, categorySelectorId, modelSelectorId, displayStyleId]);
```

## Constraint violations

An element is a _constraint violator_ and will **not** be deleted (neither will its subtree) if, after removing intra-set references, any of the following are true for elements **outside** the delete set:

| Constraint | Blocked element |
|---|---|
| Another element uses this element as its **CodeScope** | The code-scope element (and its subtree as well as all its ancestors up to the highest element present in the delete set) |
| A `GeometricElement3d` or `GeometricElement2d` outside the set uses this element as its **Category** | The category element (and its subtree root) |
| A `DefinitionElement` outside the set has a tracked **usage** reference to this element (e.g. a geometry part in a geometry stream) | The definition element (and its subtree root) |

All constraint violators, together with their entire subtrees (descendants and sub-model contents), are reported in the returned `BulkDeleteElementsResult` via `result.failures`. The direct violator is reported with `ReferencedByForeignKey` (plus the referencing `table.column`) or `DefinitionInUse`; a requested ancestor that was skipped because of it is reported with `BlockedByRelative` and the violator's id as `detail`. In `RemoveFKViolators` mode they are removed from the delete set and the rest is deleted; in `FailFast` mode nothing is deleted.

> Such blocking constraints are of the `On Delete No Action` Foreign key constraints. Such constraints need to be handled explicitly if one or more elements in the delete set are referenced by elements outside the set.

### Other constraint references

The other constraints such as `On Delete Cascade` and `On Delete Set NULL` are clearly defined and are hence handled by the API internally. `deleteElements` patches these automatically before removing the elements. For example,

- **`bis_ElementUniqueAspect`** entries are deleted from the database before the element it references.
- **`TypeDefinitionId`** on `GeometricElement3d` and `GeometricElement2d` rows - set to `NULL` when the referenced type element is being deleted and the geometric element itself is **not** in the delete set.

## Link-table relationship cleanup

`deleteElements` automatically removes rows from link-table relationship tables that reference deleted elements:

- **`ElementRefersToElements`** - rows where either the source or target element is deleted.
- **`ElementDrivesElement`** - rows where either the source or target element is deleted.
- **`ModelSelectorRefersToModels`** - rows where the target model (modeled element) is deleted.

No manual cleanup of these tables is required.

### Lifecycle batched callbacks

For large deletions, firing one notification per element adds significant overhead. Three batch-scoped callbacks allow subclasses to handle an entire group at once:

| Callback | Arg type | Fires |
|---|---|---|
| `Element.onBulkDeleted` | `OnBulkDeletedBatchArg` | Once per Element ECClass after all elements of that class are deleted; `arg.elements` lists every deleted element |
| `Element.onBulkChildDeleted` | `OnBulkChildDeletedBatchArg` | Once per parent ECClass for children whose parent was *not* itself deleted; `arg.elements` pairs each `childId` with its `parentId` |
| `Model.onBulkModelEvents` | `OnBulkModelEventsArg` | Once per Model ECClass, supplying both `deletedModelIds` (sub-models removed) and `deletedElementsByModel` (per-model element lists) |

The **default implementations** of all three callbacks delegate to the existing single-element callbacks (`onDeleted`, `onChildDeleted`, `onDeletedElement`, …) so existing overrides continue to work without modification. Override a batch callback only when you need to replace the per-element loop with something more efficient.

> **Note:** Callbacks cannot veto a deletion in `deleteElements`. Any veto attempt from a callback is ignored. If you need per-element veto semantics, use [EditTxn.deleteElement]($backend) on individual elements instead.

## Deprecated: `skipFKConstraintValidations`

Earlier releases offered `{ skipFKConstraintValidations: true }` to bypass the pre-deletion validation pass. That option has been removed because it could leave the iModel with dangling references. The flag is still accepted for source compatibility but is now equivalent to `{ deleteMode: BulkDeleteMode.FailFast }`; it is ignored when `deleteMode` is supplied. Use `deleteMode` explicitly instead.

## When to use `deleteElements` vs `deleteElement`

Use `deleteElements` when:

- Deleting a tree of elements (parent + all descendants).
- Deleting partitions/modeled elements (so their sub-models are cleaned up too).
- Deleting a mix of ordinary and definition elements.
- Deleting large numbers of elements where per-element overhead matters.
- You want all-or-nothing semantics with a detailed report of what is still referenced (`FailFast`).

Use `deleteElement` when:
- You want a hard failure on any constraint violation rather than silent exclusion and a returned failed set.
- You need callback vetoes to be respected.
