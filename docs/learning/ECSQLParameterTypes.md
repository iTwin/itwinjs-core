# ECSQL Parameter Types in iTwin.js

The query readers accept a [QueryBinder]($common). The same bindings apply to asynchronous `createQueryReader` calls and synchronous backend `withQueryReader` calls. Positional parameter indexes start at 1; named parameters use their name without the leading `:`.

## Reader bindings

| Value | TypeScript type | Explicit binding |
| --- | --- | --- |
| Boolean | `boolean` | `bindBoolean` |
| Blob | `Uint8Array` | `bindBlob` |
| DateTime | ISO 8601 date-time string | `bindString` |
| Double | `number` | `bindDouble` |
| ID | [Id64String]($bentley) | `bindId` |
| ID set | Iterable of Id64 strings | `bindIdSet`, for example with `InVirtualSet` |
| Integer | `number` | `bindInt` |
| Int64 | `number` | `bindLong`; values must be representable without losing JavaScript integer precision |
| Null | `null` | `bindNull` |
| Point2d | [Point2d]($geometry) | `bindPoint2d` |
| Point3d | [Point3d]($geometry) | `bindPoint3d` |
| Range3d | [LowAndHighXYZ]($geometry) | `bindRange3d` |
| String | `string` | `bindString` |

[QueryBinder.from]($common) accepts an array of positional values or an object of named values. It infers bindings from the JavaScript values: numbers become doubles, strings become strings, and instances of `Point2d`, `Point3d`, and `Range3d` receive the corresponding geometric binding. Use an explicit method when the parameter needs a specific type, such as `bindId` or `bindInt`.

To bind a GUID represented as a string, use a string parameter with `strToGuid(?)` where the query requires a GUID blob. See [ECSQL built-in functions](./ECSqlReference/ECSqlFunctions.md).

## Navigation, struct, and array parameters

The query readers do not support binding whole navigation values. Although `QueryBinder.bindStruct` is public, both the asynchronous and synchronous query reader APIs currently reject whole-struct parameters. Bind individual members instead, for example `WHERE Parent.Id=?` or `WHERE Location.Street=? AND Location.Zip=?`.

Arbitrary ECSQL array-property parameters are also unsupported. An array passed as one value to `QueryBinder.from` is recognized as an ID set only when it is empty or contains valid Id64 strings. It is not a general array binding. The outer array in `QueryBinder.from([value1, value2])` supplies two positional parameters.

See [binding examples](./ECSQLCodeExamples.md#parameter-bindings) for scalar, navigation-member, struct-member, and ID-set queries.

## Legacy statement bindings

The deprecated backend [ECSqlStatement]($backend) has a broader binding API, including `bindNavigation`, `bindStruct`, and `bindArray`. Those APIs accept [NavigationBindingValue]($common), objects matching struct members, and arrays of property values respectively. They do not transfer directly to the reader's `QueryBinder` interface. See [legacy binding examples](./backend/ECSQLCodeExamples.md#legacy-statement-bindings).

For standalone ECDb writes, [ECSqlWriteStatement]($backend) provides statement bindings through [ECDb.withCachedWriteStatement]($backend) or [ECDb.withWriteStatement]($backend).

See [ECSQL parameters](./ECSQL.md#ecsql-parameters) for SQL syntax and [ECSQL null behaviors](./ECSQLNullBehaviors.md) for null-update semantics.
