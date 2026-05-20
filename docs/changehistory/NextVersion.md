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

[ChangesetReader]($backend) now exposes [ChangesetReader.enableStrictMode]($backend) and [ChangesetReader.disableStrictMode]($backend) to control how the reader handles a **column-count mismatch** between a change record and the corresponding live database table.

When a row is read, the reader compares the number of columns recorded in the changeset binary against the number of columns the table currently has in the live iModel:

- **Strict mode** (`enableStrictMode`): a mismatch causes an error to be thrown — the row is not processed.
- **Lenient mode** (`disableStrictMode`, the **default**): a mismatch is resolved by taking the **minimum** of the two column counts and proceeding with that subset. This is safe because SQLite only ever appends new columns at the end of a table and we never remove columns, so older change records simply lack the trailing columns added later.

```typescript
using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.enableStrictMode(); // throw if column counts diverge between change record and live table

while (reader.step()) { /* ... */ }
```

Call `disableStrictMode()` to return to the default lenient behaviour. Both methods can be called between `step()` calls to toggle the mode mid-stream.

### ChangesetReader: `spillThresholdInBytes` controls disk spill for bounded memory use

[openGroup]($backend), [openTxn]($backend), [openLocalChanges]($backend), and [openInMemoryChanges]($backend) now accept a `spillThresholdInBytes` parameter. When the total size of the change data being read exceeds this threshold, the reader transparently writes the data to a temporary file on disk and streams it from there instead of buffering everything in memory. This keeps peak memory usage bounded and makes these APIs usable under low-memory conditions.

The default threshold is **50 MiB**. Set a lower value to spill to disk sooner:

```typescript
// Spill to disk when the merged changeset data exceeds 1 MiB
using reader = ChangesetReader.openGroup({
  db,
  changesetFiles: [cs1, cs2, cs3],
  spillThresholdInBytes: 1024 * 1024,
});
```

The same parameter is available on `openTxn`, `openLocalChanges`, and `openInMemoryChanges`.

### ChangesetReader: `close` and `Symbol.dispose` can now throw

[ChangesetReader.close]($backend) (and therefore `[Symbol.dispose]()`, which delegates to it) can now propagate errors thrown by the native layer during resource cleanup. Previously the method swallowed all errors silently.

Code that calls `[Symbol.dispose]()` manually inside a `finally` block must guard against this to avoid silently suppressing subsequent cleanup calls:

```typescript
// Before — if reader[Symbol.dispose]() throws, pcu[Symbol.dispose]() is never called:
finally {
  reader[Symbol.dispose]();
  pcu[Symbol.dispose]();
}

// After — nest the calls so each one runs regardless of whether the previous threw:
finally {
  try { reader[Symbol.dispose](); } finally { pcu[Symbol.dispose](); }
}
```

Code using the `using` declaration is unaffected — the TypeScript runtime already handles multiple `using` disposals independently.
