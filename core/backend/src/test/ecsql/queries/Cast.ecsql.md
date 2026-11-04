Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Extended cast postfix cast to Id-family types

- dataset: AllProperties.bim

```sql
SELECT 21::Id [a], '0x15'::ClassId [b], CAST('21' AS SourceId) [c], 'abc'::Id [d]
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

# Extended cast Id to TEXT is unsigned decimal

- dataset: AllProperties.bim

```sql
SELECT '0xffffffffffffffff'::Id::TEXT [a], 21::Id::TEXT [b]
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | a            | true      | 0     | a        | a    | undefined    | string   | String | undefined          |
|           | b            | true      | 1     | b        | b    | undefined    | string   | String | undefined          |

| a                      | b    |
| ---------------------- | ---- |
| "18446744073709551615" | "21" |

# Extended cast ClassId to ClassName

- dataset: AllProperties.bim

```sql
SELECT e.ECClassId::ClassName [cn], 999999::ClassName [missing] FROM aps.TestElement e ORDER BY e.ECInstanceId LIMIT 1
```

| className | accessString | generated | index | jsonName | name    | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | ------ | ------------------ |
|           | cn           | true      | 0     | cn       | cn      | undefined    | string   | String | undefined          |
|           | missing      | true      | 1     | missing  | missing | undefined    | string   | String | undefined          |

| cn                        |
| ------------------------- |
| AllProperties:TestElement |

# Extended cast EC values to TEXT

- dataset: AllProperties.bim

```sql
SELECT e.p2d::TEXT [p2], e.p3d::TEXT [p3], e.array_i::TEXT [ai], e.Model::TEXT [m], e.bin::TEXT [bn], e.b::TEXT [bo], e.dt::TEXT [d] FROM aps.TestElement e ORDER BY e.ECInstanceId LIMIT 1
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

# Extended cast navigation to Id

- dataset: AllProperties.bim

```sql
SELECT e.Model::Id [mid] FROM aps.TestElement e ORDER BY e.ECInstanceId LIMIT 1
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | mid          | true      | 0     | mid      | mid  | NavId        | long     | Id   | undefined          |

| mid  |
| ---- |
| 0x11 |

# Extended cast TEXT to Json, Guid and Point2d

- dataset: AllProperties.bim
- mode: QueryReader

```sql
SELECT '[1,2]'::Json [j], '407bfa18-944d-11ee-b9d1-0242ac120002'::Guid [g], '{"X":1,"Y":2}'::Point2d [p], '{"X":1}'::Point2d [bad]
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

# Extended cast casts computed numeric values

- dataset: AllProperties.bim

```sql
SELECT (2 + 3)::DOUBLE / 2 [a], CAST((2 + 3) AS DOUBLE) / 2 [b], (5.0 / 2)::INTEGER [c]
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | a            | true      | 0     | a        | a    | undefined    | double   | Double | undefined          |
|           | b            | true      | 1     | b        | b    | undefined    | double   | Double | undefined          |
|           | c            | true      | 2     | c        | c    | undefined    | int      | Int    | undefined          |

| a   | b   | c |
| --- | --- | - |
| 2.5 | 2.5 | 2 |

# Extended cast type propagates through derived table

- dataset: AllProperties.bim

```sql
SELECT v.a FROM (SELECT 21::Id [a]) v
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

| a    |
| ---- |
| 0x15 |

# Extended cast type propagates through CTE

- dataset: AllProperties.bim

```sql
WITH c(v) AS (SELECT 21::Id) SELECT v, v::TEXT [t] FROM c
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | v            | true      | 0     | v        | v    | Id           | long     | Id     | undefined          |
|           | t            | true      | 1     | t        | t    | undefined    | string   | String | undefined          |

| v    | t    |
| ---- | ---- |
| 0x15 | "21" |

# Extended cast ClassName comparison in WHERE

- dataset: AllProperties.bim

```sql
SELECT COUNT(*) [n] FROM aps.TestElement e WHERE e.ECClassId::ClassName = 'AllProperties:TestElement' AND e.ECInstanceId::TEXT <> 'x' AND 'true'::BOOLEAN
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
|           | n            | true      | 0     | n        | n    | undefined    | long     | Int64 | undefined          |

| n  |
| -- |
| 10 |

# Extended cast boolean predicates in WHERE

- dataset: AllProperties.bim

```sql
SELECT COUNT(*) [n] FROM aps.TestElement e WHERE 'false'::BOOLEAN OR e.ECClassId::ClassName = 'x:y' OR 'maybe'::BOOLEAN = TRUE
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
|           | n            | true      | 0     | n        | n    | undefined    | long     | Int64 | undefined          |

| n |
| - |
| 0 |

# Extended cast typed parameter in WHERE

- dataset: AllProperties.bim

```sql
SELECT IIF(e.ECClassId::ClassName = :cn, 'y', 'n') [m] FROM aps.TestElement e WHERE e.ECInstanceId = ?::Id
```

- bindString cn, AllProperties:TestElement
- bindId 2, 0x14

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
|           | m            | true      | 0     | m        | m    | undefined    | string   | String | undefined          |

| m |
| - |
| y |

# Extended cast typed positional parameter

- dataset: AllProperties.bim

```sql
SELECT ?::INTEGER [a]
```

- bindInt 1, 42

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | undefined    | int      | Int  | undefined          |

| a   |
| --- |
| 42  |

# Extended cast typed named parameter

- dataset: AllProperties.bim

```sql
SELECT CAST(:p AS Id) [a]
```

- bindId p, 0x15

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

| a    |
| ---- |
| 0x15 |

# Extended cast leading NULL in UNION takes the typed branch type

- dataset: AllProperties.bim

```sql
SELECT NULL [a] UNION ALL SELECT 21::Id
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
|           | a            | true      | 0     | a        | a    | Id           | long     | Id   | undefined          |

```json
[{}, { "a": "0x15" }]
```

# Extended cast UNION branches with different Id types fail to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 1::Id UNION SELECT 2::ClassId
```

# Extended cast scalar subquery returning a point fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT (SELECT '{"X":1,"Y":2}'::Point2d)
```

# Internal _ecsql_cast function cannot be called from ECSQL

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT _ecsql_cast('id', '0x15')
```

# Extended cast navigation cast to ClassId fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT Parent::ClassId FROM bis.Element
```

# Postfix cast is enabled by default

- dataset: AllProperties.bim

```sql
SELECT 21::Id [a]
```

```json
[{ "a": "0x15" }]
```

# Parameter cast is enabled by default

- dataset: AllProperties.bim

```sql
SELECT CAST(? AS INTEGER) [a]
```

- bindInt 1, 42

```json
[{ "a": 42 }]
```

# Removed CAST_V2 option fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 1 OPTIONS CAST_V2
```

# Removed CAST_V2=false option fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 1 ECSQLOPTIONS CAST_V2=false
```

# CAST uses extended Boolean and DateTime text conversions by default

- dataset: AllProperties.bim

```sql
SELECT CAST(TRUE AS TEXT) [b], CAST(e.dt AS TEXT) [d] FROM aps.TestElement e ORDER BY e.ECInstanceId LIMIT 1
```

```json
[{ "b": "true", "d": "2017-01-01T00:00:00.000" }]
```

# Extended cast unsupported conversion fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT e.p2d::Point3d FROM aps.TestElement e
```

# Strict enum casts validate bound values

- dataset: AllProperties.bim

```sql
SELECT CAST(? AS aps.TestIntEnum) [validInt], CAST(? AS aps.TestIntEnum) [invalidInt], CAST(? AS aps.TestStringEnum) [validString], CAST(? AS aps.TestStringEnum) [invalidString]
```

- bindInt 1, 1
- bindInt 2, 5
- bindString 3, 1
- bindString 4, invalid

```json
[{ "validInt": 1, "validString": "1" }]
```

# Strict enum casts preserve bound NULL

- dataset: AllProperties.bim

```sql
SELECT CAST(? AS aps.TestIntEnum) [i], CAST(? AS aps.TestStringEnum) [s]
```

- bindNull 1, null
- bindNull 2, null

```json
[{}]
```

# Boolean casts preserve numeric NULL

- dataset: AllProperties.bim

```sql
SELECT CAST(NULL AS INT)::BOOLEAN [a], (1/0)::BOOLEAN [b], v::BOOLEAN [c], 0::BOOLEAN [d], (-0.5)::BOOLEAN [e] FROM (SELECT CAST(NULL AS INT) v)
```

```json
[{ "d": false, "e": true }]
```

# Text conversions reject embedded NUL and trailing input

- dataset: AllProperties.bim

```sql
SELECT ('12' || CHAR(0) || 'junk')::Id [i], ('{}' || CHAR(0) || 'junk')::Json [j], ('true' || CHAR(0) || 'junk')::BOOLEAN [b], ('2020-01-02T03:04:05' || CHAR(0) || 'junk')::DateTime [d], ('{"X":1,"Y":2}' || CHAR(0) || 'junk')::Point2d [p], ('407bfa18-944d-11ee-b9d1-0242ac120002' || CHAR(0) || 'junk')::Guid [g], ('1' || CHAR(0) || 'junk')::aps.TestIntEnum [ei], ('1' || CHAR(0) || 'junk')::aps.TestStringEnum [es]
```

```json
[{}]
```

# Point casts preserve explicit CTE columns and adjacent scalar values

- dataset: AllProperties.bim

```sql
WITH c(s,p,p_0,_ecsql_point_p_0) AS (SELECT 'a','{"X":1,"Y":2}'::Point2d,'{"X":3,"Y":4,"Z":5}'::Point3d,7), d(a,b,c,e) AS (SELECT * FROM c) SELECT t.a, t.b::TEXT [p], t.c::TEXT [q], t.e FROM d t
```

```json
[{ "a": "a", "p": "{\"X\":1.0,\"Y\":2.0}", "q": "{\"X\":3.0,\"Y\":4.0,\"Z\":5.0}", "e": 7 }]
```

# Scalar subquery cast cannot bypass compound extended types

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT (SELECT 21::Id) v UNION ALL SELECT 22
```

# Derived table cast cannot bypass compound extended types

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 22 v UNION ALL SELECT v FROM (SELECT 21::Id v)
```

# CTE cast cannot bypass compound extended types

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
WITH c(v) AS (SELECT 21::Id) SELECT v FROM c UNION ALL SELECT 22
```

# Extended cast unknown target fails to prepare

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT NULL::NoSuchType
```
