Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing integer binder

- dataset: AllProperties.bim

```sql
SELECT e.i FROM aps.TestElement e where e.i > ? and e.i < ? order by e.i
```

- bindInt 1, 102
- bindInt 2, 106

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 103 |
| 104 |
| 105 |

# Testing double binders

- dataset: AllProperties.bim

```sql
SELECT e.d FROM aps.TestElement e where e.d > ? and e.d < ? order by e.d
```

- bindDouble 1, 2.5
- bindDouble 2, 6.5

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | d            | false     | 0     | d        | d    | undefined    | double   | Double | d                  |

| d   |
| --- |
| 3.1 |
| 4.1 |
| 5.1 |
| 6.1 |

# Testing long binders for ECSqlReader

- dataset: AllProperties.bim
- mode: ECSqlReader

```sql
SELECT e.l FROM aps.TestElement e where e.l > ? and e.l < ? order by e.l
```

- bindLong 1, 1003
- bindLong 2, 1006

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
| AllProperties:IPrimitive | l            | false     | 0     | l        | l    | undefined    | long     | Int64 | l                  |

| l    |
| ---- |
| 1004 |
| 1005 |

# Testing string binders

- dataset: AllProperties.bim

```sql
SELECT e.s FROM aps.TestElement e where e.s like ? order by e.s
```

- bindString 1, %2%

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s            | false     | 0     | s        | s    | undefined    | string   | String | s                  |

| s    |
| ---- |
| str2 |

# Testing date Time binders for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT e.dt FROM aps.TestElement e where e.dt > ? limit 2
```

- bindDateTime 1, 2014-01-01T11:11:11.000

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | dt           | false     | 0     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |

| dt                      |
| ----------------------- |
| 2017-01-01T00:00:00.000 |
| 2017-01-01T00:00:00.000 |

# Testing Point2D binders

- dataset: AllProperties.bim

```sql
SELECT e.p2d FROM aps.TestElement e where e.p2d = ? limit 1
```

- bindPoint2d 1, {"X": 1111.11,"Y": 2222.22}

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type    | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- | ------------------ |
| AllProperties:IPrimitive | p2d          | false     | 0     | p2d      | p2d  | undefined    | point2d  | Point2d | p2d                |

| p2d                         |
| --------------------------- |
| {"X": 1111.11,"Y": 2222.22} |

# Testing Point3D binders

- dataset: AllProperties.bim

```sql
SELECT e.p3d FROM aps.TestElement e where e.p3d = ? limit 1
```

- bindPoint3d 1, {"X": -1,"Y": 2.3,"Z": 3.0001}

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type    | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- | ------------------ |
| AllProperties:IPrimitive | p3d          | false     | 0     | p3d      | p3d  | undefined    | point3d  | Point3d | p3d                |

| p3d                            |
| ------------------------------ |
| {"X": -1,"Y": 2.3,"Z": 3.0001} |

# Testing Blob binders

- dataset: AllProperties.bim

```sql
SELECT e.bin FROM aps.TestElement e where e.bin = ? limit 1
```

- bindBlob 1, [11, 21, 31, 34, 53, 21, 14, 14, 55, 22]

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | bin          | false     | 0     | bin      | bin  | undefined    | binary   | Blob | bin                |

| bin                                         |
| ------------------------------------------- |
| BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22) |

# Testing Blob binders with abbreviateBlobs

- dataset: AllProperties.bim
- abbreviateBlobs: true
- mode: ECSqlReader

```sql
SELECT e.bin FROM aps.TestElement e where e.bin = ? limit 1
```

- bindBlob 1, [11, 21, 31, 34, 53, 21, 14, 14, 55, 22]

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | bin          | false     | 0     | bin      | bin  | Json         | string   | Blob | bin                |

| bin            |
| -------------- |
| "{"bytes":10}" |

# Testing Id binders

- dataset: AllProperties.bim

```sql
SELECT e.ECInstanceId FROM aps.TestElement e where e.ECInstanceId > ? and e.ECInstanceId < :param2
```

- bindId 1, 0x14
- bindId param2, 0x18

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | ECInstanceId | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x15         |
| 0x16         |
| 0x17         |

# Testing IdSet binders

- dataset: AllProperties.bim

```sql
SELECT e.ECInstanceId FROM aps.TestElement e where InVirtualSet(?, ECInstanceId) order by e.ECInstanceId
```

- bindIdSet 1, [0x14, 0x1b, 0x1d, 0x18]

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ECInstanceId | false     | 0     | ECInstanceId | ECInstanceId | Id           | long     | Id   | ECInstanceId       |

| ECInstanceId |
| ------------ |
| 0x14         |
| 0x18         |
| 0x1b         |
| 0x1d         |

# Testing Navigation binders for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT e.Model FROM aps.TestElement e where e.Model = :param1 limit 3
```

- bindNavigation param1, {"id":"0x11"}

| className       | accessString | generated | index | jsonName | name  | extendedType | typeName   | type       | originPropertyName |
| --------------- | ------------ | --------- | ----- | -------- | ----- | ------------ | ---------- | ---------- | ------------------ |
| BisCore:Element | Model        | false     | 0     | model    | Model | undefined    | navigation | Navigation | Model              |

| Model |
| ----- |

# Testing Array binders for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
SELECT e.array_d FROM aps.TestElement e where e.array_d = :param1 limit 3
```

- bindArray param1, [0.0, 1.1, 2.2]

| className                     | accessString | generated | index | jsonName | name    | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_d      | false     | 0     | array_d  | array_d | undefined    | double   | PrimitiveArray | array_d            |

| array_d |
| ------- |
