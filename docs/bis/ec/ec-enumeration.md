# ECEnumeration

Defines an enumeration and its enumerators with a display label and a persisted value of type int or string. Each enumerator in an enumeration must have a unique value. An enumeration can be used as the type for a primitive ECProperty in any type of ECClass. Enumerations are a different type than the value type. For example, it is not valid to override an int property with an enumeration with values of type int. The same is true for string-backed enumerations.

ECEnumerations share the same namespace as ECClasses so its type name must be unique in the schema.

## Attributes

**typeName** defines the name of this ECEnumeration. Must be a valid [ECName](./ec-name.md) and be unique among all other items in a schema.  (Required)

**backingTypeName** The type for the value of each enumerator (Required)

- Valid types are:
  - `int`
  - `string`

**description** User facing description of the enumeration. Localized and may be shown in the UI. (Optional)

**displayLabel** a localized display label that will be used instead of the name in the GUI. If not set the Type Name of the enumeration will be used (Optional)

**isStrict** If true only values defined in the enumerators are valid. If false, any value of the backing type is allowed. (Optional, default is true)

## Sub-Elements

[ECEnumerator](#ecenumerator) _(0..*)_

### ECEnumerator

Defines an individual Label/Value pair in an ECEnumeration definition

#### Attributes

**name** Defines the name of this ECEnumerator. Must be a valid [ECName](./ec-name.md) and be unique among all other Enumerators in this Enumeration. (Required)

**value** The value for this enumerator, must be unique in the context of the ECEnumeration it belongs to. (Required)

**displayLabel** A localized display label that will be used instead of the name in the GUI. If not set the Value will be used. (Optional)

**description** User facing description of the enumerator. Localized and may be shown in the UI. (Optional)
