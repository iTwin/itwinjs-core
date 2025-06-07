Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing returned values of IdSet virtual table

- dataset: AllProperties.bim

```sql
SELECT id from IdSet(?) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
SELECT id a from IdSet(?) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
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

# Testing one level subquery with IdSet for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT * FROM (SELECT id a from IdSet(?)) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
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

# Testing one level subquery with IdSet for Statement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT * FROM (SELECT id a from IdSet(?)) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

- bindIdSet 1, [0x15, 0x18, 0x19]

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

| a    |
| ---- |
| 0x15 |
| 0x18 |
| 0x19 |

# Testing TWO level subquery with IdSet for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT * FROM (SELECT * FROM (SELECT id a from IdSet(?))) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
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

# Testing TWO level subquery with IdSet for Statement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT * FROM (SELECT * FROM (SELECT id a from IdSet(?))) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

- bindIdSet 1, [0x15, 0x18, 0x19]

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

| a    |
| ---- |
| 0x15 |
| 0x18 |
| 0x19 |

# Testing TWO level subquery with IdSet with column alias for Concurrent Query

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT a FROM (SELECT * FROM (SELECT id a from IdSet(?))) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
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

# Testing TWO level subquery with IdSet with column alias for Statement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT a FROM (SELECT * FROM (SELECT id a from IdSet(?))) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

- bindIdSet 1, [0x15, 0x18, 0x19]

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | id           | long     | Id   | undefined          |

| a    |
| ---- |
| 0x15 |
| 0x18 |
| 0x19 |

# Testing with hard coded json string with hex ids

- dataset: AllProperties.bim

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet('["0x15", "0x18", "0x19"]') where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
SELECT i FROM aps.TestElement,IdSet('[21, 24, "25"]') where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES = TRUE
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
SELECT e.i FROM aps.TestElement e INNER JOIN IdSet(?) v ON e.ECInstanceId = v.id ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES = 1
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
  INNER JOIN IdSet (?) v ON v.id = e.ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES = true
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
  JOIN IdSet (?) v ON e.ECInstanceId = v.id OPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
  IdSet (?) v
  LEFT OUTER JOIN aps.TestElement e ON e.ECInstanceId = v.id ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
  LEFT OUTER JOIN IdSet (?) v ON e.ECInstanceId = v.id OPTIONS ENABLE_EXPERIMENTAL_FEATURES
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

# Testing CROSS JOIN on test table

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  e.S,
  e.i,
  v.id
FROM
  aps.TestElement e
  CROSS JOIN IdSet (?) v ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s            | false     | 0     | s        | s    | undefined    | string   | String | s                  |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i    | undefined    | int      | Int    | i                  |
|                          | id           | false     | 2     | id       | id   | Id           | long     | Id     | id                 |

| s    | i   | id   |
| ---- | --- | ---- |
| str0 | 100 | 0x15 |
| str0 | 100 | 0x18 |
| str0 | 100 | 0x19 |
| str1 | 101 | 0x15 |
| str1 | 101 | 0x18 |
| str1 | 101 | 0x19 |
| str2 | 102 | 0x15 |
| str2 | 102 | 0x18 |
| str2 | 102 | 0x19 |
| str3 | 103 | 0x15 |
| str3 | 103 | 0x18 |
| str3 | 103 | 0x19 |
| str4 | 104 | 0x15 |
| str4 | 104 | 0x18 |
| str4 | 104 | 0x19 |
| str5 | 105 | 0x15 |
| str5 | 105 | 0x18 |
| str5 | 105 | 0x19 |
| str6 | 106 | 0x15 |
| str6 | 106 | 0x18 |
| str6 | 106 | 0x19 |
| str7 | 107 | 0x15 |
| str7 | 107 | 0x18 |
| str7 | 107 | 0x19 |
| str8 | 108 | 0x15 |
| str8 | 108 | 0x18 |
| str8 | 108 | 0x19 |
| str9 | 109 | 0x15 |
| str9 | 109 | 0x18 |
| str9 | 109 | 0x19 |

# Testing FULL JOIN

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]

```sql
SELECT
  e.s,
  e.i,
  v.id
FROM
  aps.TestElement e
  FULL JOIN IdSet (?) v ON e.ECInstanceId = v.id OPTIONS ENABLE_EXPERIMENTAL_FEATURES = TRUE
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s            | false     | 0     | s        | s    | undefined    | string   | String | s                  |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i    | undefined    | int      | Int    | i                  |
|                          | id           | false     | 2     | id       | id   | Id           | long     | Id     | id                 |

| s    | i   | id        |
| ---- | --- | --------- |
| str0 | 100 | undefined |
| str1 | 101 | 0x15      |
| str2 | 102 | undefined |
| str3 | 103 | undefined |
| str4 | 104 | 0x18      |
| str5 | 105 | 0x19      |
| str6 | 106 | undefined |
| str7 | 107 | undefined |
| str8 | 108 | undefined |
| str9 | 109 | undefined |

# Testing NATURAL JOIN

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]
- errorDuringPrepare: true

```sql
SELECT e.S, e.i, v.id FROM aps.TestElement e NATURAL JOIN IdSet(?) v ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES = True
```

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
  JOIN IdSet (?) v ON e.ECInstanceId = v.id ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
SELECT i FROM aps.TestElement,IdSet(?) where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
SELECT i FROM aps.TestElement,IdSet(?) where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
  IdSet (?)
WHERE
  id = a ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
IdSet (?),
  (
    WITH
      cte (a, b) AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  )
WHERE
  id = a ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
  id = a OPTIONS ENABLE_EXPERIMENTAL_FEATURES = 1
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
IdSet (?)
WHERE
  id = a ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
IdSet (?)
WHERE
  id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
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
IdSet (?),
(
    WITH
      cte AS (
        SELECT ECInstanceId, i FROM aps.TestElement )  SELECT * FROM cte
  )
WHERE
  id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      |

| i   |
| --- |
| 101 |
| 104 |
| 105 |

# Testing IdSet by setting ENABLE_EXPERIMENTAL_FEATURES to false

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]
- errorDuringPrepare: true

```sql
SELECT i FROM aps.TestElement,IdSet(?) where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES = False
```

# Testing IdSet without ENABLE_EXPERIMENTAL_FEATURES

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]
- errorDuringPrepare: true

```sql
SELECT i FROM aps.TestElement,IdSet(?) where id = ECInstanceId
```

# Testing Abstract syntax with IdSet with space as schema name

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]
- errorDuringPrepare: true

```sql
SELECT id FROM  .IdSet(?) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

# Testing Abstract syntax with IdSet with empty schema name

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]
- errorDuringPrepare: true

```sql
SELECT id FROM .IdSet(?) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

# Testing Abstract syntax with IdSet with no arg list

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]
- errorDuringPrepare: true

```sql
SELECT id FROM IdSet OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

# Testing Abstract syntax with IdSet with schema name but with no arg list

- dataset: AllProperties.bim
- bindIdSet 1, [0x15, 0x18, 0x19]
- errorDuringPrepare: true

```sql
SELECT id FROM ECVLib.IdSet OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```
