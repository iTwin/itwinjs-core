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
