# ORDER BY clause

Sort result by set of expressions in ascending or descending order. It is also used to order nulls in result set by putting them at the start or end of results.

Syntax:

```sql
ORDER BY
    <expr> [ASC|DESC] [NULLS FIRST|LAST] [,...]
```

Order classes by schema and then class name.

```sql
SELECT * FROM [meta].[ECClassDef] ORDER BY [Schema].[Id], Name
```

Order by DisplayLabel but put null values first.

```sql
SELECT * FROM [meta].[ECClassDef] ORDER BY [DisplayLabel] NULLS FIRST
```

[ECSql Syntax](./index.md)
