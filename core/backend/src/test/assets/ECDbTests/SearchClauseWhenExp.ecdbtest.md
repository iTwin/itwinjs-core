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

# Simple case Expression without alias for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

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
