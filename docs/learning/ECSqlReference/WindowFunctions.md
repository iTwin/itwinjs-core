# Window functions

A window function is an SQL function where the input values are taken from a "window" of one or more rows in the results set of a SELECT statement.

Window functions are distinguished from other SQL functions by the presence of an OVER clause. If a function has an OVER clause, then it is a window function. If it lacks an OVER clause, then it is an ordinary aggregate or scalar function. Window functions might also have a FILTER clause in between the function and the OVER clause.

Here is an example using the built-in row_number() window function:

```sql
SELECT row_number() OVER (ORDER BY a) AS row_number FROM test.Foo;
```

[Read more.](https://www.sqlite.org/windowfunctions.html#introduction_to_window_functions)

## Window name

Named window definition clauses may also be added to a `SELECT` statement using a `WINDOW` clause and then referred to by name within window function invocations.
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

[Read more](https://www.sqlite.org/windowfunctions.html#window_chaining)

## The `PARTITION BY` clause

For the purpose of computing window functions, the result set of a query is divided into one or more "partitions". A partition consists of all rows that have the same value for all terms of the `PARTITION BY` clause in the window-defn. If there is no `PARTITION BY` clause, then the entire result set of the query is a single partition. Window function processing is performed separately for each partition.

For example:

```sql
SELECT row_number() over (PARTITION BY a) FROM test.Foo;
```

[Read more.](https://www.sqlite.org/windowfunctions.html#the_partition_by_clause)

## Window frame specifications

The `frame specification` determines which output rows are read by an `aggregate window function`. The `frame specification` consists of four parts:

- A frame type,
- A starting frame boundary,
- An ending frame boundary,
- An `EXCLUDE` clause.

Ending frame boundary and `EXCLUDE` clause are `optional`.

### Frame type

There are three frame types: `ROWS`, `GROUPS`, and `RANGE`. The frame type determines how the starting and ending boundaries of the frame are measured.

- `ROWS`: The `ROWS` frame type means that the starting and ending boundaries for the frame are determined by counting individual rows relative to the current row.
- `GROUPS`: The `GROUPS` frame type means that the starting and ending boundaries are determined by counting "groups" relative to the current group. A "group" is a set of rows all having equivalent values for all terms of the window ORDER BY clause. ("Equivalent" means the IS operator is true when comparing the two values.) In other words, a group consists of all peers of a row.
- `RANGE`: The `RANGE` frame type requires that the `ORDER BY` clause of the window has exactly one term. Call that term `X`. With the `RANGE` frame type, the elements of the frame are determined by computing the value of expression `X` for all rows in the partition and framing those rows for which the value of `X` is within a certain range of the value of `X` for the current row.

[Read more](https://www.sqlite.org/windowfunctions.html#frame_type)

### Frame boundaries

There are five ways to describe starting and ending frame boundaries:

- `UNBOUNDED PRECEDING`: The frame boundary is the first row in the partition.
- `<expr> PRECEDING`: `<expr>` must be a non-negative constant numeric expression. The boundary is a row that is `<expr>` "units" prios to the current row. The meaning of "units" here depends on the frame type:
  - `ROWS`: The frame boundary is the row that is `<expr>` rows before the current row, or the first row of the partition if there are fewer than `<expr>` rows before the current row. `<expr>` must be an integer.
  - `GROUPS`: A "group" is a set of peer rows - rows that all have the same values for every term in the `ORDER BY` clause. The frame boundary is the group that is `<expr>` groups before the group containing the current row, or the first group of the partition if there are fewer than `<expr>` groups before the current row.
  - `RANGE`: For this form, the `ORDER BY` clause of the window definition must have a single term. Call that `ORDER BY` term `X`. Let `Xi` be the value of the `X` expression for the i-th row in the partition and let `Xc` be the value of `X` for the current row. Informally, a `RANGE` bound is the first row for which Xi is within the <expr> of Xc.
- `CURRENT ROW`: The current row. For `RANGE` and `GROUPS` frame types, peers of the current row are also included in the frame, unless specifically excluded by the `EXCLUDE` clause.
- `<expr> FOLLOWING`: This is the same as `<expr> PRECEDING` except that the boundary is `<expr>` units after the current rather than before the current row.
- `UNBOUNDED FOLLOWING`: The frame boundary is the last row in the partition.

[Read more](https://www.sqlite.org/windowfunctions.html#frame_boundaries)

### The `EXCLUDE` clause

The optional `EXCLUDE` clause may take any of the following four forms:

- `EXCLUDE NO OTHERS`: This is the default. In this case no rows are excluded from the window frame as defined by its starting and ending frame boundaries.
- `EXCLUDE CURRENT ROW`: In this case the current row is excluded from the window frame. Peers of the current row remain in the frame for the `GROUPS` and `RANGE` frame types.
- `EXCLUDE GROUP`: In this case the current row and all other rows that are peers of the current row are excluded from the frame. When processing an `EXCLUDE` clause, all rows with the same `ORDER BY` values, or all rows in the partition if there is no `ORDER BY` clause, are considered peers, even if the frame type is `ROWS`.
- `EXCLUDE TIES`: In this case the current row is part of the frame, but peers of the current row are excluded.

[Read more](https://www.sqlite.org/windowfunctions.html#the_exclude_clause)

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

## The `FILTER` clause

If a `FILTER` clause is provided, then only rows for which the expr is true are included in the window frame. The aggregate window still returns a value for every row, but those for which the FILTER expression evaluates to other than true are not included in the window frame for any row. [More info.](https://www.sqlite.org/windowfunctions.html#the_filter_clause)

## Window built-in functions

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

[ECSql Syntax](./index.md)
