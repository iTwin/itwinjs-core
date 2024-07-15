# ECCustomAttributeClass

ECCustomAttributeClasses define custom metadata which may be applied to any schema item which allows ECCustomAttributes. For a list of schema items which may have a custom attribute applied see [CustomAttribute Container Types](./customattribute-container-types.md).

## Additional Attributes

**appliesTo** The [CustomAttribute Container Types](./customattribute-container-types.md) define what ECSchema items an ECInstance of a custom attribute class can be applied to. Multiple container types can be specified using a comma separated string, e.g. `Schema, EntityClass, StructClass` .
