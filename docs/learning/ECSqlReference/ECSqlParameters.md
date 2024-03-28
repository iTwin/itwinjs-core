# ECSQL Parameters

ECSQL support named and positional parameters.

## Named parameters

Name parameter can be use to bind parameter by name.

Syntax: `:<parameter-name>`

```sql
SELECT * FROM [meta].[ECClassDef] WHERE [Name] = :className
```

## Positional parameters

Positional parameter are bind by position from left to right.

Syntax: `?`

```sql
SELECT * FROM [meta].[ECClassDef] WHERE [Name] = ? AND [DisplayLabel] = ?
```

[ECSql Syntax](./index.md)
