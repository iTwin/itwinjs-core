Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Testing binary props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.bin FROM aps.TestElement e LIMIT 1) select * from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | Json         | string   | Blob |

| x          |
| ---------- |
| BIN(1,2,3) |

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

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- |
|           | p2d          | false     | 0     | p2d      | p2d  |              | point2d  | Point2d |

| p2d                     |
| ----------------------- |
| {"X": 1.034,"Y": 2.034} |

# Testing Point3d props using CTE

- dataset: AllProperties.bim

```sql
with tmp as (SELECT e.p3d FROM aps.TestElement e LIMIT 1) select * from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type    |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------- |
|           | p3d          | false     | 0     | p3d      | p3d  |              | point3d  | Point3d |

| p3d                            |
| ------------------------------ |
| {"X": -1,"Y": 2.3,"Z": 3.0001} |

# Testing Integer props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    |              | int      | Int  |

| x   |
| --- |
| 100 |

# Testing Long props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.l FROM aps.TestElement e order by e.l LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- |
|           | x            | true      | 0     | x        | x    |              | long     | Int64 |

| x    |
| ---- |
| 1000 |

# Testing Decimal props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.d FROM aps.TestElement e order by e.d LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | x            | true      | 0     | x        | x    |              | double   | Double |

| x   |
| --- |
| 0.1 |

# Testing Date time props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.dt FROM aps.TestElement e order by e.dt LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type     |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- |
|           | x            | true      | 0     | x        | x    |              | dateTime | DateTime |

| x                       |
| ----------------------- |
| 2010-01-01T11:11:11.000 |

# Testing string props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.s FROM aps.TestElement e order by e.s LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ------ |
|           | x            | true      | 0     | x        | x    |              | string   | String |

| x    |
| ---- |
| str0 |

# Testing classId props using CTE

- dataset: AllProperties.bim

```sql
with tmp(x) as (SELECT e.ECClassId FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | ClassId      | long     | Id   |

| x                     |
| --------------------- |
| $(testElementClassId) |

# Testing classId props with convertClassIdsToClassNames flag using CTE

- dataset: AllProperties.bim
- convertClassIdsToClassNames: true

```sql
with tmp(x) as (SELECT e.ECClassId FROM aps.TestElement e LIMIT 1) select x from tmp
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | ClassId      | long     | Id   |

| x                     |
| --------------------- |
| $(testElementClassId) |

# Testing classId props with convertClassIdsToClassNames flag using CTE subquery

- dataset: AllProperties.bim
- convertClassIdsToClassNames: true

```sql
select x from (with tmp(x) as (SELECT e.ECClassId FROM aps.TestElement e LIMIT 1) select x from tmp)
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- |
|           | x            | true      | 0     | x        | x    | ClassId      | long     | Id   |

| x                     |
| --------------------- |
| $(testElementClassId) |

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
|           | y            | true      | 0     | y        | y    |              | int      | Int  |

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
|           | y            | true      | 0     | y        | y    |              | int      | Int  |

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
|           | temp1.x      | true      | 0     | temp1.x  | temp1.x |              | int      | Int  |

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
      "jsonName": "temp.x",
      "extendedType": ""
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
|           | x            | true      | 0     | x        | x    |              | int      | Int  |

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
|           | temp1.x      | true      | 0     | temp1.x  | temp1.x |              | int      | Int  |

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

# Expected table aliasing to fail in CTE subquery due to prop name being wrong

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
select a.x from (with tmp(x) as (SELECT e.i FROM aps.TestElement e order by e.i LIMIT 1) select x from tmp) a;
```

# Expected classId prop test to fail with CTE subquery due to prop name being wrong

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
select tmp.x from (with tmp(x) as (SELECT e.ECClassId FROM aps.TestElement e LIMIT 1) select x from tmp)
```
