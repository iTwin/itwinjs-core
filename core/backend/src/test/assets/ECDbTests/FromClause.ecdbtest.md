Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# FromExp with a single table

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ECClassId,
  Model.Id,
  i,
  DirectStr,
  DirectLong,
  DirectDouble
FROM aps.TestElement
LIMIT
  1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:IPrimitive  | i            | false     | 3     | i            | i            | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | DirectStr    | false     | 4     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 5     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 6     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | i   | DirectStr | DirectLong | DirectDouble |
| ------------ | --------- | ---- | --- | --------- | ---------- | ------------ |
| 0x14         | 0x152     | 0x11 | 100 | str0      | 1000       | 0.1          |

# FromExp using a table alias

- dataset: AllProperties.bim

```sql
SELECT
  test.ECInstanceId,
  test.ECClassId,
  test.Model.Id,
  test.i,
  test.DirectStr,
  test.DirectLong,
  test.DirectDouble
FROM
  aps.TestElement test
LIMIT
  1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:IPrimitive  | i            | false     | 3     | i            | i            | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | DirectStr    | false     | 4     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 5     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 6     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | i   | DirectStr | DirectLong | DirectDouble |
| ------------ | --------- | ---- | --- | --------- | ---------- | ------------ |
| 0x14         | 0x152     | 0x11 | 100 | str0      | 1000       | 0.1          |

# FromExp with an inner join

- dataset: AllProperties.bim

```sql
SELECT
  t.ECInstanceId,
  t.Model.Id,
  t.DirectStr,
  c.Name
FROM
  aps.TestElement t
  INNER JOIN meta.ECClassDef c ON c.ECInstanceId = t.ECClassId
LIMIT
  1
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | Model.Id     | false     | 1     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 2     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| ECDbMeta:ECClassDef       | Name         | false     | 3     | name      | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Id   | DirectStr | Name        |
| ------------ | ---- | --------- | ----------- |
| 0x14         | 0x11 | str0      | TestElement |

# FromExp with a right join

- dataset: AllProperties.bim

```sql
SELECT
  t.ECInstanceId,
  t.Model.Id,
  t.DirectStr,
  c.Name
FROM
  aps.TestElement t
  RIGHT JOIN meta.ECClassDef c ON c.ECInstanceId = t.ECClassId
LIMIT
  1
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | Model.Id     | false     | 1     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 2     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| ECDbMeta:ECClassDef       | Name         | false     | 3     | name      | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Id   | DirectStr | Name        |
| ------------ | ---- | --------- | ----------- |
| 0x14         | 0x11 | str0      | TestElement |


# FromExp with a left join

- dataset: AllProperties.bim

```sql
SELECT
  t.ECInstanceId,
  t.Model.Id,
  t.DirectStr,
  c.Name
FROM
  aps.TestElement t
  LEFT JOIN meta.ECClassDef c ON c.ECInstanceId = t.ECClassId
LIMIT
  1
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | Model.Id     | false     | 1     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 2     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| ECDbMeta:ECClassDef       | Name         | false     | 3     | name      | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Id   | DirectStr | Name        |
| ------------ | ---- | --------- | ----------- |
| 0x14         | 0x11 | str0      | TestElement |


# FromExp with a full join

- dataset: AllProperties.bim

```sql
SELECT
  t.ECInstanceId,
  t.Model.Id,
  t.DirectStr,
  c.Name
FROM
  aps.TestElement t
  FULL JOIN meta.ECClassDef c ON c.ECInstanceId = t.ECClassId
LIMIT
  1
```

| className                 | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | Model.Id     | false     | 1     | model.id  | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:TestElement | DirectStr    | false     | 2     | directStr | DirectStr    | undefined    | string   | String | DirectStr          |
| ECDbMeta:ECClassDef       | Name         | false     | 3     | name      | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Id   | DirectStr | Name        |
| ------------ | ---- | --------- | ----------- |
| 0x14         | 0x11 | str0      | TestElement |

# FromExp with multiple joins

- dataset: AllProperties.bim

```sql
SELECT
  t.ECInstanceId AS Id,
  t.Model.Id AS ModelId,
  t.DirectStr AS DirectStr,
  c.Name AS ClassName,
  s.Name AS SchemaName
FROM
  aps.TestElement t
  INNER JOIN meta.ECClassDef c ON c.ECInstanceId = t.ECClassId
  LEFT JOIN meta.ECSchemaDef s ON c.Schema.Id = s.ECInstanceId
LIMIT
  1
```


# FromExp with a subquery

- dataset: AllProperties.bim

```sql
SELECT
  sub.Id,
  sub.ClassId
FROM
  (
    SELECT
      ECInstanceId as Id,
      ECClassId as ClassId
    FROM
      aps.TestElement
  ) sub
LIMIT
  5
```

| className | accessString | generated | index | jsonName | name    | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | ---- |
|           | Id           | true      | 0     | id       | Id      | Id           | long     | Id   |
|           | ClassId      | true      | 1     | classId  | ClassId | ClassId      | long     | Id   |

| Id   | ClassId |
| ---- | ------- |
| 0x14 | 0x152   |
| 0x15 | 0x152   |
| 0x16 | 0x152   |
| 0x17 | 0x152   |
| 0x18 | 0x152   |


# FromExp with joins and subquery

- dataset: AllProperties.bim

```sql
SELECT
  sub.ECInstanceId,
  sub.ECClassId,
  sub.Model.Id,
  sub.i,
  sub.DirectStr,
  sub.DirectLong,
  sub.DirectDouble
FROM
  (
    SELECT
      *
    FROM
      aps.TestElement e
      LEFT JOIN (
        SELECT
          *
        FROM
          meta.ECClassDef
      ) c ON c.ECInstanceId = e.ECClassId
    LIMIT
      4
  ) sub
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | ECClassId    | false     | 1     | className    | ECClassId    | ClassId      | long     | Id     | ECClassId          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:IPrimitive  | i            | false     | 3     | i            | i            | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | DirectStr    | false     | 4     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 5     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 6     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | ECClassId | Id   | i   | DirectStr | DirectLong | DirectDouble |
| ------------ | --------- | ---- | --- | --------- | ---------- | ------------ |
| 0x14         | 0x152     | 0x11 | 100 | str0      | 1000       | 0.1          |
| 0x15         | 0x152     | 0x11 | 101 | str1      | 1001       | 1.1          |
| 0x16         | 0x152     | 0x11 | 102 | str2      | 1002       | 2.1          |
| 0x17         | 0x152     | 0x11 | 103 | str3      | 1003       | 3.1          |


# FromExp with Distinct

- dataset: AllProperties.bim

```sql
SELECT DISTINCT(ECClassId) from Bis.Element
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ---- | ------------------ |
|           | ECClassId    | false     | 0     | className | ECClassId | ClassId      | long     | Id   | ECClassId          |

| ECClassId |
| --------- |
| 0x89      |
| 0x98      |
| 0xc5      |
| 0xdd      |
| 0xf0      |
| 0x126     |
| 0x152     |


# FromExp with Union

- dataset: AllProperties.bim

```sql
SELECT
  ec_classname (ECClassId) AS ClassName
FROM
  aps.TestElement
UNION
SELECT
  ec_classname (ECClassId) AS ClassName
FROM
  aps.TestElementAspect
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ |
|           | ClassName    | true      | 0     | className | ClassName | undefined    | string   | String |

| ClassName                       |
| ------------------------------- |
| AllProperties:TestElement       |
| AllProperties:TestElementAspect |


# FromExp with Union All

- dataset: AllProperties.bim

```sql
SELECT
  ec_classname (ECClassId) AS ClassName
FROM
  aps.TestElement
UNION ALL
SELECT
  ec_classname (ECClassId) AS ClassName
FROM
  aps.TestElementAspect
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ |
|           | ClassName    | true      | 0     | className | ClassName | undefined    | string   | String |

| ClassName                       |
| ------------------------------- |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElement       |
| AllProperties:TestElementAspect |
| AllProperties:TestElementAspect |
| AllProperties:TestElementAspect |
| AllProperties:TestElementAspect |
| AllProperties:TestElementAspect |


# FromExp with multiple tables

- dataset: AllProperties.bim

```sql
SELECT
  e.ECInstanceId AS ElementId,
  e.ECClassId AS ElementClass,
  a.ECInstanceID AS AspectId,
  a.ECClassId AS AspectClass
FROM
  aps.TestElement e,
  aps.TestElementAspect a
LIMIT
  5
```

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ElementId    | true      | 0     | elementId    | ElementId    | Id           | long     | Id   | ECInstanceId       |
|           | ElementClass | true      | 1     | elementClass | ElementClass | ClassId      | long     | Id   | ECClassId          |
|           | AspectId     | true      | 2     | aspectId     | AspectId     | Id           | long     | Id   | ECInstanceId       |
|           | AspectClass  | true      | 3     | aspectClass  | AspectClass  | ClassId      | long     | Id   | ECClassId          |

| ElementId | ElementClass | AspectId | AspectClass |
| --------- | ------------ | -------- | ----------- |
| 0x14      | 0x152        | 0x21     | 0x153       |
| 0x14      | 0x152        | 0x22     | 0x153       |
| 0x14      | 0x152        | 0x23     | 0x153       |
| 0x14      | 0x152        | 0x24     | 0x153       |
| 0x14      | 0x152        | 0x25     | 0x153       |