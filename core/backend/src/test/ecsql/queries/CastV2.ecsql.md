Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# CAST_V2 postfix cast to Id-family types

- dataset: AllProperties.bim

```sql
SELECT 21::Id [a], '0x15'::ClassId [b], CAST('21' AS SourceId) [c], 'abc'::Id [d] OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id    | undefined          |
|           | b            | true      | 1     | b        | b    | ClassId      | long     | Id    | undefined          |
|           | c            | true      | 2     | c        | c    | SourceId     | long     | Id    | undefined          |
|           | d            | true      | 3     | d        | d    | Id           | long     | Id    | undefined          |

| a    | b    | c    |
| ---- | ---- | ---- |
| 0x15 | 0x15 | 0x15 |

# CAST_V2 Id to TEXT is unsigned decimal

- dataset: AllProperties.bim

```sql
SELECT '0xffffffffffffffff'::Id::TEXT [a], 21::Id::TEXT [b] OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | a            | true      | 0     | a        | a    | undefined    | string   | String | undefined          |
|           | b            | true      | 1     | b        | b    | undefined    | string   | String | undefined          |

| a                      | b    |
| ---------------------- | ---- |
| "18446744073709551615" | "21" |

# CAST_V2 ClassId to ClassName

- dataset: AllProperties.bim

```sql
SELECT e.ECClassId::ClassName [cn], 999999::ClassName [missing] FROM aps.TestElement e ORDER BY e.ECInstanceId LIMIT 1 OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name    | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | ------ | ------------------ |
|           | cn           | true      | 0     | cn       | cn      | undefined    | string   | String | undefined          |
|           | missing      | true      | 1     | missing  | missing | undefined    | string   | String | undefined          |

| cn                        |
| ------------------------- |
| AllProperties:TestElement |

# CAST_V2 EC values to TEXT

- dataset: AllProperties.bim

```sql
SELECT e.p2d::TEXT [p2], e.p3d::TEXT [p3], e.array_i::TEXT [ai], e.Model::TEXT [m], e.bin::TEXT [bn], e.b::TEXT [bo], e.dt::TEXT [d] FROM aps.TestElement e ORDER BY e.ECInstanceId LIMIT 1 OPTIONS CAST_V2
```

```json
[
  {
    "p2": "{\"X\":1.034,\"Y\":2.034}",
    "p3": "{\"X\":-1.0,\"Y\":2.3,\"Z\":3.0001}",
    "ai": "[0,1,2]",
    "m": "{\"Id\":\"0x11\",\"RelECClassId\":\"0x63\"}",
    "bn": "AQID",
    "bo": "true",
    "d": "2017-01-01T00:00:00.000"
  }
]
```

# CAST_V2 navigation to Id

- dataset: AllProperties.bim

```sql
SELECT e.Model::Id [mid] FROM aps.TestElement e ORDER BY e.ECInstanceId LIMIT 1 OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | mid          | true      | 0     | mid      | mid  | NavId        | long     | Id   | undefined          |

| mid  |
| ---- |
| 0x11 |

# CAST_V2 TEXT to Json, Guid and Point2d

- dataset: AllProperties.bim
- mode: QueryReader

```sql
SELECT '[1,2]'::Json [j], '407bfa18-944d-11ee-b9d1-0242ac120002'::Guid [g], '{"X":1,"Y":2}'::Point2d [p], '{"X":1}'::Point2d [bad] OPTIONS CAST_V2
```

```json
[
  {
    "j": "[1,2]",
    "g": "407bfa18-944d-11ee-b9d1-0242ac120002",
    "p": { "X": 1, "Y": 2 }
  }
]
```

# CAST_V2 casts computed numeric values

- dataset: AllProperties.bim

```sql
SELECT (2 + 3)::DOUBLE / 2 [a], CAST((2 + 3) AS DOUBLE) / 2 [b], (5.0 / 2)::INTEGER [c] OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | a            | true      | 0     | a        | a    | undefined    | double   | Double | undefined          |
|           | b            | true      | 1     | b        | b    | undefined    | double   | Double | undefined          |
|           | c            | true      | 2     | c        | c    | undefined    | int      | Int    | undefined          |

| a   | b   | c |
| --- | --- | - |
| 2.5 | 2.5 | 2 |

# CAST_V2 type propagates through derived table

- dataset: AllProperties.bim

```sql
SELECT v.a FROM (SELECT 21::Id [a]) v OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

| a    |
| ---- |
| 0x15 |

# CAST_V2 type propagates through CTE

- dataset: AllProperties.bim

```sql
WITH c(v) AS (SELECT 21::Id OPTIONS CAST_V2) SELECT v, v::TEXT [t] FROM c OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | v            | true      | 0     | v        | v    | Id           | long     | Id     | undefined          |
|           | t            | true      | 1     | t        | t    | undefined    | string   | String | undefined          |

| v    | t    |
| ---- | ---- |
| 0x15 | "21" |

# CAST_V2 ClassName comparison in WHERE

- dataset: AllProperties.bim

```sql
SELECT COUNT(*) [n] FROM aps.TestElement e WHERE e.ECClassId::ClassName = 'AllProperties:TestElement' AND e.ECInstanceId::TEXT <> 'x' AND 'true'::BOOLEAN OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
|           | n            | true      | 0     | n        | n    | undefined    | long     | Int64 | undefined          |

| n  |
| -- |
| 10 |

# CAST_V2 boolean predicates in WHERE

- dataset: AllProperties.bim

```sql
SELECT COUNT(*) [n] FROM aps.TestElement e WHERE 'false'::BOOLEAN OR e.ECClassId::ClassName = 'x:y' OR 'maybe'::BOOLEAN = TRUE OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
|           | n            | true      | 0     | n        | n    | undefined    | long     | Int64 | undefined          |

| n |
| - |
| 0 |

# CAST_V2 typed parameter in WHERE

- dataset: AllProperties.bim

```sql
SELECT IIF(e.ECClassId::ClassName = :cn, 'y', 'n') [m] FROM aps.TestElement e WHERE e.ECInstanceId = ?::Id OPTIONS CAST_V2
```

- bindString cn, AllProperties:TestElement
- bindId 2, 0x14

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | m            | true      | 0     | m        | m    | undefined    | string   | String | undefined          |

| m |
| - |
| y |

# CAST_V2 typed positional parameter

- dataset: AllProperties.bim

```sql
SELECT ?::INTEGER [a] OPTIONS CAST_V2
```

- bindInt 1, 42

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | undefined    | int      | Int  | undefined          |

| a   |
| --- |
| 42  |

# CAST_V2 typed named parameter

- dataset: AllProperties.bim

```sql
SELECT CAST(:p AS Id) [a] OPTIONS CAST_V2
```

- bindId p, 0x15

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

| a    |
| ---- |
| 0x15 |

# CAST_V2 leading NULL in UNION takes the typed branch type

- dataset: AllProperties.bim

```sql
SELECT NULL [a] UNION ALL SELECT 21::Id OPTIONS CAST_V2
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

```json
[{}, { "a": "0x15" }]
```

# CAST_V2 UNION branches with different Id types fail to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 1::Id OPTIONS CAST_V2 UNION SELECT 2::ClassId OPTIONS CAST_V2
```

# CAST_V2 scalar subquery returning a point fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT (SELECT '{"X":1,"Y":2}'::Point2d) OPTIONS CAST_V2
```

# Internal _ecsql_cast function cannot be called from ECSQL

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT _ecsql_cast('id', '0x15')
```

# CAST_V2 navigation cast to ClassId fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT Parent::ClassId FROM bis.Element OPTIONS CAST_V2
```

# Postfix cast requires CAST_V2

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 21::Id
```

# Parameter cast requires CAST_V2

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT CAST(? AS INTEGER)
```

# CAST_V2 unsupported conversion fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT e.p2d::Point3d FROM aps.TestElement e OPTIONS CAST_V2
```

# CAST_V2 unknown target fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT NULL::NoSuchType OPTIONS CAST_V2
```
