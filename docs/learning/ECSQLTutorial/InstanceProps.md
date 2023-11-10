
# ECSQL Instance properties

ECSQL supports querying instance properties, which are any property in a class selected in ECSql or its derived classes.
These instance properties can be accessed using the `$->` operator.

There are two ways of using instance properties in ECSQL:

## Accessing the entire current instance

This renders a complete instance from the current row into ECSQL-JSON.

Example:

```sql
-- This query will return one column containing a serialized json instance with all the properties.
SELECT $ from bis.Element;
```

## Accessing a property within current instance

This allows an arbitrary property that may exist anywhere in the derived class hierarchy can be extracted and returned.
For primitive types which have a single value, instance access wil return a typed value where as any composite value will be returned as JSON.

Example

```sql
-- Returns given properties for rows for which it exists or return null.
SELECT $->PropertyThatMayOrMayNotExists FROM bis.Element;

SELECT $->Name from meta.ECClassDef LIMIT 1;
```

### Optional Properties and their impact on performance

By default, all properties accessed via instance accessor `$->prop` must exist in the class identifying the row in order for that row to qualify for the output.
If a `?` is used after the instance accessor `$->prop?`, it is considered optional and the row class will not be checked to see if the `prop` exists or not.
Optional properties may slow down performance while non-optional properties will improve the performance of an instance query.

Example

```sql
-- The following query will not return any row if there is no subclass of `Bis.Element` that has both properties `CodeValue` and `Foo` in it.
  SELECT ECClassId, ECInstanceId
  FROM Bis.Element
      WHERE $->CodeValue = 'Profiling' OR $->Foo = 'Hello'
  LIMIT 1
```

```sql
-- On the other hand, the following query makes `Foo` optional by adding `?` at the end like `$->Foo?`.
-- This will exclude this property from the list of instance properties that must exist in the class of a row for it to qualify for output.
  SELECT ECClassId, ECInstanceId
  FROM Bis.Element
      WHERE $->CodeValue = 'Profiling' OR $->Foo? = 'Hello'
  LIMIT 1
```

## Accessing composite properties

Only top level instance properties can be accessed using instance property accessor syntax `$-><prop>`.\
Using `$-><prop>.<sub prop>` will not work at the moment and will return zero rows.\
Only following property types can be used directly and they return strong type values:

- Binary
- DateTime
- Double
- Integer
- Long
- String

```sql
-- Composite property will be returned as a JSON
  SELECT $->Model from RevitDynamic.Computer where ECInstanceId = 0x8000000014c;

-- Output:{"Id":"0x80000000003","RelECClassId":"0x51"}
```

```sql
-- Following will not return any rows
  SELECT $->Model.Id from RevitDynamic.Computer where ECInstanceId = 0x8000000014c;

-- However, the child property can be accessed using JSON_EXTRACT()
  SELECT JSON_EXTRACT($->Model, '$.Id') AS ModelId from RevitDynamic.Computer where ECInstanceId = 0x8000000014c;

-- Output: 0x80000000003
```

## Limitations

- Only top level property is allowed.
- Only primitive type values can be accessed in the filter directly. Any composite type will require `JSON_EXTRACT()` to extract child value before it can be used in a query. Refer [Accessing Composite Properties](#accessing-composite-properties)
- Indexes are not supported on instance properties at the moment.
- Metadata a.k.a `ColumnInfo` is dynamically updated only for primitive properties selected for output. All other properties will get generic `ColumnInfo` with a string property and `extendType=JSON`.

## How to get better performance when using instance queries

- Try use regular properties accessor where possible.
- Do not use instance property access for local properties of class been selected.
- Try avoiding filtering queries by instance properties. Though it fast be without a index it could be slow depending on number of rows to which filter will be applied.
- Relationships that are mapped as foreign key / Navigation properties cannot be accessed via instance access.

## Examples

```sql
-- Instance Access
SELECT $ FROM BisCore.Element WHERE ECInstanceId = 0xc000000018a

-- Instance property access
SELECT $->CodeValue FROM bis.Element WHERE $->CodeValue IS NOT NULL LIMIT 1;
SELECT e.$->CodeValue FROM bis.Element e LIMIT 1;

-- Nested select
SELECT * FROM (SELECT $ FROM meta.ECClassDef);
SELECT $ FROM (SELECT * FROM meta.ECClassDef);

-- Instance access in different clauses
SELECT $ FROM meta.ECClassDef WHERE $->ECInstanceId < 3;
SELECT $ FROM meta.ECClassDef WHERE $->ECInstanceId < 3 ORDER BY $->ECClassId;
SELECT $ FROM meta.ECClassDef WHERE $->Name LIKE 'Class%' ORDER BY $->ECInstanceId DESC;
SELECT $->RevitId, $->LastModifier  FROM Bis.Element WHERE $->Asset_Tag ='COMPUTER 005';
SELECT $->Name from meta.ECClassDef WHERE $->ECInstanceId = 1;
SELECT $ from Bis.Element WHERE $->RevitId In ( 1000, 2000, 3000 );

SELECT ECInstanceId, Name
  FROM meta.ECClassDef
    WHERE Name in (
      SELECT $->Name
      FROM meta.ECClassDef 
        WHERE $->ECInstanceId = 1);

SELECT *
  FROM (
    SELECT $
    FROM meta.ECClassDef
      WHERE $->Schema.Id in (
        SELECT Schema.Id
        FROM meta.ECClassDef
          WHERE Schema.Id < 3) ORDER BY $->ECClassId);
```

[**< Previous**](./BuiltInFunctions.md)
