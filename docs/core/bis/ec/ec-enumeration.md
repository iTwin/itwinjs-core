# ECEnumeration

Defines an enumeration and its enumerators with a display label and a persisted value of type int or string. Each enumerator in an enumeration must have a unique value. An enumeration can be used as the type for a primitive ECProperty in any type of ECClass. Enumerations are a different type than the value type. For example, it is not valid to override an int property with an enumeration with values of type int. The same is true for string-backed enumerations.

ECEnumerations share the same namespace as ECClasses so its type name must be unique in the schema.

## Attributes

**typeName** defines the name of this ECEnumeration. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.

**backingTypeName** The type for the value of each enumerator

- Valid types are:
  - `int`
  - `string`

**description** User facing description of the enumeration. Localized and may be shown in the UI.

**displayLabel** a localized display label that will be used instead of the name in the GUI. If not set the Type Name of the enumeration will be used

**strict** If true only values defined in the enumerators are valid. If false, any value of the backing type is allowed.

## Sub-Elements

[ECEnumerator](#ecenumerators) _(0..*)_

### ECEnumerator

Defines an individual Label/Value pair in an ECEnumeration definition

#### Attributes

**value** The value for this enumerator, must be unique in the context of the ECEnumeration it belongs to.

**displayLabel** a localized display label that will be used instead of the name in the GUI. If not set the Value will be used
