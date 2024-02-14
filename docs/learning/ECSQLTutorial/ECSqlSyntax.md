# ECSql Syntax & Features

1. Operators
   1. [Bitwise operator](#bitwise-operator)
   1. [Arithmetic operator](#arithmetic-operator)
   1. [String operator](#string-operator)
   1. [Boolean operator](#boolean-operator)
1. Built-in functions
   1. [Scalar SQLite built-in functions](#scalar-sqlite-built-in-functions)
   1. [ECSQL Built-In functions](#ecsql-built-in-functions)
1. [JSON1 virtual classes](#json1-virtual-classes)
   1. [json_tree()](#json_tree)
   1. [json_each()](#json_each)
1. [Polymorphic vs non-polymorphic query](#polymorphic-vs-non-polymorphic-query)
1. [ECSQLOPTIONS or OPTIONS clause](#ecsqloptions-or-options-clause)
1. [Window functions](#window-functions)
1. [DATE, TIME & TIMESTAMP Literals](#date-time--timestamp-literals)
1. [NULL, NUMBER, STRING & BOOLEAN Literals](#null-number-string--boolean-literals)
1. [CASE-WHEN-THEN-ELSE](#case-when-then-else)
1. [IIF (_condition-expr_, _true-expr_, _false-expr_)](#iif-condition-expr-true-expr-false-expr)
1. [LIKE operator](#like-operator)
1. [CAST operator](#cast-operator)
1. [LIMIT clause](#limit-clause)
1. [GROUP BY clause](#group-by-clause)
1. [CTE (_Common table expression_)](#common-table-expression)
1. [Type filter](#type-filter)
1. [ORDER BY clause](#order-by-clause)
1. [ECSQL Parameters](#ecsql-parameters)
1. [Compound SELECT](#compound-select)
1. JOINs
   1. [JOIN USING](#join-using)
   1. [INNER JOIN](#inner-join)
   1. [OUTER JOIN](#outer-join)
1. [Instance query](#instance-query)
1. [Pragmas](#pragmas)
   1. [help](#pragma-help)
   1. [ecdb_ver](#pragma-ecdb_ver)
   1. [experimental_features_enabled](#pragma-experimental_features_enabled)
   1. [integrity_check](#pragma-integrity_check-experimental)
1. [ECSQL Keywords](#ecsql-keywords)
1. [Escaping keywords](#escaping-keywords)

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
| `OR`     | OR op               | `(1=2 OR 1=1)` _output `TRUE`_  |
| `AND`    | AND op              | `(1=1 AND 1=1)` _output `TRUE`_ |
| `NOT`    | NOT unary op        | `NOT (1=1)` _output `FALSE`_    |

## Scalar SQLite built-in functions

Following is list of built-in scalar functions

| Function             | Description                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `abs(X)`             | The `abs(X)` function returns the absolute value of the numeric argument `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#abs)                                                                                                          |
| `char(X1,X2,...,XN)` | The `char(X1,X2,...,XN)` function returns a string composed of characters having the unicode code point values of integers `X1` through `XN`, respectively.[Read more.](https://www.sqlite.org/lang_corefunc.html#char)                            |
| `coalesce(X,Y,...)`  | The `coalesce()` function returns a copy of its first non-NULL argument, or `NULL` if all arguments are `NULL`. [Read more.](https://www.sqlite.org/lang_corefunc.html#coalesce)                                                                   |
| `format(FORMAT,...)` | The `format(FORMAT,...)` SQL function works like the `sqlite3_mprintf()`. [Read more.](https://www.sqlite.org/lang_corefunc.html#format)                                                                                                           |
| `glob(X,Y)`          | The `glob(X,Y)` use glob syntax. [Read more.](https://www.sqlite.org/lang_corefunc.html#glob)                                                                                                                                                      |
| `ifnull(X,Y)`        | The `ifnull()` function returns a copy of its first non-NULL argument, or `NULL` if both arguments are `NULL`. [Read more.](https://www.sqlite.org/lang_corefunc.html#ifnull)                                                                      |
| `iif(X,Y,Z)`         | The `iif(X,Y,Z)` function returns the value `Y` if `X` is true, and `Z` otherwise. [Read more.](https://www.sqlite.org/lang_corefunc.html#iif)                                                                                                     |
| `instr(X,Y)`         | The `instr(X,Y)` function finds the first occurrence of string `Y` within string `X` and returns the number of prior characters plus `1`, or `0` if `Y` is nowhere found within `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#instr) |
| `length(X)`          | Return length of a value according to its type. [Read more.](https://www.sqlite.org/lang_corefunc.html#length)                                                                                                                                     |
| `like(X,Y[,Z])`      | The `like()` function is used to implement the `Y LIKE X [ESCAPE Z]` expression. [Read more.](https://www.sqlite.org/lang_corefunc.html#like)                                                                                                      |
| `lower(X)`           | The `lower(X)` function returns a copy of string `X` with all ASCII characters converted to lower case. [Read more.](https://www.sqlite.org/lang_corefunc.html#lower)                                                                              |
| `ltrim(X,Y[,Z])`     | The `ltrim(X,Y)` function returns a string formed by removing any and all characters that appear in `Y` from the left side of `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#ltrim)                                                   |
| `max(X,Y,...)`       | The multi-argument `max()` function returns the argument with the maximum value, or return `NULL` if any argument is `NULL`. [Read more.](https://www.sqlite.org/lang_corefunc.html#max)                                                           |
| `min(X,Y,...)`       | The multi-argument `min()` function returns the argument with the minimum value.[Read more.](https://www.sqlite.org/lang_corefunc.html#min)                                                                                                        |
| `nullif(X,Y)`        | The `nullif(X,Y)` function returns its first argument if the arguments are different and `NULL` if the arguments are the same. [Read more.](https://www.sqlite.org/lang_corefunc.html#nullif)                                                      |
| `octet_length(X)`    | The `octet_length(X)` function returns the number of bytes in the encoding of text string `X`.[Read more.](https://www.sqlite.org/lang_corefunc.html#octet_length)                                                                                 |
| `printf(FORMAT,...)` | The `printf()` SQL function is an alias for the `format()` SQL function. [Read more.](https://www.sqlite.org/lang_corefunc.html#printf)                                                                                                            |
| `quote(X)`           | The `quote(X)` function returns the text of an SQL literal which is the value of its argument suitable for inclusion into an SQL statement. [Read more.](https://www.sqlite.org/lang_corefunc.html#quote)                                          |
| `random()`           | The `random()` function returns a pseudo-random integer between `-9223372036854775808` and `+9223372036854775807`. [Read more.](https://www.sqlite.org/lang_corefunc.html#random)                                                                  |
| `randomblob(N)`      | The `randomblob(N)` function return an N-byte blob containing pseudo-random bytes. [Read more.](https://www.sqlite.org/lang_corefunc.html#randomblob)                                                                                              |
| `replace(X,Y,Z)`     | The `replace(X,Y,Z)` function returns a string formed by substituting string `Z` for every occurrence of string `Y` in string `X`.[Read more.](https://www.sqlite.org/lang_corefunc.html#replace)                                                  |
| `round(X[,Y])`       | The `round(X,Y)` function returns a floating-point value `X` rounded to `Y` digits to the right of the decimal point. [Read more.](https://www.sqlite.org/lang_corefunc.html#round)                                                                |
| `rtrim(X[,Y])`       | The `rtrim(X,Y)` function returns a string formed by removing any and all characters that appear in `Y` from the right side of `X`.[Read more.](https://www.sqlite.org/lang_corefunc.html#rtrim)                                                   |
| `sign(X)`            | The `sign(X)` function returns `-1`, `0`, or `+1` if the argument `X` is a numeric value that is negative, zero, or positive, respectively. [Read more.](https://www.sqlite.org/lang_corefunc.html#sign)                                           |
| `soundex(X)`         | The `soundex(X)` function returns a string that is the soundex encoding of the string `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#soundex)                                                                                         |
| `substr(X,Y[,Z])`    | The `substr(X,Y,Z)` function returns a substring of input string `X` that begins with the `Y-th` character and which is `Z` characters long. [Read more.](https://www.sqlite.org/lang_corefunc.html#substr)                                        |
| `trim(X[,Y])`        | The `trim(X,Y)` function returns a string formed by removing any and all characters that appear in `Y` from both ends of `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#trim)                                                         |
| `typeof(X)`          | The `typeof(X)` function returns a string that indicates the datatype of the expression `X`: "null", "integer", "real", "text", or "blob". [Read more.](https://www.sqlite.org/lang_corefunc.html#typeof)                                          |
| `unhex(X[,Y])`       | The `unhex(X,Y)` function returns a `BLOB` value which is the decoding of the hexadecimal string `X`. [Read more.](https://www.sqlite.org/lang_corefunc.html#unhex)                                                                                |
| `upper(X)`           | The `upper(X)` function returns a copy of input string `X` in which all lower-case ASCII characters are converted to their upper-case equivalent. [Read more.](https://www.sqlite.org/lang_corefunc.html#upper)                                    |

## ECSQL Built-In functions

Following is list of built-in scalar functions

ECSQL allows use of these built-in functions:

1. `ec_classname()` - Gets the formatted/qualified class name, given ECClassId as input
1. `ec_classid())` - Gets ECClassId, given a formatted/qualified class name as input
1. `regexp()` - test if a text matches a regex.
1. `regexp_extract()` - extract and rewrite matching regex group from a string value.
1. `strToGuid()` - covert string guid to binary guid.
1. `guidToStr()` - covert binary guid to string guid.

## ec_classname( _ecclassId_ [, *format-string* | *format-id*] )

For the specified ecClassId, returns the class name as a string formatted according to the specified format-string

### Parameters

`ecclassId`: An integer which could be a constant, column or a parameter.
`format-string | format-id`: Optional format specifier and could be one of the following values. `NULL` is also valid value -- this is the same as not specifying the second parameter at all

| format-id | format-string | output                    |
| --------- | ------------- | ------------------------- |
| 0         | `s:c`         | BisCore:Element (default) |
| 1         | `a:c`         | bis:Element               |
| 2         | `s`           | BisCore                   |
| 3         | `a`           | bis                       |
| 4         | `c`           | Element                   |
| 5         | `s.c`         | BisCore.Element           |
| 6         | `a.c`         | bis.Element               |

### Returns

className as specified by format, or `NULL` if it was unable to resolve `ECClassId`, or if the format specifier was not recognized.

Note that this can also cause `ECSqlStatement::Step()` to return `BE_SQLITE_ERROR` if the incorrect number of arguments was passed in.

### Example

```sql
-- returns schema-name:classname
SELECT ec_classname([ECClassId], 's:c') FROM [BisCore].[Element]

-- same as 'sa:cn' - returns schema-alias:classname
SELECT ec_classname([ECClassId], 1) FROM bis:Element

-- returns schema-name, after filtering on it
SELECT * FROM [BisCore].[Element] WHERE ec_classname([ECClassId], 's') = 'BisCore'

-- returns schema-alias after filtering on it
SELECT * FROM [BisCore].[Element] WHERE ec_classname([ECClassId], 3) = 'bis'

-- only get classname and filter on classname
SELECT * FROM [BisCore].[Element] WHERE ec_classname([ECClassId], 'c') = 'PUMP'
```

## ec_classId('_schema-name-or-alias_ : | . _classname_' )

For the specified (qualified) class name, returns the `ECCassId`.

Note that this function can also take in two arguments - in the following form where _schema-name-or-alias_ and _classname_ can be specified separately.
`ec_classid[ '<schema-name-or-alias>',  '<classname>')`

## Parameters

Can take either one or two parameters:
`schema-name-or-alias`: Schema name or alias e.g. bis (alias) or BisCore (name)
`class-name`: Name of the class e.g. Element

### Returns

The function return a integer `ECClassId` or `NULL` if the name could not be resolved.

Note that this can also cause `ECSqlStatement::Step()` to return `BE_SQLITE_ERROR` if the incorrect number of arguments was passed in.

### Example

```sql
-- alias or schema name both can be specified
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('opm.PUMP'), ec_classid('opm.VALVE'))
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('OpenPlant.PUMP'), ec_classid('OpenPlant.VALVE'))

-- both '.' and ':' delimiter can be used
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('opm:PUMP'), ec_classid('opm:VALVE'))
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('OpenPlant:PUMP'), ec_classid('OpenPlant:VALVE'))

-- schema name or alias and class name can be specified as two arguments
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('opm', 'PUMP'), ec_classid('opm', 'VALVE'))
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('OpenPlant', 'PUMP'), ec_classid('OpenPlant', 'VALVE'))

```

### REGEXP ( _regex_, _value_ )

Regex uses [google/re2](https://github.com/google/re2/wiki/Syntax) engine.

```sql
SELECT DisplayLabel FROM meta.ECClassDef c WHERE REGEXP('Terrain\s\w+', c.DisplayLabel);

DisplayLabel
--------------------
Terrain Boundary
Terrain Breakline
Terrain Drape Boundary
Terrain Drape Void
Terrain Hole
Terrain Island
Terrain Reference
Terrain Source Contour
Terrain Spot Elevation
Terrain Void
```

### REGEXP_EXTRACT ( _value_, _regex_ [, *rewrite*] )

Regex uses [google/re2](https://github.com/google/re2/wiki/Syntax) engine.
This function can be used to extract or rewrite the output. Parameter `rewrite` is made of group reference where `\0` refer to text captured by whole regex specified. `\1`, `\2` `...` refer to regex capture group in that order.

```sql
-- In follow we rewrite the string by swapping first and second capture group
SELECT
    REGEXP_EXTRACT(DisplayLabel,'(\w+)\s+(\w+)', '\2,\1')
FROM meta.ECClassDef c
    WHERE REGEXP('Terrain\s\w+', c.DisplayLabel);

REGEXP_EXTRACT(ECClassDef.[DisplayLabel],'(\w+)\s+(\w+)','\2,\1')
-----------------------------------------------------------------
Boundary,Terrain
Breakline,Terrain
Drape,Terrain
Drape,Terrain
Hole,Terrain
Island,Terrain
Reference,Terrain
Source,Terrain
Spot,Terrain
Void,Terrain
```

### StrToGuid( _guid-string_ )

When `GUID` is stored a binary, it need to be converted for comparison purpose.

```sql
SELECT * FROM [BisCore].[Element] WHERE FederationGuid = StrToGuid('407bfa18-944d-11ee-b9d1-0242ac120002')
```

### GuidToString( _binary-guid_ )

When `GUID` is stored a binary, it need to be converted for comparison purpose.

```sql
SELECT * FROM [BisCore].[Element] WHERE GuidToString(FederationGuid) = '407bfa18-944d-11ee-b9d1-0242ac120002'
```

## JSON1 virtual classes

This EC wrapper for JSON1 SQLite extension. It allow you to enumerate json document as table.

### json_tree()

Recursively iterate over all items in json.

```sql
select s.* from json1.json_tree('{
        "planet": "mars",
        "gravity": "3.721 m/s²",
        "surface_area": "144800000 km²",
        "distance_from_sun":"227900000 km",
        "radius" : "3389.5 km",
        "orbital_period" : "687 days",
        "moons": ["Phobos", "Deimos"]
    }') s;
```

| key               | value                                                                                                                                                                                   | type   | atom          | parent | fullkey               | path    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- | ------ | --------------------- | ------- |
| NULL              | {"planet":"mars","gravity":"3.721 m/sy","surface_area":"144800000 kmy","distance_from_sun":"227900000 km","radius":"3389.5 km","orbital_period":"687 days","moons":["Phobos","Deimos"]} | object | NULL          | NULL   | $                     | $       |
| planet            | mars                                                                                                                                                                                    | text   | mars          | 0      | $.planet              | $       |
| gravity           | 3.721 m/sy                                                                                                                                                                              | text   | 3.721 m/sy    | 0      | $.gravity             | $       |
| surface_area      | 144800000 kmy                                                                                                                                                                           | text   | 144800000 kmy | 0      | $."surface_area"      | $       |
| distance_from_sun | 227900000 km                                                                                                                                                                            | text   | 227900000 km  | 0      | $."distance_from_sun" | $       |
| radius            | 3389.5 km                                                                                                                                                                               | text   | 3389.5 km     | 0      | $.radius              | $       |
| orbital_period    | 687 days                                                                                                                                                                                | text   | 687 days      | 0      | $."orbital_period"    | $       |
| moons             | ["Phobos","Deimos"]                                                                                                                                                                     | array  | NULL          | 0      | $.moons               | $       |
| 0                 | Phobos                                                                                                                                                                                  | text   | Phobos        | 14     | $.moons[0]            | $.moons |
| 1                 | Deimos                                                                                                                                                                                  | text   | Deimos        | 14     | $.moons[1]            | $.moons |

### json_each()

Iterate top level json and return each entry as row.

```sql
select s.* from json1.json_each('{
        "planet": "mars",
        "gravity": "3.721 m/s²",
        "surface_area": "144800000 km²",
        "distance_from_sun":"227900000 km",
        "radius" : "3389.5 km",
        "orbital_period" : "687 days",
        "moons": ["Phobos", "Deimos"]
    }') s;
```

outputs following result

| key               | value               | type  | atom          | parent | fullkey               | path |
| ----------------- | ------------------- | ----- | ------------- | ------ | --------------------- | ---- |
| planet            | mars                | text  | mars          | NULL   | $.planet              | $    |
| gravity           | 3.721 m/sy          | text  | 3.721 m/sy    | NULL   | $.gravity             | $    |
| surface_area      | 144800000 kmy       | text  | 144800000 kmy | NULL   | $."surface_area"      | $    |
| distance_from_sun | 227900000 km        | text  | 227900000 km  | NULL   | $."distance_from_sun" | $    |
| radius            | 3389.5 km           | text  | 3389.5 km     | NULL   | $.radius              | $    |
| orbital_period    | 687 days            | text  | 687 days      | NULL   | $."orbital_period"    | $    |
| moons             | ["Phobos","Deimos"] | array | NULL          | NULL   | $.moons               | $    |

## Polymorphic vs non-polymorphic query

ECSQL support polymorphic query by default unless use use `ONLY` keyword.

Syntax: `[ALL|ONLY] <className>`

### Polymorphic query

```sql
SELECT * FORM [BisCore].[GeometricElement3d] Limit 10

-- following is same as above and all GeometricElement3d and its derived classes will be returned.
SELECT * FORM ALL [BisCore].[GeometricElement3d] Limit 10

```

### Non-Polymorphic query

Restrict result to exactly a single type of class.

```sql
SELECT * FORM ONLY [BisCore].[GeometricElement3d] Limit 10

```

## ECSQLOPTIONS or OPTIONS clause

`ECSQLOPTIONS` which can also be written as just `OPTIONS` use to specify flags thats will effect processing of ECSQL statement.

Syntax: `<select-stmt> OPTIONS option[=val] [,...]`

Here is list of supported options

1. `USE_JS_PROP_NAMES` returns json from instance accessor, compilable with iTwin.js typescript.
1. `DO_NOT_TRUNCATE_BLOB` return full blob instead of truncating it when using instance accessor.
1. `ENABLE_EXPERIMENTAL_FEATURES` enable experimental features.

Get instance as json which is compatible with itwin.js.

```sql
SELECT $ FROM [BisCore].[Element] OPTIONS USE_JS_PROP_NAMES
/*
$
--------------------
{
   "id":"0x1",
   "className":"BisCore.Subject",
   "model":{
      "id":"0x1",
      "relClassName":"BisCore.ModelContainsElements"
   },
   "lastMod":"2023-12-06T15:24:45.785Z",
   "codeSpec":{
      "id":"0x1f",
      "relClassName":"BisCore.CodeSpecSpecifiesCode"
   },
   "codeScope":{
      "id":"0x1",
      "relClassName":"BisCore.ElementScopesCode"
   },
   "codeValue":"Subject of this imodel",
   "description":""
}
*/
```

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

It is possible to define one window in terms of another. Specifically, the shorthand allows the new window to implicitly copy the `PARTITION BY` and optionally `ORDER BY` clauses of the base window. For example, in the following:

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

- `ROWS`: The `ROWS` frame type means that the starting and ending boundaries for the frame are determined by counting individual rows relative to the current row.
- `GROUPS`: The `GROUPS` frame type means that the starting and ending boundaries are determine by counting "groups" relative to the current group. A "group" is a set of rows that all have equivalent values for all all terms of the window ORDER BY clause. ("Equivalent" means that the IS operator is true when comparing the two values.) In other words, a group consists of all peers of a row.
- `RANGE`: The `RANGE` frame type requires that the `ORDER BY` clause of the window have exactly one term. Call that term `X`. With the `RANGE` frame type, the elements of the frame are determined by computing the value of expression `X` for all rows in the partition and framing those rows for which the value of `X` is within a certain range of the value of `X` for the current row.

[Read more.](https://www.sqlite.org/windowfunctions.html#frame_type)

#### Frame boundaries

There are five ways to describe starting and ending frame boundaries:

- `UNBOUNDED PRECEDING`: The frame boundary is the first row in the partition.
- `<expr> PRECEDING`: `<expr>` must be a non-negative constant numeric expression. The boundary is a row that is `<expr>` "units" prios to the current row. The meaning of "units" here depends on the frame type:
  - `ROWS`: The frame boundary is the row that is `<expr>` rows before the current row, or the first row of the partition if there are fewer than `<expr>` rows before the current row. `<expr>` must be an integer.
  - `GROUPS`: A "group" is a set of peer rows - rows that all have the same values for every term in the `ORDER BY` clause. The frame boundary is the group that is `<expr>` groups before the group containing the current row, or the first group of the partition if there are fewer than `<expr>` groups before the current row.
  - `RANGE`: For this form, the `ORDER BY` clause of the window definition must have a single term. Call that `ORDER BY` term `X`. Let `Xi` be the value of the `X` expression for the i-th row in the partition and let `Xc` be the value of `X` for the current row. Informally, a `RANGE` bound is the first row for which Xi is within the <expr> of Xc.
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

| Function                      | Description                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `row_number()`                | The `row_number()` function returns a number of the row within the current partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                                                       |
| `rank()`                      | The `rank()` function returns a row_number() of the first peer in each group - the rank of the current row with gaps. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                       |
| `dense_rank()`                | The `dense_rank()` function returns a number of the current row's peer group within its partition - the rank of the current row without gaps. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                               |
| `percent_rank()`              | The `percent_rank()` function returns a value between `0.0` and `1.0` equal to `(rank - 1) / (partition-rows - 1)`, where `rank` is the value returned by `rank()` and `partition-rows` is the total number of rows in the partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                       |
| `cume_dist()`                 | The `cume_dist()` function returns a number, which is calculated as `row-number / partition-rows`, where `row-number` is the value returned by `row_number()` for the last peer in the last group and `partition-rows` the number of rows in the partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions) |
| `ntile(N)`                    | The `ntile(N)` function divides the partition into `N` groups as evenly as possible and assigns an integer between `1` and `N` to each group. Argument `N` is handled as an integer. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                        |
| `lag(expr)`                   | The first form of the `lag()` function returns the result of evaluating expression `expr` agains the previous row in the partition. Or, if there is no previous row, `NULL`. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                |
| `lag(expr, offset)`           | If the `offset` argument is provided, then it must be a non-negative integer. In this case the value returned is the result of evaluating `expr` against the row `offset` rows after the current row within the partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                  |
| `lag(expr, offset, default)`  | If the `default` is also provided, then it is returned instead of `NULL` if the row identified by `offset` does not exist. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                  |
| `lead(expr)`                  | The first form of the `lead()` function returns the result of evaluating expression `expr` against the next row in the partition. Or, if there is no next row, `NULL`. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                      |
| `lead(expr, offset)`          | If the `offset` argument is provided, then it must be a non-negative integer. In this case the value returned is the result of evaluating `expr` against the row `offset` rows after the current row within partition. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                      |
| `lead(expr, offset, default)` | If `default` is also provided, then it is returned instead of `NULL` if the row identified by `offset` does not exist. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                                                                                                                      |
| `first_value(expr)`           | The function `first_value(expr)` calculates the window frame for each row in the same way as an aggregate window function. It returns the value of `expr` evaluated against the first row in thw window frame for each row. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                 |
| `last_value(expr)`            | The function `last_value(expr)` calculates the window frame for each row in the same way as an aggregate window function. It returns the value of `expr` evaluated against the last row in the window frame for each row. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                   |
| `nth_value(expr, N)`          | The functions `nth_value(expr, N)` calculates the window frame for each row in the same way as an aggregate window function. It returns the value of `expr` evaluated against the row `N` in the window frame. [Read more.](https://www.sqlite.org/windowfunctions.html#built_in_window_functions)                                              |

## DATE, TIME & TIMESTAMP Literals

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

| Type      | Declared in ECSQL | Descriptions                                |
| --------- | ----------------- | ------------------------------------------- |
| `Integer` | Yes               | 32bit integer                               |
| `Long`    | Yes               | 64bit integer                               |
| `Double`  | Yes               | Stored as 8-byte IEEE floating point number |
| `String`  | Yes               | UTF-8 encoded string                        |
| `Boolean` | Yes               | True/False. stored as single byte integer   |
| `Point2d` | No                | _Cannot be declared in ECSQL_               |
| `Point3d` | No                | _Cannot be declared in ECSQL_               |
| `Binary`  | No                | _Cannot be declared in ECSQL_               |

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
         WHEN [Length] > 1 THEN 'Big'
    END
FROM test.Foo

-- CASE with ELSE. If Length is not greater than 1 then the ELSE expression is returned.
SELECT
    CASE
        WHEN [Length] > 1 THEN 'Big'
        ELSE 'Small'
    END
FROM [test].[Foo]

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
FROM [test].[Foo]
```

## IIF (_condition-expr_, _true-expr_, _false-expr_)

ECSQL supports IIF(), which is really shorthand for `CASE WHEN <condition-expr> THEN <true-expr> ELSE <false-expr> END`

### Parameters

`condition-expr`: A condition expression that resolve into a boolean value. e.g. Length > 1.0.

`true-expr`: Value returned when the `condition-expr` is evaluated to a _true_ value.

`false-expr`: Value returned when the `condition-expr` is evaluated to a _false_ value.

### Example

```sql
-- Returns 'Big' if Length is greater than 1, and 'Small' otherwise
SELECT IIF([Length] > 1.0, 'Big', 'Small') FROM [test].[Foo];

-- Returns DisplayLabel if Name is NULL, and Name otherwise
SELECT IIF([Name] IS NULL, [DisplayLabel], [Name]) FROM [test].[Foo];
```

## LIKE operator

Match value to a pattern.

Syntax: `<expr> [NOT] LIKE <pattern> [ESCAPE '<char>']`

- The percent sign `%` represents zero, one, or multiple characters
- The underscore sign `_` represents one, single character

Find classes with name start with `IL`.

```sql
    -- find classes
    SELECT Name FROM [meta].[ECClassDef] WHERE [Name]  LIKE 'IL%' LIMIT 3;
    /*
    Name
    --------------------
    ILinearElement
    ILinearElementProvidedBySource
    ILinearElementSource
    */
```

`NOT LIKE` example

```sql
    -- find classes
    SELECT Name FROM [meta].[ECClassDef] WHERE [Name] NOT LIKE 'IL%' LIMIT 3;
    /*
    Name
    --------------------
    __x002A__U2_23086
    __x0037__12__x002F__7020
    __x0037__12__x002F__7030ElementAspect
    */
```

when searching for `%` or `_` we need to escape expression.

```sql
    SELECT Name FROM [meta].[ECClassDef] WHERE [Name] LIKE '\_%' ESCAPE '\' LIMIT 3;
    /*
    Name
    --------------------
    __x002A__U2_23086
    __x0037__12__x002F__7020
    __x0037__12__x002F__7030ElementAspect
    */
```

## CAST operator

Allow converting primitive value from one type to another.

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

## LIMIT clause

Limit the number of rows returned by query. The clause also set offset from which the limit on rows is applied. [Read sqlite docs](https://www.sqlite.org/lang_select.html#limitoffset)

Syntax: `LIMIT <limit> [OFFSET <offset>]`

```sql
    -- return only 10 rows.
    SELECT 1 FROM meta.ECClassDef LIMIT 10

    -- return only 10 rows from offset 10
    SELECT 1 FROM meta.ECClassDef LIMIT 10 OFFSET 10
```

## GROUP BY clause

Syntax: `GROUP BY <expr-list> [HAVING <group-filter-expr]`

Count instances of each type of class.

```sql
    SELECT EC_CLASSNAME([ECClassId]) [ClassName], COUNT(*) [InstanceCount]
    FROM [BisCore].[Element]
    GROUP BY [ECClassId]
    LIMIT 3
```

Will produce:

| ClassName                   | InstanceCount |
| --------------------------- | ------------- |
| BisCore:DrawingCategory     | 328           |
| BisCore:AnnotationTextStyle | 22            |
| BisCore:AuxCoordSystem2d    | 2s            |

Count instances of each type of class by filter out group with count less then 10.

```sql
    SELECT EC_CLASSNAME([ECClassId]) [ClassName], COUNT(*) [InstanceCount]
    FROM [BisCore].[Element]
    GROUP BY [ECClassId]
    HAVING COUNT(*)>10
    LIMIT 3;
```

Will produce:

| ClassName                   | InstanceCount |
| --------------------------- | ------------- |
| BisCore:DrawingCategory     | 328           |
| BisCore:AnnotationTextStyle | 22            |
| BisCore:CategorySelector    | 313           |

## Common table expression

Syntax:

```sql
WITH [RECLUSIVE]
    <cte-name>([args...]) AS (
        <query1>
        [UNION <query2>]
    )[, <next-cte-block>]
    <query3>
```

A simple example of cte.

```sql
WITH RECURSIVE
    c(i) AS (
        SELECT 1
        UNION
        SELECT i + 1 FROM [c] WHERE i < 4 ORDER BY 1
    )
    SELECT i FROM [c]
    /*
        i
        ------------------
        1
        2
        3
        4
    */
```

Query assembly hierarchy where Depth is greater then `10` and limit row to `100`.

```sql
WITH RECURSIVE
    assembly ([Id], [ParentId], [Code], [Label], [AssemblyPath], [Depth]) AS (
        SELECT
            [r].[ECInstanceId],
            [r].[Parent].[Id],
            [r].[CodeValue],
            [r].[UserLabel],
            COALESCE([r].[CodeValue], [r].[UserLabel]), 1
        FROM [BisCore].[Element] [r]
        WHERE [r].[Parent].[Id] IS NULL
        UNION ALL
        SELECT
            [c].[ECInstanceId],
            [c].[Parent].[Id],
            [c].[CodeValue],
            [c].[UserLabel],
            [p].[AssemblyPath] || '->' || COALESCE([c].[CodeValue], [c].[UserLabel]), [Depth] + 1
        FROM [bis].[Element] [c]
            JOIN [assembly] [p] ON [p].[Id] = [c].[Parent].[Id]
) SELECT * FROM [assembly] WHERE [Depth] > 10 LIMIT 100
```

## Type filter

Filter `ECClassId` by set of classes in polymorphic or non-polymorphic manner.

Syntax: `<classId> IS [NOT] ( [ALL|ONLY] <class-name>[, ...])`

Select element where it is of type `PUMP` or `PIPE`.

```sql
    SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IS (plant.PUMP, plant.PIPE)
```

Select element where it is exactly of type `PUMP` or `PIPE`.

```sql
    SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IS (ONLY plant.PUMP, ONLY plant.PIPE)
```

Find all the element that is not of type `PUMP` or `PIPE`

```sql
    SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IS NOT (plant.PUMP, plant.PIPE)
```

## ORDER BY clause

Sort result by set of expressions in ascending or descending order. It is also use to order nulls in result set by putting them in front or last of results.

Syntax:

```sql
ORDER BY
    <expr> [ASC|DESC] [NULLS FIRST|LAST] [,...]
```

Order classes by schema and then class name.

```sql
SELECT * FROM [meta].[ECClassDef] ORDER BY [Schema].[Id], Name
```

Order by DisplayLabel but put null values first.

```sql
SELECT * FROM [meta].[ECClassDef] ORDER BY [DisplayLabel] NULLS FIRST
```

## ECSQL Parameters

ECSQL support named and positional parameters.

### Named parameters

Name parameter can be use to bind parameter by name.

Syntax: `:<parameter-name>`

```sql
SELECT * FROM [meta].[ECClassDef] WHERE [Name] = :className
```

### Positional parameters

Positional parameter are bind by position from left to right.

Syntax: `?`

```sql
SELECT * FROM [meta].[ECClassDef] WHERE [Name] = ? AND [DisplayLabel] = ?
```

## JOIN USING

Join using automatically uses relationship definition to join two classes

Syntax: `JOIN <end-class> USING <relationship> [FORWARD|BACKWARD]`

In following we join from `Bis.Element` to `BisCore.Element` using `BisCore.ElementOwnsChildElements`. Where child element is `t0` and parent is `t1`. If we use `FORWARD` then `t0` will become child and `t1` will be parent.

```sql
    SELECT *
    FROM [BisCore].[Element] t0
        JOIN [BisCore].[Element] t1 USING [BisCore].[ElementOwnsChildElements] BACKWARD
```

## Compound SELECT

Result of `SELECT` statement can be combined with other select statements using one of following operator.

1. `UNION` - take a union of result of two queries such that there is no duplicate results.
1. `UNION ALL` - take a union of results of two queries.
1. `INTERSECT` - take only rows that are common in both queries.
1. `EXCEPT` - take rows from first queries that are not present in second query.

Simple union with no duplicate rows

```sql
SELECT 1 a ,2 b
UNION
SELECT 1 a, 2 b
/*
a | b
------
1 | 2
*/
```

Simple union with duplicate rows

```sql
SELECT 1 a ,2 b
UNION ALL
SELECT 1 a, 2 b
/*
a | b
------
1 | 2
1 | 2
*/
```

Simple intersect return only common results

```sql
SELECT 1 a ,2 b
INTERSECT
SELECT 1 a, 2 b
/*
a | b
------
1 | 2
*/
```

Except return exclude result from first query by second.

```sql
SELECT 1 a ,2 b
EXCEPT
SELECT 1 a, 2 b
/*
a | b
------
*/
```

## OUTER JOIN

Outer joins are joins that return matched values and unmatched values from either or both classes.

There are three type of OUTER JOIN.

1. LEFT JOIN
2. RIGHT JOIN
3. FULL JOIN

### LEFT JOIN

`LEFT JOIN` returns only unmatched rows from the left class, as well as matched rows in both classes

```sql

SELECT * FROM (SELECT null b) t LEFT JOIN  (SELECT 1 b) r ON t.b=r.b;
/*
b        |b_1
----------------------------
NULL     |NULL
*/
```

### RIGHT JOIN

`RIGHT JOIN` returns only unmatched rows from the right class, as well as matched rows in both classes

```sql

SELECT * FROM (SELECT null b) t RIGHT JOIN  (SELECT 1 b) r ON t.b=r.b;
/*
b        |b_1
----------------------------
NULL     |1
*/
```

### FULL JOIN

`FULL JOIN` returns all the rows from both joined classes, whether they have a matching row or not.

```sql
SELECT * FROM (SELECT null b) t FULL JOIN  (SELECT 1 b) r ON t.b=r.b;
/*
b        |b_1
----------------------------
NULL     |NULL
NULL     |1
*/
```

## INNER JOIN

Join to a class or subquery.

Syntax: `[INNER] JOIN <class|subquery> ON <join-expr>`

```sql
SELECT [schema].[Name] [Schema], [class].[Name] [Class]
FROM [meta].[ECClassDef] [class]
    INNER JOIN [meta].[ECSchemaDef] [schema] ON [class].[Schema].[Id] =  [schema].[ECInstanceId]
ORDER BY [schema].[Name], [class].[Name]
LIMIT 4;

/*
Schema              |Class
-----------------------------------------
BisCore             |AnnotationElement2d
BisCore             |AnnotationFrameStyle
BisCore             |AnnotationLeaderStyle
BisCore             |AnnotationTextStyle
*/
```

## Instance query

### What is instance property?

Instance property is any property in a class selected in ECSql or its derived classes.

### How to access instance property?

In ECSQL instance property can be accessed by using the `$->` operator.

```sql
SELECT $->[CodeValue] FROM [BisCore].[Element] WHERE $->[CodeValue] IS NOT NULL LIMIT 1;
--
SELECT e.$->[CodeValue] FROM [BisCore].[Element] e LIMIT 1;
```

### How it works?

Instance property allows relaxed access to any property within a hierarchy or selected class. It allows full access to the underlying instance of a class using its base class. We can think of it as if `$` represent the full instance not just properties of the selected class.

Following ECSQL will return only properties declared in `BisCore.Element`

```sql
    SELECT * FROM [BisCore].[Element] WHERE ECInstanceId = 0xc000000018a
```

| ECInstanceId    | ECClassId | Model                                  | Last Modified              | Code Specification           | Code Scope                   | Code   | User Label | Parent | Federation GUID | JSON Properties |
| --------------- | --------- | -------------------------------------- | -------------------------- | ---------------------------- | ---------------------------- | ------ | ---------- | ------ | --------------- | --------------- |
| `0x8000000014c` | `0x710`   | `{Id:0x80000000003,RelECClassId:0x51}` | `2020-09-13T21:03:39.281Z` | `{Id:0x1,RelECClassId:0x59}` | `{Id:0x1,RelECClassId:0x5b}` | `NULL` | `Computer` | `NULL` | `NULL`          | `NULL`          |

While following return all properties of respective derived class of `BisCore.Element`

```sql
    SELECT $ FROM [BisCore].[Element] WHERE ECInstanceId = 0xc000000018a
```

above return one column and it contain serialized json instance with all properties

```json
{
  "ECInstanceId": "0x8000000014c",
  "ECClassId": "0x710",
  "Model": {
    "Id": "0x80000000003",
    "RelECClassId": "0x51"
  },
  "LastMod": "2020-09-13T21:03:39.281Z",
  "CodeSpec": {
    "Id": "0x1",
    "RelECClassId": "0x59"
  },
  "CodeScope": {
    "Id": "0x1",
    "RelECClassId": "0x5b"
  },
  "UserLabel": "Computer",
  "Category": {
    "Id": "0x70000000034",
    "RelECClassId": "0xa8"
  },
  "InSpatialIndex": true,
  "Origin": {
    "X": -20.17197015358312,
    "Y": -12.999908317386943,
    "Z": -5.363399999999998
  },
  "Yaw": -9.610521879999869,
  "Pitch": 0,
  "Roll": 0,
  "BBoxLow": {
    "X": -0.2844601562499974,
    "Y": -0.34431570637657166,
    "Z": -0.00034867627660684075
  },
  "BBoxHigh": {
    "X": 0.4287276153476725,
    "Y": 0.0297172168743558,
    "Z": 0.5207000000000108
  },
  "GeometryStream": "encoding=base64;Ug==",
  "TypeDefinition": {
    "Id": "0x80000000145",
    "RelECClassId": "0xcc"
  },
  "TypeId": "382002",
  "RevitId": "381840",
  "Timestamp": "2020-09-10T13:36:41.000",
  "LastModifier": "kiran.patkar",
  "ELEM_TYPE_PARAM": "Computer",
  "ELEM_CATEGORY_PARAM": "Specialty Equipment",
  "STRUCTURAL_ANALYTICAL_MODEL": false,
  "INSTANCE_ELEVATION_PARAM": 0.7366000000000033,
  "SYMBOL_ID_PARAM": "Computer",
  "IFC_GUID": "84f9c43a-0eef-4a55-b00e-a4ee3cda61e8-0005d390",
  "PHASE_CREATED": "New Construction",
  "ELEM_FAMILY_AND_TYPE_PARAM": "Computer",
  "HOST_AREA_COMPUTED": 0.818624848267919,
  "PHASE_DEMOLISHED": "None",
  "ELEM_FAMILY_PARAM": "Computer",
  "SCHEDULE_LEVEL_PARAM": "B1-CONCOURSE",
  "INSTANCE_SCHEDULE_ONLY_LEVEL_PARAM": "B1-CONCOURSE",
  "WALL_ATTR_ROOM_BOUNDING": true,
  "INSTANCE_OFFSET_POS_PARAM": true,
  "INSTANCE_MOVES_WITH_GRID_PARAM": true,
  "INSTANCE_STRUCT_USAGE_PARAM": 0,
  "SKETCH_PLANE_PARAM": "<not associated>",
  "INSTANCE_HEAD_HEIGHT_PARAM": 0.7366000000000033,
  "INSTANCE_SILL_HEIGHT_PARAM": 0.7366000000000033,
  "FLOOR_HEIGHTABOVELEVEL_PARAM": 0.7366000000000033,
  "STRUCTURAL_ELEVATION_AT_BOTTOM": -5.3634000000000075,
  "STRUCTURAL_ELEVATION_AT_TOP": -4.842699999999992,
  "STRUCTURAL_ELEVATION_AT_BOTTOM_SURVEY": -5.3634000000000075,
  "STRUCTURAL_ELEVATION_AT_TOP_SURVEY": -4.842699999999992,
  "HOST_ID_PARAM": "None",
  "INSTANCE_FREE_HOST_PARAM": "Floor : Tile mosaic 30mm 2",
  "INSTANCE_FREE_HOST_OFFSET_PARAM": 0.7366000000000033,
  "HOST_VOLUME_COMPUTED": 0.006083188590931392,
  "FAMILY_LEVEL_PARAM": "B1-CONCOURSE",
  "Asset_Tag": "COMPUTER 005"
}
```

Take a property `Asset_Tag` which might be property that exist on some instance of derived hierarchy of `bis.Element` and we like to find any instance of `Bis.Element` where `$->Asset_Tag ='COMPUTER 005'`

```sql
    SELECT [ECInstanceId] FROM [BisCore].[Element] WHERE $->[Asset_Tag] ='COMPUTER 005'
```

| ECInstanceId  |
| ------------- |
| 0x8000000014c |

Similarly we can read any set of properties and also filter by them

```sql
    SELECT $->[RevitId], $->[LastModifier]  FROM [BisCore].[Element] WHERE $->[Asset_Tag] ='COMPUTER 005'
```

| $ -> RevitId | $ -> LastModifier |
| ------------ | ----------------- |
| 381840       | kiran.patkar      |

ECSql will apply a property filter on selected rows such that those instances which has at least one property out of set of instance property must exists. This improve performance.

```sql
    SELECT $->[ThisPropertyDoesNotExists] from [BisCore].[Element];
```

If `ThisPropertyDoesNotExists` does not exists in `Bis.Element` derived hierarchy then no row will be returned. ECSql filter only include rows that must have at least one instance property. If any instance does not have any instance property requested then it will will be skipped.

### Accessing composite properties like `NavigationProperty`, `Point2d`, `Point3d` or `Struct`s

Only top level instance property can be accessed via `$-><prop>` syntax. Doing something like `$->Model.Id` will not not work as of now. It might be supported in future but as of now any access-string within a composite property is not supported, if its the only property selected then zero row will be returned.

Following type of properties can directly be use in filters and return strong type value.

- DateTime
- Integer
- Long
- Binary
- String
- Double

Here is example of `RevitId` use with `IN()` clause.

```sql
    SELECT $ from [BisCore].[Element] WHERE $->RevitId In ( 1000, 2000, 3000 );
```

While composite properties are returned as `JSON`.

```sql
    SELECT $->[Model] from [RevitDynamic].[Computer] where [ECInstanceId] = 0x8000000014c;
```

above will return following

| $ -> Model                                     |
| ---------------------------------------------- |
| `{"Id":"0x80000000003","RelECClassId":"0x51"}` |

While following will not return any row

```sql
    SELECT $->[Model].[Id] from [RevitDynamic].[Computer] where [ECInstanceId] = 0x8000000014c;
```

But you can still do following to get child property

```sql
    SELECT JSON_EXTRACT($->[Model], '$.Id') AS ModelId from [RevitDynamic].[Computer] where [ECInstanceId] = 0x8000000014c;
```

above will return following

| ModelId         |
| --------------- |
| `0x80000000003` |

## Optional and non-optional instance properties

By default, all properties accessed via instance accessor i.e. `$->prop` must exist in the class identifying the row for that row to qualify for output.

If the user uses `?` after a property accessor e.g. `$->prop?` then it will be considered optional, and the row class will not be checked to see if the `prop` exists or not.

The following query will return no row if there is no subclass of `Bis.Element` that has both properties `CodeValue` and `Foo` in it.

```sql
  SELECT ECClassId, ECInstanceId
  FROM [BisCore].[Element]
      WHERE $->CodeValue = 'Profiling' OR $->Foo = 'Hello'
  LIMIT 1
  ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

On the other hand, the following query makes `Foo` optional by adding `?` at the end like `$->Foo?`. This will exclude this property from the list of instance properties that must exist in the class of a row for it to qualify for output.

```sql
  SELECT ECClassId, ECInstanceId
  FROM [BisCore].[Element]
      WHERE $->CodeValue = 'Profiling' OR $->Foo? = 'Hello'
  LIMIT 1
  ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

> Note: Optional property may slow down performance while non-optional properties will improve the performance of instance query.

## Accessing composite properties

Only top level instance properties can be accessed using instance property accessor syntax `$-><prop>`.\
Using `$-><prop>.<sub prop>` will not work at the moment and will return zero rows.\
Only following property types can be used directly and they return strong type values:

- Binary
- DateTime
- Double
- Integer
- Long
- String

```sql
-- Composite property will be returned as a JSON
  SELECT $->Model from RevitDynamic.Computer where ECInstanceId = 0x8000000014c;

-- Output:{"Id":"0x80000000003","RelECClassId":"0x51"}
```

```sql
-- Following will not return any rows
  SELECT $->Model.Id from RevitDynamic.Computer where ECInstanceId = 0x8000000014c;

-- However, the child property can be accessed using JSON_EXTRACT()
  SELECT JSON_EXTRACT($->Model, '$.Id') AS ModelId from RevitDynamic.Computer where ECInstanceId = 0x8000000014c;

-- Output: 0x80000000003
```

## Examples

```sql
-- Instance Access
SELECT $ FROM [BisCore].[Element] WHERE [ECInstanceId] = 0xc000000018a

-- Instance property access
SELECT $->[CodeValue] FROM [bis].[Element] WHERE $->[CodeValue] IS NOT NULL LIMIT 1;
SELECT [e].$->[CodeValue] FROM [bis].[Element] [e] LIMIT 1;

-- Nested select
SELECT * FROM (SELECT $ FROM [meta].[ECClassDef]);
SELECT $ FROM (SELECT * FROM [meta].[ECClassDef]);

-- Instance access in different clauses
SELECT $ FROM [meta].[ECClassDef] WHERE $->[ECInstanceId] < 3;
SELECT $ FROM [meta].[ECClassDef] WHERE $->[ECInstanceId] < 3 ORDER BY $->ECClassId;
SELECT $ FROM [meta].[ECClassDef] WHERE $->[Name] LIKE 'Class%' ORDER BY $->[ECInstanceId] DESC;
SELECT $->[RevitId], $->[LastModifier]  FROM [Bis].[Element] WHERE $->[Asset_Tag] ='COMPUTER 005';
SELECT $->[Name] from [meta].[ECClassDef] WHERE $->[ECInstanceId] = 1;
SELECT $ from [Bis].[Element] WHERE $->[RevitId] In ( 1000, 2000, 3000 );

SELECT [ECInstanceId], Name
  FROM [meta].[ECClassDef]
    WHERE [Name] in (
      SELECT $->[Name]
      FROM [meta].[ECClassDef]
        WHERE $->[ECInstanceId] = 1);

SELECT *
  FROM (
    SELECT $
    FROM [meta].[ECClassDef]
      WHERE $->[Schema].[Id] in (
        SELECT [Schema].[Id]
        FROM [meta].[ECClassDef]
          WHERE [Schema].[Id] < 3) ORDER BY $->[ECClassId]);
```

## Limitation

1. Only top level property is allowed.
2. Only primitive type values can be accessed in the filter directly. Any composite type will require `JSON_EXTRACT()` to extract child value before it can be used in a query. Refer [Accessing Composite Properties](#accessing-composite-properties)
3. Currently indexes are not supported on instance properties.
4. MetaData a.k.a `ColumnInfo` is dynamically updated only for primitive properties selected for output. All other properties will get generic `ColumnInfo` with a string property and `extendType=JSON`.

## Performance

Generally speaking the performance of instance prop is pretty good though it involve overhead of extracting either property value or complete instance.

- Try use regular properties accessor where possible.
- Do not use instance property access for local properties of class been selected.
- Try avoiding filtering queries by instance properties. Though it fast be without a index it could be slow depending on number of rows to which filter will be applied.

## Pragmas

### `PRAGMA help`

Print out list of pragma supported by ECSQL.

```sql
PRAGMA help
```

| pragma                        | type   | descr                                                                       |
| ----------------------------- | ------ | --------------------------------------------------------------------------- |
| checksum                      | global | checksum([ec_schema OR ec_map OR db_schema]) return sha1 checksum for data. |
| ecdb_ver                      | global | return current and file profile versions                                    |
| experimental_features_enabled | global | enable/disable experimental features                                        |
| explain_query                 | global | explain query plan                                                          |
| help                          | global | return list of pragma supported                                             |
| integrity_check               | global | performs integrity checks on ECDb                                           |
| parse_tree                    | global | parse_tree(ecsql) return parse tree of ecsql.                               |
| disqualify_type_index         | class  | set/get disqualify_type_index flag for a given ECClass                      |

### `PRAGMA ecdb_ver`

Print out ECDb current profile version supported by software and file profile version.

```sql
PRAGMA ecdb_ver
```

| current | file    |
| ------- | ------- |
| 4.0.0.4 | 4.0.0.2 |

### `PRAGMA experimental_features_enabled`

Enable experimental feature in ECSQL on current connection.

```sql
PRAGMA experimental_features_enabled=true
```

to switch off

```sql
PRAGMA experimental_features_enabled=false
```

to check if flag is currently set.

```sql
PRAGMA experimental_features_enabled

// experimental_features_enabled
// -----------------------------
// False
```

### `PRAGMA integrity_check` (experimental)

1. `check_ec_profile` - checks if the profile table, indexes, and triggers are present. Does not check of be\_\* tables. Issues are returned as a list of tables/indexes/triggers which was not found or have different DDL.
2. `check_data_schema` - checks if all the required data tables and indexes exist for mapped classes. Issues are returned as a list of tables/columns which was not found or have different DDL.
3. `check_data_columns` - checks if all the required columns exist in data tables. Issues are returned as a list of those tables/columns.
4. `check_nav_class_ids` - checks if `RelClassId` of a Navigation property is a valid ECClassId. It does not check the value to match the relationship class.
5. `check_nav_ids` - checks if `Id` of a Navigation property matches a valid row primary class.
6. `check_linktable_fk_class_ids` - checks if `SourceECClassId` or `TargetECClassId` of a link table matches a valid ECClassId.
7. `check_linktable_fk_ids`- checks if `SourceECInstanceId` or `TargetECInstanceId` of a link table matches a valid row in primary class.
8. `check_class_ids`- checks persisted `ECClassId` in all data tables and make sure they are valid.
9. `check_schema_load` - checks if all schemas can be loaded into memory.

```sql
PRAGMA integrity_check ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES;
```

output of above will look like listing all check with result and time took to run the test.

| sno | check                        | result | elapsed_sec |
| --- | ---------------------------- | ------ | ----------- |
| 1   | check_data_columns           | True   | 0.005       |
| 2   | check_ec_profile             | True   | 0.001       |
| 3   | check_nav_class_ids          | True   | 0.179       |
| 4   | check_nav_ids                | True   | 0.403       |
| 5   | check_linktable_fk_class_ids | True   | 0.001       |
| 6   | check_linktable_fk_ids       | False  | 0.003       |
| 7   | check_class_ids              | True   | 0.039       |
| 8   | check_data_schema            | True   | 0.000       |
| 9   | check_schema_load            | True   | 0.000       |

## ECSQL Keywords

| Key | Keywords                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `ALL`, `AND`, `ANY`, `AS`, `ASC`, `AVG`                                                                                                 |
| B   | `BACKWARD`, `BETWEEN`, `BINARY`, `BLOB`, `BOOLEAN`, `BY`                                                                                |
| C   | `CASE`, `CAST`, `COLLATE`, `COUNT`, `CROSS`. `CUME_DIST`, `CURRENT`, `CURRENT_DATE`, `CURRENT_TIME`, `CURRENT_TIMESTAMP`                |
| D   | `DATE`, `DELETE`, `DENSE_RANK`, `DESC`, `DISTINCT`, `DOUBLE`                                                                            |
| E   | `ECSQLOPTIONS`, `ELSE`, `END`, `ESCAPE`, `EVERY`, `EXCEPT`, `EXCLUDE`, `EXISTS`                                                         |
| F   | `FALSE`, `FILTER`, `FIRST`, `FIRST_VALUE`, `FLOAT`, `FOLLOWING`, `FOR`, `FORWARD`, `FROM`, `FULL`                                       |
| G   | `GROUP`, `GROUP_CONCAT`, `GROUPS`, `HAVING`                                                                                             |
| I   | `IIF`, `IN`, `INNER`, `INSERT`, `INT`, `INTEGER`, `INT64`, `INTERSECT`, `INTO`, `IS`                                                    |
| J   | `JOIN`                                                                                                                                  |
| L   | `LAG`, `LAST`, `LAST_VALUE`, `LEAD`, `LEFT`, `LIKE`, `LIMIT`, `LONG`                                                                    |
| M   | `MATCH`, `MAX` ,`MIN`                                                                                                                   |
| N   | `NATURAL`, `NO`, `NOCASE`, `NOT`, `NTH_VALUE`, `NTILE`, `NULL`, `NULLS`                                                                 |
| O   | `OFFSET`, `ON`, `ONLY`, `OPTIONS`, `OR`, `ORDER`, `OTHERS`, `OUTER`, `OVER`                                                             |
| P   | `PARTITION`, `PERCENT_RANK`, `PRAGMA`, `PRECEDING`, `RANGE`, `RANK`, `REAL`, `RECURSIVE`, `RIGHT`, `ROW`, `ROW_NUMBER`, `ROWS`, `RTRIM` |
| S   | `SELECT`, `SET`, `SOME`, `STRING`, `SUM`                                                                                                |
| T   | `THEN`, `TIES`, `TIME`, `TIMESTAMP`, `TOTAL`, `TRUE`                                                                                    |
| U   | `UNBOUNDED`, `UNION`, `UNIQUE`, `UNKNOWN`, `UPDATE`, `USING`                                                                            |
| V   | `VALUE`, `VALUES` ,`VARCHAR`                                                                                                            |
| W   | `WHEN`, `WHERE`, `WINDOW`, `WITH`                                                                                                       |

## Escaping keywords

ECSQL has large set of [keywords](#ecsql-keywords). Keywords sometime appear in query as class name, property name or parameter name, cte block name or aliases and will result in query to fail. To fix it the keyword need to be quoted or escaped. Following is different ways keywords can be escaped. In ECSQL is preferred to escape using square brackets e.g. `[keyword]`.

| Escape            | description                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"_keyword_"**   | A keyword in double-quotes is an identifier.                                                                                                                                              |
| **[*keyword*]**   | A keyword enclosed in square brackets is an identifier. This is not standard SQL. This quoting mechanism is used by MS Access and SQL Server and is included in SQLite for compatibility. |
| **\`_keyword_\`** | A keyword enclosed in grave accents (ASCII code 96) is an identifier. This is not standard SQL. This quoting mechanism is used by MySQL and is included in SQLite for compatibility.      |

> As best practice it good idea to escape at least escape all user defined identifiers like alias and properties name even when they are not currently keywords. They may become keyword in future as ECSQL evolve and may break your query.
