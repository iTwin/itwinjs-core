# ECClass filter

Filter `ECClassId` by set of classes in polymorphic or non-polymorphic manner.

Syntax: `<classId> IS [NOT] ( [ALL|ONLY] <class-name>[, ...])`

Select element where it is of type `PUMP` or `PIPE`.

```sql
    SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IS (plant.PUMP, plant.PIPE)
```

Select element where it is exactly of type `PUMP` or `PIPE`.

```sql
    SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IS (ONLY plant.PUMP, ONLY plant.PIPE)
```

Find all the element that is not of type `PUMP` or `PIPE`

```sql
    SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IS NOT (plant.PUMP, plant.PIPE)
```

[ECSql Syntax](./index.md)
