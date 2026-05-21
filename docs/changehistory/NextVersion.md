---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [ECSQL CROSS JOIN now supports optional ON clause](#ecsql-cross-join-now-supports-optional-on-clause)
    - [ChangesetReader: `spillThresholdInBytes` controls disk spill for bounded memory use](#changesetreader-spillthresholdinbytes-controls-disk-spill-for-bounded-memory-use)
    - [ChangesetReader: `close` and `Symbol.dispose` can now throw](#changesetreader-close-and-symboldispose-can-now-throw)
    - [Schema changesets can be reversed](#schema-changesets-can-be-reversed)
  - [Electron 42 support](#electron-42-support)

## @itwin/core-backend

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

### ChangesetReader: `enableStrictMode` and `disableStrictMode`

[ChangesetReader]($backend) gains [ChangesetReader.enableStrictMode]($backend) and [ChangesetReader.disableStrictMode]($backend) to toggle strict column-count checking. In strict mode a mismatch between a change record and the live table column count throws immediately; in lenient mode (the default) the minimum column count is used instead. See [Strict mode](../learning/backend/ChangesetReader.md#strict-mode) for details.

### ChangesetReader: `spillThresholdInBytes` controls disk spill for bounded memory use

[openGroup]($backend), [openTxn]($backend), [openLocalChanges]($backend), and [openInMemoryChanges]($backend) now accept `spillThresholdInBytes` to bound peak memory by spilling change data to a temporary file on disk when the threshold is exceeded (default **50 MiB**). See [`spillThresholdInBytes`](../learning/backend/ChangesetReader.md#spillthresholdinbytes--bounding-peak-memory-usage) for details.

### ChangesetReader: `close` and `Symbol.dispose` can now throw

[ChangesetReader.close]($backend) (and `[Symbol.dispose]()`) can now propagate errors from the native layer; previously they were silently swallowed. Code using manual `[Symbol.dispose]()` calls in a `finally` block may need updating — see [Disposal](../learning/backend/ChangesetReader.md#disposal--always-close-the-reader-and-unifier) for the safe patterns. Code using `using` is unaffected.
