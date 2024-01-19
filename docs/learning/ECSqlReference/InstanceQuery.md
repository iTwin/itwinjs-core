# Instance query

Instance queries allow you to select properties defined in derived classes when selecting a base class or multiple properties with the same name defined in different derived classes.

## What is instance property?

Instance property is any property in a class selected in ECSql or its derived classes accessed via the instance query syntax.

## How to access instance property?

In ECSQL instance property can be accessed by using the `$->` operator.

```sql
SELECT $->[CodeValue] FROM [BisCore].[Element] WHERE $->[CodeValue] IS NOT NULL LIMIT 1;
--
SELECT e.$->[CodeValue] FROM [BisCore].[Element] e LIMIT 1;
```

## How it works?

Instance property allows relaxed access to any property within a hierarchy or selected class. It allows full access to the underlying instance of a class using its base class. We can think of it as if `$` represent the full instance not just properties of the selected class.

Following ECSQL will return only properties declared in `BisCore.Element`

```sql
    SELECT * FROM [BisCore].[Element] WHERE ECInstanceId = 0xc000000014c
```

| ECInstanceId    | ECClassId | Model                                  | Last Modified              | Code Specification           | Code Scope                   | Code   | User Label | Parent | Federation GUID | JSON Properties |
| --------------- | --------- | -------------------------------------- | -------------------------- | ---------------------------- | ---------------------------- | ------ | ---------- | ------ | --------------- | --------------- |
| `0x8000000014c` | `0x710`   | `{Id:0x80000000003,RelECClassId:0x51}` | `2020-09-13T21:03:39.281Z` | `{Id:0x1,RelECClassId:0x59}` | `{Id:0x1,RelECClassId:0x5b}` | `NULL` | `Computer` | `NULL` | `NULL`          | `NULL`          |

While following return all properties of respective derived class of `BisCore.Element`

```sql
    SELECT $ FROM [BisCore].[Element] WHERE ECInstanceId = 0xc000000014c
```

above return one column and it contain serialized json instance with all properties

```json
{
  "ECInstanceId": "0x8000000014c",
  "ECClassId": "0x710",
  "Model": {
    "Id": "0x80000000003",
    "RelECClassId": "0x51"
  },
  "LastMod": "2020-09-13T21:03:39.281Z",
  "CodeSpec": {
    "Id": "0x1",
    "RelECClassId": "0x59"
  },
  "CodeScope": {
    "Id": "0x1",
    "RelECClassId": "0x5b"
  },
  "UserLabel": "Computer",
  "Category": {
    "Id": "0x70000000034",
    "RelECClassId": "0xa8"
  },
  "InSpatialIndex": true,
  "Origin": {
    "X": -20.17197015358312,
    "Y": -12.999908317386943,
    "Z": -5.363399999999998
  },
  "Yaw": -9.610521879999869,
  "Pitch": 0,
  "Roll": 0,
  "BBoxLow": {
    "X": -0.2844601562499974,
    "Y": -0.34431570637657166,
    "Z": -0.00034867627660684075
  },
  "BBoxHigh": {
    "X": 0.4287276153476725,
    "Y": 0.0297172168743558,
    "Z": 0.5207000000000108
  },
  "GeometryStream": "encoding=base64;Ug==",
  "TypeDefinition": {
    "Id": "0x80000000145",
    "RelECClassId": "0xcc"
  },
  "TypeId": "382002",
  "RevitId": "381840",
  "Timestamp": "2020-09-10T13:36:41.000",
  "LastModifier": "kiran.patkar",
  "ELEM_TYPE_PARAM": "Computer",
  "ELEM_CATEGORY_PARAM": "Specialty Equipment",
  "FAMILY_LEVEL_PARAM": "B1-CONCOURSE",
  "Asset_Tag": "COMPUTER 005"
}
```

Take a property `Asset_Tag` which might be property that exist on some instance of derived hierarchy of `bis.Element` and we like to find any instance of `Bis.Element` where `$->Asset_Tag ='COMPUTER 005'`

```sql
    SELECT [ECInstanceId] FROM [BisCore].[Element] WHERE $->[Asset_Tag] ='COMPUTER 005'
```

| ECInstanceId  |
| ------------- |
| 0x8000000014c |

Similarly we can read any set of properties and also filter by them

```sql
    SELECT $->[RevitId], $->[LastModifier]  FROM [BisCore].[Element] WHERE $->[Asset_Tag] ='COMPUTER 005'
```

| $ -> RevitId | $ -> LastModifier |
| ------------ | ----------------- |
| 381840       | kiran.patkar      |

ECSql will apply a property filter on selected rows such that those instances which has at least one property out of set of instance property must exists. This improve performance.

```sql
    SELECT $->[ThisPropertyDoesNotExists] from [BisCore].[Element];
```

If `ThisPropertyDoesNotExists` does not exists in `Bis.Element` derived hierarchy then no row will be returned. ECSql filter only include rows that must have at least one instance property. If any instance does not have any instance property requested then it will will be skipped.

## Accessing composite properties like `NavigationProperty`, `Point2d`, `Point3d` or `Struct`s

Only top level instance property can be accessed via `$-><prop>` syntax. Doing something like `$->Model.Id` will not not work as of now. It might be supported in future but as of now any access-string within a composite property is not supported, if its the only property selected then zero row will be returned.

Following type of properties can directly be use in filters and return strong type value.

- DateTime
- Integer
- Long
- Binary
- String
- Double

Here is example of `RevitId` use with `IN()` clause.

```sql
    SELECT $ from [BisCore].[Element] WHERE $->RevitId In ( 1000, 2000, 3000 );
```

While composite properties are returned as `JSON`.

```sql
    SELECT $->[Model] from [RevitDynamic].[Computer] where [ECInstanceId] = 0x8000000014c;
```

above will return following

| $ -> Model                                     |
| ---------------------------------------------- |
| `{"Id":"0x80000000003","RelECClassId":"0x51"}` |

While following will not return any row

```sql
    SELECT $->[Model].[Id] from [RevitDynamic].[Computer] where [ECInstanceId] = 0x8000000014c;
```

But you can still do following to get child property

```sql
    SELECT JSON_EXTRACT($->[Model], '$.Id') AS ModelId from [RevitDynamic].[Computer] where [ECInstanceId] = 0x8000000014c;
```

above will return following

| ModelId         |
| --------------- |
| `0x80000000003` |

## Optional and non-optional instance properties

By default, all properties accessed via instance accessor i.e. `$->prop` must exist in the class identifying the row for that row to qualify for output.

If the user uses `?` after a property accessor e.g. `$->prop?` then it will be considered optional, and the row class will not be checked to see if the `prop` exists or not.

The following query will return no row if there is no subclass of `Bis.Element` that has both properties `CodeValue` and `Foo` in it.

```sql
  SELECT ECClassId, ECInstanceId
  FROM [BisCore].[Element]
      WHERE $->CodeValue = 'Profiling' OR $->Foo = 'Hello'
  LIMIT 1
```

On the other hand, the following query makes `Foo` optional by adding `?` at the end like `$->Foo?`. This will exclude this property from the list of instance properties that must exist in the class of a row for it to qualify for output.

```sql
  SELECT ECClassId, ECInstanceId
  FROM [BisCore].[Element]
      WHERE $->CodeValue = 'Profiling' OR $->Foo? = 'Hello'
  LIMIT 1
```

> Note: Optional property may slow down performance while non-optional properties will improve the performance of instance query.

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

## Examples

```sql
-- Instance Access
SELECT $ FROM [BisCore].[Element] WHERE [ECInstanceId] = 0xc000000018a

-- Instance property access
SELECT $->[CodeValue] FROM [bis].[Element] WHERE $->[CodeValue] IS NOT NULL LIMIT 1;
SELECT [e].$->[CodeValue] FROM [bis].[Element] [e] LIMIT 1;

-- Nested select
SELECT * FROM (SELECT $ FROM [meta].[ECClassDef]);
SELECT $ FROM (SELECT * FROM [meta].[ECClassDef]);

-- Instance access in different clauses
SELECT $ FROM [meta].[ECClassDef] WHERE $->[ECInstanceId] < 3;
SELECT $ FROM [meta].[ECClassDef] WHERE $->[ECInstanceId] < 3 ORDER BY $->ECClassId;
SELECT $ FROM [meta].[ECClassDef] WHERE $->[Name] LIKE 'Class%' ORDER BY $->[ECInstanceId] DESC;
SELECT $->[RevitId], $->[LastModifier]  FROM [Bis].[Element] WHERE $->[Asset_Tag] ='COMPUTER 005';
SELECT $->[Name] from [meta].[ECClassDef] WHERE $->[ECInstanceId] = 1;
SELECT $ from [Bis].[Element] WHERE $->[RevitId] In ( 1000, 2000, 3000 );

SELECT [ECInstanceId], Name
  FROM [meta].[ECClassDef]
    WHERE [Name] in (
      SELECT $->[Name]
      FROM [meta].[ECClassDef]
        WHERE $->[ECInstanceId] = 1);

SELECT *
  FROM (
    SELECT $
    FROM [meta].[ECClassDef]
      WHERE $->[Schema].[Id] in (
        SELECT [Schema].[Id]
        FROM [meta].[ECClassDef]
          WHERE [Schema].[Id] < 3) ORDER BY $->[ECClassId]);
```

## Limitation

1. Only top level property is allowed.
2. Only primitive type values can be accessed in the filter directly. Any composite type will require `JSON_EXTRACT()` to extract child value before it can be used in a query. Refer [Accessing Composite Properties](#accessing-composite-properties)
3. Currently indexes are not supported on instance properties.
4. MetaData a.k.a `ColumnInfo` is dynamically updated only for primitive properties selected for output. All other properties will get generic `ColumnInfo` with a string property and `extendType=JSON`.

## Performance

Generally speaking the performance of instance prop is pretty good though it involve overhead of extracting either property value or complete instance.

- Try use regular properties accessor where possible.
- Do not use instance property access for local properties of class been selected.
- Try avoiding filtering queries by instance properties. Though it fast be without a index it could be slow depending on number of rows to which filter will be applied.

[ECSql Syntax](./index.md)
