## Breaking changes to Id64

The use of [Id64]($bentleyjs-core) objects to represent 64-bit IDs was determined to produce measurable negative impact on both memory consumption and code execution time. This impact was amplified by inconsistencies within the iModel.js library - APIs dealing with 64-bit IDs would variously represent them as plain `string`s, `Id64` objects, or either through use of the type alias `Id64String = Id64 | string`. Frequent conversion from one representation to another would often be required when using these APIs. The naming of some functions was also ambiguous.

To address these problems the following changes were made:

* The [Id64String]($bentleyjs-core) type alias was reduced to a simple alias for `string`. It now serves as a marker type indicating that a `string` variable or function argument is expected to conform to the semantics of a well-formed 64-bit ID.
* All function arguments, function return types, and class members of type `Id64` were changed to `Id64String`.
* The Id64 constructor was made private.
* Static functions for constructing, validating, and interrogating `Id64String`s were added to the `Id64` class.
* The code for parsing, validating, and interrogating `Id64String`s was optimized to execute more quickly.
* Id64.getLow() and Id64.getHigh() were renamed to [Id64.getLocalId]($bentleyjs-core) and [Id64.getBriefcaseId]($bentleyjs-core).

See [Working with IDs](../learning/common/Id64.md) for an updated overview.

The pervasiveness of 64-bit IDs in iModel.js make these changes very likely to break existing code in consumers of the iModel.js packages. To adapt such code:

* Replace all usage of `Id64` objects with `Id64String`.
* Replace all calls to the `Id64` constructor with a call to one of the static functions returning an `Id64String` based on your input to the constructor:
  * If your input is a JSON representation of an ID - type `string | undefined` - use [Id64.fromJSON]($bentleyjs-core).
  * If your input is a string, use [Id64.fromString]($bentleyjs-core) if the string is not known to already contain a well-formed ID; otherwise elide the call.
  * If your input is an array of 2 numbers indicating a briefcase ID and local ID, use [Id64.fromLocalAndBriefcaseIds]($bentleyjs-core).
* Replace all calls to non-static `Id64` methods with equivalent static methods accepting an `Id64String`.
* Replace calls to `equals` and `areEqual` with the built-in comparison operators.
* If you truly feel the need to instantiate an `Id64` object - e.g., because you want to do type-switching using an `instanceof` check - use [Id64.wrap]($bentleyjs-core) to create one from an `Id64String`.
