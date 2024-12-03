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
| 0x14         | 20  | 20   | "20" |
| 0x15         | 21  | 21   | "21" |

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
| "1"      |
| "2"      |
| Fizz     |
| "4"      |
| Buzz     |
| Fizz     |
| "7"      |
| "8"      |
| Fizz     |
| Buzz     |
| "11"     |
| Fizz     |
| "13"     |
| "14"     |
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

# Testing Type enums in the built-in schemas

- dataset: AllProperties.bim

```sql
SELECT Type FROM meta.ECClassDef WHERE Name='TestElement'
```

```json
{
  "columns": [
    {
      "className": "ECDbMeta:ECClassDef",
      "accessString": "Type",
      "generated": false,
      "index": 0,
      "jsonName": "type",
      "name": "Type",
      "typeName": "ECDbMeta.ECClassType",
      "type": "Int",
      "originPropertyName": "Type"
    }
  ]
}
```

```json
[
  {
    "Type": 0
  }
]
```

# Testing Modifier enums in the built-in schemas

- dataset: AllProperties.bim

```sql
SELECT Modifier FROM meta.ECClassDef WHERE Name='TestElement'
```

```json
{
  "columns": [
    {
      "className": "ECDbMeta:ECClassDef",
      "accessString": "Modifier",
      "generated": false,
      "index": 1,
      "jsonName": "modifier",
      "name": "Modifier",
      "typeName": "ECDbMeta.ECClassModifier",
      "type": "Int",
      "originPropertyName": "Modifier"
    }
  ]
}
```

```json
[
  {
    "Modifier": 0
  }
]
```

# Simple select with LIKE operator and wildcard at the end

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, DirectStr FROM aps.TestElement where DirectStr LIKE 'str%' LIMIT 5
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectStr    | false     | 0     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | DirectStr |
| ------------ | --------- |
| 0x14         | str0      |
| 0x15         | str1      |
| 0x16         | str2      |
| 0x17         | str3      |
| 0x18         | str4      |

# Simple select with LIKE operator and wildcard at the beginning

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, DirectStr FROM aps.TestElement where DirectStr LIKE '%tr5'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectStr    | false     | 0     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | DirectStr |
| ------------ | --------- |
| 0x19         | str5      |

# Simple select with LIKE operator and wildcard in the middle

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, DirectStr FROM aps.TestElement where DirectStr LIKE 's%5'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectStr    | false     | 0     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | DirectStr |
| ------------ | --------- |
| 0x19         | str5      |

# Simple select with LIKE operator and multiple wildcard

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp FROM aps.TestElement where NullProp LIKE 'N%t%u%'
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | NullProp |
| ------------ | -------- |
| 0x15         | NotNull  |
| 0x17         | NotNull  |
| 0x19         | NotNull  |
| 0x1b         | NotNull  |
| 0x1d         | NotNull  |

# Simple select with LIKE operator underscore wildcard

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, DirectStr FROM aps.TestElement where DirectStr LIKE 'str_' LIMIT 10 OFFSET 5
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectStr    | false     | 1     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | DirectStr |
| ------------ | --------- |
| 0x19         | str5      |
| 0x1a         | str6      |
| 0x1b         | str7      |
| 0x1c         | str8      |
| 0x1d         | str9      |

# Simple select with LIKE operator and combination of wildcards

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, DirectStr FROM aps.TestElement where DirectStr LIKE 's_r%'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectStr    | false     | 1     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | DirectStr |
| ------------ | --------- |
| 0x14         | str0      |
| 0x15         | str1      |
| 0x16         | str2      |
| 0x17         | str3      |
| 0x18         | str4      |
| 0x19         | str5      |
| 0x1a         | str6      |
| 0x1b         | str7      |
| 0x1c         | str8      |
| 0x1d         | str9      |

# Simple select with LIKE operator and new ESCAPE character

- dataset: AllProperties.bim

```sql
SELECT
  *
FROM
  (
    SELECT
      ECInstanceId,
      CASE
        WHEN NullProp IS NULL THEN 'Test_1234'
        ELSE 'TEST'
      END AS Test_Val
    FROM
      aps.TestElement
  ) e
WHERE
  e.Test_Val LIKE 'TEST$_%' ESCAPE '$'
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | Test_Val     | true      | 1     | test_Val | Test_Val     | undefined    | string   | String | undefined          |

| ECInstanceId | Test_Val  |
| ------------ | --------- |
| 0x14         | Test_1234 |
| 0x16         | Test_1234 |
| 0x18         | Test_1234 |
| 0x1a         | Test_1234 |
| 0x1c         | Test_1234 |

# Simple select with LIKE operator and existing character underscore as ESCAPE character

- dataset: AllProperties.bim

```sql
SELECT
  *
FROM
  (
    SELECT
      ECInstanceId,
      CASE
        WHEN NullProp IS NULL THEN 'Test_1234'
        ELSE 'TEST%1234'
      END AS Test_Val
    FROM
      aps.TestElement
  ) e
WHERE
  e.Test_Val LIKE 'TEST_%12%' ESCAPE '_'
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | Test_Val     | true      | 1     | test_Val | Test_Val     | undefined    | string   | String | undefined          |

| ECInstanceId | Test_Val  |
| ------------ | --------- |
| 0x15         | TEST%1234 |
| 0x17         | TEST%1234 |
| 0x19         | TEST%1234 |
| 0x1b         | TEST%1234 |
| 0x1d         | TEST%1234 |

# Simple select with LIKE operator and existing character '%' as ESCAPE character

- dataset: AllProperties.bim

```sql
SELECT
  *
FROM
  (
    SELECT
      ECInstanceId,
      CASE
        WHEN NullProp IS NULL THEN 'Test_1234'
        ELSE 'TEST1234'
      END AS Test_Val
    FROM
      aps.TestElement
  ) e
WHERE
  e.Test_Val LIKE 'TEST%_123_' ESCAPE '%'
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | Test_Val     | true      | 1     | test_Val | Test_Val     | undefined    | string   | String | undefined          |

| ECInstanceId | Test_Val  |
| ------------ | --------- |
| 0x14         | Test_1234 |
| 0x16         | Test_1234 |
| 0x18         | Test_1234 |
| 0x1a         | Test_1234 |
| 0x1c         | Test_1234 |

# Trying PRAGMA parse_tree without enabling experimental features

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
pragma parse_tree([select x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x from tmp) a])
```

# Trying PRAGMA integrity_check without enabling experimental features

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
PRAGMA integrity_check
```

# Trying PRAGMA parse_tree with enabling experimental features

- dataset: AllProperties.bim

```sql
PRAGMA parse_tree (
  [select x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x from tmp) a]
) OPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "val",
      "generated": true,
      "index": 0,
      "jsonName": "val",
      "name": "val",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "val"
    }
  ]
}
```

```json
[
  {
    "val": "{\"id\":\"SelectStatementExp\",\"select\":{\"id\":\"SingleSelectStatementExp\",\"selection\":[{\"id\":\"DerivedPropertyExp\",\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"x\"}}],\"from\":[{\"id\":\"SubqueryRefExp\",\"alias\":\"a\",\"query\":{\"id\":\"SubqueryExp\",\"query\":{\"id\":\"CommonTableExp\",\"recursive\":false,\"blocks\":[{\"id\":\"CommonTableBlockExp\",\"name\":\"tmp\",\"args\":[\"x\"],\"asQuery\":{\"id\":\"SelectStatementExp\",\"select\":{\"id\":\"SingleSelectStatementExp\",\"selection\":[{\"id\":\"DerivedPropertyExp\",\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"e.i\"}}],\"from\":[{\"id\":\"ClassNameExp\",\"tableSpace\":\"\",\"schemaName\":\"AllProperties\",\"className\":\"TestElement\",\"alias\":\"e\"}],\"orderBy\":[{\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"e.i\"}}],\"limit\":{\"id\":\"LimitOffsetExp\",\"exp\":{\"id\":\"LiteralValueExp\",\"kind\":\"RAW\",\"value\":\"1\"}}}}}],\"select\":{\"id\":\"SelectStatementExp\",\"select\":{\"id\":\"SingleSelectStatementExp\",\"selection\":[{\"id\":\"DerivedPropertyExp\",\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"x\"},\"alias\":\"x\"}],\"from\":[{\"id\":\"CommonTableBlockNameExp\",\"name\":\"tmp\"}]}}}}}]}}"
  }
]
```

# Trying PRAGMA parse_tree with enabling experimental features but using ECSQLOPTIONS instead of OPTIONS

- dataset: AllProperties.bim

```sql
PRAGMA parse_tree (
  [select x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x from tmp) a]
) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "val",
      "generated": true,
      "index": 0,
      "jsonName": "val",
      "name": "val",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "val"
    }
  ]
}
```

```json
[
  {
    "val": "{\"id\":\"SelectStatementExp\",\"select\":{\"id\":\"SingleSelectStatementExp\",\"selection\":[{\"id\":\"DerivedPropertyExp\",\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"x\"}}],\"from\":[{\"id\":\"SubqueryRefExp\",\"alias\":\"a\",\"query\":{\"id\":\"SubqueryExp\",\"query\":{\"id\":\"CommonTableExp\",\"recursive\":false,\"blocks\":[{\"id\":\"CommonTableBlockExp\",\"name\":\"tmp\",\"args\":[\"x\"],\"asQuery\":{\"id\":\"SelectStatementExp\",\"select\":{\"id\":\"SingleSelectStatementExp\",\"selection\":[{\"id\":\"DerivedPropertyExp\",\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"e.i\"}}],\"from\":[{\"id\":\"ClassNameExp\",\"tableSpace\":\"\",\"schemaName\":\"AllProperties\",\"className\":\"TestElement\",\"alias\":\"e\"}],\"orderBy\":[{\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"e.i\"}}],\"limit\":{\"id\":\"LimitOffsetExp\",\"exp\":{\"id\":\"LiteralValueExp\",\"kind\":\"RAW\",\"value\":\"1\"}}}}}],\"select\":{\"id\":\"SelectStatementExp\",\"select\":{\"id\":\"SingleSelectStatementExp\",\"selection\":[{\"id\":\"DerivedPropertyExp\",\"exp\":{\"id\":\"PropertyNameExp\",\"path\":\"x\"},\"alias\":\"x\"}],\"from\":[{\"id\":\"CommonTableBlockNameExp\",\"name\":\"tmp\"}]}}}}}]}}"
  }
]
```
