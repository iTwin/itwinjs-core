# Polymorphic vs non-polymorphic query

ECSQL is polymorphic query by default, use the `ONLY` keyword to make queries non-polymorphic.

Syntax: `[ALL|ONLY] <className>`

## Polymorphic query

```sql
SELECT * FORM [BisCore].[GeometricElement3d] Limit 10

-- following is same as above and all GeometricElement3d and its derived classes will be returned.
SELECT * FORM ALL [BisCore].[GeometricElement3d] Limit 10

```

## Non-Polymorphic query

Restrict result to exactly a single type of class.

```sql
SELECT * FORM ONLY [BisCore].[GeometricElement3d] Limit 10

```

[ECSql Syntax](./index.md)
