---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [ECSQL CROSS JOIN now supports optional ON clause](#ecsql-cross-join-now-supports-optional-on-clause)
    - [Schema changesets can be reversed](#schema-changesets-can-be-reversed)
  - [@itwin/core-quantity](#itwincore-quantity)
    - [Generated unit identifiers and sync built-in conversion helpers](#generated-unit-identifiers-and-sync-built-in-conversion-helpers)
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

## @itwin/core-quantity

### Generated unit identifiers and sync built-in conversion helpers

`@itwin/core-quantity` now exposes beta [Units]($quantity), [Phenomena]($quantity), [UnitSystems]($quantity), and [UnitConversions]($quantity) helpers for the built-in canonical unit set shipped with the package. This gives callers discoverable package-owned identifiers instead of magic strings, grouped unit browsing by phenomenon, and a synchronous built-in conversion path for canonical bundled units.

[Units]($quantity) includes bundled BIS `InvertedUnit` identifiers inside their natural phenomenon buckets, removing magic-string cases for ratio-style units such as `Units.HORIZONTAL_PER_VERTICAL`.

The package also now exposes beta [getDefaultPersistenceUnit]($quantity) for the recommended built-in default persistence unit of a supported bundled phenomenon. `Phenomena.LENGTH_RATIO` is intentionally excluded from that helper until the built-in default length-ratio unit is settled.

Additionally, [Quantity.convertTo]($quantity) now throws [QuantityError]($quantity) with [QuantityStatus.InvalidUnitConversion]($quantity) when given `UnitConversionProps` marked with `error: true`, matching the newer [UnitConversions]($quantity) throwing helpers. Callers that previously relied on `convertTo(...)` silently applying identity math for invalid conversions should update to handle this error explicitly.

## Electron 42 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 42](https://www.electronjs.org/blog/electron-42-0).
