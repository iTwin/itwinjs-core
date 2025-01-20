Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing returned values of IdSet virtual table

- dataset: AllProperties.bim

```sql
SELECT id from ECVLib.IdSet(?)
```

- bindIdSet 1, [0x15, 0x18, 0x19]

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | id           | false     | 0     | id       | id   | Id           | long     | Id   | id                 |

| id   |
| ---- |
| 0x15 |
| 0x18 |
| 0x19 |

# Testing returned values of IdSet virtual table with alias

- dataset: AllProperties.bim

```sql
SELECT id a from ECVLib.IdSet(?)
```

- bindIdSet 1, [0x15, 0x18, 0x19]

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | id                 |

| a    |
| ---- |
| 0x15 |
| 0x18 |
| 0x19 |

# Testing with hard coded json string with hex ids

- dataset: AllProperties.bim

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet('["0x15", "0x18", "0x19"]') where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing with hard coded json string with decimal ids

- dataset: AllProperties.bim

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet('[21, 24, "25"]') where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing INNER JOINS with IdSet

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT e.i FROM aps.TestElement e INNER JOIN ECVLib.IdSet(?) v ON e.ECInstanceId = v.id
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing INNER JOINS with IdSet and also select VirtualProp

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  e.i,
  v.id
FROM
  aps.TestElement e
  INNER JOIN ECVLib.IdSet (?) v ON v.id = e.ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |
|                          | id           | false     | 1     | id       | id   | Id           | long     | Id   | id                 |

| i   | id   |
| --- | ---- |
| 101 | 0x15 |
| 104 | 0x18 |
| 105 | 0x19 |

# Testing INNER JOIN with string prop

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  e.ECInstanceId,
  e.s,
  v.id
FROM
  aps.TestElement e
  JOIN ECVLib.IdSet (?) v ON e.ECInstanceId = v.id
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:IPrimitive | s            | false     | 1     | s        | s            | undefined    | string   | String | s                  |
|                          | id           | false     | 2     | id_1     | id           | Id           | long     | Id     | id                 |

| ECInstanceId | s    | id   |
| ------------ | ---- | ---- |
| 0x15         | str1 | 0x15 |
| 0x18         | str4 | 0x18 |
| 0x19         | str5 | 0x19 |

# Testing LEFT OUTER JOIN on virtual table

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  e.ECInstanceId,
  e.i,
  v.id
FROM
  ECVLib.IdSet (?) v
  LEFT OUTER JOIN aps.TestElement e ON e.ECInstanceId = v.id
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |
|                          | id           | false     | 2     | id_1     | id           | Id           | long     | Id   | id                 |

| ECInstanceId | i   | id   |
| ------------ | --- | ---- |
| 0x15         | 101 | 0x15 |
| 0x18         | 104 | 0x18 |
| 0x19         | 105 | 0x19 |

# Testing LEFT OUTER JOIN on test table

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  e.ECInstanceId,
  e.i,
  v.id
FROM
  aps.TestElement e
  LEFT OUTER JOIN ECVLib.IdSet (?) v ON e.ECInstanceId = v.id
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |
|                          | id           | false     | 2     | id_1     | id           | Id           | long     | Id   | id                 |

| ECInstanceId | i   | id        |
| ------------ | --- | --------- |
| 0x14         | 100 | undefined |
| 0x15         | 101 | 0x15      |
| 0x16         | 102 | undefined |
| 0x17         | 103 | undefined |
| 0x18         | 104 | 0x18      |
| 0x19         | 105 | 0x19      |
| 0x1a         | 106 | undefined |
| 0x1b         | 107 | undefined |
| 0x1c         | 108 | undefined |
| 0x1d         | 109 | undefined |

# Testing JOIN

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  e.ECInstanceId,
  e.i,
  v.id
FROM
  aps.TestElement e
  JOIN ECVLib.IdSet (?) v ON e.ECInstanceId = v.id
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |
|                          | id           | false     | 2     | id_1     | id           | Id           | long     | Id   | id                 |

| ECInstanceId | i   | id   |
| ------------ | --- | ---- |
| 0x15         | 101 | 0x15 |
| 0x18         | 104 | 0x18 |
| 0x19         | 105 | 0x19 |

# Testing by binding with hex ids

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing by binding with decimal ids for ECSql Statement

- dataset: AllProperties.bim
- bindIdSet 1, [21, 24, 25]
- mode: Statement

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing by binding with decimal ids for ConcurrentQuery

`The purpose of this test is to show that bindIdSet when working with ConcurrentQuery only takes into account hex ids and not decimal ids`

- dataset: AllProperties.bim
- bindIdSet 1, [21, 24, 25]
- mode: ConcurrentQuery

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |

# Testing IdSet following cte subquery

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  b
FROM
  (
    WITH
      cte (a, b) AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  ),
  ECVLib.IdSet (?)
WHERE
  id = a
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | b            | true      | 0     | b        | b    | undefined    | int      | Int  |

| b   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing cte subquery following IdSet

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  b
FROM
ECVLib.IdSet (?),
  (
    WITH
      cte (a, b) AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  )
WHERE
  id = a
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | b            | true      | 0     | b        | b    | undefined    | int      | Int  |

| b   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing nested CTE subquery following IdSet

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  b
FROM
ECVLib.IdSet (?),
( select * from (
    WITH
      cte (a, b) AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  ))
WHERE
  id = a
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | b            | true      | 0     | b        | b    | undefined    | int      | Int  |

| b   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing IdSet following nested CTE subquery

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  b
FROM
( select * from (
    WITH
      cte (a, b) AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  )),
ECVLib.IdSet (?)
WHERE
  id = a
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | b            | true      | 0     | b        | b    | undefined    | int      | Int  |

| b   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing IdSet following nested CTE without sub columns subquery

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  i
FROM
( select * from (
    WITH
      cte AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  )),
ECVLib.IdSet (?)
WHERE
  id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing CTE without sub columns subquery following IdSet

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  i
FROM
ECVLib.IdSet (?),
(
    WITH
      cte AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  )
WHERE
  id = ECInstanceId
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      |

| i   |
| --- |
| 101 |
| 104 |
| 105 |
