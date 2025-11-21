# ECCustomAttributes

Instances of [ECCustomAttributeClasses](./ec-custom-attribute-class.md) that are applied to other items in a schema to add new metadata attributes.  Any number of custom attributes may be applied to a schema item but only one instance of each class may be applied.

For example:

```xml
<ECProperty propertyName="LastMod" typeName="dateTime" displayLabel="Last Modified" description="The last modified time of the bis:Element.">
    <ECCustomAttributes>
        <DateTimeInfo xmlns="CoreCustomAttributes.1.0">
            <DateTimeKind>Utc</DateTimeKind>
        </DateTimeInfo>
        <HiddenProperty xmlns="CoreCustomAttributes.1.0"/>
    </ECCustomAttributes>
</ECProperty>
```

```json
{
    "name" : "LastMod",
    "description" : "The last modified time of the bis:Element.",
    "isReadOnly" : true,
    "label" : "Last Modified",
    "type" : "PrimitiveProperty",
    "typeName" : "dateTime",
    "customAttributes" : [
      {
          "DateTimeKind" : "Utc",
          "className" : "CoreCustomAttributes.DateTimeInfo"
      },
      {
          "className" : "CoreCustomAttributes.HiddenProperty"
      }
    ]
},
```

The custom attribute concept allows any custom metadata to be applied because they are defined using a special type of ECClass, see [ECCustomAttributeClass](./ec-custom-attribute-class.md) for more details

Note: The order of custom attributes within its parent container is not guaranteed. Our APIs will return a consistent order, but it may not always be the same as the order in which they were defined in the schema. This should not be a problem since the same custom attribute may only be applied once.
