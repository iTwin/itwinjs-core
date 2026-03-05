# ECCustomAttributeClass

ECCustomAttributeClasses define custom metadata which may be applied to any schema item which allows ECCustomAttributes. For a list of schema items which may have a custom attribute applied see [CustomAttribute Container Types](./customattribute-container-types.md).  For examples of a custom attribute applied to a schema item see [ECCustom Attributes](./ec-custom-attributes.md).

## Additional Attributes

**appliesTo** The [CustomAttribute Container Types](./customattribute-container-types.md) define what ECSchema items an ECInstance of a custom attribute class can be applied to. Multiple container types can be specified using a comma separated string, e.g. `Schema, EntityClass, StructClass` .

## Examples

```xml
<ECCustomAttributeClass typeName="HiddenProperty" appliesTo="AnyProperty" modifier="Sealed" >
    <ECProperty propertyName="Show" typeName="boolean" />
</ECCustomAttributeClass>

<ECCustomAttributeClass typeName="DateTimeInfo" description="Optional additional meta data for ECProperties of type DateTime." appliesTo="PrimitiveProperty, ArrayProperty" modifier="Sealed">
    <ECProperty propertyName="DateTimeKind" typeName="DateTimeKind" description="Either Utc, Local or Unspecified. Default: Unspecified."/>
    <ECProperty propertyName="DateTimeComponent" typeName="DateTimeComponent" description="Either DateTime or Date. Default: DateTime."/>
</ECCustomAttributeClass>
<ECEnumeration typeName="DateTimeKind" backingTypeName="string" isStrict="true">
    <ECEnumerator value="Unspecified" name="Unspecified"/>
    <ECEnumerator value="Utc" name="Utc"/>
    <ECEnumerator value="Local" name="Local"/>
</ECEnumeration>
<ECEnumeration typeName="DateTimeComponent" backingTypeName="string" isStrict="true">
    <ECEnumerator value="DateTime" name="DateTime"/>
    <ECEnumerator value="Date" name="Date"/>
    <ECEnumerator value="TimeOfDay" name="TimeOfDay"/>
</ECEnumeration>
```

```json
"HiddenProperty": {
  "schemaItemType": "CustomAttributeClass",
  "modifier": "Sealed",
  "properties": [
    {
      "name": "Show",
      "type": "PrimitiveProperty",
      "typeName": "boolean"
    }
  ],
  "appliesTo": "AnyProperty"
},

"DateTimeInfo": {
  "schemaItemType": "CustomAttributeClass",
  "description": "Optional additional meta data for ECProperties of type DateTime.",
  "modifier": "Sealed",
  "properties": [
    {
      "name": "DateTimeKind",
      "type": "PrimitiveProperty",
      "description": "Either Utc, Local or Unspecified. Default: Unspecified.",
      "typeName": "CoreCustomAttributes.DateTimeKind"
    },
    {
      "name": "DateTimeComponent",
      "type": "PrimitiveProperty",
      "description": "Either DateTime or Date. Default: DateTime.",
      "typeName": "CoreCustomAttributes.DateTimeComponent"
    }
  ],
  "appliesTo": "PrimitiveProperty, ArrayProperty"
},
"DateTimeKind": {
  "schemaItemType": "Enumeration",
  "type": "string",
  "isStrict": true,
  "enumerators": [
    { "name": "Unspecified", "value": "Unspecified" },
    { "name": "Utc", "value": "Utc" },
    { "name": "Local", "value": "Local" }
  ]
},
"DateTimeComponent": {
  "schemaItemType": "Enumeration",
  "type": "string",
  "isStrict": true,
  "enumerators": [
    { "name": "DateTime", "value": "DateTime" },
    { "name": "Date", "value": "Date" },
    { "name": "TimeOfDay", "value": "TimeOfDay" }
  ]
},
```
