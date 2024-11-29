Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing point2d for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> p2d from aps.TestElement limit 2
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "$->p2d",
      "generated": true,
      "index": 0,
      "jsonName": "$->p2d",
      "name": "$->p2d",
      "extendedType": "json",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    "$->p2d": "{\"X\":1.034,\"Y\":2.034}"
  },
  {
    "$->p2d": "{\"X\":1111.11,\"Y\":2222.22}"
  }
]
```

# Testing point2d for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> p2d from aps.TestElement limit 2
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "$->p2d",
      "generated": true,
      "index": 0,
      "jsonName": "$->p2d",
      "name": "__x0024____x002D____x003E__p2d",
      "extendedType": "json",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    "$->p2d": "{\"X\":1.034,\"Y\":2.034}"
  },
  {
    "$->p2d": "{\"X\":1111.11,\"Y\":2222.22}"
  }
]
```

# Testing Point3d for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> p3d from aps.TestElement limit 2
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "$->p3d",
      "generated": true,
      "index": 0,
      "jsonName": "$->p3d",
      "name": "$->p3d",
      "extendedType": "json",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    "$->p3d": "{\"X\":-1.0,\"Y\":2.3,\"Z\":3.0001}"
  },
  {
    "$->p3d": "{\"X\":-111.11,\"Y\":-222.22,\"Z\":-333.33}"
  }
]
```

# Testing Point3d for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> p3d from aps.TestElement limit 2
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "$->p3d",
      "generated": true,
      "index": 0,
      "jsonName": "$->p3d",
      "name": "__x0024____x002D____x003E__p3d",
      "extendedType": "json",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    "$->p3d": "{\"X\":-1.0,\"Y\":2.3,\"Z\":3.0001}"
  },
  {
    "$->p3d": "{\"X\":-111.11,\"Y\":-222.22,\"Z\":-333.33}"
  }
]
```

# Testing Integers for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> i from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | $->i         | true      | 0     | $->i     | $->i | json         | string   | Int  | i                  |

| $->i |
| ---- |
| 100  |
| 101  |

# Testing Integers for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> i from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | i            | false     | 0     | i        | i    | json         | string   | Int  | i                  |

| i   |
| --- |
| 100 |
| 101 |

# Testing double prop using alias for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> d double_prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
|           | double_prop  | true      | 0     | double_prop | double_prop | json         | string   | Double | d                  |

| double_prop |
| ----------- |
| 0.1         |
| 1.1         |

# Testing double prop using alias for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> d double_prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | d            | false     | 0     | d        | d    | json         | string   | Double | d                  |

| d   |
| --- |
| 0.1 |
| 1.1 |

# Testing long prop using alias for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> l long_prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ----- | ------------------ |
|           | long_prop    | true      | 0     | long_prop | long_prop | json         | string   | Int64 | l                  |

| long_prop |
| --------- |
| 1000      |
| 1001      |

# Testing long prop using alias for ECsqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> l long_prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
|           | l            | false     | 0     | l        | l    | json         | string   | Int64 | l                  |

| l    |
| ---- |
| 1000 |
| 1001 |

# Testing string prop using alias for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> s string_prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
|           | string_prop  | true      | 0     | string_prop | string_prop | json         | string   | String | s                  |

| string_prop |
| ----------- |
| str0        |
| str1        |

# Testing string prop using alias for ECsqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> s string_prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | s            | false     | 0     | s        | s    | json         | string   | String | s                  |

| s    |
| ---- |
| str0 |
| str1 |

# Testing date time prop using alias for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> dt dateTime_prop from aps.TestElement limit 2
```

| className | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type     | originPropertyName |
| --------- | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | -------- | ------------------ |
|           | dateTime_prop | true      | 0     | dateTime_prop | dateTime_prop | json         | string   | DateTime | dt                 |

| dateTime_prop           |
| ----------------------- |
| 2017-01-01T00:00:00.000 |
| 2010-01-01T11:11:11.000 |

# Testing date time prop using alias for ECsqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> dt dateTime_prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
|           | dt           | false     | 0     | dt       | dt   | json         | string   | DateTime | dt                 |

| dt                      |
| ----------------------- |
| 2017-01-01T00:00:00.000 |
| 2010-01-01T11:11:11.000 |

# Testing binary prop using alias for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
SELECT $ -> bin binary_Prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName    | name        | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ---- | ------------------ |
|           | binary_Prop  | true      | 0     | binary_Prop | binary_Prop | json         | string   | Blob | bin                |

| binary_Prop                                 |
| ------------------------------------------- |
| BIN(1, 2, 3)                                |
| BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22) |

# Testing binary prop using alias for ECsqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT $ -> bin binary_Prop from aps.TestElement limit 2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | bin          | false     | 0     | bin      | bin  | json         | string   | Blob | bin                |

| bin                                         |
| ------------------------------------------- |
| BIN(1, 2, 3)                                |
| BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22) |

# Testing point2d_X prop

- dataset: AllProperties.bim

```sql
SELECT $ -> p2d.X p2dX_prop from aps.TestElement limit 2
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "p2dX_prop",
      "generated": true,
      "index": 0,
      "jsonName": "p2dX_prop",
      "name": "p2dX_prop",
      "extendedType": "json",
      "typeName": "string"
    }
  ]
}
```

```json
[]
```

# Testing ExtractInstance in where clause

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId from aps.TestElement where FLOOR($->d) = 1
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x15         |

# Testing integer array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_i intArray_Prop from aps.TestElement limit 1
```

# Testing long array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_l longArray_Prop from aps.TestElement limit 1
```

# Testing double array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_d doubleArray_Prop from aps.TestElement limit 1
```

# Testing string array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_s StringArray_Prop from aps.TestElement limit 1
```

# Testing date time array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_dt dateTimeArray_Prop from aps.TestElement limit 1
```

# Testing point 2d array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_p2d Point2DArray_Prop from aps.TestElement limit 1
```

# Testing point 3d array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_p3d Point3DArray_Prop from aps.TestElement limit 1
```

# Testing binary array prop using alias

- dataset: AllProperties.bim
- skip: The query in the test causes a crash on the backend

```sql
SELECT $ -> array_bin BinaryArray_Prop from aps.TestElement limit 1
```
