# CASE-WHEN-THEN-ELSE

ECSQL supports only searched CASE expressions:

```sql
CASE
      WHEN <expr> THEN <expr>
    [ WHEN <expr> THEN <expr> ...]
    [ ELSE <expr> ]
END
```

## Limitations

Only primitive types can be used with WHEN, THEN and ELSE. This does not include p2d, p3d, IGeometery and NavigationProperties. You can still use sub-queries that return single column and pretty much any SQL expressions.

## Example

```sql
-- CASE without ELSE. Returns NULL if the IF case is not met
SELECT
    CASE
         WHEN [Length] > 1 THEN 'Big'
    END
FROM test.Foo

-- CASE with ELSE. If Length is not greater than 1 then the ELSE expression is returned.
SELECT
    CASE
        WHEN [Length] > 1 THEN 'Big'
        ELSE 'Small'
    END
FROM [test].[Foo]

-- Multiple CASE with ELSE
SELECT
    CASE
        WHEN weekDay=1 THEN 'Mon'
        WHEN weekDay=2 THEN 'Tue'
        WHEN weekDay=3 THEN 'Wen'
        WHEN weekDay=4 THEN 'Thr'
        WHEN weekDay=5 THEN 'Fri'
        WHEN weekDay=6 THEN 'Sat'
        WHEN weekDay=7 THEN 'Sun'
        ELSE 'Wrong value'
    END
FROM [test].[Foo]
```

[ECSql Syntax](./index.md)
