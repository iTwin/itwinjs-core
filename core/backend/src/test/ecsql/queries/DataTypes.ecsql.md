Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Select Integer property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1;
```

| i   |
| --- |
| 100 |

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

# Select Integer array property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_i FROM aps.TestElement e LIMIT 1;
```

| array_i   |
| --------- |
| [0, 1, 2] |

| className                     | accessString | generated | index | jsonName | name    | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_i      | false     | 0     | array_i  | array_i | undefined    | int      | PrimitiveArray | array_i            |

# Select Long property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.l FROM aps.TestElement e order by e.l LIMIT 1;
```

| l    |
| ---- |
| 1000 |

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
| AllProperties:IPrimitive | l            | false     | 0     | l        | l    | undefined    | long     | Int64 | l                  |

# Select Long array property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_l FROM aps.TestElement e LIMIT 1;
```

| array_l               |
| --------------------- |
| [10000, 20000, 30000] |

| className                     | accessString | generated | index | jsonName | name    | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_l      | false     | 0     | array_l  | array_l | undefined    | long     | PrimitiveArray | array_l            |

# Select double property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.d FROM aps.TestElement e order by e.d LIMIT 1;
```

| d   |
| --- |
| 0.1 |

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | d            | false     | 0     | d        | d    | undefined    | double   | Double | d                  |

# Select double array property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_d FROM aps.TestElement e LIMIT 1;
```

| array_d         |
| --------------- |
| [0.0, 1.1, 2.2] |

| className                     | accessString | generated | index | jsonName | name    | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_d      | false     | 0     | array_d  | array_d | undefined    | double   | PrimitiveArray | array_d            |

# Select string property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.s FROM aps.TestElement e order by e.s LIMIT 1;
```

| s    |
| ---- |
| str0 |

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | s            | false     | 0     | s        | s    | undefined    | string   | String | s                  |

# Select string array property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_s FROM aps.TestElement e LIMIT 1;
```

| array_s            |
| ------------------ |
| ["s0", "s1", "s2"] |

| className                     | accessString | generated | index | jsonName | name    | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_s      | false     | 0     | array_s  | array_s | undefined    | string   | PrimitiveArray | array_s            |

# Select date time property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.dt FROM aps.TestElement e order by e.dt LIMIT 1;
```

| dt                      |
| ----------------------- |
| 2010-01-01T11:11:11.000 |

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | dt           | false     | 0     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |

# Select date time array property from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_dt FROM aps.TestElement e LIMIT 1;
```

| array_dt                                               |
| ------------------------------------------------------ |
| ["2017-01-01T00:00:00.000", "2010-01-01T11:11:11.000"] |

| className                     | accessString | generated | index | jsonName | name     | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_dt     | false     | 0     | array_dt | array_dt | undefined    | dateTime | PrimitiveArray | array_dt           |

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

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type    | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- | ------------------ |
| AllProperties:IPrimitive | p2d          | false     | 0     | p2d      | p2d  | undefined    | point2d  | Point2d | p2d                |

# Select point2d array from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_p2d FROM aps.TestElement e LIMIT 1;
```

```json
[
  {
    "array_p2d": [
      {
        "X": 1.034,
        "Y": 2.034
      },
      {
        "X": 1111.11,
        "Y": 2222.22
      }
    ]
  }
]
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_p2d    | false     | 0     | array_p2d | array_p2d | undefined    | point2d  | PrimitiveArray | array_p2d          |

# Select point3d from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.p3d FROM aps.TestElement e LIMIT 1;
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type    | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- | ------------------ |
| AllProperties:IPrimitive | p3d          | false     | 0     | p3d      | p3d  | undefined    | point3d  | Point3d | p3d                |

| p3d                            |
| ------------------------------ |
| {"X": -1,"Y": 2.3,"Z": 3.0001} |

# Select point3d array from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_p3d FROM aps.TestElement e LIMIT 1;
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_p3d    | false     | 0     | array_p3d | array_p3d | undefined    | point3d  | PrimitiveArray | array_p3d          |

| array_p3d                                                                 |
| ------------------------------------------------------------------------- |
| [{"X": -1,"Y": 2.3,"Z": 3.0001},{"X": -111.11,"Y": -222.22,"Z": -333.33}] |

# Select binary data from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.bin FROM aps.TestElement e LIMIT 1;
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | bin          | false     | 0     | bin      | bin  | undefined    | binary   | Blob | bin                |

```json
[
  {
    "bin": "BIN(1,2,3)"
  }
]
```

# Select binary array data from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.array_bin FROM aps.TestElement e LIMIT 1;
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_bin    | false     | 0     | array_bin | array_bin | undefined    | binary   | PrimitiveArray | array_bin          |

```json
[
  {
    "array_bin": ["BIN(1,2,3)", "BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22)"]
  }
]
```

# Select binary array data from TestElement with abbreviateBlobs

- dataset: AllProperties.bim
- abbreviateBlobs: true
- mode: ConcurrentQuery

```sql
SELECT e.array_bin FROM aps.TestElement e LIMIT 1;
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_bin    | false     | 0     | array_bin | array_bin | Json    | string   | PrimitiveArray | array_bin          |

```json
[
  {
    "array_bin": ["{\"bytes\":3}", "{\"bytes\":10}"]
  }
]
```

# Select binary array data from TestElement using Tables

- dataset: AllProperties.bim

```sql
SELECT e.array_bin FROM aps.TestElement e LIMIT 1;
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_bin    | false     | 0     | array_bin | array_bin | undefined    | binary   | PrimitiveArray | array_bin          |

| array_bin                                                     |
| ------------------------------------------------------------- |
| ["BIN(1,2,3)", "BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22)"] |

# Select binary array data from TestElement using Tables with abbreviateBlobs

- dataset: AllProperties.bim
- abbreviateBlobs: true
- mode: ConcurrentQuery
- skip: abbreviate blobs does not seem to be thread safe, this affects other tests that run in parallel

```sql
SELECT e.array_bin FROM aps.TestElement e LIMIT 1;
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_bin    | false     | 0     | array_bin | array_bin | Json         | string   | PrimitiveArray | array_bin          |

| array_bin                           |
| ----------------------------------- |
| ["{\"bytes\":3}", "{\"bytes\":10}"] |
