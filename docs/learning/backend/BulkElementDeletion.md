# Bulk Element Deletion

[EditTxn.deleteElements]($backend) provides an efficient way to delete many elements in one call. `deleteElements` expands parent-child hierarchies, cascades into sub-models, validates that nothing in the resulting delete set is still referenced from outside it, fires lifecycle callbacks, NULLs dangling non-constraint references, and cleans up link-table relationships - all in a single native operation.

The operation is **all-or-nothing**: either every element in the expanded delete set is deleted, or - if any of them is still referenced from outside the set - nothing is deleted and the blocking elements are reported.

## Basic usage

Pass an array of element IDs to delete. The method returns a [BulkDeleteElementsResult]($backend) that describes the outcome: the deletion status and, when the call was rejected, which elements block it and why.

```typescript
const result: BulkDeleteElementsResult = txn.deleteElements([idA, idB, idC]);

switch (result.status) {
  case BulkDeleteElementsStatus.Success:
    // All requested elements (and their children / sub-model contents) were deleted.
    break;
  case BulkDeleteElementsStatus.ConstraintViolation:
    // At least one element in the delete set is still referenced from outside it, so nothing was deleted.
    // Inspect result.failures, fix (or include) the referencing elements, and retry.
    for (const failure of result.failures)
      console.log(`${failure.elementId}: ${BulkDeleteFailureReason[failure.reason]} ${failure.detail ?? ""}`);
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
| `status` | [BulkDeleteElementsStatus]($backend): `Success`, `ConstraintViolation` or `DeletionFailed` |
| `failures` | [BulkDeleteFailure]($backend) entries, only populated on `ConstraintViolation`: the element, a [BulkDeleteFailureReason]($backend) and an optional `detail` (see [Constraint violations](#constraint-violations)) |
| `sqlDeleteStatus` | Raw `DbResult` from the underlying SQL DELETE statement; only meaningful for `DeletionFailed` |
| `failedIds` | _Deprecated._ The unique set of element ids appearing in `failures` |

The validation pass runs before anything is modified, so `ConstraintViolation` always leaves the iModel - and the current txn - untouched. Only `DeletionFailed` can leave partial changes behind; in that case the caller must abandon the txn.

You do **not** need to call [EditTxn.deleteDefinitionElements]($backend) for DefinitionElements. `deleteElements` handles both ordinary elements and DefinitionElements and performs the same usage checks for definitions.
The behavioral differences are that `deleteDefinitionElements` silently ignores non-definition elements in the input and deletes whatever it can, whereas `deleteElements` deletes either everything or nothing.

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

DefinitionElements (categories, subcategories, geometry parts, render materials, textures, display styles, view definitions, etc.) can only be deleted when they are no longer referenced by elements outside the delete set. `deleteElements` performs the necessary usage checks automatically. A definition element that is still in use outside the delete set is reported in `result.failures` with reason `DefinitionInUse`, and the call is rejected.

Importantly, _intra-set_ usages are resolved correctly: if element A references element B and both are in the input, neither blocks the other.

```typescript
// Delete a ViewDefinition together with the CategorySelector, ModelSelector and DisplayStyle it owns - all intra-set references are resolved automatically.
txn.deleteElements([viewId, categorySelectorId, modelSelectorId, displayStyleId]);
```

## Constraint violations

The delete set is first expanded (children and sub-model contents are added) and then validated as a whole. An element in the expanded set is a _constraint violator_ if, after discounting references from other members of the set, any of the following is true for elements **outside** the set:

| Constraint | Reported reason | `detail` |
|---|---|---|
| A row outside the set references the element through a `NO ACTION` / `RESTRICT` / `SET DEFAULT` foreign key - e.g. another element uses it as its **CodeScope**, or a `GeometricElement2d`/`GeometricElement3d` uses it as its **Category** | `ReferencedByForeignKey` | the referencing `table.column`, e.g. `bis_GeometricElement3d.CategoryId` |
| A `DefinitionElement` that has a tracked **usage** outside the set that is not a foreign key (e.g. a GeometryPart, SubCategory or RenderMaterial used from a geometry stream) | `DefinitionInUse` | - |
| One of the elements every iModel must keep: the root Subject, the DictionaryModel partition or the RealityDataSources partition | `ProtectedElement` | - |
| An element whose handler belongs to a read-only `DgnDomain` | `ReadOnlyDomain` | the domain name |

If there is at least one violator, the status is `ConstraintViolation`, **nothing** is deleted and `failures` lists every violator. Each element appears at most once; if it violates several constraints the first one found is reported.

Only the *direct* violators are reported. If you request a parent whose cascaded child is still referenced, the child is listed, not the parent. Likewise, the expanded set is validated exactly once: an element that would only become a violator after another violator is removed from the input is not reported until you retry.

To proceed, either add the referencing elements to the delete set (so the reference becomes intra-set), or remove the reported elements from the input, then call `deleteElements` again.

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

## Lifecycle batched callbacks

For large deletions, firing one notification per element adds significant overhead. Three batch-scoped callbacks allow subclasses to handle an entire group at once:

| Callback | Arg type | Fires |
|---|---|---|
| `Element.onBulkDeleted` | `OnBulkDeletedBatchArg` | Once per Element ECClass after all elements of that class are deleted; `arg.elements` lists every deleted element |
| `Element.onBulkChildDeleted` | `OnBulkChildDeletedBatchArg` | Once per parent ECClass for children whose parent was *not* itself deleted; `arg.elements` pairs each `childId` with its `parentId` |
| `Model.onBulkModelEvents` | `OnBulkModelEventsArg` | Once per Model ECClass, supplying both `deletedModelIds` (sub-models removed) and `deletedElementsByModel` (per-model element lists) |

The **default implementations** of all three callbacks delegate to the existing single-element callbacks (`onDeleted`, `onChildDeleted`, `onDeletedElement`, …) so existing overrides continue to work without modification. Override a batch callback only when you need to replace the per-element loop with something more efficient.

> **Note:** Callbacks cannot veto a deletion in `deleteElements`. Any veto attempt from a callback is ignored. If you need per-element veto semantics, use [EditTxn.deleteElement]($backend) on individual elements instead.

## Deprecated: `skipFKConstraintValidations`

Earlier releases offered `{ skipFKConstraintValidations: true }` to bypass the pre-deletion validation pass. That option has been removed because it could leave the iModel with dangling references (e.g. a deleted GeometryPart still referenced from a geometry stream). The flag is still accepted for source compatibility but is now **ignored**: validation always runs, regardless of its value.

## When to use `deleteElements` vs `deleteElement`

Use `deleteElements` when:

- Deleting a tree of elements (parent + all descendants).
- Deleting partitions/modeled elements (so their sub-models are cleaned up too).
- Deleting a mix of ordinary and definition elements.
- Deleting large numbers of elements where per-element overhead matters.
- You want all-or-nothing semantics with a detailed report of what is still referenced.

Use [EditTxn.deleteElement]($backend) when you need per-element veto semantics from lifecycle callbacks, or when you want to delete whatever can be deleted and handle each failure individually.
