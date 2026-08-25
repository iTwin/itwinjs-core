# IdSet Virtual Table

`IdSet` is an ECSQL built in virtual table which takes in a valid JSON array string of hex or decimal ids and stores the ids as a virtual table. It can be used as an alternative to `InVirtualSet`. The column retuned by `IdSet` virtual table will always be named `id` by default but can be aliased as per choice. `IdSet` virtual table is defined under the schema named `ECVLib`. But schema name is optional in case of Table Valued Functions so `IdSet` virtual table works fine even when the schema named `ECVLib` is not mentioned in the ECSql query. It is an experimental feature, so the ECSql Option `ENABLE_EXPERIMENTAL_FEATURES` should be passed with the query in order for it to work.

## Syntax

```sql
SELECT i FROM aps.TestElement, IdSet('["0x15", "0x18", "0x19"]') where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

OR

```sql
SELECT i FROM aps.TestElement, IdSet(?) where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

It is also possible to reuse the same `IdSet` in statements that contain UNIONs by using [CTEs](./CTE.md):

```sql
WITH my_cte AS (SELECT id FROM IdSet(?) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES)
    SELECT true as is3d, gel.Model.id as modelId FROM BisCore.GeometricElement3d gel, my_cte WHERE gel.ECInstanceId = my_cte.id
    UNION ALL
    SELECT false as is3d, gel.Model.id as modelId FROM BisCore.GeometricElement2d gel, my_cte WHERE gel.ECInstanceId = my_cte.id
```

## Arguments accepted

- `IdSet` accepts a valid string JSON array with valid string hex ids like `["0x15", "0x18", "0x19"]`
- `IdSet` also accepts a valid string JSON array with valid decimal ids like `[21, 24, 25]`
- `IdSet` also accepts a valid string JSON array with valid decimal ids being passed on as string like `["21", "24", "25"]`

## BindIdSet support

As `IdSet` is an alternative to `InVirtualSet()`, `bindIdSet` also works with `IdSet` virtual table

```sql
SELECT i FROM aps.TestElement, IdSet(?) where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

- bindIdSet 1, [0x15, 0x18, 0x19]

## Migrating from `InVirtualSet`

The following ECSql query using `InVirtualSet`

```sql
SELECT i FROM aps.TestElement where InVirtualSet(?, ECInstanceId)
```

can be translated using `IdSet` as follows

```sql
SELECT i FROM aps.TestElement, IdSet(?) where id = ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

[ECSql Syntax](./index.md)
