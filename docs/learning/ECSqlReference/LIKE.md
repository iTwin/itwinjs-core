# LIKE operator

Match value to a pattern.

Syntax: `<expr> [NOT] LIKE <pattern> [ESCAPE '<char>']`

- The percent sign `%` represents zero, one, or multiple characters
- The underscore sign `_` represents one, single character

Find classes with name start with `IL`.

```sql
    -- find classes
    SELECT Name FROM [meta].[ECClassDef] WHERE [Name]  LIKE 'IL%' LIMIT 3;
    /*
    Name
    --------------------
    ILinearElement
    ILinearElementProvidedBySource
    ILinearElementSource
    */
```

`NOT LIKE` example

```sql
    -- find classes
    SELECT Name FROM [meta].[ECClassDef] WHERE [Name] NOT LIKE 'IL%' LIMIT 3;
    /*
    Name
    --------------------
    __x002A__U2_23086
    __x0037__12__x002F__7020
    __x0037__12__x002F__7030ElementAspect
    */
```

when searching for `%` or `_` we need to escape expression.

```sql
    SELECT Name FROM [meta].[ECClassDef] WHERE [Name] LIKE '\_%' ESCAPE '\' LIMIT 3;
    /*
    Name
    --------------------
    __x002A__U2_23086
    __x0037__12__x002F__7020
    __x0037__12__x002F__7030ElementAspect
    */
```

[ECSql Syntax](./index.md)
