# CAST operator

Converts a value from one type to another.

Syntax: `CAST(<expr> AS [TEXT | INTEGER | REAL | BLOB | TIMESTAMP])`

Example:

```sql
    SELECT CAST(3.14159265 AS TEXT);
    -- 3.14159265
    SELECT CAST('3.14159265' AS REAL);
    -- 3.1416
    SELECT CAST('3.14159265' AS INTEGER);
    -- 3
```

## Extended casting (`CAST_V2`)

Extended casting is opt-in. It is enabled with the `CAST_V2` [ECSQL option](./ECSqlOptions.md). Without the option, `CAST` keeps its existing behavior and the `::` syntax is rejected.

With `CAST_V2` enabled:

- PostgreSQL-style postfix casts are supported: `<expr>::<type>`. `<expr>::<type>` and `CAST(<expr> AS <type>)` behave identically.
- Target types can be any EC primitive type (`INTEGER`, `LONG`, `DOUBLE`, `TEXT`, `BOOLEAN`, `DATETIME`, `DATE`, `BINARY`, `POINT2D`, `POINT3D`, ...), a schema-qualified EC enumeration, or one of the special targets listed below.
- Parameters can be cast. The cast gives the parameter its type, so it is bound accordingly: `?::INTEGER`, `CAST(:p AS INTEGER)`, `:p::Point2d`.
- An unknown target type or an unsupported conversion fails when the statement is prepared.
- Invalid input to the conversions described below (Id, `ClassName`, `Json`, `Guid`, points, `BOOLEAN`, `DATETIME` and strict enumerations) returns `NULL`. `INTEGER`, `LONG`, `DOUBLE` and `BINARY` targets keep SQLite's conversion rules: `'12abc'::INTEGER` returns `12` and `'abc'::INTEGER` returns `0`.

> Enabling `CAST_V2` also changes existing `CAST(...)` expressions in the same scope. `CAST(TRUE AS TEXT)` returns `true` instead of `1`. A DateTime cast to `TEXT` returns an ISO-8601 string instead of a Julian day number. A Binary cast to `TEXT` returns Base64 instead of the raw bytes. A strict enumeration returns `NULL` for values that aren't enumerators.

```sql
SELECT CAST(TRUE AS TEXT) b, CAST(dt AS TEXT) d FROM aps.TestElement LIMIT 1
-- 1    | 2457754.5
SELECT CAST(TRUE AS TEXT) b, CAST(dt AS TEXT) d FROM aps.TestElement LIMIT 1 OPTIONS CAST_V2
-- true | 2017-01-01T00:00:00.000
```

### Precedence and chaining

Postfix casts bind tighter than unary and binary operators and can be chained. Use an alias for cast columns, because otherwise the column name is generated from the expression.

```sql
SELECT 1 + '2'::INTEGER a OPTIONS CAST_V2
-- 3
SELECT '7.9'::REAL::INTEGER a, 1.9::INTEGER b OPTIONS CAST_V2
-- 7 | 1
SELECT (2 + 3)::DOUBLE / 2 a, (5.0 / 2)::INTEGER b OPTIONS CAST_V2
-- 2.5 | 2
SELECT -'5'::INTEGER a OPTIONS CAST_V2
-- -5
SELECT -5::TEXT a OPTIONS CAST_V2
-- error: the cast applies to 5, and unary minus can't be applied to TEXT. Use (-5)::TEXT.
```

### Scope of the option

The option applies to the `SELECT` it is attached to, including its derived tables and scalar subqueries. `OPTIONS CAST_V2=false` disables it.

- Each branch of a compound `SELECT` (`UNION`, ...) uses its own options. A trailing `OPTIONS` only applies to the last branch.
- Each common table expression definition uses its own options. The type of a cast inside a CTE is kept when the CTE is used.
- On `INSERT`, `UPDATE` and `DELETE` statements the option has no effect. A `SELECT` subquery inside them can enable it with its own `OPTIONS CAST_V2`.

```sql
SELECT v FROM (SELECT 21::Id v) OPTIONS CAST_V2
-- 0x15 (the derived table is covered)
WITH c(v) AS (SELECT 21::Id) SELECT v FROM c OPTIONS CAST_V2
-- error: the CTE definition needs its own option
WITH c(v) AS (SELECT 21::Id OPTIONS CAST_V2) SELECT v, v::TEXT t FROM c OPTIONS CAST_V2
-- 0x15 | 21
WITH c(v) AS (SELECT 21) SELECT v::Id a FROM c OPTIONS CAST_V2
-- 0x15
SELECT 21::Id a UNION ALL SELECT 22::Id OPTIONS CAST_V2
-- error: the first branch has no option
SELECT 21::Id a OPTIONS CAST_V2 UNION ALL SELECT 22::Id OPTIONS CAST_V2
-- 0x15, 0x16
DELETE FROM aps.TestElement WHERE ECInstanceId IN (SELECT ?::Id OPTIONS CAST_V2)
```

### Compound SELECT and scalar subqueries

When a column of a compound `SELECT` contains a `CAST_V2` cast, all branches with a type must have the same extended type. A plain number doesn't match an Id, so cast every branch to the same type. A `NULL` literal takes the type of the other branches.

A scalar subquery cannot return a `Point2d` or `Point3d` value; cast it to `TEXT` inside the subquery instead.

```sql
SELECT 1::Id a OPTIONS CAST_V2 UNION SELECT 2::ClassId OPTIONS CAST_V2
-- error: Id and ClassId differ
SELECT 1::Id a OPTIONS CAST_V2 UNION ALL SELECT 2
-- error: Id and plain Long differ
SELECT 1::Id a OPTIONS CAST_V2 UNION ALL SELECT ECInstanceId FROM aps.TestElement
-- ECInstanceId is already an Id, so this works
SELECT 21::Id a OPTIONS CAST_V2 UNION ALL SELECT NULL
SELECT NULL a UNION ALL SELECT 21::Id OPTIONS CAST_V2
-- column is an Id in both cases
SELECT (SELECT '{"X":1,"Y":2}'::Point2d) a OPTIONS CAST_V2
-- error
SELECT (SELECT '{"X":1,"Y":2}'::Point2d::TEXT) a OPTIONS CAST_V2
-- {"X":1.0,"Y":2.0}
```

### Parameters

A cast parameter is bound using the input type the cast expects. For most targets that is the target type. `?::Id` (and the other Id types) and `?::ClassName` bind an id, so `?::ClassName` takes a class id, not a class name. `?::Guid` binds a GUID. Use `(?::TEXT)::<type>` to bind a string and convert it.

- Only a parameter that is the direct operand of the cast gets its type. In `(? + 1)::INTEGER` the parameter is untyped.
- All casts of a named parameter must agree on the input type. Uncast uses of the same named parameter get the same type.
- Binding a value of the wrong kind, such as an integer to `?::Point2d`, fails when binding.

```sql
SELECT ?::INTEGER + 1 a OPTIONS CAST_V2
-- bindInteger(1, 41) -> 42
SELECT :p::Id a, :p b OPTIONS CAST_V2
-- bindId("p", "0x1234") -> both columns are the id 0x1234
SELECT :p::Id, :p::Point2d OPTIONS CAST_V2
-- error: conflicting types for :p
SELECT ?::ClassName c OPTIONS CAST_V2
-- bindId(1, classId) -> 'Schema:Class'
SELECT (?::TEXT)::Point2d p OPTIONS CAST_V2
-- bindString(1, '{"X":5,"Y":6}') -> point (5, 6)
SELECT * FROM bis.Element WHERE ECInstanceId = ?::Id OPTIONS CAST_V2
```

### Id types

An integer, or text holding a decimal or `0x` hexadecimal number, can be cast to one of the Id extended types: `Id`, `ClassId`, `SourceId`, `SourceClassId`, `TargetId`, `TargetClassId`, `NavId` and `NavRelClassId`. The result is a `long` value tagged with that extended type, so statements and readers treat it as an id.

- Text must be a complete number without spaces or a sign, and it must fit in 64 bits. Otherwise the result is `NULL`.
- Integers are kept as they are, including their sign bit.
- Floating-point and enumeration values cannot be cast to an Id.

Casting an Id to `TEXT` returns its unsigned decimal value. Inside JSON results (navigation properties and arrays), ids are written as hexadecimal.

```sql
SELECT 21::Id a, '0x15'::ClassId b, 'abc'::Id c OPTIONS CAST_V2
-- 0x15 | 0x15 | NULL
SELECT ' 21'::Id a, '-1'::Id b, ''::Id c, '0x1ffffffffffffffff'::Id d OPTIONS CAST_V2
-- NULL | NULL | NULL | NULL
SELECT 1.5::Id OPTIONS CAST_V2
-- error
SELECT '0xffffffffffffffff'::Id::TEXT a OPTIONS CAST_V2
-- 18446744073709551615
SELECT ECInstanceId::TEXT a FROM bis.Element LIMIT 1 OPTIONS CAST_V2
-- decimal text, e.g. 20
SELECT 21::Id::ClassId a OPTIONS CAST_V2
-- 0x15 (as a ClassId)
```

Prefer comparing ids as ids. For example, use `ECInstanceId = '0x1'::Id` rather than `ECInstanceId::TEXT = '1'`, which can't use the primary key.

### ClassName

An integer or id text can be cast to `ClassName`. The result is the class's full name in the form `Schema:Class`, with a colon, or `NULL` if the class doesn't exist.

```sql
SELECT ECClassId::ClassName c FROM meta.ECSchemaDef LIMIT 1 OPTIONS CAST_V2
-- ECDbMeta:ECSchemaDef
SELECT 'abc'::ClassName a, 0::ClassName b OPTIONS CAST_V2
-- NULL | NULL
```

`ClassName` is computed for every row, so a filter such as `WHERE ECClassId::ClassName = 'BisCore:Subject'` can't use an index. To filter by class, use `WHERE ECClassId IS (BisCore.Subject)` or `IS (ONLY BisCore.Subject)` instead.

### Json and Guid

- `<text>::Json` validates the JSON and returns the text unchanged, with the `Json` extended type. Scalar JSON values such as `1`, `"s"` and `null` are valid. Invalid JSON returns `NULL`.
- `<text>::Guid` converts a GUID string to a 16-byte binary value with the `BeGuid` extended type. A 16-byte binary value can also be cast. An invalid GUID returns `NULL`. `<guid>::TEXT` returns the GUID string.

```sql
SELECT '{bad'::Json a, '{ "a" : 1 }'::Json b, 'null'::Json c OPTIONS CAST_V2
-- NULL | { "a" : 1 } | null
SELECT FederationGuid::TEXT g FROM bis.Element WHERE FederationGuid IS NOT NULL LIMIT 1 OPTIONS CAST_V2
-- 2d3d3239-4a1c-4375-88e9-af43a1ea6ad1
SELECT * FROM bis.Element WHERE FederationGuid = '2d3d3239-4a1c-4375-88e9-af43a1ea6ad1'::Guid OPTIONS CAST_V2
```

### Converting EC values to TEXT

| Source | Result |
| --- | --- |
| Point2d / Point3d | `{"X":1.0,"Y":2.0}` / `{"X":1.0,"Y":2.0,"Z":3.0}`. A `NULL` coordinate makes the result `NULL`. |
| Struct | JSON object using the struct member names. `NULL` members are omitted. If all members are `NULL`, the result is `NULL`. Nested values follow the same rules. |
| Primitive or struct array | JSON array. `NULL` elements are kept, e.g. `[1,null,3]`. |
| Navigation property | `{"Id":"0x..","RelECClassId":"0x.."}`. `RelECClassId` is omitted when it is `NULL`. |
| Boolean | `true` or `false` |
| DateTime | ISO-8601 string |
| Binary | Base64 string. `GeometryStream` is binary, so it returns Base64 too. |
| Guid (`BeGuid` binary) | GUID string |
| IGeometry property | iModel JSON string |

A `NULL` source returns `NULL`. The content doesn't depend on row-format options.

```sql
SELECT p2d::TEXT a, p3d::TEXT b, array_i::TEXT c FROM aps.TestElement LIMIT 1 OPTIONS CAST_V2
-- {"X":1.034,"Y":2.034} | {"X":-1.0,"Y":2.3,"Z":3.0001} | [0,1,2]
SELECT Origin::TEXT FROM bis.GeometricElement3d OPTIONS CAST_V2
-- {"X":1.0,"Y":2.0,"Z":3.0}
SELECT Model::TEXT FROM bis.Element LIMIT 1 OPTIONS CAST_V2
-- {"Id":"0x1","RelECClassId":"0x63"}
```

### Other conversions

- `<text>::Point2d` / `<text>::Point3d` parses a JSON object with numeric `X`, `Y` (and `Z`) members. Lowercase `x`, `y`, `z` are accepted and other members are ignored. If a required coordinate is missing, isn't a number, or isn't finite, the result is `NULL`.
- `<navigation>::Id` (or `::NavId`) returns the id of the referenced instance (extended type `NavId`). `<navigation>::LONG` returns it as a plain `long`. Other Id targets, such as `<navigation>::ClassId`, aren't supported; use `<navigation>.RelECClassId` for the relationship class id.
- `<text>::BOOLEAN` accepts `true` and `false` (any case, surrounding spaces ignored) and numeric text. A number converts to `true` if it is non-zero. Other text returns `NULL`.
- `<text>::DATETIME` and `<text>::DATE` parse an ISO-8601 string; a trailing `Z` is dropped. A number is read as a Julian day. Malformed input returns `NULL`.
- `<value>::<enumeration>` returns `NULL` for a strict enumeration if the value isn't one of its enumerators. For integer enumerations, the value must be an integer, an integral number such as `2.0`, or integer text, so `'abc'` and `1.7` return `NULL`. A non-strict enumeration accepts any value. Casting an enumeration to `TEXT` returns its value, not the enumerator name.

```sql
SELECT '{"x":1,"y":2}'::Point2d::TEXT a, '{"X":"1","Y":2}'::Point2d b OPTIONS CAST_V2
-- {"X":1.0,"Y":2.0} | NULL
SELECT Model::Id a, Model::LONG b, Model.RelECClassId::NavRelClassId c FROM bis.Element LIMIT 1 OPTIONS CAST_V2
-- 0x1 | 1 | 0x63
SELECT 'TRUE'::BOOLEAN a, 'maybe'::BOOLEAN b, 0.5::BOOLEAN c, ' false '::BOOLEAN d OPTIONS CAST_V2
-- true | NULL | true | false
SELECT '2020-01-02T03:04:05Z'::DATETIME::TEXT a, '2020-01-02T10:00:00'::DATE::TEXT b, 2460000.5::DATETIME::TEXT c OPTIONS CAST_V2
-- 2020-01-02T03:04:05.000 | 2020-01-02 | 2023-02-25T00:00:00.000
```

Converting between Point2d and Point3d, converting structs, arrays or navigation values to anything other than `TEXT` (or a navigation value to `Id`, `NavId` or `LONG`), and converting text to a struct, array or navigation value are not supported. Neither are element-wise array conversions such as `IntArr::LONG[]`, or `<navigation>::ClassName`.

[ECSql Syntax](./index.md)
