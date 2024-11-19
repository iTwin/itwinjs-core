Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Select Integer property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1;
```

| i   |
| --- |
| 100 |

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | i            | false     | 0     | i        | i    |              | int      | Int  |

# Select Long property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.l FROM aps.TestElement e order by e.l LIMIT 1;
```

| l    |
| ---- |
| 1000 |

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- |
|           | l            | false     | 0     | l        | l    |              | long     | Int64 |

# Select double property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.d FROM aps.TestElement e order by e.d LIMIT 1;
```

| d   |
| --- |
| 0.1 |

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | d            | false     | 0     | d        | d    |              | double   | Double |

# Select string property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.s FROM aps.TestElement e order by e.s LIMIT 1;
```

| s    |
| ---- |
| str0 |

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | s            | false     | 0     | s        | s    |              | string   | String |

# Select date time property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.dt FROM aps.TestElement e order by e.dt LIMIT 1;
```

| dt                      |
| ----------------------- |
| 2010-01-01T11:11:11.000 |

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type     |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- |
|           | dt           | false     | 0     | dt       | dt   |              | dateTime | DateTime |

# Select point2d from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.p2d FROM aps.TestElement e LIMIT 1;
```

```json
[
  {
    "p2d": {
      "X": 1.034,
      "Y": 2.034
    }
  }
]
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- |
|           | p2d          | false     | 0     | p2d      | p2d  |              | point2d  | Point2d |

# Select point3d from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.p3d FROM aps.TestElement e LIMIT 1;
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- |
|           | p3d          | false     | 0     | p3d      | p3d  |              | point3d  | Point3d |

| p3d                            |
| ------------------------------ |
| {"X": -1,"Y": 2.3,"Z": 3.0001} |

# Select binary data from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.bin FROM aps.TestElement e LIMIT 1;
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | bin          | false     | 0     | bin      | bin  | Json         | string   | Blob |

```json
[
  {
    "bin": "BIN(1,2,3)"
  }
]
```
