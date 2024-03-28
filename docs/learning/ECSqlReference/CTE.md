# CTE - Common table expression

Syntax:

```sql
WITH [RECLUSIVE]
    <cte-name>([args...]) AS (
        <query1>
        [UNION <query2>]
    )[, <next-cte-block>]
    <query3>
```

A simple example of cte.

```sql
WITH RECURSIVE
    c(i) AS (
        SELECT 1
        UNION
        SELECT i + 1 FROM [c] WHERE i < 4 ORDER BY 1
    )
    SELECT i FROM [c]
    /*
        i
        ------------------
        1
        2
        3
        4
    */
```

Query assembly hierarchy where Depth is greater then `10` and limit row to `100`.

```sql
WITH RECURSIVE
    assembly ([Id], [ParentId], [Code], [Label], [AssemblyPath], [Depth]) AS (
        SELECT
            [r].[ECInstanceId],
            [r].[Parent].[Id],
            [r].[CodeValue],
            [r].[UserLabel],
            COALESCE([r].[CodeValue], [r].[UserLabel]), 1
        FROM [BisCore].[Element] [r]
        WHERE [r].[Parent].[Id] IS NULL
        UNION ALL
        SELECT
            [c].[ECInstanceId],
            [c].[Parent].[Id],
            [c].[CodeValue],
            [c].[UserLabel],
            [p].[AssemblyPath] || '->' || COALESCE([c].[CodeValue], [c].[UserLabel]), [Depth] + 1
        FROM [bis].[Element] [c]
            JOIN [assembly] [p] ON [p].[Id] = [c].[Parent].[Id]
) SELECT * FROM [assembly] WHERE [Depth] > 10 LIMIT 100
```

[ECSql Syntax](./index.md)
