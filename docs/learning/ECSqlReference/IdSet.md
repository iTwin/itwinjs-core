# IdSet Virtual Table

`IdSet` is an ECSQl built in virtual table which takes in a valid JSON array string of hex or decimal ids and stores the ids as a virtual table. It can be used as an alternative to `InVirtualSet`.

## Syntax

```sql
SELECT i FROM aps.TestElement, ECVLib.IdSet('["0x15", "0x18", "0x19"]') where id = ECInstanceId
```

OR

```sql
SELECT i FROM aps.TestElement, ECVLib.IdSet(?) where id = ECInstanceId
```

## Arguments accepted

- `IdSet` accepts a valid string JSON array with valid string hex ids like `["0x15", "0x18", "0x19"]`
- `IdSet` also accepts a valid string JSON array with valid decimal ids like `[21, 24, 25]`
- `IdSet` also accepts a valid string JSON array with valid decimal ids being passed on as string like `["21", "24", "25"]`

## BindIdSet support

As `IdSet` is an alternative to `InVirtualSet()`, `bindIdSet` also works with `IfdSet` virtual table

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

- bindIdSet 1, [0x15, 0x18, 0x19]

## Migrating from `InVirtualSet`

The following ECSql query using `InVirtualSet`

```sql
SELECT i FROM aps.TestElement where InVirtualSet(?, ECInstanceId)
```

can be translated using `IdSet` as follows

```sql
SELECT i FROM aps.TestElement,ECVLib.IdSet(?) where id = ECInstanceId
```

[ECSql Syntax](./index.md)
