Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Case Expression with first condition true and rest false

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN 1 THEN 'First'
    WHEN 0 THEN 'Second'
    WHEN 0 THEN 'Third'
    ELSE 'Forth'
  END a
FROM
  aps.TestElement
LIMIT
  1
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | a            | true      | 0     | a        | a    | undefined    | string   | String |

| a     |
| ----- |
| First |

# Simple case Expression without alias for QueryReaders

- dataset: AllProperties.bim
- mode: QueryReader

```sql
SELECT
  CASE
    WHEN 1 THEN 'First'
    WHEN 0 THEN 'Second'
    WHEN 0 THEN 'Third'
    ELSE 'Forth'
  END
FROM
  aps.TestElement
LIMIT
  1
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": " CASE  WHEN 1 THEN 'First' WHEN 0 THEN 'Second' WHEN 0 THEN 'Third' ELSE 'Forth' END ",
      "generated": true,
      "index": 0,
      "jsonName": " CASE  WHEN 1 THEN 'First' WHEN 0 THEN 'Second' WHEN 0 THEN 'Third' ELSE 'Forth' END ",
      "name": " CASE  WHEN 1 THEN 'First' WHEN 0 THEN 'Second' WHEN 0 THEN 'Third' ELSE 'Forth' END ",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    " CASE  WHEN 1 THEN 'First' WHEN 0 THEN 'Second' WHEN 0 THEN 'Third' ELSE 'Forth' END ": "First"
  }
]
```

# Simple case Expression without alias for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT
  CASE
    WHEN 1 THEN 'First'
    WHEN 0 THEN 'Second'
    WHEN 0 THEN 'Third'
    ELSE 'Forth'
  END
FROM
  aps.TestElement
LIMIT
  1
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": " CASE  WHEN 1 THEN 'First' WHEN 0 THEN 'Second' WHEN 0 THEN 'Third' ELSE 'Forth' END ",
      "generated": true,
      "index": 0,
      "jsonName": "__x0020__CASE__x0020____x0020__WHEN__x0020__1__x0020__THEN__x0020____x0027__First__x0027____x0020__WHEN__x0020__0__x0020__THEN__x0020____x0027__Second__x0027____x0020__WHEN__x0020__0__x0020__THEN__x0020____x0027__Third__x0027____x0020__ELSE__x0020____x0027__Forth__x0027____x0020__END__x0020__",
      "name": "__x0020__CASE__x0020____x0020__WHEN__x0020__1__x0020__THEN__x0020____x0027__First__x0027____x0020__WHEN__x0020__0__x0020__THEN__x0020____x0027__Second__x0027____x0020__WHEN__x0020__0__x0020__THEN__x0020____x0027__Third__x0027____x0020__ELSE__x0020____x0027__Forth__x0027____x0020__END__x0020__",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    " CASE  WHEN 1 THEN 'First' WHEN 0 THEN 'Second' WHEN 0 THEN 'Third' ELSE 'Forth' END ": "First"
  }
]
```

# Case Expression with third condition true and rest false

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN 0 THEN 'First'
    WHEN 0 THEN 'Second'
    WHEN 1 THEN 'Third'
    ELSE 'Forth'
  END a
FROM
  aps.TestElement
LIMIT
  1
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | a            | true      | 0     | a        | a    | undefined    | string   | String |

| a     |
| ----- |
| Third |

# Case Expression with different type data in then and else clause

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN DirectStr = 'str0' OR
    (
      DirectLong < 1006 AND
      DirectDouble > 4.1
    ) THEN dt
    ELSE s
  END a
FROM
  aps.TestElement
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type     |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- |
|           | a            | true      | 0     | a        | a    | undefined    | dateTime | DateTime |

| a                        |
| ------------------------ |
| 2017-01-01T00:00:00.000  |
| -4713-11-24T12:00:00.000 |
| -4713-11-24T12:00:00.000 |
| -4713-11-24T12:00:00.000 |
| -4713-11-24T12:00:00.000 |
| 2010-01-01T11:11:11.000  |
| -4713-11-24T12:00:00.000 |
| -4713-11-24T12:00:00.000 |
| -4713-11-24T12:00:00.000 |
| -4713-11-24T12:00:00.000 |

`Note:- This test documents the behaviour that if we put different type data in then and else clause the first data type is given priority and the other data is converted to first data type.`

# When-Then chaining

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN ECInstanceId < 0x18 THEN 'Withing First 4'
    WHEN ECInstanceId >= 0x18 AND
    ECInstanceId < 0x1b THEN 'Withing second 4'
    WHEN ECInstanceId > 0x1b THEN 'Withing last 2'
  END limiting_ECInstanceId
FROM
  aps.TestElement
```

| className | accessString          | generated | index | jsonName              | name                  | extendedType | typeName | type   |
| --------- | --------------------- | --------- | ----- | --------------------- | --------------------- | ------------ | -------- | ------ |
|           | limiting_ECInstanceId | true      | 0     | limiting_ECInstanceId | limiting_ECInstanceId | undefined    | string   | String |

| limiting_ECInstanceId |
| --------------------- |
| Withing First 4       |
| Withing First 4       |
| Withing First 4       |
| Withing First 4       |
| Withing second 4      |
| Withing second 4      |
| Withing second 4      |
| undefined             |
| Withing last 2        |
| Withing last 2        |

# Testing ECInstanceIds of Bis.Model against Model.Id from TestElement in When Clause

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN ECInstanceId = (
      SELECT
        Model.Id
      FROM
        aps.TestElement
    ) THEN ec_classname (ECClassId)
    ELSE 'ClassName not found'
  END ClassName
FROM
  Bis.Model
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ |
|           | ClassName    | true      | 0     | className | ClassName | undefined    | string   | String |

| ClassName             |
| --------------------- |
| ClassName not found   |
| ClassName not found   |
| BisCore:PhysicalModel |
| ClassName not found   |

# Testing ECInstanceIds of meta.ECClassDef against ECClassId from TestElement in When Clause

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN ECInstanceId > (
      SELECT
        ECClassId
      FROM
        aps.TestElement
    ) THEN Name
  END ClassName
FROM
  meta.ECClassDef
WHERE
  ClassName <> 'undefined'
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ |
|           | ClassName    | true      | 0     | className | ClassName | undefined    | string   | String |

| ClassName                   |
| --------------------------- |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Complex When clause with nested subqueries

- dataset: AllProperties.bim

```sql
SELECT
  CASE
    WHEN ECInstanceId > (
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
    ) THEN Name
    ELSE 'ClassName not found'
  END ClassName
FROM
  meta.ECClassDef
WHERE
  ClassName <> 'ClassName not found'
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ |
|           | ClassName    | true      | 0     | className | ClassName | undefined    | string   | String |

| ClassName                   |
| --------------------------- |
| TestElementAspect           |
| TestElementRefersToElements |
| TestEntityClass             |
| TestFeature                 |
| TestFeatureUsesElement      |

# Testing internal props of objects in When Clause

- dataset: AllProperties.bim

```sql
SELECT CASE WHEN p2d.X = 1.034 THEN p2d.X ELSE 0.0 END X_Coord FROM (SELECT * FROM aps.TestElement) limit 4
```

| className | accessString | generated | index | jsonName | name    | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | ------ |
|           | X_Coord      | true      | 0     | x_Coord  | X_Coord | undefined    | double   | Double |

| X_Coord |
| ------- |
| 1.034   |
| 0       |
| 1.034   |
| 0       |

# Testing internal props of objects in When Clause with level 2 subquery

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT CASE WHEN p2d.X = 1.034 THEN p2d.X ELSE 0.0 END X_Coord FROM (SELECT * FROM (SELECT * FROM aps.TestElement)) limit 4
```
