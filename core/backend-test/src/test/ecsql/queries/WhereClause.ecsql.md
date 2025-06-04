Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Equality check with string variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ec_classname(ECClassId) as ClassName,  Model.Id, DirectStr FROM aps.TestElement WHERE DirectStr = 'str0'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |

# Inequality check with string variable

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ec_classname(ECClassId) as ClassName, Model.Id, DirectStr FROM aps.TestElement WHERE DirectStr != 'str0' LIMIT
  2
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x15         | AllProperties:TestElement | 0x11 | str1      |
| 0x16         | AllProperties:TestElement | 0x11 | str2      |

# Equality check with long variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ec_classname(ECClassId) as ClassName,  Model.Id, DirectLong FROM aps.TestElement WHERE DirectLong = 1004
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x18         | AllProperties:TestElement | 0x11 | 1004       |

# Inequality check with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong != 1004
LIMIT
  2
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x14         | AllProperties:TestElement | 0x11 | 1000       |
| 0x15         | AllProperties:TestElement | 0x11 | 1001       |

# Greater than condition with long variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ec_classname(ECClassId) as ClassName,  Model.Id, DirectLong FROM aps.TestElement WHERE DirectLong > 1008
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x1d         | AllProperties:TestElement | 0x11 | 1009       |

# Greater than equal condition with long variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ec_classname(ECClassId) as ClassName,  Model.Id, DirectLong FROM aps.TestElement WHERE DirectLong >= 1008
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x1c         | AllProperties:TestElement | 0x11 | 1008       |
| 0x1d         | AllProperties:TestElement | 0x11 | 1009       |

# Less than condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong < 1001
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x14         | AllProperties:TestElement | 0x11 | 1000       |

# Less than equal condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong <= 1001
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x14         | AllProperties:TestElement | 0x11 | 1000       |
| 0x15         | AllProperties:TestElement | 0x11 | 1001       |

# Equality check with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble < 1.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | 0.1          |

# Inequality check with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble != 1.1
LIMIT 2
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | 0.1          |
| 0x16         | AllProperties:TestElement | 0x11 | 2.1          |

# Greater than condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble > 8.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x1d         | AllProperties:TestElement | 0x11 | 9.1          |

# Greater than equal condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble >= 8.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x1c         | AllProperties:TestElement | 0x11 | 8.1          |
| 0x1d         | AllProperties:TestElement | 0x11 | 9.1          |

# Less than condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble < 1.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | 0.1          |

# Less than equal condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble <= 1.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | 0.1          |
| 0x15         | AllProperties:TestElement | 0x11 | 1.1          |

# Chaining AND conditions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr,
  DirectLong,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectStr != 'str0' AND
  DirectLong < 1006 AND
  DirectDouble > 4.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 4     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 5     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectStr | DirectLong | DirectDouble |
| ------------ | ------------------------- | ---- | --------- | ---------- | ------------ |
| 0x19         | AllProperties:TestElement | 0x11 | str5      | 1005       | 5.1          |

# Chaining AND and OR conditions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr,
  DirectLong,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectStr = 'str0' OR
  (
    DirectLong < 1006 AND
    DirectDouble > 4.1
  )
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 4     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 5     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectStr | DirectLong | DirectDouble |
| ------------ | ------------------------- | ---- | --------- | ---------- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | str0      | 1000       | 0.1          |
| 0x19         | AllProperties:TestElement | 0x11 | str5      | 1005       | 5.1          |

# Between condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong BETWEEN 1004 AND 1006
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 4     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x18         | AllProperties:TestElement | 0x11 | 1004       |
| 0x19         | AllProperties:TestElement | 0x11 | 1005       |
| 0x1a         | AllProperties:TestElement | 0x11 | 1006       |

# Between condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble BETWEEN 1.1 AND 3.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x15         | AllProperties:TestElement | 0x11 | 1.1          |
| 0x16         | AllProperties:TestElement | 0x11 | 2.1          |
| 0x17         | AllProperties:TestElement | 0x11 | 3.1          |

# IN condition with string variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  DirectStr IN ('str0', 'str4', 'str8')
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |
| 0x18         | AllProperties:TestElement | 0x11 | str4      |
| 0x1c         | AllProperties:TestElement | 0x11 | str8      |

# IN condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong IN (1004, 1007, 1009)
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x18         | AllProperties:TestElement | 0x11 | 1004       |
| 0x1b         | AllProperties:TestElement | 0x11 | 1007       |
| 0x1d         | AllProperties:TestElement | 0x11 | 1009       |

# IN condition with Double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble IN (5.1, 8.1)
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className    | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ClassName                 | Id   | DirectDouble |
| ------------ | ------------------------- | ---- | ------------ |
| 0x19         | AllProperties:TestElement | 0x11 | 5.1          |
| 0x1c         | AllProperties:TestElement | 0x11 | 8.1          |

# Pattern matching with %

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  DirectStr LIKE 'StR%'
LIMIT
  3
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |
| 0x15         | AllProperties:TestElement | 0x11 | str1      |
| 0x16         | AllProperties:TestElement | 0x11 | str2      |

# Partial pattern matching with %

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  DirectStr LIKE 'S%5'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x19         | AllProperties:TestElement | 0x11 | str5      |

# Pattern matching with \_

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  DirectStr LIKE 'St_0'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |

# Anti-pattern matching with %

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  DirectStr NOT LIKE 'S%2'
LIMIT
  3
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |
| 0x15         | AllProperties:TestElement | 0x11 | str1      |
| 0x17         | AllProperties:TestElement | 0x11 | str3      |

# With NOT NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  NullProp
FROM
  aps.TestElement
WHERE
  NullProp IS NOT NULL
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ClassName                 | Id   | NullProp |
| ------------ | ------------------------- | ---- | -------- |
| 0x15         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x17         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x19         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x1b         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x1d         | AllProperties:TestElement | 0x11 | NotNull  |

# With NOT condition

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  NOT DirectStr IN (
    'str0',
    'str1',
    'str2',
    'str4',
    'str5',
    'str6',
    'str2',
    'str8',
    'str9'
  )
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x17         | AllProperties:TestElement | 0x11 | str3      |
| 0x1b         | AllProperties:TestElement | 0x11 | str7      |

# With subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  ECClassId IN (
    SELECT
      ECInstanceId
    FROM
      meta.ECClassDef
  )
LIMIT
  2
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x14         | AllProperties:TestElement | 0x11 | 1000       |
| 0x15         | AllProperties:TestElement | 0x11 | 1001       |

# With EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement e
WHERE
  EXISTS (
    SELECT
      1
    FROM
      meta.ECClassDef c
    WHERE
      c.ECInstanceId = e.ECClassId AND
      c.Name = 'TestElement'
  )
LIMIT 3
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x14         | AllProperties:TestElement | 0x11 | 1000       |
| 0x15         | AllProperties:TestElement | 0x11 | 1001       |
| 0x16         | AllProperties:TestElement | 0x11 | 1002       |

# With NOT EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement e
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      meta.ECClassDef c
    WHERE
      c.ECInstanceId = e.ECClassId AND
      c.Name = 'WrongTestElement'
  )
LIMIT
  4
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x14         | AllProperties:TestElement | 0x11 | 1000       |
| 0x15         | AllProperties:TestElement | 0x11 | 1001       |
| 0x16         | AllProperties:TestElement | 0x11 | 1002       |
| 0x17         | AllProperties:TestElement | 0x11 | 1003       |

# With functions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  UPPER(DirectStr) = 'STR0'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |

# With aggregate functions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong > (
    SELECT
      AVG(DirectLong)
    FROM
      aps.TestElement
  )
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className  | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |

| ECInstanceId | ClassName                 | Id   | DirectLong |
| ------------ | ------------------------- | ---- | ---------- |
| 0x19         | AllProperties:TestElement | 0x11 | 1005       |
| 0x1a         | AllProperties:TestElement | 0x11 | 1006       |
| 0x1b         | AllProperties:TestElement | 0x11 | 1007       |
| 0x1c         | AllProperties:TestElement | 0x11 | 1008       |
| 0x1d         | AllProperties:TestElement | 0x11 | 1009       |

# Using IS NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  NullProp
FROM
  aps.TestElement
WHERE
  NullProp IS NULL
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ClassName                 | Id   |
| ------------ | ------------------------- | ---- |
| 0x14         | AllProperties:TestElement | 0x11 |
| 0x16         | AllProperties:TestElement | 0x11 |
| 0x18         | AllProperties:TestElement | 0x11 |
| 0x1a         | AllProperties:TestElement | 0x11 |
| 0x1c         | AllProperties:TestElement | 0x11 |

# Using IS NOT NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  NullProp
FROM
  aps.TestElement
WHERE
  NullProp IS NOT NULL
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ClassName                 | Id   | NullProp |
| ------------ | ------------------------- | ---- | -------- |
| 0x15         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x17         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x19         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x1b         | AllProperties:TestElement | 0x11 | NotNull  |
| 0x1d         | AllProperties:TestElement | 0x11 | NotNull  |

# Using COALESCE - IN

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr,
  NullProp
FROM
  aps.TestElement
WHERE
  COALESCE(NullProp, DirectStr) IN ('NotNull')
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ClassName                 | Id   | DirectStr | NullProp |
| ------------ | ------------------------- | ---- | --------- | -------- |
| 0x15         | AllProperties:TestElement | 0x11 | str1      | NotNull  |
| 0x17         | AllProperties:TestElement | 0x11 | str3      | NotNull  |
| 0x19         | AllProperties:TestElement | 0x11 | str5      | NotNull  |
| 0x1b         | AllProperties:TestElement | 0x11 | str7      | NotNull  |
| 0x1d         | AllProperties:TestElement | 0x11 | str9      | NotNull  |

# Using COALESCE NOT IN

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr,
  NullProp
FROM
  aps.TestElement
WHERE
  COALESCE(NullProp, DirectStr) NOT IN ('NotNull')
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |
| 0x16         | AllProperties:TestElement | 0x11 | str2      |
| 0x18         | AllProperties:TestElement | 0x11 | str4      |
| 0x1a         | AllProperties:TestElement | 0x11 | str6      |
| 0x1c         | AllProperties:TestElement | 0x11 | str8      |

# Using CASE - NOT NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr,
  NullProp
FROM
  aps.TestElement
WHERE
  CASE
    WHEN NullProp IS NOT NULL THEN 'TRUE'
    ELSE 'FALSE'
  END = 'FALSE'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ClassName                 | Id   | DirectStr |
| ------------ | ------------------------- | ---- | --------- |
| 0x14         | AllProperties:TestElement | 0x11 | str0      |
| 0x16         | AllProperties:TestElement | 0x11 | str2      |
| 0x18         | AllProperties:TestElement | 0x11 | str4      |
| 0x1a         | AllProperties:TestElement | 0x11 | str6      |
| 0x1c         | AllProperties:TestElement | 0x11 | str8      |

# Using CASE - IS NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname(ECClassId) as ClassName,
  Model.Id,
  DirectStr,
  NullProp
FROM
  aps.TestElement
WHERE
  CASE
    WHEN NullProp IS NULL THEN 'TRUE'
    ELSE 'FALSE'
  END = 'FALSE'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ClassName                 | Id   | DirectStr | NullProp |
| ------------ | ------------------------- | ---- | --------- | -------- |
| 0x15         | AllProperties:TestElement | 0x11 | str1      | NotNull  |
| 0x17         | AllProperties:TestElement | 0x11 | str3      | NotNull  |
| 0x19         | AllProperties:TestElement | 0x11 | str5      | NotNull  |
| 0x1b         | AllProperties:TestElement | 0x11 | str7      | NotNull  |
| 0x1d         | AllProperties:TestElement | 0x11 | str9      | NotNull  |
