# ECStructClass

ECStructClasses define complex types, that can be used as the type for an ECStructProperty. Structs cannot be instantiated outside of the context of the containing instance and cannot be shared between instances. Structs may contain struct properties but you may not create infinitely recursing structures.

## Example

```xml
<ECStructClass typeName="DistanceExpression" description="Core structure carrying linearly-referenced information.">
    <ECProperty propertyName="DistanceAlongFromStart" typeName="double" kindOfQuantity="LENGTH"/>
    <ECProperty propertyName="LateralOffsetFromILinearElement" typeName="double" kindOfQuantity="LENGTH"/>
    <ECProperty propertyName="VerticalOffsetFromILinearElement" typeName="double" kindOfQuantity="LENGTH"/>
    <ECProperty propertyName="DistanceAlongFromReferent" typeName="double" kindOfQuantity="LENGTH"/>
</ECStructClass>
```

```json
"DistanceExpression": {
  "schemaItemType": "StructClass",
  "description": "Core structure carrying linearly-referenced information.",
  "properties": [
    {
      "name": "DistanceAlongFromStart",
      "type": "PrimitiveProperty",
      "label": "Distance-along",
      "kindOfQuantity": "LinearReferencing.LENGTH",
      "typeName": "double"
    },
    {
      "name": "LateralOffsetFromILinearElement",
      "type": "PrimitiveProperty",
      "label": "Lateral offset",
      "kindOfQuantity": "LinearReferencing.LENGTH",
      "typeName": "double"
    },
    {
      "name": "VerticalOffsetFromILinearElement",
      "type": "PrimitiveProperty",
      "label": "Vertical offset",
      "kindOfQuantity": "LinearReferencing.LENGTH",
      "typeName": "double"
    },
    {
      "name": "DistanceAlongFromReferent",
      "type": "PrimitiveProperty",
      "label": "Distance-along from Referent",
      "kindOfQuantity": "LinearReferencing.LENGTH",
      "typeName": "double"
    }
  ]
},
```
