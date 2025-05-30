# Compound SELECT

Result of `SELECT` statement can be combined with other select statements using one of following operator.

1. `UNION` - take a union of result of two queries such that there is no duplicate results.
1. `UNION ALL` - take a union of results of two queries.
1. `INTERSECT` - take only rows that are common in both queries.
1. `EXCEPT` - take rows from first query that are not present in second query.

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

[ECSql Syntax](./index.md)
