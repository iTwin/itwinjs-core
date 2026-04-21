# Bulk Element Deletion

[EditTxn.deleteElements]($backend) provides an efficient way to delete many elements in one call. `deleteElements` expands parent-child hierarchies, cascades into sub-models, checks and prunes constraint violators, fires lifecycle callbacks, NULLs dangling non-constraint references, and cleans up link-table relationships - all in a single native operation.

## Basic usage

Pass an array of element IDs to delete. The method returns a set of IDs that could **not** be deleted because they would violate an integrity constraint (see [Constraint violations](#constraint-violations) below).

```typescript
const failed: Id64Set = txn.deleteElements([idA, idB, idC]);
if (failed.size > 0) {
  // Some elements could not be deleted; inspect `failed` to see which ones.
}
```

You do **not** need to call [EditTxn.deleteDefinitionElements]($backend) for DefinitionElements. `deleteElements` handles both ordinary elements and DefinitionElements and it performs the same usage checks for definitions.
The only behavioral difference is that `deleteDefinitionElements` silently ignores non-definition elements in the input, whereas deleteElements will attempt to delete everything it can.

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

All constraint violators, together with their entire subtrees (descendants and sub-model contents), are removed from the delete set and are returned in the failed `Id64Set`.

## Non-constraint references - automatic NULLing

Some references are not enforced as database constraints and therefore do not block deletion. `deleteElements` patches these automatically before removing the elements:

- **`TypeDefinitionId`** on `GeometricElement3d` and `GeometricElement2d` rows - set to `NULL` when the referenced type element is being deleted and the geometric element itself is **not** in the delete set.

## Link-table relationship cleanup

`deleteElements` automatically removes rows from link-table relationship tables that reference deleted elements:

- **`ElementRefersToElements`** - rows where either the source or target element is deleted.
- **`ElementDrivesElement`** - rows where either the source or target element is deleted.
- **`ModelSelectorRefersToModels`** - rows where the target model (modeled element) is deleted.

No manual cleanup of these tables is required.

## Lifecycle callbacks

`deleteElements` fires the standard lifecycle callbacks for every element in the final delete set (after constraint violators have been pruned):

- `Element.onDelete` - fired for every element that was originally in the input array.
- `Element.onDeleted` - fired for every element that will be deleted including child elements and sub-model elements.
- `Element.onChildDelete` / `Element.onChildDeleted` - fired on the **parent** element when a child is deleted and that parent is **not** itself being deleted.
- `Element.onSubModelDelete` / `Element.onSubModelDeleted` - fired on the modeled element when its sub-model is deleted.
- `Model.onDelete` / `Model.onDeleted` - fired on the sub-model being deleted when the modeled element is deleted.

> **Note:** Callbacks cannot veto a deletion in `deleteElements`. Any veto attempt from a callback is ignored. If you need per-element veto semantics, use [EditTxn.deleteElement]($backend) on individual elements instead.

Use `deleteElements` when:

- Deleting a tree of elements (parent + all descendants).
- Deleting partitions/modeled elements (so their sub-models are cleaned up too).
- Deleting a mix of ordinary and definition elements.

Use `deleteElement` when:
- You want a hard failure on any constraint violation rather than silent exclusion and a returned failed set.
- You need callback vetoes to be respected.
