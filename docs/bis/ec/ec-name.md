# ECName

An ECName is used any time an invariant, string based, name is needed for an element in a schema. These strings must follow the following rules:

1. Must contain at least one character
2. Must contain only alpha numeric characters plus `_`
3. May not start with a number or `_`
4. May not contain spaces
5. Case is allowed but all comparisons are case insensitive. E.g. PIPE == Pipe

These rules are designed to ease code generation and mapping into databases.

If coming from a system with less restrictive naming rules some valid ECName must be chosen for each named element in the schema. There are two common options suggested.

1. Replace illegal characters with a similar legal character and swizzle names to be unique if necessary. The original name can be placed in the display label for the element so it shows in the UI
2. Replace invalid characters with a special sequence `__xHHHH__` where `HHHH` is the character code for the replaced character. Names created this way will automatically be converted back to their original form for display so the display label should be left unset. This option has the upside of preserving all names with no swizzle but produces ugly invariant names.

## Different ECName Representations

There are many different ways to represent an ECName depending on the context they need to be referred to. This section explains each one and the differences between them.

### ECSchema Full Name

The Schema full name contains the name of the schema in addition to the 3-part version number.

`{SchemaName}.{RR}.{ww}.{mm}`

### Full Name

A full name is comprised of the schema name, or [schema full name](#ecschema-full-name), and the name of the schema item, an [ECName](#ecname). It can either be separated by a `:` or `.`.

The `:` separator is the most common and has long been the preferred separator. However, the `.` has been used by WSG and more recently introduced into the ECSchemaJSON format and may continue to become more widely spread and supported.

Note: If the schema full name is used then the `:` separator must be used.

Format of `:` separator without schema version: `{schemaName}:{schemaItemName}`

Format of `:` separator with schema version: `{schemaFullName}:{schemaItemName}`

Format of `.` separator: `{schemaName}.{schemaItemName}`

### ECSql Name

An ECSql name contains the same information as the [full name](#full-name) but has a slightly different format to be used in an ECSql context. Square braces, `[`, are added around each item to escape any naming conflicts with reserved keywords in ECSql.

The ECSql Name like its name suggests is only ever used within the context of ECSql and is not supported, or recommended, for use outside of it.

Examples:

`[{schemaName}].[{schemaItemName}]`

`[{schemaName}]:[{schemaItemName}]`

### Qualified Name

A qualified name contains the schema's alias, if the schema item exists within a reference schema, and the schema item name, an [ECName](#ecname).

This is no longer the preferred way of identifying a class within the context of its parent ECSchema, using [full name](#full-name) is now preferred. The qualified name is currently only supported in the ECXML format for references.

Example:

`{schemaAlias}:{schemaItemName}`
