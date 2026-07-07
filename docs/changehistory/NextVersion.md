---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [ECSQL `IS` / `IS NOT` operator now works between two operands](#ecsql-is--is-not-operator-now-works-between-two-operands)
  - [Electron 43 support](#electron-43-support)

## @itwin/core-backend

### ECSQL `IS` / `IS NOT` operator now works between two operands

The ECSQL `IS` and `IS NOT` operators can now be used between two operands — for example `prop1 IS [NOT] prop2`, where each operand may be any value expression: a property, the `NULL` literal, a constant, a parameter, a function call, an arithmetic expression, etc. These map to SQLite's **null-safe** comparison operators, so `NULL IS NULL` is `TRUE` and `1 IS NULL` is `FALSE`, unlike `=`/`<>` which treat a `NULL` operand as _unknown_.

Previously `IS` / `IS NOT` only supported the right-hand operands `NULL`, the boolean literals `TRUE`/`FALSE`/`UNKNOWN`, and the [ECClass type predicate](../learning/ECSqlReference/ECClassFilter.md) (`IS (ClassName)`). Those forms still take precedence — a right-hand operand that is exactly `NULL`/`TRUE`/`FALSE`/`UNKNOWN`, or a parenthesized **qualified** class name such as `(bis.Element)` (optionally with an `ONLY`/`ALL` prefix or a comma-separated list), keeps its original meaning. A parenthesized *unqualified* name such as `(prop2)` is instead read as a value expression, so `prop1 IS (prop2)` is a null-safe comparison. A parenthesized *qualified* name that does not resolve to a known ECClass — for example `(alias.prop)` or `(ts.Status.Active)` — is also treated as a null-safe value expression instead of failing with a "class not found" error; when a qualified name is both a valid class and a valid property path, the type-predicate (class) reading takes precedence.

For multi-column operands (such as `Point2d`/`Point3d` and navigation properties) the comparison is expanded column-wise, consistent with `=` and `<>`: `IS` joins the per-column comparisons with `AND`, and `IS NOT` joins them with `OR`.

**Example** — find elements whose code value differs from their user label, or from a value extracted from JSON, treating `NULL` as a comparable value:

```sql
SELECT * FROM bis.Element WHERE CodeValue IS NOT UserLabel
SELECT * FROM bis.Element WHERE CodeValue IS json_extract(JsonProperties, '$.code')
```

See the [ECSQL operators reference](../learning/ECSqlReference/Operators.md#is--is-not-operator-null-safe-comparison) for more details.

## Electron 43 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 43](https://www.electronjs.org/blog/electron-43-0).
