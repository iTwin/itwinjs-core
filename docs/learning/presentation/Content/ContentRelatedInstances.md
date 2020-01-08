# ContentRelatedInstances Specification

Returns content for instances related to the selected (input) instances.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`relationships` | No* | `MultiSchemaClassesSpecification \| MultiSchemaClassesSpecification[]` | `[]` | List of ECRelationship specifications to follow when looking for related instances. Optional if `relatedClasses` is specified.
`relatedClasses` | No* | `MultiSchemaClassesSpecification \| MultiSchemaClassesSpecification[]` | `[]` | List of related instance ECClass specifications. Optional if `relationships` is specified.
`requiredDirection` | No | `"Forward" \| "Backward" \| "Both"` | `"Both"` | Relationship direction to follow when walking from the selected (input) instance.
`instanceFilter` | No | [ECExpression](./ECExpressions.md#instance-filter) | `""` | Condition for filtering instances
`skipRelatedLevel` | No | `number` | `0` | Skips defined level of related items and shows next level related items.
`isRecursive` | No | `boolean` | `false` | Walks the specified relationships recursively to find related instances. **Note:** Can't be used together with `skipRelatedLevel`. **Warning:** Using this specification has significant negative performance impact.
*Ordering* |
`priority` | No | `number` | `1000` | Changes the order of specifications.
*Content Modifiers* |
`relatedProperties` | No | `RelatedPropertiesSpecification[]` | `[]` | Specifications of [related properties](./Terminology.md#related-properties) which are included in the generated content. *See [this page](./RelatedPropertiesSpecification.md) for more details*
`calculatedProperties` | No | `CalculatedPropertiesSpecification[]` | `[]` | Specifications of calculated properties whose values are generated using provided ECExpressions. *See [this page](./CalculatedPropertiesSpecification.md) for more details*
`propertyCategories` | No | `PropertyCategorySpecification[]` | `[]` | Specifications for custom categories. Simply defining the categories does nothing - they have to be referenced from `PropertySpecification` defined in `propertyOverrides` by `id`. *See [this page](./PropertyCategorySpecification.md) for more details*
`propertyOverrides` | No | `PropertySpecification[]` | `[]` | Specifications for various property overrides. *See [this page](./PropertySpecification.md) for more details*
`showImages` | No | `boolean` | `false` | Should image IDs be calculated for the returned instances. When `true`, [ImageIdOverride](../customization/ImageIdOverride.md) rules get applied when creating content.
*Misc.* |
`relatedInstances` | No | `RelatedInstanceSpecification[]` | `[]` | Specifications of [related instances](../RelatedInstanceSpecification.md) that can be used in content creation.

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
