# ECSQL Built-In functions

Following is list of built-in scalar functions

ECSQL allows use of these built-in functions:

1. [`ec_classname()`](#ec_classname-ecclassid--format-string--format-id) - Gets the formatted/qualified class name, given ECClassId as input
1. [`ec_classid())`](#ec_classidschema-name-or-alias----classname) - Gets ECClassId, given a formatted/qualified class name as input
1. [`regexp()`](#regexp--regex-value) - test if a text matches a regex.
1. [`regexp_extract()`](#regexp_extract--value-regex--rewrite) - extract and rewrite matching regex group from a string value.
1. [`strToGuid()`](#strtoguid-guid-string) - covert string guid to binary guid.
1. [`guidToStr()`](#guidtostring-binary-guid) - covert binary guid to string guid.
1. [`navigation_value()`](#navigation_value-ecnavigationproperty-path-id--RelECClassId) - Constructs an ECNavigation value, given ECNavigation property, Id and optionaly, RelECClassId.

## ec_classname( _ecclassId_ [, _format-string_ | _format-id_] )

For the specified ecClassId, returns the class name as a string formatted according to the specified format-string

### Parameters

`ecclassId`: An integer which could be a constant, column or a parameter.
`format-string | format-id`: Optional format specifier and could be one of the following values. `NULL` is also valid value -- this is the same as not specifying the second parameter at all

| format-id | format-string | output                    |
| --------- | ------------- | ------------------------- |
| 0         | `s:c`         | BisCore:Element (default) |
| 1         | `a:c`         | bis:Element               |
| 2         | `s`           | BisCore                   |
| 3         | `a`           | bis                       |
| 4         | `c`           | Element                   |
| 5         | `s.c`         | BisCore.Element           |
| 6         | `a.c`         | bis.Element               |

### Returns

className as specified by format, or `NULL` if it was unable to resolve `ECClassId`, or if the format specifier was not recognized.

Note that this can also cause `ECSqlStatement::Step()` to return `BE_SQLITE_ERROR` if the incorrect number of arguments was passed in.

### Example

```sql
-- returns schema-name:classname
SELECT ec_classname([ECClassId], 's:c') FROM [BisCore].[Element]

-- same as 'sa:cn' - returns schema-alias:classname
SELECT ec_classname([ECClassId], 1) FROM bis:Element

-- returns schema-name, after filtering on it
SELECT * FROM [BisCore].[Element] WHERE ec_classname([ECClassId], 's') = 'BisCore'

-- returns schema-alias after filtering on it
SELECT * FROM [BisCore].[Element] WHERE ec_classname([ECClassId], 3) = 'bis'

-- only get classname and filter on classname
SELECT * FROM [BisCore].[Element] WHERE ec_classname([ECClassId], 'c') = 'PUMP'
```

## ec_classId('_schema-name-or-alias_ : | . _classname_' )

For the specified (qualified) class name, returns the `ECCassId`.

Note that this function can also take in two arguments - in the following form where _schema-name-or-alias_ and _classname_ can be specified separately.
`ec_classid[ '<schema-name-or-alias>',  '<classname>')`

## Parameters

Can take either one or two parameters:
`schema-name-or-alias`: Schema name or alias e.g. bis (alias) or BisCore (name)
`class-name`: Name of the class e.g. Element

### Returns

An integer `ECClassId` or `NULL` if the name could not be resolved.

Note that this can also cause `ECSqlStatement::Step()` to return `BE_SQLITE_ERROR` if the incorrect number of arguments was passed in.

### Example

```sql
-- alias or schema name both can be specified
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('opm.PUMP'), ec_classid('opm.VALVE'))
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('OpenPlant.PUMP'), ec_classid('OpenPlant.VALVE'))

-- both '.' and ':' delimiter can be used
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('opm:PUMP'), ec_classid('opm:VALVE'))
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('OpenPlant:PUMP'), ec_classid('OpenPlant:VALVE'))

-- schema name or alias and class name can be specified as two arguments
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('opm', 'PUMP'), ec_classid('opm', 'VALVE'))
SELECT * FROM [BisCore].[Element] WHERE [ECClassId] IN (ec_classid('OpenPlant', 'PUMP'), ec_classid('OpenPlant', 'VALVE'))

```

## REGEXP ( _regex_, _value_ )

Regex uses [google/re2](https://github.com/google/re2/wiki/Syntax) engine.

```sql
SELECT DisplayLabel FROM meta.ECClassDef c WHERE REGEXP('Terrain\s\w+', c.DisplayLabel);

DisplayLabel
--------------------
Terrain Boundary
Terrain Breakline
Terrain Drape Boundary
Terrain Drape Void
Terrain Hole
Terrain Island
Terrain Reference
Terrain Source Contour
Terrain Spot Elevation
Terrain Void
```

## REGEXP_EXTRACT ( _value_, _regex_ [, _rewrite_] )

Regex uses [google/re2](https://github.com/google/re2/wiki/Syntax) engine.
This function can be used to extract or rewrite the output. Parameter `rewrite` is made of group reference where `\0` refer to text captured by whole regex specified. `\1`, `\2` `...` refer to regex capture group in that order.

```sql
-- In follow we rewrite the string by swapping first and second capture group
SELECT
    REGEXP_EXTRACT(DisplayLabel,'(\w+)\s+(\w+)', '\2,\1')
FROM meta.ECClassDef c
    WHERE REGEXP('Terrain\s\w+', c.DisplayLabel);

REGEXP_EXTRACT(ECClassDef.[DisplayLabel],'(\w+)\s+(\w+)','\2,\1')
-----------------------------------------------------------------
Boundary,Terrain
Breakline,Terrain
Drape,Terrain
Drape,Terrain
Hole,Terrain
Island,Terrain
Reference,Terrain
Source,Terrain
Spot,Terrain
Void,Terrain
```

## StrToGuid( _guid-string_ )

When `GUID` is stored as a binary, it needs to be converted for comparison purposes.

```sql
SELECT * FROM [BisCore].[Element] WHERE FederationGuid = StrToGuid('407bfa18-944d-11ee-b9d1-0242ac120002')
```

## GuidToString( _binary-guid_ )

When `GUID` is stored as a binary, it needs to be converted for comparison purpose.

```sql
SELECT * FROM [BisCore].[Element] WHERE GuidToString(FederationGuid) = '407bfa18-944d-11ee-b9d1-0242ac120002'
```

## NAVIGATION_VALUE( _ECNavigationProperty-path_, _Id_ [, _RelECClassId_] )

Constructs an ECNavigation property from the provided values.

## Parameters

Can take either two or three parameters:
`ECNavigationProperty-path`: The path must consist of Schema name or alias, Class name and Property Name. The property should always be an ECNavigation property.
`Id`: The Id that will be applied to the ECNavigation value
`RelECClassId`: The RelECClassId that will be applied to the ECNavigation value

The `RelECClassId` argument is optional and when it is missing, the RelECClassId will be taken from the ECNavigationProperty ECRelationship class

### Returns

The function returns an ECNavigation property.

### Example

```sql
-- returns an ECNavigation value with Id equal to 1 and RelECClassId equal to ClassId of the ECRelationshipClass (in this case, id of the ModelContainsElements)
SELECT NAVIGATION_VALUE(bis.Element.Model, 1)

-- returns an ECNavigation value with Id equal to 1 and RelECClassId equal to 2
SELECT NAVIGATION_VALUE(bis.Element.Model, 1, 2)

-- properties can be passed to the Id and RelECClassId arguments as well, but FROM clause should be specified
SELECT NAVIGATION_VALUE(bis.Element.Model, Model.Id, Model.RelECClassId) [MyNavProp] FROM bis.Model
```

[ECSql Syntax](./index.md)
