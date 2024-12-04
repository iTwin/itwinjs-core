# Select Specific Primitive Properties

- dataset: AllProperties.bim

```sql
SELECT i, l, d, b, dt, s FROM aps.TestElement
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | l            | false     | 1     | l        | l    | undefined    | long     | Int64    | l                  |
| AllProperties:IPrimitive | d            | false     | 2     | d        | d    | undefined    | double   | Double   | d                  |
| AllProperties:IPrimitive | b            | false     | 3     | b        | b    | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive | dt           | false     | 4     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive | s            | false     | 5     | s        | s    | undefined    | string   | String   | s                  |

| i   | l    | d   | b    | dt                      | s    |
| --- | ---- | --- | ---- | ----------------------- | ---- |
| 100 | 1000 | 0.1 | true | 2017-01-01T00:00:00.000 | str0 |
| 101 | 1001 | 1.1 | true | 2010-01-01T11:11:11.000 | str1 |
| 102 | 1002 | 2.1 | true | 2017-01-01T00:00:00.000 | str2 |
| 103 | 1003 | 3.1 | true | 2010-01-01T11:11:11.000 | str3 |
| 104 | 1004 | 4.1 | true | 2017-01-01T00:00:00.000 | str4 |
| 105 | 1005 | 5.1 | true | 2010-01-01T11:11:11.000 | str5 |
| 106 | 1006 | 6.1 | true | 2017-01-01T00:00:00.000 | str6 |
| 107 | 1007 | 7.1 | true | 2010-01-01T11:11:11.000 | str7 |
| 108 | 1008 | 8.1 | true | 2017-01-01T00:00:00.000 | str8 |
| 109 | 1009 | 9.1 | true | 2010-01-01T11:11:11.000 | str9 |

# Select Array Properties

- dataset: AllProperties.bim

```sql
SELECT array_i,array_l,array_d,array_b,array_dt,array_s FROM aps.TestElement LIMIT 1
```

```json
{
  "columns": [
    {
      "className": "AllProperties:IPrimitiveArray",
      "accessString": "array_i",
      "generated": false,
      "index": 0,
      "jsonName": "array_i",
      "name": "array_i",
      "typeName": "int",
      "type": "PrimitiveArray",
      "originPropertyName": "array_i"
    },
    {
      "className": "AllProperties:IPrimitiveArray",
      "accessString": "array_l",
      "generated": false,
      "index": 1,
      "jsonName": "array_l",
      "name": "array_l",
      "typeName": "long",
      "type": "PrimitiveArray",
      "originPropertyName": "array_l"
    },
    {
      "className": "AllProperties:IPrimitiveArray",
      "accessString": "array_d",
      "generated": false,
      "index": 2,
      "jsonName": "array_d",
      "name": "array_d",
      "typeName": "double",
      "type": "PrimitiveArray",
      "originPropertyName": "array_d"
    },
    {
      "className": "AllProperties:IPrimitiveArray",
      "accessString": "array_b",
      "generated": false,
      "index": 3,
      "jsonName": "array_b",
      "name": "array_b",
      "typeName": "boolean",
      "type": "PrimitiveArray",
      "originPropertyName": "array_b"
    },
    {
      "className": "AllProperties:IPrimitiveArray",
      "accessString": "array_dt",
      "generated": false,
      "index": 4,
      "jsonName": "array_dt",
      "name": "array_dt",
      "typeName": "dateTime",
      "type": "PrimitiveArray",
      "originPropertyName": "array_dt"
    },
    {
      "className": "AllProperties:IPrimitiveArray",
      "accessString": "array_s",
      "generated": false,
      "index": 5,
      "jsonName": "array_s",
      "name": "array_s",
      "typeName": "string",
      "type": "PrimitiveArray",
      "originPropertyName": "array_s"
    }
  ]
}
```

```json
[
  {
    "array_i": [0, 1, 2],
    "array_l": [10000, 20000, 30000],
    "array_d": [0, 1.1, 2.2],
    "array_b": [true, false, true],
    "array_dt": ["2017-01-01T00:00:00.000", "2010-01-01T11:11:11.000"],
    "array_s": ["s0", "s1", "s2"]
  }
]
```

# NullProp Handling in Select

- dataset: AllProperties.bim

```sql
SELECT NullProp FROM aps.TestElement WHERE NullProp IS NULL
```

| className                 | accessString | generated | index | jsonName | name     | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp | NullProp | undefined    | string   | String | NullProp           |

| |
| |
| |
| |
| |
| |
| |

# Select Instances of Mixin Classes (should be empty)

- dataset: AllProperties.bim

```sql
SELECT * FROM ONLY aps.IPrimitive
```

| className                | accessString | generated | index | jsonName  | name         | extendedType | typeName                          |
| ------------------------ | ------------ | --------- | ----- | --------- | ------------ | ------------ | --------------------------------- |
|                          | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long                              |
|                          | ECClassId    | false     | 1     | className | ECClassId    | ClassId      | long                              |
| AllProperties:IPrimitive | i            | false     | 2     | i         | i            | undefined    | int                               |
| AllProperties:IPrimitive | l            | false     | 3     | l         | l            | undefined    | long                              |
| AllProperties:IPrimitive | d            | false     | 4     | d         | d            | undefined    | double                            |
| AllProperties:IPrimitive | b            | false     | 5     | b         | b            | undefined    | boolean                           |
| AllProperties:IPrimitive | dt           | false     | 6     | dt        | dt           | undefined    | dateTime                          |
| AllProperties:IPrimitive | s            | false     | 7     | s         | s            | undefined    | string                            |
| AllProperties:IPrimitive | j            | false     | 8     | j         | j            | undefined    | string                            |
| AllProperties:IPrimitive | bin          | false     | 9     | bin       | bin          | Json         | string                            |
| AllProperties:IPrimitive | p2d          | false     | 10    | p2d       | p2d          | undefined    | point2d                           |
| AllProperties:IPrimitive | p3d          | false     | 11    | p3d       | p3d          | undefined    | point3d                           |
| AllProperties:IPrimitive | g            | false     | 12    | g         | g            | undefined    | Bentley.Geometry.Common.IGeometry |
| AllProperties:IPrimitive | st           | false     | 13    | st        | st           | undefined    | AllProperties.ComplexStruct       |

# Test Class Name Query

- dataset: AllProperties.bim

```sql
SELECT ECClassId FROM meta.ECClassDef WHERE Name = 'TestElement'
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ---- | ------------------ |
|           | ECClassId    | false     | 0     | className | ECClassId | ClassId      | long     | Id   | ECClassId          |

| ECClassId |
| --------- |
| 0x25      |

# Select DISTINCT Values

- dataset: AllProperties.bim

```sql
SELECT DISTINCT s FROM aps.TestElement Limit 3
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s            | false     | 0     | s        | s    | undefined    | string   | String | s                  |

| s    |
| ---- |
| str0 |
| str1 |
| str2 |

# Alias Select Query

- dataset: AllProperties.bim

```sql
SELECT te.i AS IntegerValue, te.s AS StringValue FROM aps.TestElement AS te LIMIT 3
```

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|           | IntegerValue | true      | 0     | integerValue | IntegerValue | undefined    | int      | Int    | i                  |
|           | StringValue  | true      | 1     | stringValue  | StringValue  | undefined    | string   | String | s                  |

| IntegerValue | StringValue |
| ------------ | ----------- |
| 100          | str0        |
| 101          | str1        |
| 102          | str2        |

# Select with CASE Statement

- dataset: AllProperties.bim

```sql
SELECT s, CASE WHEN i > 104 THEN 'High' ELSE 'Low' END AS ValueCategory FROM aps.TestElement
```

| className                | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s             | false     | 0     | s             | s             | undefined    | string   | String | s                  |
|                          | ValueCategory | true      | 1     | valueCategory | ValueCategory | undefined    | string   | String | undefined          |

| s    | ValueCategory |
| ---- | ------------- |
| str0 | Low           |
| str1 | Low           |
| str2 | Low           |
| str3 | Low           |
| str4 | Low           |
| str5 | High          |
| str6 | High          |
| str7 | High          |
| str8 | High          |
| str9 | High          |

# Select with functions

- dataset: AllProperties.bim

```sql
SELECT s, LENGTH(s) AS StringLength,  AVG(d) AS AverageDouble FROM aps.TestElement
```

| className                | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s             | false     | 0     | s             | s             | undefined    | string   | String | s                  |
|                          | StringLength  | true      | 1     | stringLength  | StringLength  | undefined    | long     | Int64  | undefined          |
|                          | AverageDouble | true      | 2     | averageDouble | AverageDouble | undefined    | double   | Double | undefined          |

| s    | StringLength | AverageDouble |
| ---- | ------------ | ------------- |
| str0 | 4            | 4.6           |

# Select with function enclosed in brackets

- dataset: AllProperties.bim

```sql
SELECT s, (format(s)) AS StringFormatted, (LENGTH(s)) AS StringLength FROM aps.TestElement
```

| className                | accessString    | generated | index | jsonName        | name            | extendedType | typeName | type   | originPropertyName |
| ------------------------ | --------------- | --------- | ----- | --------------- | --------------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s               | false     | 0     | s               | s               | undefined    | string   | String | s                  |
|                          | StringFormatted | true      | 1     | stringFormatted | StringFormatted | undefined    | string   | String | undefined          |
|                          | StringLength    | true      | 2     | stringLength    | StringLength    | undefined    | long     | Int64  | undefined          |

| s    | StringFormatted | StringLength |
| ---- | --------------- | ------------ |
| str0 | str0            | 4            |
| str1 | str1            | 4            |
| str2 | str2            | 4            |
| str3 | str3            | 4            |
| str4 | str4            | 4            |
| str5 | str5            | 4            |
| str6 | str6            | 4            |
| str7 | str7            | 4            |
| str8 | str8            | 4            |
| str9 | str9            | 4            |

# Select with ec_classname enclosed in brackets

- dataset: AllProperties.bim

```sql
SELECT (ec_classname (ECClassId)) AS ClassName FROM aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ |
|           | ClassName    | true      | 0     | className | ClassName | undefined    | string   | String |

| ClassName                 |
| ------------------------- |
| AllProperties:TestElement |
| AllProperties:TestElement |

# Compound Select - UNION

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong > 1006
UNION
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong < 1003
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
| 0x1b         | 1007       |
| 0x1c         | 1008       |
| 0x1d         | 1009       |

# Compound Select - UNION ALL

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong > 1004
UNION ALL
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong < 1007
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | DirectLong |
| ------------ | ---------- |
| 0x19         | 1005       |
| 0x1a         | 1006       |
| 0x1b         | 1007       |
| 0x1c         | 1008       |
| 0x1d         | 1009       |
| 0x14         | 1000       |
| 0x15         | 1001       |
| 0x16         | 1002       |
| 0x17         | 1003       |
| 0x18         | 1004       |
| 0x19         | 1005       |
| 0x1a         | 1006       |

# Compound Select - INTERSECT

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong > 1004
INTERSECT
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong < 1007
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | DirectLong |
| ------------ | ---------- |
| 0x19         | 1005       |
| 0x1a         | 1006       |

# Compound Select - EXCEPT

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong > 1006
EXCEPT
SELECT
  ECInstanceId,
  DirectLong
FROM
  aps.TestElement
WHERE
  DirectLong > 1008
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type  | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ----- | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong | DirectLong   | undefined    | long     | Int64 | DirectLong         |

| ECInstanceId | DirectLong |
| ------------ | ---------- |
| 0x1b         | 1007       |
| 0x1c         | 1008       |
