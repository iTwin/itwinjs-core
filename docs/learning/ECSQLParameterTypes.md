# iTwin.js Types used in [ECSQL](./ECSQL.md) Parameter Bindings

The following table list which iTwin.js type you can use for binding values to [ECSQL parameters](./ECSQL.md#ecsql-parameters).

ECSQL Parameter Type | iTwin.js Type
------------- | ----------
Boolean       | boolean
Blob          | Uint8Array
DateTime      | ISO 8601 date time string
Double        | number
GUID          | [GuidString]($bentleyjs-core)
Id            | [Id64String]($bentleyjs-core)
Integer       | number. Use a decimal string, if the value is greater than the JavaScript limitation for big integers.
Navigation Value | [NavigationBindingValue]($common)
Point2d       | [XAndY]($geometry-core)
Point3d       | [XAndY]($geometry-core)
Range3d       | [LowAndHighXYZ]($geometry-core)
string        | string
Struct        | JavaScript object matching the members of the struct. The member values can be primitives, arrays, or objects of the above types
Array         | JavaScript array of primitives or objects of the above types
