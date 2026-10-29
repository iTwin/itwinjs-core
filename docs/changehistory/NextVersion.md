---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Extended ECSQL casting](#extended-ecsql-casting)

## Backend

### Extended ECSQL casting

ECSQL supports extended casting when the `CAST_V2` option is specified. Without the option, `CAST` behaves as before and the `::` syntax is rejected.

- PostgreSQL-style postfix casts: `SELECT ECInstanceId::TEXT FROM bis.Element OPTIONS CAST_V2`.
- Parameter casts, which give the parameter its binding type: `?::INTEGER` or `CAST(:p AS INTEGER)`.
- Id targets (`Id`, `ClassId`, `SourceId`, `SourceClassId`, `TargetId`, `TargetClassId`, `NavId`, `NavRelClassId`) that tag an integer or id text as an id, and `ClassName`, which converts a class id to `Schema:Class`.
- `TEXT` conversions of points, structs, arrays and navigation properties to JSON. Also `Json`, `Guid`, Boolean, DateTime, Binary and geometry conversions, e.g. `FederationGuid::TEXT` and `'{"X":1,"Y":2}'::Point2d`.

Unknown target types and unsupported conversions fail when the statement is prepared. Invalid input to the new conversions (Id, `ClassName`, `Json`, `Guid`, points, Boolean, DateTime and strict enumerations) returns `NULL`. Numeric and Binary targets keep SQLite's conversion rules.

Adding `CAST_V2` to an existing query also changes its existing `CAST(...)` expressions. For example, `CAST(TRUE AS TEXT)` returns `true` instead of `1`, and a DateTime cast to `TEXT` returns an ISO-8601 string instead of a Julian day number. See [CAST](../learning/ECSqlReference/CAST.md#extended-casting-cast_v2).

The ECSQL version was bumped to `2.0.5.0`.
