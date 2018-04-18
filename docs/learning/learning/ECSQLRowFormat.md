# Format of a row returned from an [ECSQL](ECSQL) SELECT query

A row returned from an [ECSQL](ECSQL) SELECT query is formatted as JavaScript object where every SELECT clause item becomes a property in the JavaScript object.

## Property names

If the ECSQL select clause item

- is an [ECSQL system property](@imodeljs-common.ECSqlSystemProperty), the property name is as described here: [ECJsonNames.toJsName](@imodeljs-common.ECJsonNames.toJsName)
- has a column alias, the alias, with the first character lowered, becomes the property name.
- has no alias, the ECSQL select clause item, with the first character lowered, becomes the property name.

## Property value types

The resulting types of the returned property values are these:

ECSQL type | Extended Type | JavaScript Typ
---------- | ------------- | ---------------
Boolean    | -             | boolean
Blob       | -             | ArrayBuffer
Blob       | BeGuid        | GUID string (see [Guid]($bentleyjs-common.Guid))
ClassId system properties | - | fully qualified class name
Double     | -             | number
DateTime   | -             | ISO8601 string
Id system properties | -   | hexadecimal string
Integer    | -             | number
Int64      | -             | number
Int64      | Id            | hexadecimal string
Point2d    | -             | [XAndY]($geometry-core.XAndY)
Point3d    | -             | [XYAndZ]($geometry-core.XYAndZ)
String     | -             | string
Navigation | n/a           | [NavigationValue]($imodeljs-common.NavigationValue)
Struct     | n/a           | JavaScript object with properties of the types in this table
Array      | n/a           | array of the types in this table

## Examples

ECSQL | Row
----- | ---
`SELECT ECInstanceId,ECClassId,Parent,LastMod,FederationGuid,UserLabel FROM bis.Element` | `{id:"0x132", className:"generic.PhysicalObject", parent:{id:"0x444", relClassName:"bis.ElementOwnsChildElements"},lastMod:"2018-02-27T14:12:55.000Z",federationGuid:"274e25dc-8407-11e7-bb31-be2e44b06b34",userLabel:"My element"}`
`SELECT s.ECInstanceId schemaId, c.ECInstanceId classId FROM meta.ECSchemaDef s JOIN meta.ECClassDef c ON s.ECInstanceId=c.Schema.Id` | `{schemaId:"0x132", classId:"0x332"}`
`SELECT count(*) FROM bis.Element` | `{"count(*)": 31241}`
`SELECT count(*) cnt FROM bis.Element` | `{cnt: 31241}`
