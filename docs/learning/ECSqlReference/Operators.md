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
| `OR`     | OR op               | `(1=2 OR 1=1)` _output `TRUE`_  |
| `AND`    | AND op              | `(1=1 AND 1=1)` _output `TRUE`_ |
| `NOT`    | NOT unary op        | `NOT (1=1)` _output `FALSE`_    |

[ECSql Syntax](./index.md)
