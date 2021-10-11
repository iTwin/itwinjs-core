# Format of a row returned from an [ECSQL](./ECSQL.md) SELECT query

When using Concurrent query a row format can be selected. By default ConcurrentQuery engine always render top level row as array of values and not object. But it also include meta data allowing array to be converted into two other formats. The format is controlled by flag [QueryRowFormat]($common) which can have one of following values.

- **UseECsqlPropertyNames**: Each row is an object in which each non-null column value can be accessed by its name as defined in the ECSql. Null values are omitted.
- **UseJsPropertyNames**: Each row is an array of values accessed by an index corresponding to the property's position in the ECSql SELECT statement. Null values are included if they are followed by a non-null column, but trailing null values at the end of the array are omitted.
- **UseArrayIndexes**: The default format if none is specified by the caller

There is tiny overhead when accessing row as `UseECsqlPropertyNames` or `UseJsPropertyNames` as it require convert array values into a object with property name and values. We recommend using array values as is allowing much better performance.

> **Note** that `ECSqlStatement.getRow()` function does not take row format as parameter and always return `UseJsPropertyNames`. In future the parameter will be added but we recommend using concurrent query on both frontend and backend as it is more efficient in term of memory and performance.

## Property names

If the ECSQL select clause item

- has a column alias, the alias, with the first character lowered, becomes the property name.
- has no alias and is no ECSQL system property, the ECSQL select clause item, with the **first character lowered**, becomes the property name.
- is an ECSQL system property (see also enum [ECSqlSystemProperty]($common)):


### System properties when `UseJsPropertyNames` options is used
  System property | JavaScript Type
  --- | ---
  [ECInstanceId](./ECSQL.md#ECInstanceId-and-ECClassId) | id
  [ECClassId](./ECSQL.md#ECInstanceId-and-ECClassId) | className
  [SourceECInstanceId](./ECSQL.md#ecrelationshipclasses) | sourceId
  [SourceECClassId](./ECSQL.md#ecrelationshipclasses) | sourceClassName
  [TargetECInstanceId](./ECSQL.md#ecrelationshipclasses) | targetId
  [TargetECClassId](./ECSQL.md#ecrelationshipclasses) | targetClassName

  Navigation property member | JavaScript Type
  --- | ---
  [Id](./ECSQL.md#navigation-properties) | id
  [RelClassId](./ECSQL.md#navigation-properties) | relClassName
### System properties when `UseJsPropertyNames` options is used

>Note: the property case will be same as specified in ECSQL

  System property | JavaScript Type
  --- | ---
  [ECInstanceId](./ECSQL.md#ECInstanceId-and-ECClassId) | ECInstanceId
  [ECClassId](./ECSQL.md#ECInstanceId-and-ECClassId) | ECClassId
  [SourceECInstanceId](./ECSQL.md#ecrelationshipclasses) | SourceECInstanceId
  [SourceECClassId](./ECSQL.md#ecrelationshipclasses) | SourceECClassId
  [TargetECInstanceId](./ECSQL.md#ecrelationshipclasses) | TargetECInstanceId
  [TargetECClassId](./ECSQL.md#ecrelationshipclasses) | TargetECClassId

  Navigation property member | JavaScript Type
  --- | ---
  [Id](./ECSQL.md#navigation-properties) | Id
  [RelClassId](./ECSQL.md#navigation-properties) | RelECClassId

  Point property member | JavaScript Type
  --- | ---
  [X](./ECSQL.md#points) | x
  [Y](./ECSQL.md#points) | y
  [Z](./ECSQL.md#points) | z

## Property value types

The resulting types of the returned property values are these:

ECSQL type | Extended Type | JavaScript Typ
---------- | ------------- | ---------------
Boolean    | -             | boolean
Blob       | -             | Uint8Array
Blob       | BeGuid        | [GuidString]($core-bentley)
ClassId system properties | - | fully qualified class name
Double     | -             | number
DateTime   | -             | ISO 8601 date time string
Id system properties | -   | [Id64String]($core-bentley)
Integer    | -             | number
Int64      | -             | number
Int64      | Id            | hexadecimal string
Point2d    | -             | [XAndY]($core-geometry)
Point3d    | -             | [XYAndZ]($core-geometry)
String     | -             | string
Navigation | n/a           | [NavigationValue]($common)
Struct     | n/a           | JavaScript object with properties of the types in this table
Array      | n/a           | array of the types in this table

## Examples

ECSQL | Row
----- | ---
`SELECT ECInstanceId,ECClassId,Parent,LastMod,FederationGuid,UserLabel FROM bis.Element` | `{id:"0x132", className:"generic.PhysicalObject", parent:{id:"0x444", relClassName:"bis.ElementOwnsChildElements"},lastMod:"2018-02-27T14:12:55.000Z",federationGuid:"274e25dc-8407-11e7-bb31-be2e44b06b34",userLabel:"My element"}`
`SELECT s.ECInstanceId schemaId, c.ECInstanceId classId FROM meta.ECSchemaDef s JOIN meta.ECClassDef c ON s.ECInstanceId=c.Schema.Id` | `{schemaId:"0x132", classId:"0x332"}`
`SELECT count(*) FROM bis.Element` | `{"count(*)": 31241}`
`SELECT count(*) cnt FROM bis.Element` | `{cnt: 31241}`
