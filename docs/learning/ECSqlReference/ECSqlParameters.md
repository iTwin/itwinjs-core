# ECSQL Parameters

ECSQL supports named and positional parameters.

## Named parameters

Named parameters can be used to bind a parameter by name.

Syntax: `:<parameter-name>`

```sql
SELECT * FROM [meta].[ECClassDef] WHERE [Name] = :className
```

## Positional parameters

Positional parameters are bound by position from left to right.

Syntax: `?`

```sql
SELECT * FROM [meta].[ECClassDef] WHERE [Name] = ? AND [DisplayLabel] = ?
```

[ECSql Syntax](./index.md)
