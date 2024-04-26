# LIMIT clause

Limit the number of rows returned by query. The clause also sets offset from which the limit on rows is applied. [Read sqlite docs](https://www.sqlite.org/lang_select.html#limitoffset)

Syntax: `LIMIT <limit> [OFFSET <offset>]`

```sql
    -- return only 10 rows.
    SELECT 1 FROM meta.ECClassDef LIMIT 10

    -- return only 10 rows from offset 10
    SELECT 1 FROM meta.ECClassDef LIMIT 10 OFFSET 10
```

[ECSql Syntax](./index.md)
