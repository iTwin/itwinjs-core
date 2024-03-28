# IIF (_condition-expr_, _true-expr_, _false-expr_)

ECSQL supports IIF(), which is really shorthand for `CASE WHEN <condition-expr> THEN <true-expr> ELSE <false-expr> END`

## Parameters

`condition-expr`: A condition expression that resolve into a boolean value. e.g. Length > 1.0.

`true-expr`: Value returned when the `condition-expr` is evaluated to a _true_ value.

`false-expr`: Value returned when the `condition-expr` is evaluated to a _false_ value.

## Example

```sql
-- Returns 'Big' if Length is greater than 1, and 'Small' otherwise
SELECT IIF([Length] > 1.0, 'Big', 'Small') FROM [test].[Foo];

-- Returns DisplayLabel if Name is NULL, and Name otherwise
SELECT IIF([Name] IS NULL, [DisplayLabel], [Name]) FROM [test].[Foo];
```

[ECSql Syntax](./index.md)
