# SubqueryValue

- dataset: AllProperties.bim

```sql
SELECT (SELECT te.ECInstanceId FROM aps.TestElement te) AS ecId
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | ecId         | true      | 0     | ecId     | ecId | Id           | long     | Id   |

| ecId |
| ---- |
| 0x14 |

# SubqueryValue in CTE

- dataset: AllProperties.bim

```sql
WITH
  myCTE (ecId) AS (
    SELECT (SELECT te.ECInstanceId FROM aps.TestElement te) AS ecId
  )
SELECT * FROM myCTE
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | ecId         | true      | 0     | ecId     | ecId | Id           | long     | Id   |

| ecId |
| ---- |
| 0x14 |

# CAST Id to various types

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  CAST(te.ECInstanceId AS INTEGER) [int],
  CAST(te.ECInstanceId AS LONG) [long],
  CAST(te.ECInstanceId AS VARCHAR) [char]
FROM
  aps.TestElement te
LIMIT
  2
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | int          | true      | 1     | int      | int          | undefined    | int      | Int    | undefined          |
|           | long         | true      | 2     | long     | long         | undefined    | long     | Int64  | undefined          |
|           | char         | true      | 3     | char     | char         | undefined    | string   | String | undefined          |

| ECInstanceId | int | long | char |
| ------------ | --- | ---- | ---- |
| 0x14         | 20  | 20   | "20"   |
| 0x15         | 21  | 21   | "21"   |

# Nested CAST

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  CAST(CAST(te.ECInstanceId AS VARCHAR) AS LONG) [result]
FROM
  aps.TestElement te
LIMIT
  2
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ----- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|           | result       | true      | 1     | result   | result       | undefined    | long     | Int64 | undefined          |

| ECInstanceId | result |
| ------------ | ------ |
| 0x14         | 20     |
| 0x15         | 21     |

# IIF integer value

- dataset: AllProperties.bim

```sql
SELECT te.ECInstanceId, IIF(te.i < 102, 'Small', 'Big') as [calc] from aps.TestElement te LIMIT 5
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | calc         | true      | 1     | calc     | calc         | undefined    | string   | String | undefined          |

| ECInstanceId | calc  |
| ------------ | ----- |
| 0x14         | Small |
| 0x15         | Small |
| 0x16         | Big   |
| 0x17         | Big   |
| 0x18         | Big   |

# FizzBuzz (nested IIF)

- dataset: AllProperties.bim

```sql
WITH RECURSIVE
  numbers (x) AS (
     SELECT 1 UNION ALL
     SELECT x + 1 FROM numbers
     LIMIT 15
  )
SELECT
  IIF(
    x % 3 = 0 AND x % 5 = 0, 'FizzBuzz',
    IIF(x % 3 = 0, 'Fizz',
      IIF(x % 5 = 0, 'Buzz', CAST(x AS VARCHAR))
    )
  ) AS [result]
FROM
  numbers
```

| className | accessString | generated | index | jsonName | name   | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ------ | ------------ | -------- | ------ |
|           | result       | true      | 0     | result   | result | undefined    | string   | String |

| result   |
| -------- |
| "1"        |
| "2"        |
| Fizz     |
| "4"        |
| Buzz     |
| Fizz     |
| "7"        |
| "8"        |
| Fizz     |
| Buzz     |
| "11"       |
| Fizz     |
| "13"       |
| "14"       |
| FizzBuzz |


# SubqueryTestExp with EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId
FROM
  aps.TestElement e
WHERE
  EXISTS (
    SELECT
      1
    FROM
      aps.TestElementAspect a
    WHERE
      e.ECInstanceId = a.Element.Id
  )
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x14         |
| 0x16         |
| 0x18         |
| 0x1a         |
| 0x1c         |

# SubqueryTestExp with NOT EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId
FROM
  aps.TestElement e
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      aps.TestElementAspect a
    WHERE
      e.ECInstanceId = a.Element.Id
  )
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x15         |
| 0x17         |
| 0x19         |
| 0x1b         |
| 0x1d         |

# Simple LIMIT and OFFSET test

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId FROM  aps.TestElement e LIMIT 5 OFFSET 8
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x1c         |
| 0x1d         |
