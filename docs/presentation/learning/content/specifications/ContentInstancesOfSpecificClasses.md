# ContentInstancesOfSpecificClasses Specification

Returns content for instances of specific ECClasses.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-|-
*Filtering* |
`classes` | Yes | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | Classes whose instances should be used.
`arePolymorphic` | No | `boolean` | `false` | Should all `classes` be handled polymorphically.
`instanceFilter` | No | [ECExpression](../ECExpressions.md#instance-filter) | `""` | Condition for filtering instances
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
  "specType": "ContentInstancesOfSpecificClasses",
  "classes": {
    "schemaName": "BisCore",
    "classNames": ["Model"]
  },
  "arePolymorphic": true
}
```
