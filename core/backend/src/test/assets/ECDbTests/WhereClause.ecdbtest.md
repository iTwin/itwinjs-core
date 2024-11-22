Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# WhereExp equality check with string variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ECClassId,  Model.Id, DirectStr FROM aps.TestElement WHERE DirectStr = 'str0'
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   |            | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |

# WhereExp inequality check with string variable

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, ECClassId, Model.Id, DirectStr FROM aps.TestElement WHERE DirectStr != 'str0' LIMIT
  2
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   |            | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x15         | 0x152     | 0x11 | str1      |
| 0x16         | 0x152     | 0x11 | str2      |


# WhereExp equality check with long variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ECClassId,  Model.Id, DirectLong FROM aps.TestElement WHERE DirectLong = 1004
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | extendType | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ---------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id         | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | ClassId    | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | NavId      | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     |            | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x18         | 0x152     | 0x11 | 1004       |


# WhereExp inequality check with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong != 1004
LIMIT
  2
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | extendType | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ---------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id         | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | ClassId    | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | NavId      | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     |            | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x14         | 0x152     | 0x11 | 1000       |
| 0x15         | 0x152     | 0x11 | 1001       |


# WhereExp greater than condition with long variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ECClassId,  Model.Id, DirectLong FROM aps.TestElement WHERE DirectLong > 1008
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | extendType | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ---------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id         | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | ClassId    | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | NavId      | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     |            | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x1d         | 0x152     | 0x11 | 1009       |


# WhereExp greater than equal condition with long variable

- dataset: AllProperties.bim

```sql
SELECT  ECInstanceId,  ECClassId,  Model.Id, DirectLong FROM aps.TestElement WHERE DirectLong >= 1008
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | extendType | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ---------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id         | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | ClassId    | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | NavId      | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     |            | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x1c         | 0x152     | 0x11 | 1008       |
| 0x1d         | 0x152     | 0x11 | 1009       |

# WhereExp less than condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong < 1001
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | extendType | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ---------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id         | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | ClassId    | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | NavId      | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     |            | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x14         | 0x152     | 0x11 | 1000       |


# WhereExp less than equal condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong <= 1001
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | extendType | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ---------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id         | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | ClassId    | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | NavId      | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     |            | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x14         | 0x152     | 0x11 | 1000       |
| 0x15         | 0x152     | 0x11 | 1001       |


# WhereExp equality check with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble < 1.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x14         | 0x152     | 0x11 | 0.1          |

# WhereExp inequality check with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble != 1.1
LIMIT 2
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x14         | 0x152     | 0x11 | 0.1          |
| 0x16         | 0x152     | 0x11 | 2.1          |


# WhereExp greater than condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble > 8.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x1d         | 0x152     | 0x11 | 9.1          |

# WhereExp greater than equal condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble >= 8.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x1c         | 0x152     | 0x11 | 8.1          |
| 0x1d         | 0x152     | 0x11 | 9.1          |

# WhereExp less than condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble < 1.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x14         | 0x152     | 0x11 | 0.1          |

# WhereExp less than equal condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble <= 1.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x14         | 0x152     | 0x11 | 0.1          |
| 0x15         | 0x152     | 0x11 | 1.1          |


# WhereExp chaining AND conditions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr    | DirectStr    | undefined    | string   |            | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 4     | directLong   | DirectLong   | undefined    | long     |            | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 5     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectStr | DirectLong | DirectDouble |
| ------------ | --------- | ---- | --------- | ---------- | ------------ |
| 0x19         | 0x152     | 0x11 | str5      | 1005       | 5.1          |


# WhereExp chaining AND and OR conditions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr    | DirectStr    | undefined    | string   |            | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 4     | directLong   | DirectLong   | undefined    | long     |            | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 5     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectStr | DirectLong | DirectDouble |
| ------------ | --------- | ---- | --------- | ---------- | ------------ |
| 0x14         | 0x152     | 0x11 | str0      | 1000       | 0.1          |
| 0x19         | 0x152     | 0x11 | str5      | 1005       | 5.1          |


# WhereExp Between condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong BETWEEN 1004 AND 1006
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 4     | directLong   | DirectLong   | undefined    | long     |            | Int64  | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x18         | 0x152     | 0x11 | 1004       |
| 0x19         | 0x152     | 0x11 | 1005       |
| 0x1a         | 0x152     | 0x11 | 1006       |


# WhereExp Between condition with double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectDouble
FROM
  aps.TestElement
WHERE
  DirectDouble BETWEEN 1.1 AND 3.1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   |            | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x15         | 0x152     | 0x11 | 1.1          |
| 0x16         | 0x152     | 0x11 | 2.1          |
| 0x17         | 0x152     | 0x11 | 3.1          |


# WhereExp IN condition with string variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectStr
FROM
  aps.TestElement
WHERE
  DirectStr IN ('str0', 'str4', 'str8')
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | extendType | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ---------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id         | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | ClassId    | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | NavId      | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   |            | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |
| 0x18         | 0x152     | 0x11 | str4      |
| 0x1c         | 0x152     | 0x11 | str8      |

# WhereExp IN condition with long variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong IN (1004, 1007, 1009)
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | extendType | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ---------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id         | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | ClassId    | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | NavId      | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     |            | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x18         | 0x152     | 0x11 | 1004       |
| 0x1b         | 0x152     | 0x11 | 1007       |
| 0x1d         | 0x152     | 0x11 | 1009       |


# WhereExp IN condition with Double variable

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectDouble | false     | 3     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | DirectDouble |
| ------------ | --------- | ---- | ------------ |
| 0x19         | 0x152     | 0x11 | 5.1          |
| 0x1c         | 0x152     | 0x11 | 8.1          |


# WhereExp pattern matching with %

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |
| 0x15         | 0x152     | 0x11 | str1      |
| 0x16         | 0x152     | 0x11 | str2      |

# WhereExp partial pattern matching with %

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x19         | 0x152     | 0x11 | str5      |

# WhereExp pattern matching with _

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |


# WhereExp anti-pattern matching with %

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |
| 0x15         | 0x152     | 0x11 | str1      |
| 0x17         | 0x152     | 0x11 | str3      |


# WhereExp with NOT NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ECClassId | Id   | NullProp |
| ------------ | --------- | ---- | -------- |
| 0x15         | 0x152     | 0x11 | NotNull  |
| 0x17         | 0x152     | 0x11 | NotNull  |
| 0x19         | 0x152     | 0x11 | NotNull  |
| 0x1b         | 0x152     | 0x11 | NotNull  |
| 0x1d         | 0x152     | 0x11 | NotNull  |


# WhereExp with NOT condition

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x17         | 0x152     | 0x11 | str3      |
| 0x1b         | 0x152     | 0x11 | str7      |


# WhereExp with subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x14         | 0x152     | 0x11 | 1000       |
| 0x15         | 0x152     | 0x11 | 1001       |

# WhereExp with EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x14         | 0x152     | 0x11 | 1000       |
| 0x15         | 0x152     | 0x11 | 1001       |
| 0x16         | 0x152     | 0x11 | 1002       |

# WhereExp with NOT EXISTS

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x14         | 0x152     | 0x11 | 1000       |
| 0x15         | 0x152     | 0x11 | 1001       |
| 0x16         | 0x152     | 0x11 | 1002       |
| 0x17         | 0x152     | 0x11 | 1003       |

# WhereExp with functions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |


# WhereExp with aggregate functions

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className  | ECClassId    | ClassId      | long     | Id    | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id   | Id           | NavId        | long     | Id    | Id                 |
| AllProperties:TestElement | DirectLong   | false     | 3     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | ECClassId | Id   | DirectLong |
| ------------ | --------- | ---- | ---------- |
| 0x19         | 0x152     | 0x11 | 1005       |
| 0x1a         | 0x152     | 0x11 | 1006       |
| 0x1b         | 0x152     | 0x11 | 1007       |
| 0x1c         | 0x152     | 0x11 | 1008       |
| 0x1d         | 0x152     | 0x11 | 1009       |


# WhereExp using IS NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ECClassId | Id   |
| ------------ | --------- | ---- |
| 0x14         | 0x152     | 0x11 |
| 0x16         | 0x152     | 0x11 |
| 0x18         | 0x152     | 0x11 |
| 0x1a         | 0x152     | 0x11 |
| 0x1c         | 0x152     | 0x11 |

# WhereExp using IS NOT NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ECClassId | Id   | NullProp |
| ------------ | --------- | ---- | -------- |
| 0x15         | 0x152     | 0x11 | NotNull  |
| 0x17         | 0x152     | 0x11 | NotNull  |
| 0x19         | 0x152     | 0x11 | NotNull  |
| 0x1b         | 0x152     | 0x11 | NotNull  |
| 0x1d         | 0x152     | 0x11 | NotNull  |


# WhereExp using COALESCE - IN

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ECClassId | Id   | DirectStr | NullProp |
| ------------ | --------- | ---- | --------- | -------- |
| 0x15         | 0x152     | 0x11 | str1      | NotNull  |
| 0x17         | 0x152     | 0x11 | str3      | NotNull  |
| 0x19         | 0x152     | 0x11 | str5      | NotNull  |
| 0x1b         | 0x152     | 0x11 | str7      | NotNull  |
| 0x1d         | 0x152     | 0x11 | str9      | NotNull  |

# WhereExp using COALESCE NOT IN

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |
| 0x16         | 0x152     | 0x11 | str2      |
| 0x18         | 0x152     | 0x11 | str4      |
| 0x1a         | 0x152     | 0x11 | str6      |
| 0x1c         | 0x152     | 0x11 | str8      |


# WhereExp using CASE - NOT NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ECClassId | Id   | DirectStr |
| ------------ | --------- | ---- | --------- |
| 0x14         | 0x152     | 0x11 | str0      |
| 0x16         | 0x152     | 0x11 | str2      |
| 0x18         | 0x152     | 0x11 | str4      |
| 0x1a         | 0x152     | 0x11 | str6      |
| 0x1c         | 0x152     | 0x11 | str8      |


# WhereExp using CASE - IS NULL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
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
|                           | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 3     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 4     | nullProp  | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | ECClassId | Id   | DirectStr | NullProp |
| ------------ | --------- | ---- | --------- | -------- |
| 0x15         | 0x152     | 0x11 | str1      | NotNull  |
| 0x17         | 0x152     | 0x11 | str3      | NotNull  |
| 0x19         | 0x152     | 0x11 | str5      | NotNull  |
| 0x1b         | 0x152     | 0x11 | str7      | NotNull  |
| 0x1d         | 0x152     | 0x11 | str9      | NotNull  |