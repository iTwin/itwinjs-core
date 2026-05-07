---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [ECSQL CROSS JOIN now supports optional ON clause](#ecsql-cross-join-now-supports-optional-on-clause)
  - [@itwin/core-quantity](#itwincore-quantity)
    - [Quantity conversion helpers now expose generated inverted-unit identifiers and tighten invalid conversion handling](#quantity-conversion-helpers-now-expose-generated-inverted-unit-identifiers-and-tighten-invalid-conversion-handling)

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

## @itwin/core-quantity

### Quantity conversion helpers now expose generated inverted-unit identifiers and tighten invalid conversion handling

`@itwin/core-quantity` now generates [UnitSchemaNames]($quantity) entries for bundled BIS `InvertedUnit` items in addition to `Unit`, `Phenomenon`, and `UnitSystem` items. This removes remaining magic-string cases for bundled ratio-style units such as `Units.HORIZONTAL_PER_VERTICAL`.

Additionally, [Quantity]($quantity).[convertTo]($quantity) now throws [QuantityError]($quantity) with [QuantityStatus.InvalidUnitConversion]($quantity) when given `UnitConversionProps` marked with `error: true`, matching the newer [UnitConversions]($quantity) throwing helpers. Callers that previously relied on `convertTo(...)` silently applying identity math for invalid conversions should update to handle this error explicitly.
