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
