---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Move elements between models and parents](#move-elements-between-models-and-parents)
    - [ECSQL CROSS JOIN now supports optional ON clause](#ecsql-cross-join-now-supports-optional-on-clause)
    - [Schema changesets can be reversed](#schema-changesets-can-be-reversed)
  - [Electron 42 support](#electron-42-support)

## @itwin/core-backend

### Move elements between models and parents

Two new `@beta` methods on [EditTxn]($backend) allow moving existing elements to a different model and/or parent without deleting and re-inserting them:

- **`EditTxn.moveElement`** — moves a single leaf element (no children) to a new model and/or parent. Requires an exclusive lock on the element being moved and shared locks on the target model and parent.
- **`EditTxn.moveElementTree`** — moves an element and its entire descendant subtree. Descendants are relocated bottom-up (leaves first), then parent-child relationships are re-established in the target model. An optional `onMoveChild` callback lets callers supply new codes for descendants whose code scope is model-based.

Both methods accept a [MoveElementProps]($backend) object specifying the element id, target model, target parent, and optional new code.

```typescript
// Move a single element to a new model as a root element
editTxn.moveElement({ id: elementId, targetModelId: newModelId });

// Move an element to become a child of another element
editTxn.moveElement({ id: elementId, targetElementId: newParentId });

// Move an entire subtree, providing new codes for children with model-scoped codes
editTxn.moveElementTree({
  id: rootElementId,
  targetModelId: newModelId,
  onMoveChild: (childProps) => {
    // Return a new code if needed, or undefined to keep the existing code
    return { spec: childProps.code.spec, scope: newModelId, value: childProps.code.value };
  },
});
```

### ECSQL CROSS JOIN now supports optional ON clause

`CROSS JOIN` in ECSQL now accepts an optional `ON` condition, matching standard SQL and SQLite behavior. Previously, `CROSS JOIN` only produced an unfiltered Cartesian product between two classes.

The key benefit of using `CROSS JOIN` with an `ON` clause — rather than `INNER JOIN` — is optimizer control: SQLite's [special CROSS JOIN handling](https://www.sqlite.org/lang_select.html#special_handling_of_cross_join_) prevents the query planner from reordering the joined tables, giving applications explicit control over the join order and query execution plan.

**Example** — filter the Cartesian product while locking join order:

```sql
-- Returns only matching Person/Identifier pairs, but forces Person to be the outer table
SELECT * FROM ts.Person p CROSS JOIN ts.Identifier i ON p.PersonalID = i.PersonId
```

This is equivalent in result to an `INNER JOIN`, but the optimizer is not permitted to swap the table order, which can be important for performance-sensitive queries.

### Schema changesets can be reversed

This makes it possible to walk a changeset timeline backwards through interleaved schema and data changesets. After reversing a schema changeset, the EC metadata (class definitions, property mappings, schema version) reflects the state prior to that changeset.

As a result, `CheckpointManager.downloadCheckpoint` now succeeds when the target changeset is older than the checkpoint and the range spans one or more schema changesets. Previously this would fail because schema changesets could not be reversed.

## Electron 42 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 42](https://www.electronjs.org/blog/electron-42-0).
