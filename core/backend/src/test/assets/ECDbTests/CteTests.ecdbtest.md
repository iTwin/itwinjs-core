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
