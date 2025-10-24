Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing binary props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.bin FROM aps.TestElement e LIMIT 1) select * from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | undefined    | binary   | Blob |

| x          |
| ---------- |
| BIN(1,2,3) |

# Testing binary array props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.array_bin FROM aps.TestElement e LIMIT 1) select * from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type           |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------------- |
|           | x            | true      | 0     | x        | x    | undefined    | binary   | PrimitiveArray |

```json
[
  {
    "x": ["BIN(1,2,3)", "BIN(11, 21, 31, 34, 53, 21, 14, 14, 55, 22)"]
  }
]
```

# Testing binary props using abbreviateBlobs using CTE

- dataset: AllProperties.bim
- abbreviateBlobs: true
- mode: ConcurrentQuery

```sql
with tmp(x) as (SELECT e.bin FROM aps.TestElement e LIMIT 1) select * from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | Json         | string   | Blob |

| x             |
| ------------- |
| "{"bytes":3}" |

# Testing Point2d props using CTE

- dataset: AllProperties.bim

```sql
with tmp as (SELECT e.p2d FROM aps.TestElement e LIMIT 1) select * from tmp
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type    | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- | ------------------ |
| AllProperties:IPrimitive | p2d          | false     | 0     | p2d      | p2d  | undefined    | point2d  | Point2d | p2d                |

| p2d                     |
| ----------------------- |
| {"X": 1.034,"Y": 2.034} |

# Testing Point2d x coord value using CTE

- dataset: AllProperties.bim

```sql
with tmp as (SELECT e.p2d FROM aps.TestElement e LIMIT 1) select p2d.x from tmp
```

| className                             | accessString | generated | index | jsonName | name | extendedType | typeName | type   | originPropertyName |
| ------------------------------------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ | ------------------ |
| ECDbSystem:PointECSqlSystemProperties | p2d.X        | false     | 0     | p2d.X    | X    | undefined    | double   | Double | X                  |

| X     |
| ----- |
| 1.034 |

# Testing Point2d x coord value using CTE subquery

- dataset: AllProperties.bim
- skip: The query for this test causes a crash on the backend so skipping it for now but documenting the behaviour

```sql
select p2d.X from (with tmp as (SELECT e.p2d FROM aps.TestElement e LIMIT 1) select p2d from tmp)
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | p2d.X        | false     | 0     | X        | X    |              | double   | Double |

| X     |
| ----- |
| 1.034 |

# Testing Point2d array props using CTE

- dataset: AllProperties.bim

```sql
with tmp as (SELECT e.array_p2d FROM aps.TestElement e LIMIT 1) select array_p2d from tmp
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_p2d    | false     | 0     | array_p2d | array_p2d | undefined    | point2d  | PrimitiveArray | array_p2d          |

| array_p2d                                             |
| ----------------------------------------------------- |
| [{"X": 1.034,"Y": 2.034},{"X": 1111.11,"Y": 2222.22}] |

# Testing Point3d props using CTE

- dataset: AllProperties.bim

```sql
with tmp as (SELECT e.p3d FROM aps.TestElement e LIMIT 1) select * from tmp
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type    | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- | ------------------ |
| AllProperties:IPrimitive | p3d          | false     | 0     | p3d      | p3d  | undefined    | point3d  | Point3d | p3d                |

| p3d                            |
| ------------------------------ |
| {"X": -1,"Y": 2.3,"Z": 3.0001} |

# Testing Point3d props using CTE subquery

- dataset: AllProperties.bim

```sql
select p3d from (with tmp as (SELECT e.p3d FROM aps.TestElement e LIMIT 1) select p3d from tmp)
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type    | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- | ------------------ |
| AllProperties:IPrimitive | p3d          | false     | 0     | p3d      | p3d  | undefined    | point3d  | Point3d | p3d                |

| p3d                            |
| ------------------------------ |
| {"X": -1,"Y": 2.3,"Z": 3.0001} |

# Testing Point3d array props using CTE

- dataset: AllProperties.bim

```sql
with tmp as (SELECT e.array_p3d FROM aps.TestElement e LIMIT 1) select array_p3d from tmp
```

| className                     | accessString | generated | index | jsonName  | name      | extendedType | typeName | type           | originPropertyName |
| ----------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------------- | ------------------ |
| AllProperties:IPrimitiveArray | array_p3d    | false     | 0     | array_p3d | array_p3d | undefined    | point3d  | PrimitiveArray | array_p3d          |

| array_p3d                                                                 |
| ------------------------------------------------------------------------- |
| [{"X": -1,"Y": 2.3,"Z": 3.0001},{"X": -111.11,"Y": -222.22,"Z": -333.33}] |

# Testing Integer props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | undefined    | int      | Int  |

| x   |
| --- |
| 100 |

# Testing Integer array props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.array_i FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type           |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------------- |
|           | x            | true      | 0     | x        | x    | undefined    | int      | PrimitiveArray |

| x         |
| --------- |
| [0, 1, 2] |

# Testing Long props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.l FROM aps.TestElement e order by e.l LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- |
|           | x            | true      | 0     | x        | x    | undefined    | long     | Int64 |

| x    |
| ---- |
| 1000 |

# Testing Long array props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.array_l FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type           |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------------- |
|           | x            | true      | 0     | x        | x    | undefined    | long     | PrimitiveArray |

| x                     |
| --------------------- |
| [10000, 20000, 30000] |

# Testing Decimal props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.d FROM aps.TestElement e order by e.d LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | x            | true      | 0     | x        | x    | undefined    | double   | Double |

| x   |
| --- |
| 0.1 |

# Testing Decimal array props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.array_d FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type           |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------------- |
|           | x            | true      | 0     | x        | x    | undefined    | double   | PrimitiveArray |

| x               |
| --------------- |
| [0.0, 1.1, 2.2] |

# Testing Date time props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.dt FROM aps.TestElement e order by e.dt LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type     |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- |
|           | x            | true      | 0     | x        | x    | undefined    | dateTime | DateTime |

| x                       |
| ----------------------- |
| 2010-01-01T11:11:11.000 |

# Testing Date time array props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.array_dt FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type           |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------------- |
|           | x            | true      | 0     | x        | x    | undefined    | dateTime | PrimitiveArray |

| x                                                      |
| ------------------------------------------------------ |
| ["2017-01-01T00:00:00.000", "2010-01-01T11:11:11.000"] |

# Testing string props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.s FROM aps.TestElement e order by e.s LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | x            | true      | 0     | x        | x    | undefined    | string   | String |

| x    |
| ---- |
| str0 |

# Testing string array props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.array_s FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type           |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------------- |
|           | x            | true      | 0     | x        | x    | undefined    | string   | PrimitiveArray |

| x                  |
| ------------------ |
| ["s0", "s1", "s2"] |

# Testing classId props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT ec_classname(e.ECClassId) FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | x            | true      | 0     | x        | x    | undefined    | string   | String |

| x                         |
| ------------------------- |
| AllProperties:TestElement |

# Testing classId props with convertClassIdsToClassNames flag using CTE

- dataset: AllProperties.bim
- convertClassIdsToClassNames: true

```sql
with tmp(x) as (SELECT ec_classname(e.ECClassId) FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | x            | true      | 0     | x        | x    | undefined    | string   | String |

| x                         |
| ------------------------- |
| AllProperties:TestElement |

# Testing classId props with convertClassIdsToClassNames flag using CTE subquery

- dataset: AllProperties.bim
- convertClassIdsToClassNames: true

```sql
select x from (with tmp(x) as (SELECT ec_classname(e.ECClassId) FROM aps.TestElement e LIMIT 1) select x from tmp)
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | x            | true      | 0     | x        | x    | undefined    | string   | String |

| x                         |
| ------------------------- |
| AllProperties:TestElement |

# Testing InstanceId props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.ECInstanceId FROM aps.TestElement e order by e.ECInstanceId LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | Id           | long     | Id   |

| x    |
| ---- |
| 0x14 |

# Testing prop aliasing in CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x y from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | y            | true      | 0     | y        | y    | undefined    | int      | Int  |

| y   |
| --- |
| 100 |

# Testing prop aliasing in CTE subquery

- dataset: AllProperties.bim

```sql
select y from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x y from tmp)
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | y            | true      | 0     | y        | y    | undefined    | int      | Int  |

| y   |
| --- |
| 100 |

# Testing table aliasing in CTE for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select temp1.x from tmp temp1
```

| className | accessString | generated | index | jsonName | name    | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | ---- |
|           | temp1.x      | true      | 0     | temp1.x  | temp1.x | undefined    | int      | Int  |

| temp1.x |
| ------- |
| 100     |

# Testing table aliasing in CTE for ECSqlStatement

- dataset: AllProperties.bim
- mode: Statement

```sql
with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select temp1.x from tmp temp1
```

```json
{
  "columns": [
    {
      "accessString": "temp1.x",
      "name": "temp1__x002E__x",
      "type": "Int",
      "typeName": "int",
      "generated": true,
      "index": 0,
      "className": "",
      "jsonName": "temp.x"
    }
  ]
}
```

| temp1.x |
| ------- |
| 100     |

# Testing table aliasing in CTE subquery

- dataset: AllProperties.bim

```sql
select x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x from tmp) a;
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | undefined    | int      | Int  |

| x   |
| --- |
| 100 |

# Testing table aliasing on both inner and outer tables in CTE subquery for ConcurrentQuery

- dataset: AllProperties.bim
- mode: ConcurrentQuery

```sql
select temp1.x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select temp1.x from tmp temp1) a;
```

| className | accessString | generated | index | jsonName | name    | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | ---- |
|           | temp1.x      | true      | 0     | temp1.x  | temp1.x | undefined    | int      | Int  |

| temp1.x |
| ------- |
| 100     |

# Testing table aliasing on both inner and outer tables in CTE subquery for Statement

- dataset: AllProperties.bim
- mode: Statement

```sql
select temp1.x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select temp1.x from tmp temp1) a;
```

```json
{
  "columns": [
    {
      "accessString": "temp1.x",
      "name": "temp1__x002E__x",
      "type": "Int",
      "typeName": "int",
      "generated": true,
      "index": 0,
      "className": "",
      "jsonName": "temp.x",
      "extendedType": ""
    }
  ]
}
```

| temp1.x |
| ------- |
| 100     |

# Recursive query with simple scalar values

- dataset: AllProperties.bim

```sql
WITH RECURSIVE cnt (x) AS ( VALUES (100) UNION ALL SELECT x + 1 FROM cnt WHERE x < 210 ) SELECT x FROM cnt LIMIT 5
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- |
|           | x            | true      | 0     | x        | x    | undefined    | long     | Int64 |

| x   |
| --- |
| 100 |
| 101 |
| 102 |
| 103 |
| 104 |

# Recursive query with interger props union scalar values

- dataset: AllProperties.bim

```sql
WITH RECURSIVE cte (x) AS ( SELECT e.i FROM aps.TestElement e WHERE e.i = 100 UNION ALL SELECT x + 1 FROM cte WHERE x < 104) SELECT x FROM cte
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | undefined    | int      | Int  |

| x   |
| --- |
| 100 |
| 101 |
| 102 |
| 103 |
| 104 |

# CTE subquery with alias

- dataset: AllProperties.bim

```sql
SELECT
  a.x
FROM
  (
    WITH
      tmp (x) AS (
        SELECT
          e.i
        FROM
          aps.TestElement e
        ORDER BY
          e.i
        LIMIT
          1
      )
    SELECT
      x
    FROM
      tmp
  ) a
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | undefined    | int      | Int  |

| x   |
| --- |
| 100 |

# CTE Without subcolumns subquery with alias

- dataset: AllProperties.bim

```sql
SELECT
  a.i
FROM
  (
    WITH
      tmp AS (
        SELECT
          e.i
        FROM
          aps.TestElement e
        ORDER BY
          e.i
        LIMIT
          1
      )
    SELECT
      i
    FROM
      tmp
  ) a
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int  | i                  |

| i   |
| --- |
| 100 |

# CTE Without subcolumns subquery with alias for array property

- dataset: AllProperties.bim

```sql
SELECT
  a.array_i
FROM
  (
    WITH
      tmp AS (
        SELECT
          e.array_i
        FROM
          aps.TestElement e
        ORDER BY
          e.i
        LIMIT
          1
      )
    SELECT
      array_i
    FROM
      tmp
  ) a
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
    }
  ]
}
```

```json
[
  {
    "array_i": [0, 1, 2]
  }
]
```

# CTE referencing CTE

- dataset: AllProperties.bim

```sql
WITH
  edges AS (
    SELECT
      [sif].[ECInstanceId] AS [Id],
      [sif].[Parent].[Id] AS [ParentId],
      [sif].[CodeValue],
      [sif].[UserLabel],
      [sif].[EntryPriority]
    FROM
      [bis].[SheetIndexFolder] [sif]
    UNION ALL
    SELECT
      [si].[ECInstanceId] AS [Id],
      [si].[Parent].[Id] AS [ParentId],
      [si].[CodeValue],
      [si].[UserLabel],
      -1 AS [EntryPriority]
    FROM
      [bis].[SheetIndex] [si]
  ),
  nodes AS (
    SELECT
      [sr].[ECInstanceId] AS [Id],
      [sr].[Parent].[Id] AS [ParentId],
      [sr].[CodeValue],
      [sr].[UserLabel],
      [sr].[EntryPriority]
    FROM
      [bis].[SheetReference] [sr]
  ),
  joinToParent AS (
    SELECT
      p.Id
    FROM
      nodes [p]
      LEFT JOIN edges [c] ON [p].Id = [c].ParentId
  )
SELECT
  *
FROM
  joinToParent
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- |
|           | Id           | true      | 0     | id       | Id   | Id           | long     |

# Expected table aliasing for inner and outer tables to fail in CTE subquery due to prop name being wrong

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
select a.x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select temp1.x from tmp temp1) a;
```

# Expected classId prop test to fail with CTE subquery due to prop name being wrong

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
select tmp.x from (with tmp(x) as (SELECT e.ECClassId FROM aps.TestElement e LIMIT 1) select x from tmp)
```
