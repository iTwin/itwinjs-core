# ContentRelatedInstances Specification

Returns content for instances related to the selected (input) instances.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-|-
*Filtering* |
`relationships` | No* | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | List of ECRelationship specifications to follow when looking for related instances. Optional if `relatedClasses` is specified.
`relatedClasses` | No* | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | List of related instance ECClass specifications. Optional if `relationships` is specified.
`requiredDirection` | No | `"Forward" | "Backward" | "Both"` | `"Both"` | Relationship direction to follow when walking from the selected (input) instance.
`instanceFilter` | No | [ECExpression](../ECExpressions.md#instance-filter) | `""` | Condition for filtering instances
`skipRelatedLevel` | No | `number` | `0` | Skips defined level of related items and shows next level related items.
`isRecursive` | No | `boolean` | `false` | Walks the specified relationships recursively to find related instances. **Note:** Can't be used together with `skipRelatedLevel`. **Warning:** Using this specification has significant negative performance impact.
*Ordering* |
`priority` | No | `number` | `1000` | Changes the order of specifications.
*Content Modifiers* |
`relatedProperties` | No | `RelatedPropertiesSpecification[]` | `[]` | Specifications of [related properties](../Terminology.md#related-properties) which are included in the generated content. *See [this page](../modifiers/RelatedPropertiesSpecification.md) for more details*
`calculatedProperties` | No | `CalculatedPropertiesSpecification[]` | `[]` | Specifications of calculated properties whose values are generated using provided ECExpressions. *See [this page](../modifiers/CalculatedPropertiesSpecification.md) for more details*
`propertiesDisplay` | No | `PropertiesDisplaySpecification[]` | `[]` | Specifications for customizing property display by hiding / showing them. *See [this page](../modifiers/PropertiesDisplaySpecification.md) for more details*
`propertyEditors` | No | `PropertyEditorsSpecification[]` | `[]` | Specifications of property editors which can be utilities in UI components to edit specific properties. *See [this page](../modifiers/PropertyEditorsSpecification.md) for more details*
`showImages` | No | `boolean` | `false` | Should image IDs be calculated for the returned instances. When `true`, [ImageIdOverride](../../customization/rules/ImageIdOverride.md) rules get applied when creating content.
*Misc.* |
`relatedInstances` | No | `RelatedInstanceSpecification[]` | `[]` | Specifications of [related instances](../../RelatedInstanceSpecification.md) that can be used in content creation.

## Example

```JSON
{
  "specType": "ContentRelatedInstances",
  "relationships": {
    "schemaName": "BisCore",
    "classNames": ["ModelContainsElements"]
  },
  "requiredDirection": "Forward",
  "relatedClasses": {
    "schemaName": "BisCore",
    "classNames": ["PhysicalElement"]
  },
  "arePolymorphic": true
}
```
