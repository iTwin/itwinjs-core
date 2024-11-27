Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

<!--
All the tests here need to be updated to be have more precise checks.
Once the AllOrAnyExp has been fixed.
-->

# AllOrAnyExp Using ALL with equality

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


# AllOrAnyExp Using ALL with inequality

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


# AllOrAnyExp Using ANY with equality

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


# AllOrAnyExp Using ANY with inequality

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



# AllOrAnyExp Using ANY Greater Than

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |

# AllOrAnyExp Using ANY Greater Than Or Equal To

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x152        | TestElement                 |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |

# AllOrAnyExp Using ANY Less Than

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


# AllOrAnyExp Using ANY Less Than Or Equal To

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



# AllOrAnyExp Using SOME with equality

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


# AllOrAnyExp Using SOME with inequality

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


# AllOrAnyExp Using SOME with Greater Than

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |


# AllOrAnyExp Using SOME with Greater Than Or Equal To

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x152        | TestElement                 |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |


# AllOrAnyExp Using SOME with Less Than

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


# AllOrAnyExp Using SOME with Less Than Or Equal To

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



# AllOrAnyExp Using ANY with subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |


# AllOrAnyExp Using ANY with where clause in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x152        | TestElement                 |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |


# AllOrAnyExp Using SOME with where clause in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |


# AllOrAnyExp Using ANY with group by clause in subquery

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
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
|                     | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef | Name         | false     | 1     | name     | Name         | undefined    | string   | String | Name               |

| ECInstanceId | Name                        |
| ------------ | --------------------------- |
| 0x152        | TestElement                 |
| 0x153        | TestElementAspect           |
| 0x154        | TestElementRefersToElements |


# AllOrAnyExp Using SOME with group by clause in subquery

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