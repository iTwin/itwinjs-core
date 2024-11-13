Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Select different properties from TestElement

- Mode: Both
- dataset: AllProperties.bim

```sql
SELECT e.i, e.l, e.d, e.s, e.dt FROM aps.TestElement e LIMIT 2;
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

```json
[
  {
    "i": 100,
    "l": 1000,
    "d": 0.1,
    "s": "str0",
    "dt": "2017-01-01T00:00:00.000"
  },
  {
    "i": 101,
    "l": 1001,
    "d": 1.1,
    "s": "str1",
    "dt": "2010-01-01T11:11:11.000"
  }
]
```

| PropName | AccessString | Type     | TypeName | IsGeneratedProperty |
| -------- | ------------ | -------- | -------- | ------------------- |
| i        | i            | Int      | int      | false               |
| l        | l            | Int64    | long     | false               |
| d        | d            | Double   | double   | false               |
| s        | s            | String   | string   | false               |
| dt       | dt           | DateTime | dateTime | false               |

# Select different properties from TestElement using Tables

- dataset: AllProperties.bim

```sql
SELECT e.i, e.l, e.d, e.s, e.dt FROM aps.TestElement e LIMIT 2;
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| i   | l    | d   | s    | dt                      |
| --- | ---- | --- | ---- | ----------------------- |
| 100 | 1000 | 0.1 | str0 | 2017-01-01T00:00:00.000 |
| 101 | 1001 | 1.1 | str1 | 2010-01-01T11:11:11.000 |

| PropName | AccessString | Type     | TypeName | IsGeneratedProperty |
| -------- | ------------ | -------- | -------- | ------------------- |
| i        | i            | Int      | int      | false               |
| l        | l            | Int64    | long     | false               |
| d        | d            | Double   | double   | false               |
| s        | s            | String   | string   | false               |
| dt       | dt           | DateTime | dateTime | false               |

# Select point2d and point3d from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.p2d, e.p3d FROM aps.TestElement e LIMIT 2;
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

```json
[
  {
    "p2d": {
      "X": 1.034,
      "Y": 2.034
    },
    "p3d": {
      "X": -1,
      "Y": 2.3,
      "Z": 3.0001
    }
  },
  {
    "p2d": {
      "X": 1111.11,
      "Y": 2222.22
    },
    "p3d": {
      "X": -111.11,
      "Y": -222.22,
      "Z": -333.33
    }
  }
]
```

| PropName | AccessString | Type    | TypeName | IsGeneratedProperty |
| -------- | ------------ | ------- | -------- | ------------------- |
| p2d      | p2d          | Point2d | point2d  | false               |
| p3d      | p3d          | Point3d | point3d  | false               |

# Select point2d and point3d from TestElement using Tables

- dataset: AllProperties.bim

```sql
SELECT e.p2d, e.p3d FROM aps.TestElement e LIMIT 2;
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| PropName | AccessString | Type    | TypeName | IsGeneratedProperty |
| -------- | ------------ | ------- | -------- | ------------------- |
| p2d      | p2d          | Point2d | point2d  | false               |
| p3d      | p3d          | Point3d | point3d  | false               |

| p2d                         | p3d                                      |
| --------------------------- | ---------------------------------------- |
| {"X": 1.034,"Y": 2.034}     | {"X": -1,"Y": 2.3,"Z": 3.0001}           |
| {"X": 1111.11,"Y": 2222.22} | {"X": -111.11,"Y": -222.22,"Z": -333.33} |

# Select binary data from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.bin FROM aps.TestElement e LIMIT 2;
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| PropName | AccessString | Type | TypeName | IsGeneratedProperty |
| -------- | ------------ | ---- | -------- | ------------------- |
| bin      | bin          | Blob | string   | false               |

```json
[
  {
    "bin": "BIN(1,2,3)"
  },
  {
    "bin": "BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22)"
  }
]
```

# Select binary data from TestElement using Tables

- Mode: Both
- dataset: AllProperties.bim

```sql
SELECT e.bin FROM aps.TestElement e LIMIT 2;
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| PropName | AccessString | Type | TypeName | IsGeneratedProperty |
| -------- | ------------ | ---- | -------- | ------------------- |
| bin      | bin          | Blob | string   | false               |

| bin                                         |
| ------------------------------------------- |
| BIN(1,2,3)                                  |
| BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22) |
