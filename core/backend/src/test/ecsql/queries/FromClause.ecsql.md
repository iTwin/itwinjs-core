Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# With a single table

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname (ECClassId) AS Name,
  Model.Id,
  i,
  DirectStr,
  DirectLong,
  DirectDouble
FROM
  aps.TestElement
LIMIT
  1
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|                           | Name         | true      | 1     | name         | Name         | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:IPrimitive  | i            | false     | 3     | i            | i            | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | DirectStr    | false     | 4     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 5     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 6     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | Name                      | Id   | i   | DirectStr | DirectLong | DirectDouble |
| ------------ | ------------------------- | ---- | --- | --------- | ---------- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | 100 | str0      | 1000       | 0.1          |


# Using a table alias

- dataset: AllProperties.bim

```sql
SELECT
  test.ECInstanceId,
  ec_classname (ECClassId) AS Name,
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
|                           | Name         | true      | 1     | name         | Name         | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:IPrimitive  | i            | false     | 3     | i            | i            | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | DirectStr    | false     | 4     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 5     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 6     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | Name                      | Id   | i   | DirectStr | DirectLong | DirectDouble |
| ------------ | ------------------------- | ---- | --- | --------- | ---------- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | 100 | str0      | 1000       | 0.1          |

# With an inner join

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

# With a right join

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

# With a left join

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

# With a full join

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

# With multiple joins

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

# With a subquery

- dataset: AllProperties.bim

```sql
SELECT
  sub.Id,
  ec_classname (sub.ClassId) AS Name
FROM
  (
    SELECT
      ECInstanceId AS Id,
      ECClassId AS ClassId
    FROM
      aps.TestElement
  ) sub
LIMIT
  5
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | Id           | true      | 0     | id       | Id   | Id           | long     | Id     |
|           | Name         | true      | 1     | name     | Name | undefined    | string   | String |

| Id   | Name                      |
| ---- | ------------------------- |
| 0x14 | AllProperties:TestElement |
| 0x15 | AllProperties:TestElement |
| 0x16 | AllProperties:TestElement |
| 0x17 | AllProperties:TestElement |
| 0x18 | AllProperties:TestElement |

# With joins and subquery

- dataset: AllProperties.bim

```sql
SELECT
  sub.ECInstanceId,
  ec_classname (sub.ECClassId) AS Name,
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
|                           | Name         | true      | 1     | name         | Name         | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 2     | model.id     | Id           | NavId        | long     | Id     | Id                 |
| AllProperties:IPrimitive  | i            | false     | 3     | i            | i            | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | DirectStr    | false     | 4     | directStr    | DirectStr    | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 5     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 6     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |

| ECInstanceId | Name                      | Id   | i   | DirectStr | DirectLong | DirectDouble |
| ------------ | ------------------------- | ---- | --- | --------- | ---------- | ------------ |
| 0x14         | AllProperties:TestElement | 0x11 | 100 | str0      | 1000       | 0.1          |
| 0x15         | AllProperties:TestElement | 0x11 | 101 | str1      | 1001       | 1.1          |
| 0x16         | AllProperties:TestElement | 0x11 | 102 | str2      | 1002       | 2.1          |
| 0x17         | AllProperties:TestElement | 0x11 | 103 | str3      | 1003       | 3.1          |


# With Distinct keyword

- dataset: AllProperties.bim

```sql
SELECT DISTINCT(ec_classname(ECClassId)) as Name from Bis.Element
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | Name         | true      | 0     | name     | Name | undefined    | string   | String |

| Name                        |
| --------------------------- |
| BisCore:SubCategory         |
| BisCore:DefinitionPartition |
| BisCore:SpatialCategory     |
| BisCore:LinkPartition       |
| BisCore:PhysicalPartition   |
| BisCore:Subject             |
| AllProperties:TestElement   |
| AllProperties:TestFeature   |

# With Union

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

# With Union All

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

# With multiple tables

- dataset: AllProperties.bim

```sql
SELECT
  e.ECInstanceId AS ElementId,
  ec_classname (e.ECClassId) AS ElementClassName,
  a.ECInstanceID AS AspectId,
  a.ECClassId AS AspectClass
FROM
  aps.TestElement e,
  aps.TestElementAspect a
LIMIT
  5
```

| className | accessString     | generated | index | jsonName         | name             | extendedType | typeName | type   | originPropertyName |
| --------- | ---------------- | --------- | ----- | ---------------- | ---------------- | ------------ | -------- | ------ | ------------------ |
|           | ElementId        | true      | 0     | elementId        | ElementId        | Id           | long     | Id     | ECInstanceId       |
|           | ElementClassName | true      | 1     | elementClassName | ElementClassName | undefined    | string   | String | undefined          |
|           | AspectId         | true      | 2     | aspectId         | AspectId         | Id           | long     | Id     | ECInstanceId       |
|           | AspectClass      | true      | 3     | aspectClass      | AspectClass      | ClassId      | long     | Id     | ECClassId          |

| ElementId | ElementClassName          | AspectId | AspectClass |
| --------- | ------------------------- | -------- | ----------- |
| 0x14      | AllProperties:TestElement | 0x21     | 0x163       |
| 0x14      | AllProperties:TestElement | 0x22     | 0x163       |
| 0x14      | AllProperties:TestElement | 0x23     | 0x163       |
| 0x14      | AllProperties:TestElement | 0x24     | 0x163       |
| 0x14      | AllProperties:TestElement | 0x25     | 0x163       |
