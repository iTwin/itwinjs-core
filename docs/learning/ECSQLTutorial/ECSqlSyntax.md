# ECSql Syntax & Features

## Bitwise operator

| Operator | Description         | Example                                          |
|----------|---------------------|--------------------------------------------------|
| `\|`     | Bitwise OR          | `(3\|4 )` *output `7`*                           |
| `&`      | Bitwise AND         | `(4&2 )`  *output `0`*                           |
| `<<`     | Bitwise shift left  | `(1<<2)` *output `4`*                            |
| `>>`     | Bitwise shift right | `(4>>1)` *output `2`*                            |
| `~`      | Bitwise NOT urinary | `( ~1 )`   *output `-2` or `0xfffffffffffffffe`* |

## Arithmetic operator

| Operator | Description | Example                |
|----------|-------------|------------------------|
| `+`      | Add         | `(1 + 1)` *output `2`* |
| `-`      | Subtract    | `(2 - 1)` *output `1`* |
| `*`      | Multiply    | `(2 * 2)` *output `4`* |
| `/`      | Divide      | `(4 / 2)` *output `2`* |
| `%`      | Modulo      | `(4 % 2)` *output `0`* |

## String operator

| Operator | Description | Example                |
|----------|-------------|------------------------|
| `\|\|`   | Concatenate | `'Hello'\|\| ',' \|\| 'World'` *output `Hello,World`* |

## Boolean operator

| Operator | Description         | Example                         |
|----------|---------------------|---------------------------------|
| `=`      | Equal               | `(1 = 3)` *output `FALSE`*      |
| `>`      | Greater than        | `(1 > 3)` *output `FALSE`*      |
| `<`      | Less than           | `(1 < 3)` *output `TRUE`*       |
| `>=`     | Greater or equal to | `(3 >= 3)` *output `TRUE`*      |
| `<=`     | Less or equal to    | `(3 <= 5)` *output `TRUE`*      |
| `<>`     | Not equal           | `(1 <> 3)` *output `TRUE`*      |
| `!=`     | Not equal           | `(1 != 3)` *output `TRUE`*      |
| `OR`     | OR op               | `(1=2 OR 1=1)` *output `TRUE`*  |
| `AND`    | AND op              | `(1=1 AND 1=1)` *output `TRUE`* |
| `NOT`    | NOT unary op        | `NOT (1=1)` *output `FALSE`*    |

## Scalar built-in functions

Following is list of built-in scalar functions

| Function             | Description                                                                                                                                                                                                                                        |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `abs(X)`             | The `abs(X)` function returns the absolute value of the numeric argument `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#abs)                                                                                                          |
| `char(X1,X2,...,XN)` | The `char(X1,X2,...,XN)` function returns a string composed of characters having the unicode code point values of integers `X1` through `XN`, respectively.[Read more.](https://www.sqlite.org/lang_corefunc.html#char)                                                                                                                                                                                       |
| `coalesce(X,Y,...)`  | The `coalesce()` function returns a copy of its first non-NULL argument, or `NULL` if all arguments are `NULL`. [Read more.](https://www.sqlite.org/lang_corefunc.html#coalesce)                                                                   |
| `format(FORMAT,...)` | The `format(FORMAT,...)` SQL function works like the `sqlite3_mprintf()`. [Read more.](https://www.sqlite.org/lang_corefunc.html#format)                                                                                                           |
| `glob(X,Y)`          | The `glob(X,Y)` use glob syntax. [Read more.](https://www.sqlite.org/lang_corefunc.html#glob)                                                                                                                                                      |
| `ifnull(X,Y)`        | The `ifnull()` function returns a copy of its first non-NULL argument, or `NULL` if both arguments are `NULL`. [Read more.](https://www.sqlite.org/lang_corefunc.html#ifnull)                                                                      |
| `iif(X,Y,Z)`         | The `iif(X,Y,Z)` function returns the value `Y` if `X` is true, and `Z` otherwise. [Read more.](https://www.sqlite.org/lang_corefunc.html#iif)                                                                                                     |
| `instr(X,Y)`         | The `instr(X,Y)` function finds the first occurrence of string `Y` within string `X` and returns the number of prior characters plus `1`, or `0` if `Y` is nowhere found within `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#instr) |
| `length(X)`          | Return length of a value according to its type. [Read more.](https://www.sqlite.org/lang_corefunc.html#length)                                                                                                                                     |
| `like(X,Y[,Z])`      | The `like()` function is used to implement the `Y LIKE X [ESCAPE Z]` expression. [Read more.](https://www.sqlite.org/lang_corefunc.html#like)                                                                                                      |
| `lower(X)`           | The `lower(X)` function returns a copy of string `X` with all ASCII characters converted to lower case. [Read more.](https://www.sqlite.org/lang_corefunc.html#lower)                                                                              |
| `ltrim(X,Y[,Z])`     | The `ltrim(X,Y)` function returns a string formed by removing any and all characters that appear in `Y` from the left side of `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#ltrim)                                                                                                                                                                                      |
| `max(X,Y,...)`       | The multi-argument `max()` function returns the argument with the maximum value, or return `NULL` if any argument is `NULL`. [Read more.](https://www.sqlite.org/lang_corefunc.html#max)                                                                                                                                                                                        |
| `min(X,Y,...)`       | The multi-argument `min()` function returns the argument with the minimum value.[Read more.](https://www.sqlite.org/lang_corefunc.html#min)                                                                                                                                                                                        |
| `nullif(X,Y)`        | The `nullif(X,Y)` function returns its first argument if the arguments are different and `NULL` if the arguments are the same. [Read more.](https://www.sqlite.org/lang_corefunc.html#nullif)                                                                                                                                                                                     |
| `octet_length(X)`    | The `octet_length(X)` function returns the number of bytes in the encoding of text string `X`.[Read more.](https://www.sqlite.org/lang_corefunc.html#octet_length)                                                                                                                                                                               |
| `printf(FORMAT,...)` | The `printf()` SQL function is an alias for the `format()` SQL function. [Read more.](https://www.sqlite.org/lang_corefunc.html#printf)                                                                                                                                                                                     |
| `quote(X)`           | The `quote(X)` function returns the text of an SQL literal which is the value of its argument suitable for inclusion into an SQL statement. [Read more.](https://www.sqlite.org/lang_corefunc.html#quote)                                                                                                                                                                                      |
| `random()`           | The `random()` function returns a pseudo-random integer between `-9223372036854775808` and `+9223372036854775807`. [Read more.](https://www.sqlite.org/lang_corefunc.html#random)                                                                                                                                                                                     |
| `randomblob(N)`      | The `randomblob(N)` function return an N-byte blob containing pseudo-random bytes. [Read more.](https://www.sqlite.org/lang_corefunc.html#randomblob)                                                                                                                                                                                 |
| `replace(X,Y,Z)`     | The `replace(X,Y,Z)` function returns a string formed by substituting string `Z` for every occurrence of string `Y` in string `X`.[Read more.](https://www.sqlite.org/lang_corefunc.html#replace)                                                                                                                                                                                    |
| `round(X[,Y])`       | The `round(X,Y)` function returns a floating-point value `X` rounded to `Y` digits to the right of the decimal point. [Read more.](https://www.sqlite.org/lang_corefunc.html#round)                                                                                                                                                                                      |
| `rtrim(X[,Y])`       | The `rtrim(X,Y)` function returns a string formed by removing any and all characters that appear in `Y` from the right side of `X`.[Read more.](https://www.sqlite.org/lang_corefunc.html#rtrim)                                                                                                                                                                                      |
| `sign(X)`            | The `sign(X)` function returns `-1`, `0`, or `+1` if the argument `X` is a numeric value that is negative, zero, or positive, respectively. [Read more.](https://www.sqlite.org/lang_corefunc.html#sign)                                                                                                                                                                                       |
| `soundex(X)`         | The `soundex(X)` function returns a string that is the soundex encoding of the string `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#soundex)                                                                                                                                                                                    |
| `substr(X,Y[,Z])`    | The `substr(X,Y,Z)` function returns a substring of input string `X` that begins with the `Y-th` character and which is `Z` characters long. [Read more.](https://www.sqlite.org/lang_corefunc.html#substr)                                                                                                                                                                                     |
| `trim(X[,Y])`        | The `trim(X,Y)` function returns a string formed by removing any and all characters that appear in `Y` from both ends of `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#trim)                                                                                                                                                                                       |
| `typeof(X)`          | The `typeof(X)` function returns a string that indicates the datatype of the expression `X`: "null", "integer", "real", "text", or "blob". [Read more.](https://www.sqlite.org/lang_corefunc.html#typeof)                                                                                                                                                                                     |
| `unhex(X[,Y])`       | The `unhex(X,Y)` function returns a `BLOB` value which is the decoding of the hexadecimal string `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#unhex)                                                                                                                                                                                      |
| `upper(X)`           | The `upper(X)` function returns a copy of input string `X` in which all lower-case ASCII characters are converted to their upper-case equivalent. [Read more.](https://www.sqlite.org/lang_corefunc.html#upper)                                                                                                                                                                                      |

## Window functions

A window function is an SQL function where the input values are taken from a "window" of one or more rows in the results set of a SELECT statement.

Window functions are distinguished from other SQL functions by the presence of an OVER clause. If a function has an OVER clause, then it is a window function. If it lacks an OVER clause, then it is an ordinary aggregate or scalar function. Window functions might also have a FILTER clause in between the function and the OVER clause.

Here is an example using the built-in row_number() window function:
```sql
SELECT row_number() OVER (ORDER BY a) AS row_number FROM test.Foo;
```

[Read more.](https://www.sqlite.org/windowfunctions.html#introduction_to_window_functions)

### Window name

Named window definition clauses may also bee added to a `SELECT` statement using a `WINDOW` clause and then referred to by name within window function invocations.
For example:
```sql
SELECT x, y, row_number() OVER win1, rank() OVER win2
FROM t0
WINDOW win1 AS (ORDER BY y RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
       win2 AS (PARTITION BY y ORDER BY x)
ORDER BY x;
```

It is possible to define one window in terms of another. Specifically, the shorthand allows the new window to implicitly copy the PARTITION BY and optionally ORDER BY clauses of the base window. For example, in the following:
```sql
SELECT group_concat(b, '.') OVER (
  win ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)
FROM t1
WINDOW win AS (PARTITION BY a ORDER BY c);
```

[Read more.](https://www.sqlite.org/windowfunctions.html#window_chaining)

### The `PARTITION BY` clause

For the purpose of computing window functions, the result set of a query is divided into one or more "partitions". A partition consists of all rows that have the same value for all terms of the `PARTITION BY` clause in the window-defn. If there is no `PARTITION BY` clause, then the entire result set of the query is a single partition. Window function processing is performed separately for each partition.

For example:
```sql
SELECT row_number() over (PARTITION BY a) FROM test.Foo;
```

[Read more.](https://www.sqlite.org/windowfunctions.html#the_partition_by_clause)

### Window frame specifications

The `frame specification` determines which output rows are read by an `aggregate window function`. The `frame specification` consists of four parts:
- A frame type,
- A starting frame boundary,
- An ending frame boundary,
- An `EXCLUDE` clause.

Ending frame boundary and `EXCLUDE` clause are `optional`.

#### Frame type

There are three frame types: `ROWS`, `GROUPS`, and `RANGE`. The frame type determines how the starting and ending boundaries of the frame are measured.
- `ROWS`: The ROWS frame type means that the starting and ending boundaries for the frame are determined by counting individual rows relative to the current row.
- `GROUPS`: The GROUPS frame type means that the starting and ending boundaries are determine by counting "groups" relative to the current group. A "group" is a set of rows that all have equivalent values for all all terms of the window ORDER BY clause. ("Equivalent" means that the IS operator is true when comparing the two values.) In other words, a group consists of all peers of a row.
- `RANGE`: The RANGE frame type requires that the `ORDER BY` clause of the window have exactly one term. Call that term `X`. With the `RANGE` frame type, the elements of the frame are determined by computing the value of expression `X` for all rows in the partition and framing those rows for which the value of `X` is within a certain range of the value of `X` for the current row.

[Read more.](https://www.sqlite.org/windowfunctions.html#frame_type)

#### Frame boundaries

There are five ways to describe starting and ending frame boundaries:
- `UNBOUNDED PRECEDING`: The frame boundary is the first row in the partition.
- `<expr> PRECEDING`: `<expr>` must be a non-negative constant numeric expression. The boundary is a row that is `<expr>` "units" prios to the current row. The meaning of "units" here depends on the frame type:
    - `ROWS`: The frame boundary is the row that is `<expr>` rows before the current row, or the first row of the partition if there are fewer than `<expr>` rows before the current row. `<expr>` must be an integer.
    - `GROUPS`: A "group" is a set of peer rows - rows that all have the same values for every term in the `ORDER BY` clause. The frame boundary is the group that is `<expr>` groups before the group containing the current row, or the first group of the partition if there are fewer than `<expr>` groups before the current row.
    - `RANGE`: For this form, the `ORDER BY` clause of the window definition must have a single term. Call that `ORDER BY` term `X`. Let `Xi` be the value of the X expression for the i-th row in the partition and let `Xc` be the value of `X` for the current row. Informally, a `RANGE` bound is the first row for which Xi is within the <expr> of Xc.
- `CURRENT ROW`: The current row. For `RANGE` and `GROUPS` frame types, peers of the current row are also included in the frame, unless specifically excluded by the `EXCLUDE` clause.
- `<expr> FOLLOWING`: This is the same as `<expr> PRECEDING` except that the boundary is `<expr>` units after the current rather than before the current row.
- `UNBOUNDED FOLLOWING`: The frame boundary is the last row in the partition.

[Read more.](https://www.sqlite.org/windowfunctions.html#frame_boundaries)

#### The `EXCLUDE` clause

The optional `EXCLUDE` clause may take any of the following four forms:
- `EXCLUDE NO OTHERS`: This is the default. In this case no rows are excluded from the window frame as defined by its starting and ending frame boundaries.
- `EXCLUDE CURRENT ROW`: In this case the current row is excluded from the window frame. Peers of the current row remain in the frame for the `GROUPS` and `RANGE` frame types.
- `EXCLUDE GROUP`: In this case the current row and all other rows that are peers of the current row are excluded from the frame. When processing an `EXCLUDE` clause, all rows with the same `ORDER BY` values, or all rows in the partition if there is no `ORDER BY` clause, are considered peers, even if the frame type is `ROWS`.
- `EXCLUDE TIES`: In this case the current row is part of the frame, but peers of the current row are excluded.

[Read more.](https://www.sqlite.org/windowfunctions.html#the_exclude_clause)

Here are some examples with window frames:
```sql
SELECT
group_concat(b, '.') OVER (
    ORDER BY c GROUPS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS
),
group_concat(b, '.') OVER (
    ORDER BY c ROWS UNBOUNDED PRECEDING
)
FROM test.Foo;
```

### The `FILTER` clause

If a `FILTER` clause is provided, then only rows for which the expr is true are included in the window frame. The aggregate window still returns a value for every row, but those for which the FILTER expression evaluates to other than true are not included in the window frame for any row. [More info.](https://www.sqlite.org/windowfunctions.html#the_filter_clause)

### Window built-in functions

ECSql supports the following built-in window functions:

| Function                      | Description                                                                                                                                                                                                                                                                                                                                       |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `row_number()`                | The `row_number()` function returns a number of the row within the current partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                                                         |
| `rank()`                      | The `rank()` function returns a row_number() of the first peer in each group - the rank of the current row with gaps. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                         |
| `dense_rank()`                | The `dense_rank()` function returns a number of the current row's peer group within its partition - the rank of the current row without gaps. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                 |
| `percent_rank()`              | The `percent_rank()` function returns a value between `0.0` and `1.0` equal to `(rank - 1) / (partition-rows - 1)`, where `rank` is the value returned by `rank()` and `partition-rows` is the total number of rows in the partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                         |
| `cume_dist()`                 | The `cume_dist()` function returns a number, which is calculated as `row-number / partition-rows`, where `row-number` is the value returned by `row_number()` for the last peer in the last group and `partition-rows` the number of rows in the partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)   |
| `ntile(N)`                    | The `ntile(N)` function divides the partition into `N` groups as evenly as possible and assigns an integer between `1` and `N` to each group. Argument `N` is handled as an integer. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                          |
| `lag(expr)`                   | The first form of the `lag()` function returns the result of evaluating expression `expr` agains the previous row in the partition. Or, if there is no previous row, `NULL`. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                  |
| `lag(expr, offset)`           | If the `offset` argument is provided, then it must be a non-negative integer. In this case the value returned is the result of evaluating `expr` against the row `offset` rows after the current row within the partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                    |
| `lag(expr, offset, default)`  | If the `default` is also provided, then it is returned instead of `NULL` if the row identified by `offset` does not exist. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                    |
| `lead(expr)`                  | The first form of the `lead()` function returns the result of evaluating expression `expr` against the next row in the partition. Or, if there is no next row, `NULL`. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                        |
| `lead(expr, offset)`          | If the `offset` argument is provided, then it must be a non-negative integer. In this case the value returned is the result of evaluating `expr` against the row `offset` rows after the current row within partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                        |
| `lead(expr, offset, default)` | If `default` is also provided, then it is returned instead of `NULL` if the row identified by `offset` does not exist. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                        |
| `first_value(expr)`           | The function `first_value(expr)` calculates the window frame for each row in the same way as an aggregate window function. It returns the value of `expr` evaluated against the first row in thw window frame for each row. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                   |
| `last_value(expr)`            | The function `last_value(expr)` calculates the window frame for each row in the same way as an aggregate window function. It returns the value of `expr` evaluated against the last row in the window frame for each row. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                     |
| `nth_value(expr, N)`          | The functions `nth_value(expr, N)` calculates the window frame for each row in the same way as an aggregate window function. It returns the value of `expr` evaluated against the row `N` in the window frame. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                |

## Date/Time Literal

### `TIMESTAMP`

Describe a literal timestamp value. Timestamp is provided according to
[iso-8601](https://en.wikipedia.org/wiki/ISO_8601) standard.

```bnf
TIMESTAMP <iso-8601-timestamp>
```

Following example use [strftime()](https://www.sqlite.org/lang_datefunc.html) to extract date/time component from a timestamp value.

```sql
SELECT strftime('%m/%d/%Y %H:%M:%S', TIMESTAMP '2013-02-09T12:01:22') AS [output]
```

Output look like following

```text
output
--------------------
02/09/2013 12:01:22
```

### `DATE`

Describe a literal timestamp value. Timestamp is provided according to
[iso-8601](https://en.wikipedia.org/wiki/ISO_8601) standard.

```bnf
DATE <iso-8601-date>
```

Following example use [strftime()](https://www.sqlite.org/lang_datefunc.html) to extract date component from a date literal value.

```sql
SELECT strftime('%m/%d/%Y', DATE '2013-02-09') AS [output]
```

Output look like following

```text
output
--------------------
02/09/2013
```

### `TIME`

Describe a literal timestamp value. Timestamp is provided according to
[iso-8601](https://en.wikipedia.org/wiki/ISO_8601) standard.

```bnf
DATE <iso-8601-time>
```

Following example use [strftime()](https://www.sqlite.org/lang_datefunc.html) to extract time component from a time literal value.

```sql
SELECT strftime('%H:%M:%S', TIME '12:01:22') AS [output]
```

Output look like following

```text
output
--------------------
12:01:22
```

## NULL, NUMBER, STRING & BOOLEAN Literals

ECSQL support following primitive types but not all can be declared as literal in ECSQL though can be inserted/updated and queried in ECSQL.

| Type      | Declared in ECSQL | Descriptions                                 |
|-----------|-------------------|----------------------------------------------|
| `Integer` | Yes               | 32bit integer                                |
| `Long`    | Yes               | 64bit integer                                |
| `Double`  | Yes               | Stored as 8-byte IEEE floating point number |
| `String`  | Yes               | UTF-8 encoded string                         |
| `Boolean` | Yes               | True/False. stored as single byte integer     |
| `Point2d` | No                | *Cannot be declared in ECSQL*                |
| `Point3d` | No                | *Cannot be declared in ECSQL*                |
| `Binary`  | No                | *Cannot be declared in ECSQL*                |

```sql
-- integer / long
SELECT 12344, 0xfffff

-- double
SELECT 1.3, -3.3e-1

-- concatenated string
SELECT 'Hello' || ',' || ' ' || 'World',

-- boolean
SELECT true, false

-- null
SELECT NULL
```

## CASE-WHEN-THEN-ELSE

ECSQL supports only searched CASE expressions:

```sql
CASE
      WHEN <expr> THEN <expr>
    [ WHEN <expr> THEN <expr> ...]
    [ ELSE <expr> ]
END
```

### Limitations

Only primitive type can be used with WHEN, THEN and ELSE. Primitive does not include p2d, p3d, IGeometery and NavigationProperties. You can still use sub-queries that return single column and pretty much any SQL expressions.

### Example

```sql
-- CASE without ELSE. Returns NULL if the IF case is not met
SELECT
    CASE
         WHEN Length > 1 THEN 'Big'
    END
FROM test.Foo

-- CASE with ELSE. If Length is not greater than 1 then the ELSE expression is returned.
SELECT
    CASE
        WHEN Length > 1 THEN 'Big'
        ELSE 'Small'
    END
FROM test.Foo

-- Multiple CASE with ELSE
SELECT
    CASE
        WHEN weekDay=1 THEN 'Mon'
        WHEN weekDay=2 THEN 'Tue'
        WHEN weekDay=3 THEN 'Wen'
        WHEN weekDay=4 THEN 'Thr'
        WHEN weekDay=5 THEN 'Fri'
        WHEN weekDay=6 THEN 'Sat'
        WHEN weekDay=7 THEN 'Sun'
        ELSE 'Wrong value'
    END
FROM test.Foo
```

## IIF ( *condition-expr*, *true-expr* , *false-expr* )

ECSQL supports IIF(), which is really shorthand for `CASE WHEN <condition-expr> THEN <true-expr> ELSE <false-expr> END`

### Parameters

`condition-expr`: A condition expression that resolve into a boolean value. e.g. Length > 1.0.

`true-expr`: Value returned when the `condition-expr` is evaluated to a *true* value.

`false-expr`: Value returned when the `condition-expr` is evaluated to a *false* value.

### Example

```sql
-- Returns 'Big' if Length is greater than 1, and 'Small' otherwise
SELECT IIF(Length > 1.0, 'Big', 'Small') FROM test.Foo;

-- Returns DisplayLabel if Name is NULL, and Name otherwise
SELECT IIF(Name IS NULL, DisplayLabel, Name) FROM test.Foo;
```
