# ECSql Operators

## Bitwise operator

| Operator | Description         | Example                                        |
| -------- | ------------------- | ---------------------------------------------- |
| `&`      | Bitwise AND         | `(4&2 )` _output `0`_                          |
| `~`      | Bitwise NOT urinary | `( ~1 )` _output `-2` or `0xfffffffffffffffe`_ |
| `\|`     | Bitwise OR          | `(3\|4 )` _output `7`_                         |
| `<<`     | Bitwise shift left  | `(1<<2)` _output `4`_                          |
| `>>`     | Bitwise shift right | `(4>>1)` _output `2`_                          |

## Arithmetic operator

| Operator | Description | Example                |
| -------- | ----------- | ---------------------- |
| `+`      | Add         | `(1 + 1)` _output `2`_ |
| `-`      | Subtract    | `(2 - 1)` _output `1`_ |
| `*`      | Multiply    | `(2 * 2)` _output `4`_ |
| `/`      | Divide      | `(4 / 2)` _output `2`_ |
| `%`      | Modulo      | `(4 % 2)` _output `0`_ |

## String operator

| Operator | Description | Example                                               |
| -------- | ----------- | ----------------------------------------------------- |
| `\|\|`   | Concatenate | `'Hello'\|\| ',' \|\| 'World'` _output `Hello,World`_ |

## Boolean operator

| Operator | Description         | Example                         |
| -------- | ------------------- | ------------------------------- |
| `=`      | Equal               | `(1 = 3)` _output `FALSE`_      |
| `>`      | Greater than        | `(1 > 3)` _output `FALSE`_      |
| `<`      | Less than           | `(1 < 3)` _output `TRUE`_       |
| `>=`     | Greater or equal to | `(3 >= 3)` _output `TRUE`_      |
| `<=`     | Less or equal to    | `(3 <= 5)` _output `TRUE`_      |
| `<>`     | Not equal           | `(1 <> 3)` _output `TRUE`_      |
| `!=`     | Not equal           | `(1 != 3)` _output `TRUE`_      |
| `IS`     | Null-safe equal     | `(NULL IS NULL)` _output `TRUE`_   |
| `IS NOT` | Null-safe not equal | `(1 IS NOT NULL)` _output `TRUE`_  |
| `OR`     | OR op               | `(1=2 OR 1=1)` _output `TRUE`_  |
| `AND`    | AND op              | `(1=1 AND 1=1)` _output `TRUE`_ |
| `NOT`    | NOT unary op        | `NOT (1=1)` _output `FALSE`_    |

## `IS` / `IS NOT` operator (null-safe comparison)

The `IS` and `IS NOT` operators compare two operands using **null-safe** semantics, mapping to SQLite's [`IS` / `IS NOT`](https://www.sqlite.org/lang_expr.html) operators. Unlike `=` and `<>`, a `NULL` operand never makes the result _unknown_:

- `NULL IS NULL` is `TRUE` (whereas `NULL = NULL` is _unknown_, so the row is filtered out).
- `<value> IS NULL` is `FALSE` when `<value>` is not `NULL`.

Each operand may be any value expression — a property, the `NULL` literal, a constant, a parameter, a function call, an arithmetic expression, and so on — and the `NULL` literal may appear on either side.

```sql
-- Rows where CodeValue and UserLabel differ, treating NULL as a comparable value
SELECT * FROM [bis].[Element] WHERE [CodeValue] IS NOT [UserLabel]

-- Equivalent to "CodeValue IS NULL"
SELECT * FROM [bis].[Element] WHERE NULL IS [CodeValue]

-- The right-hand side can be any value expression, e.g. a function call
SELECT * FROM [bis].[Element] WHERE [CodeValue] IS json_extract([JsonProperties], '$.code')
```

For multi-column operands such as `Point2d`/`Point3d` and navigation properties, the comparison is expanded column-wise (consistent with `=` and `<>`): `IS` joins the per-column comparisons with `AND`, while `IS NOT` joins them with `OR`.

```sql
-- TRUE only when Origin and BBoxLow match on every coordinate (X, Y and Z)
SELECT * FROM [bis].[GeometricElement3d] WHERE [Origin] IS [BBoxLow]

-- TRUE when the two navigation properties differ on either the related Id or the relationship class
SELECT * FROM [ts].[Child] WHERE [ParentA] IS NOT [ParentB]
```

Both operands must be type-compatible, following the same rules as `=` and `<>`: comparable primitive types (for example two strings, or numeric types compared with each other) or composite types of the same shape (`Point2d` with `Point2d`, a navigation property with a navigation property), with the `NULL` literal allowed against any type. Comparing unrelated types — for example a `string` against a `Point3d` — is rejected when the statement is prepared.

> Note: `IS [NOT]` is also used by the unrelated [ECClass filter](./ECClassFilter.md) predicate (`<classId> IS [NOT] (<class-name>, ...)`) and by the boolean truth tests `IS [NOT] TRUE`/`FALSE`/`UNKNOWN`. Those forms take precedence: a right-hand operand that is exactly `NULL`/`TRUE`/`FALSE`/`UNKNOWN`, or a parenthesized `(ClassName)`, keeps its original meaning. Write such a value expression without the outer parentheses (for example `x IS y + 1` rather than `x IS (y + 1)`) when it could be mistaken for a type predicate.

[ECSql Syntax](./index.md)
