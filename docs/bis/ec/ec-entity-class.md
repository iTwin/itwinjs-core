# ECEntityClass

ECEntityClasses make up the domain model in a schema, defining the objects which will be created and inserted into the repository. It has additional attributes over the common set.

In addition to having one base class an entity class my have any number of [Mixins](./ec-mixin-class.md) applied.

## Custom Attributes

ECEntity classes inherit custom attributes from their base class and any mixins applied.  Base classes are traversed first, followed by mixins.  When more than one custom attribute of the same class is found the first one found is the one returned.

## Additional Sub-Elements

[ECNavigationProperty](./ec-property.md#ecnavigationproperty) _(0..*)_

## Example

```xml
<ECEntityClass typeName="Door">
    <BaseClass>bis:PhysicalElement</BaseClass>
    <ECProperty propertyName="OverallHeight" typeName="double" kindOfQuantity="AECU:LENGTH_SHORT"/>
    <ECProperty propertyName="OverallWidth"typeName= "double" kindOfQuantity="AECU:LENGTH_SHORT"/>
    <ECProperty propertyName="Description" typeName="string"/>
</ECEntityClass>
```

```json
"Door": {
  "schemaItemType": "EntityClass",
  "baseClass": "BisCore.PhysicalElement",
  "properties": [
    {
      "name": "OverallHeight",
      "type": "PrimitiveProperty",
      "description": "Overall Height of the Door",
      "label": "Overall Height",
      "kindOfQuantity": "AecUnits.LENGTH_SHORT",
      "typeName": "double"
    },
    {
      "name": "OverallWidth",
      "type": "PrimitiveProperty",
      "description": "Overal1 Width of the Door",
      "label": "Overall Width",
      "kindOfQuantity": "AecUnits.LENGTH_SHORT",
      "typeName": "double"
    },
    {
      "name": "Description",
      "type": "PrimitiveProperty",
      "typeName": "string"
    }
  ]
},
```
