# SelectedNodeInstances Specification

Returns content for selected (input) instances.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-|-
*Filtering* |
`acceptableSchemaName` | No | `string` | `""` | Filter selected nodes by specified schema name. All schemas are accepted if not specified.
`acceptableClassNames` | No | `string[]` | `[]` | Filter selected nodes by specified class names. All classes are accepted if not specified.
`acceptablePolymorphically` | No | `boolean` | `false` | Should `acceptableClassNames` property be checked polymorphically. If true, all derived classes are accepted as well.
`onlyIfNotHandled` | No | boolean | `false` | Identifies whether we should ignore this specification if there is already an existing specification with higher `priority` that already provides content.
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
  "specType": "SelectedNodeInstances",
  "acceptableSchemaName": "MySchema",
  "acceptableClassNames": ["MyClass1", "MyClass2"],
  "acceptablePolymorphically": true
}
```
