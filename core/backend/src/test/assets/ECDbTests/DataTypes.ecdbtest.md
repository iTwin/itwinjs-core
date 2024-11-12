Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Select different properties from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.i, e.l, e.d, e.s, e.dt FROM aps.TestElement e LIMIT 2;
```

## Concurrent Query

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| Name | ClassName                | AccessString | JsonName | TypeName | Generated | Index |
| ---- | ------------------------ | ------------ | -------- | -------- | --------- | ----- |
| i    | AllProperties:IPrimitive | i            | i        | int      | false     | 0     |
| l    | AllProperties:IPrimitive | l            | l        | long     | false     | 1     |
| d    | AllProperties:IPrimitive | d            | d        | double   | false     | 2     |
| s    | AllProperties:IPrimitive | s            | s        | string   | false     | 3     |
| dt   | AllProperties:IPrimitive | dt           | dt       | dateTime | false     | 4     |

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

## ECSqlStatement

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| AccessString | Type     | PropertyName | OriginPropertyName | RootClassAlias | RootClassName             | RootClassTableSpace | IsEnum | IsGeneratedProperty | IsSystemProperty | IsDynamicprop |
| ------------ | -------- | ------------ | ------------------ | -------------- | ------------------------- | ------------------- | ------ | ------------------- | ---------------- | ------------- |
| i            | Int      | i            | i                  | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |
| l            | Int64    | l            | l                  | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |
| d            | Double   | d            | d                  | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |
| s            | String   | s            | s                  | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |
| dt           | DateTime | dt           | dt                 | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |

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

# Select point2d and point3d from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.p2d, e.p3d FROM aps.TestElement e LIMIT 2;
```

## Concurrent Query

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| Name | ClassName                | AccessString | JsonName | TypeName | Generated | Index |
| ---- | ------------------------ | ------------ | -------- | -------- | --------- | ----- |
| p2d  | AllProperties:IPrimitive | p2d          | p2d      | point2d  | false     | 0     |
| p3d  | AllProperties:IPrimitive | p3d          | p3d      | point3d  | false     | 1     |

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

## ECSqlStatement

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| AccessString | Type    | PropertyName | OriginPropertyName | RootClassAlias | RootClassName             | RootClassTableSpace | IsEnum | IsGeneratedProperty | IsSystemProperty | IsDynamicprop |
| ------------ | ------- | ------------ | ------------------ | -------------- | ------------------------- | ------------------- | ------ | ------------------- | ---------------- | ------------- |
| p2d          | Point2d | p2d          | p2d                | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |
| p3d          | Point3d | p3d          | p3d                | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |

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

# only: Select binary data from TestElement

- dataset: AllProperties.bim

```sql
SELECT e.bin FROM aps.TestElement e LIMIT 2;
```

## Concurrent Query

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| Name | ClassName                | AccessString | JsonName | TypeName | Generated | Index |
| ---- | ------------------------ | ------------ | -------- | -------- | --------- | ----- |
| bin  | AllProperties:IPrimitive | bin          | bin      | string   | false     | 0     |

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

## ECSqlStatement

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
```

| AccessString | Type | PropertyName | OriginPropertyName | RootClassAlias | RootClassName             | RootClassTableSpace | IsEnum | IsGeneratedProperty | IsSystemProperty | IsDynamicprop |
| ------------ | ---- | ------------ | ------------------ | -------------- | ------------------------- | ------------------- | ------ | ------------------- | ---------------- | ------------- |
| bin          | Blob | bin          | bin                | e              | AllProperties.TestElement | main                | false  | false               | false            | false         |

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
