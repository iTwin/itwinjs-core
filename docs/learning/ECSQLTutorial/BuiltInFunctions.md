
# ECSQL Built-In functions

ECSQL allows use of these built-in functions:

1. `ec_classname()` - Gets the formatted/qualified class name, given ECClassId as input
2. `ec_classid())` - Gets ECClassId, given a formatted/qualified class name as input

# ec_classname(*ecclassId*[,*format-string* | *format-id*)

For the specified ecClassId, returns the class name as a string formatted according to the specified format-string

## Parameters

`ecclassId`: An integer which could be a constant, column or a parameter.
`format-string | format-id`:  Optional format specifier and could be one of the following values. `NULL` is also valid value -- this is the same as not specifying the second parameter at all

| format-id | format-string | output                    |
| --------- | ------------- | ------------------------- |
| 0         | 's:c'         | BisCore:Element (default) |
| 1         | 'a:c'         | bis:Element               |
| 2         | 's'           | BisCore                   |
| 3         | 'a'           | bis                       |
| 4         | 'c'           | Element                   |
| 5         | 's.c'         | BisCore.Element           |
| 6         | 'a.c'         | bis.Element               |

### Returns

className as specified by format, or `NULL` if it was unable to resolve `ECClassId`, or if the format specifier was not recognized.

Note that this can also cause `ECSqlStatement::Step()` to return `BE_SQLITE_ERROR` if the incorrect number of arguments was passed in.

### Example

```sql
-- returns schema-name:classname
SELECT ec_classname(ECClassId, 's:c') FROM bis:Element

-- same as 'sa:cn' - returns schema-alias:classname
SELECT ec_classname(ECClassId, 1) FROM bis:Element

-- returns schema-name, after filtering on it
SELECT * FROM bis:Element WHERE ec_classname(ECClassId, 's') = 'BisCore'

-- returns schema-alias after filtering on it
SELECT * FROM bis:Element WHERE ec_classname(ECClassId, 3) = 'bis'

-- only get classname and filter on classname
SELECT * FROM bis:Element WHERE ec_classname(ECClassId, 'c') = 'PUMP'
```

# ec_classId('*schema-name-or-alias* : | . *classname*' )

For the specified (qualified) class name, returns the `ECCassId`.

Note that this function can also take in two arguments - in the following form where *schema-name-or-alias* and *classname* can be specified separately.
`ec_classid[ '<schema-name-or-alias>',  '<classname>')`

## Parameters

Can take either one or two parameters:
`schema-name-or-alias`: Schema name or alias e.g. bis (alias) or BisCore (name)
`class-name`: Name of the class e.g. Element

### Returns

The function return a integer `ECClassId` or `NULL` if the name could not be resolved.

Note that this can also cause `ECSqlStatement::Step()` to return `BE_SQLITE_ERROR` if the incorrect number of arguments was passed in.

### Example

```sql
-- alias or schema name both can be specified
SELECT * FROM bis.Element WHERE ECClassId IN (ec_classid('opm.PUMP'), ec_classid('opm.VALVE'))
SELECT * FROM bis.Element WHERE ECClassId IN (ec_classid('OpenPlant.PUMP'), ec_classid('OpenPlant.VALVE'))

-- both '.' and ':' delimiter can be used
SELECT * FROM bis.Element WHERE ECClassId IN (ec_classid('opm:PUMP'), ec_classid('opm:VALVE'))
SELECT * FROM bis.Element WHERE ECClassId IN (ec_classid('OpenPlant:PUMP'), ec_classid('OpenPlant:VALVE'))

-- schema name or alias and class name can be specified as two arguments
SELECT * FROM bis.Element WHERE ECClassId IN (ec_classid('opm', 'PUMP'), ec_classid('opm', 'VALVE'))
SELECT * FROM bis.Element WHERE ECClassId IN (ec_classid('OpenPlant', 'PUMP'), ec_classid('OpenPlant', 'VALVE'))
```

[**< Previous**](./ConditionalExpr.md)
