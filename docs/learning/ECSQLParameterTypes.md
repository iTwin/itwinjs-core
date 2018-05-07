# iModelJs Types used in [ECSQL](./ECSQL) Parameter Bindings

The following table list which iModelJs type you can use for binding values to [ECSQL parameters](./ECSQL#ecsql-parameters).

ECSQL Parameter Type | iModelJs Type
------------- | ----------
Boolean       | boolean
Blob          | ArrayBuffer, SharedArrayBuffer, Base64 string
DateTime      | [ECSqlTypedString]($common/ECSqlTypedString) with an ISO 8601 date time string
Double        | number
GUID          | [Guid]($bentleyjs-core.Guid)
Id            | [Id64]($bentleyjs-core.Id64)
Navigation Value | [NavigationBindingValue]($common/NavigationBindingValue)
Point2d       | [XAndY]($geometry-core.XAndY)
Point3d       | [XAndY]($geometry-core.XYAndZ)
Range3d       | [LowAndHighXYZ]($geometry-core.LowAndHighXYZ)
string        | string
Struct        | JavaScript object matching the members of the struct. The member values can be primitives, arrays, or objects of the above types
Array         | JavaScript array of primitives or objects of the above types