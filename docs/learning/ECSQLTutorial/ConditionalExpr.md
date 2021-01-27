# ECSql Conditional Expressions

ECSQL supports the following conditional expressions:

1. `CASE-WHEN-THEN-ELSE`
2. `IIF()`

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

Only primitive type can be used with WHEN, THEN and ELSE. Primitive does not include p2d, p3d, IGometery and NavigationProperties. You can still use sub-queries that return single column and pretty much any SQL expressions.

## Example

```sql
-- CASE without ELSE. Returns NULL if the IF case is not met
SELECT
    CASE
         WHEN Length > 1 THEN 'Big'
    END
FROM test.Foo

-- CASE with ELSE. If Length is not greater than 1 then the ELSE expression is returned.
SELECT
    CASE
        WHEN Length > 1 THEN 'Big'
        ELSE 'Small'
    END
FROM test.Foo

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
FROM test.Foo
```

# IIF ( *condition-expr*, *true-expr* , *false-expr* )

ECSQL supports IIF(), which is really shorthand for `CASE WHEN <condition-expr> THEN <true-expr> ELSE <false-expr> END`

## Parameters

`condition-expr`: A condition expression that resolve into a boolean value. e.g. Length > 1.0.

`true-expr`: Value returned when the `condition-expr` is evaluated to a *true* value.

`false-expr`: Value returned when the `condition-expr` is evaluated to a *false* value.

### Example

```sql
-- Returns 'Big' if Length is greater than 1, and 'Small' otherwise
SELECT IIF(Length > 1.0, 'Big', 'Small') FROM test.Foo;

-- Returns DisplayLabel if Name is NULL, and Name otherwise
SELECT IIF(Name IS NULL, DisplayLabel, Name) FROM test.Foo;

```

[**< Previous**](./TypeFilter.md) &nbsp; | &nbsp; [**Next >**](./BuiltInFunctions.md)
