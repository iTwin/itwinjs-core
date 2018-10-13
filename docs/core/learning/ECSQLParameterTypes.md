# iModel.js Types used in [ECSQL](./ECSQL.md) Parameter Bindings

The following table list which iModel.js type you can use for binding values to [ECSQL parameters](./ECSQL.md#ecsql-parameters).

ECSQL Parameter Type | iModel.js Type
------------- | ----------
Boolean       | boolean
Blob          | ArrayBuffer, Base64 string
DateTime      | [ECSqlTypedString]($common) with an ISO 8601 date time string
Double        | number
GUID          | [Guid]($bentleyjs-core)
Id            | [Id64]($bentleyjs-core)
Navigation Value | [NavigationBindingValue]($common)
Point2d       | [XAndY]($geometry-core)
Point3d       | [XAndY]($geometry-core)
Range3d       | [LowAndHighXYZ]($geometry-core)
string        | string
Struct        | JavaScript object matching the members of the struct. The member values can be primitives, arrays, or objects of the above types
Array         | JavaScript array of primitives or objects of the above types