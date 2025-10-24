Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Using ALL with equality

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId = ALL (
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName             |
| ------- | --------------------- |
| 0x11    | BisCore:PhysicalModel |

# Using ALL with inequality

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId != ALL (
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName               |
| ------- | ----------------------- |
| 0x10    | BisCore:DictionaryModel |
| 0xe     | BisCore:LinkModel       |
| 0x1     | BisCore:RepositoryModel |

# Using ANY with equality

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId = ANY(
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName             |
| ------- | --------------------- |
| 0x11    | BisCore:PhysicalModel |

# Using ANY with inequality

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId != ANY(
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName               |
| ------- | ----------------------- |
| 0x10    | BisCore:DictionaryModel |
| 0xe     | BisCore:LinkModel       |
| 0x1     | BisCore:RepositoryModel |

# Using ANY Greater Than

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId > ANY(
    SELECT
      ECClassId
    FROM
      aps.TestElement
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using ANY Greater Than Or Equal To

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId >= ANY(
    SELECT
      ECClassId
    FROM
      aps.TestElement
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElement                 |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using ANY Less Than

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId < ANY(
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName               |
| ------- | ----------------------- |
| 0x10    | BisCore:DictionaryModel |
| 0xe     | BisCore:LinkModel       |
| 0x1     | BisCore:RepositoryModel |

# Using ANY Less Than Or Equal To

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId <= ANY(
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName               |
| ------- | ----------------------- |
| 0x10    | BisCore:DictionaryModel |
| 0xe     | BisCore:LinkModel       |
| 0x11    | BisCore:PhysicalModel   |
| 0x1     | BisCore:RepositoryModel |

# Using SOME with equality

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId = SOME (
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName             |
| ------- | --------------------- |
| 0x11    | BisCore:PhysicalModel |

# Using SOME with inequality

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId != SOME (
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName               |
| ------- | ----------------------- |
| 0x10    | BisCore:DictionaryModel |
| 0xe     | BisCore:LinkModel       |
| 0x1     | BisCore:RepositoryModel |

# Using SOME with Greater Than

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId > SOME (
    SELECT
      ECClassId
    FROM
      aps.TestElement
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using SOME with Greater Than Or Equal To

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId >= SOME (
    SELECT
      ECClassId
    FROM
      aps.TestElement
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElement                 |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using SOME with Less Than

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId < SOME (
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName               |
| ------- | ----------------------- |
| 0x10    | BisCore:DictionaryModel |
| 0xe     | BisCore:LinkModel       |
| 0x1     | BisCore:RepositoryModel |

# Using SOME with Less Than Or Equal To

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId AS ModelId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId <= SOME (
    SELECT
      Model.Id
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|           | ModelId      | true      | 0     | modelId   | ModelId   | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName | undefined    | string   | String | undefined          |

| ModelId | ClassName               |
| ------- | ----------------------- |
| 0x10    | BisCore:DictionaryModel |
| 0xe     | BisCore:LinkModel       |
| 0x11    | BisCore:PhysicalModel   |
| 0x1     | BisCore:RepositoryModel |

# Using ANY with subquery

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId > ANY(
    SELECT
      e.ECClassId
    FROM
      aps.TestElement e
    WHERE
      e.ECInstanceId IN (
        SELECT
          Element.Id
        FROM
          aps.TestElementAspect
      )
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using ANY with where clause in subquery

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId >= ANY(
    SELECT
      e.ECClassId
    FROM
      aps.TestElement e
    WHERE
      e.ECInstanceId IN (
        SELECT
          Element.Id
        FROM
          aps.TestElementAspect
      )
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElement                 |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using SOME with where clause in subquery

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId > SOME (
    SELECT
      e.ECClassId
    FROM
      aps.TestElement e
    WHERE
      e.ECInstanceId IN (
        SELECT
          Element.Id
        FROM
          aps.TestElementAspect
      )
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using ANY with group by clause in subquery

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId >= ANY(
    SELECT
      ECClassId
    FROM
      aps.TestElement
    GROUP BY
      ECClassId
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElement                 |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Using SOME with group by clause in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname (ECClassId) AS ClassName
FROM
  Bis.Model
WHERE
  ECInstanceId <= SOME (
    SELECT
      Model.Id
    FROM
      aps.TestElement
    GROUP BY
      ECClassId
  )
ORDER BY
  ECInstanceId ASC
```

| className | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |

| ECInstanceId | ClassName               |
| ------------ | ----------------------- |
| 0x1          | BisCore:RepositoryModel |
| 0xe          | BisCore:LinkModel       |
| 0x10         | BisCore:DictionaryModel |
| 0x11         | BisCore:PhysicalModel   |

# Using ALL with simple CTE in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname (ECClassId) AS ClassName,
  Element.Id AS ElementID
FROM
  aps.TestElementAspect
WHERE
  Element.Id = ALL (
    WITH
      cte (Id) AS (
        SELECT
          ECInstanceId
        FROM
          aps.TestElement
        LIMIT
          1
      )
    SELECT
      *
    FROM
      cte
  )
```

| className | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|           | ElementID    | true      | 2     | elementID | ElementID    | NavId        | long     | Id     | Id                 |

| ECInstanceId | ClassName                       | ElementID |
| ------------ | ------------------------------- | --------- |
| 0x21         | AllProperties:TestElementAspect | 0x14      |

# Using ANY with simple CTE in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname (ECClassId) AS ClassName,
  Element.Id AS ElementID
FROM
  aps.TestElementAspect
WHERE
  Element.Id = ANY(
    WITH
      cte (Id) AS (
        SELECT
          ECInstanceId
        FROM
          aps.TestElement
      )
    SELECT
      *
    FROM
      cte
  )
```

| className | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|           | ElementID    | true      | 2     | elementID | ElementID    | NavId        | long     | Id     | Id                 |

| ECInstanceId | ClassName                       | ElementID |
| ------------ | ------------------------------- | --------- |
| 0x21         | AllProperties:TestElementAspect | 0x14      |
| 0x22         | AllProperties:TestElementAspect | 0x16      |
| 0x23         | AllProperties:TestElementAspect | 0x18      |
| 0x24         | AllProperties:TestElementAspect | 0x1a      |
| 0x25         | AllProperties:TestElementAspect | 0x1c      |

# Using ANY GTE with simple CTE in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname (ECClassId) AS ClassName,
  Element.Id AS ElementID
FROM
  aps.TestElementAspect
WHERE
  Element.Id >= ANY(
    WITH
      cte (Id) AS (
        SELECT
          ECInstanceId
        FROM
          aps.TestElement
      )
    SELECT
      *
    FROM
      cte
  )
```

| className | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|           | ElementID    | true      | 2     | elementID | ElementID    | NavId        | long     | Id     | Id                 |

| ECInstanceId | ClassName                       | ElementID |
| ------------ | ------------------------------- | --------- |
| 0x21         | AllProperties:TestElementAspect | 0x14      |
| 0x22         | AllProperties:TestElementAspect | 0x16      |
| 0x23         | AllProperties:TestElementAspect | 0x18      |
| 0x24         | AllProperties:TestElementAspect | 0x1a      |
| 0x25         | AllProperties:TestElementAspect | 0x1c      |

# Using SOME with simple CTE in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname (ECClassId) AS ClassName,
  Element.Id AS ElementID
FROM
  aps.TestElementAspect
WHERE
  Element.Id < SOME (
    WITH
      cte (Id) AS (
        SELECT
          ECInstanceId
        FROM
          aps.TestElement
      )
    SELECT
      *
    FROM
      cte
  )
```

| className | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|           | ElementID    | true      | 2     | elementID | ElementID    | NavId        | long     | Id     | Id                 |

| ECInstanceId | ClassName                       | ElementID |
| ------------ | ------------------------------- | --------- |
| 0x21         | AllProperties:TestElementAspect | 0x14      |
| 0x22         | AllProperties:TestElementAspect | 0x16      |
| 0x23         | AllProperties:TestElementAspect | 0x18      |
| 0x24         | AllProperties:TestElementAspect | 0x1a      |
| 0x25         | AllProperties:TestElementAspect | 0x1c      |

# Using ANY with CTE and alias

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  ec_classname (ECClassId) AS ClassName,
  Element.Id AS ElementID
FROM
  aps.TestElementAspect aspect
WHERE
  aspect.Element.Id >= ANY(
    WITH
      cte (Id) AS (
        SELECT
          elem.ECInstanceId
        FROM
          aps.TestElement elem
      )
    SELECT
      Id
    FROM
      cte
  )
```

| className | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | ClassName    | true      | 1     | className | ClassName    | undefined    | string   | String | undefined          |
|           | ElementID    | true      | 2     | elementID | ElementID    | NavId        | long     | Id     | Id                 |

| ECInstanceId | ClassName                       | ElementID |
| ------------ | ------------------------------- | --------- |
| 0x21         | AllProperties:TestElementAspect | 0x14      |
| 0x22         | AllProperties:TestElementAspect | 0x16      |
| 0x23         | AllProperties:TestElementAspect | 0x18      |
| 0x24         | AllProperties:TestElementAspect | 0x1a      |
| 0x25         | AllProperties:TestElementAspect | 0x1c      |

# Using ALL with recursive CTE

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong < ALL (
    WITH RECURSIVE
      cnt (x) AS (
        VALUES
          (1005)
        UNION ALL
        SELECT
          x + 1
        FROM
          cnt
        WHERE
          x < 1010
      )
    SELECT
      x
    FROM
      cnt
  )
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | DirectLong |
| ------------ | ---------- |
| 0x14         | 1000       |
| 0x15         | 1001       |
| 0x16         | 1002       |
| 0x17         | 1003       |
| 0x18         | 1004       |
| 0x19         | 1005       |

# Using ALL with recursive CTE

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong >= SOME (
    WITH RECURSIVE
      cnt (x) AS (
        VALUES
          (1007)
        UNION ALL
        SELECT
          x + 1
        FROM
          cnt
        WHERE
          x < 10
      )
    SELECT
      x
    FROM
      cnt
  )
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | DirectLong |
| ------------ | ---------- |
| 0x1b         | 1007       |
| 0x1c         | 1008       |
| 0x1d         | 1009       |

# Using ALL with multiple items

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN COUNT(Name) >= 366 THEN true
    ELSE false
  END AS result
FROM
  meta.ecclassdef
WHERE
  ECInstanceID < ALL (
    SELECT
      ECClassId,
      Model.RelECClassId
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName | name   | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ------ | ------------ | -------- | ------- |
|           | result       | true      | 0     | result   | result | undefined    | boolean  | Boolean |

| result |
| ------ |
| true   |

# Using ANY with multiple items

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN COUNT(Name) >= 274 THEN true
    ELSE false
  END AS result
FROM
  meta.ecclassdef
WHERE
  ECInstanceID > ANY(
    SELECT
      ECClassId,
      Model.RelECClassId
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName | name   | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ------ | ------------ | -------- | ------- |
|           | result       | true      | 0     | result   | result | undefined    | boolean  | Boolean |

| result |
| ------ |
| true   |

# Using SOME with multiple items

- dataset: AllProperties.bim

```sql
SELECT
  count(*) AS Total_Count
FROM
  meta.ecclassdef
WHERE
  ECInstanceID = SOME(
    SELECT
      ECClassId,
      Model.RelECClassId
    FROM
      aps.TestElement
  )
```

| className | accessString | generated | index | jsonName    | name        | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ----- |
|           | Total_Count  | true      | 0     | Total_Count | Total_Count | undefined    | long     | Int64 |

| Total_Count |
| ----------- |
| 2           |

# ALL in select clause

- dataset: AllProperties.bim

```sql
select ec_classname(ALL(ECClassId)) as Test_Val from aps.TestElement
```

| className | accessString | generated | index | jsonName | name     | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------ |
|           | Test_Val     | true      | 0     | test_Val | Test_Val | undefined    | string   | String |

| Test_Val                  |
| ------------------------- |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |
| AllProperties:TestElement |

# ANY in select clause

- dataset: AllProperties.bim

```sql
select ANY(ECClassId) as Test_Val from aps.TestElement
```

| className | accessString | generated | index | jsonName | name     | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------- |
|           | Test_Val     | true      | 0     | test_Val | Test_Val | undefined    | boolean  | Boolean |

| Test_Val |
| -------- |
| true     |

# SOME in select clause

- dataset: AllProperties.bim

```sql
select SOME(ECClassId) as Test_Val from aps.TestElement
```

| className | accessString | generated | index | jsonName | name     | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------- |
|           | Test_Val     | true      | 0     | test_Val | Test_Val | undefined    | boolean  | Boolean |

| Test_Val |
| -------- |
| true     |

# With conditional ALL

- dataset: AllProperties.bim

```sql
SELECT
  Name
FROM
  meta.ECClassDef
WHERE
  ECInstanceId > ANY(
    SELECT
      ECClassId
    FROM
      aps.TestElement
    WHERE
      DirectLong > 1007
  )
```

| className           | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
| ECDbMeta:ECClassDef | Name         | false     | 0     | name     | Name         | undefined    | string   | String | Name               |

| Name                        |
| --------------------------- |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |
