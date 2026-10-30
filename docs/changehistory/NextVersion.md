---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Extended ECSQL casting](#extended-ecsql-casting)
  - [Breaking changes](#breaking-changes)
    - [Extended casting is the default](#extended-casting-is-the-default)

## Backend

### Extended ECSQL casting

ECSQL supports extended casting by default, including in CTEs, compound queries, subqueries, and data-modification statements.

- PostgreSQL-style postfix casts: `SELECT ECInstanceId::TEXT FROM bis.Element`.
- Parameter casts, which give the parameter its binding type: `?::INTEGER` or `CAST(:p AS INTEGER)`.
- Id targets (`Id`, `ClassId`, `SourceId`, `SourceClassId`, `TargetId`, `TargetClassId`, `NavId`, `NavRelClassId`) that tag an integer or id text as an id, and `ClassName`, which converts a class id to `Schema:Class`.
- `TEXT` conversions of points, structs, arrays and navigation properties to JSON. Also `Json`, `Guid`, Boolean, DateTime, Binary and geometry conversions, e.g. `FederationGuid::TEXT` and `'{"X":1,"Y":2}'::Point2d`.

Unknown target types and unsupported conversions fail when the statement is prepared. Invalid input to the new conversions (Id, `ClassName`, `Json`, `Guid`, points, Boolean, DateTime and strict enumerations) returns `NULL`. Numeric and Binary targets keep SQLite's conversion rules.

See [CAST](../learning/ECSqlReference/CAST.md#extended-casting) for conversion rules and examples.

The ECSQL version was bumped to `2.0.6.0`.

## Breaking changes

### Extended casting is the default

The `CAST_V2` option has been removed. Remove it from all queries, including `CAST_V2=true` and `CAST_V2=false`; statements that still specify it fail to prepare. There is no option to restore legacy casting.

Existing `CAST(...)` expressions now use the extended rules without opting in. Boolean-to-TEXT returns `true`/`false` instead of `1`/`0`, DateTime-to-TEXT returns ISO-8601 instead of a Julian day number, Binary-to-TEXT returns Base64 instead of raw bytes, and strict enumeration casts return `NULL` for values that are not enumerators.

Update consumers that parse those text results. For numeric Boolean or Julian day results, cast to `INTEGER` or `DOUBLE` respectively instead of `TEXT`. For raw binary data, select the Binary value directly. Validate strict enumeration inputs before casting if the application requires invalid values to be reported.

Compound-query columns containing a cast must agree on their extended type across typed branches. Cast all branches to the same type when combining an Id cast with a plain integer or a different Id type. These semantics require the matching native library; check `PRAGMA ecsql_ver` for ECSQL `2.0.6.0` or later.
