# ECCustomAttributes

Instances of [ECCustomAttributeClasses](./ec-custom-attribute-class.md) that are applied to other items in a schema to add new metadata attributes.  Any number of custom attributes may be applied to a schema item but only one instance of each class may be applied.

For example:

```xml
        <ECProperty propertyName="LastMod" typeName="dateTime" displayLabel="Last Modified" description="The last time any element in this Model was modified.">
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
               "description" : "The last modified time of the bis:Element. This is maintained by the core framework and should not be set directly by applications.",
               "isReadOnly" : true,
               "label" : "Last Modified",
               "name" : "LastMod",
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

Custom attributes allow any custom metadata to be applied because they are defined using a special type of ECClass.

```xml
    <ECCustomAttributeClass typeName="HiddenProperty" appliesTo="AnyProperty" modifier="Sealed" description="Identifies a property which is designed to be hidden from the user interface">
        <ECProperty propertyName="Show" typeName="boolean" description="If set to true show the hidden property. Defaults to False.  Allows a property override to show a hidden property in a derived class" />
    </ECCustomAttributeClass>
```

For more details about custom attributes see [ECCustomAttributeClass](./ec-custom-attribute-class.md)
