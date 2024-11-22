Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing integer binder

- dataset: AllProperties.bim

```sql
SELECT e.i FROM aps.TestElement e where e.i > ? and e.i < ? order by e.i
```

- bindInt 1, 102
- bindInt 2, 106

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | i            | false     | 0     | i        | i    | undefined    | int      | Int  |

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

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | d            | false     | 0     | d        | d    | undefined    | double   | Double |

| d   |
| --- |
| 3.1 |
| 4.1 |
| 5.1 |
| 6.1 |

# Testing double binders for concurrentQuery

- dataset: AllProperties.bim
- mode: concurrentQuery

```sql
SELECT e.l FROM aps.TestElement e where e.l > ? and e.l < ? order by e.l
```

- bindLong 1, 1003
- bindLong 2, 1006

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- |
|           | l            | false     | 0     | l        | l    | undefined    | long     | Int64 |

| l    |
| ---- |
| 1004 |
| 1005 |

# Testing long binders for concurrentQuery

- dataset: AllProperties.bim
- mode: concurrentQuery

```sql
SELECT e.l FROM aps.TestElement e where e.l > ? and e.l < ? order by e.l
```

- bindLong 1, 1003
- bindLong 2, 1006

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- |
|           | l            | false     | 0     | l        | l    | undefined    | long     | Int64 |

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

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | s            | false     | 0     | s        | s    | undefined    | string   | String |

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

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type     |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- |
|           | dt           | false     | 0     | dt       | dt   | undefined    | dateTime | DateTime |

| dt                      |
| ----------------------- |
| 2017-01-01T00:00:00.000 |
| 2017-01-01T00:00:00.000 |

# Testing Point2D binders for ECSqlStatement

- dataset: AllProperties.bim
- only: true

```sql
SELECT e.p2d FROM aps.TestElement e where e.p2d = ? limit 1
```

- bindPoint2d 1, {"X": 1111.11,"Y": 2222.22}

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- |
|           | p2d          | false     | 0     | p2d      | p2d  | undefined    | point2d  | Point2d |

| p2d                         |
| --------------------------- |
| {"X": 1111.11,"Y": 2222.22} |

# Testing Point3D binders for ECSqlStatement

- dataset: AllProperties.bim
- only: true

```sql
SELECT e.p3d FROM aps.TestElement e where e.p3d = ? limit 1
```

- bindPoint3d 1, {"X": -1,"Y": 2.3,"Z": 3.0001}

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- |
|           | p3d          | false     | 0     | p3d      | p3d  | undefined    | point3d  | Point3d |

| p3d                            |
| ------------------------------ |
| {"X": -1,"Y": 2.3,"Z": 3.0001} |
