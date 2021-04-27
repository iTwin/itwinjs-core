# PropertyCategory Content Modifier

> Based on [PropertyCategorySpecification]($presentation-common) interface.

This content modifier allows defining a custom property category. Simply defining it doesn't affect the content,
but a defined category can be used in property overrides.

See [property categorization page](./PropertyCategorization.md) for more details.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`id` | Yes | `string` | | Category identifier which has to be unique at the scope of it's definition.
`parentId` | No | `string` | `""` | Identifier of a parent category. The parent category has to be available in the scope of this category definition.
`label` | Yes | `string` | | Display label of the category. May be [localized](../Localization.md).
`description` | No | `string` | `""` | Extensive description of the category.
`priority` | No | `number` | `1000` | Priority of the category. Higher priority categories are displayed on top.
`autoExpand` | No | `boolean` | `false` | Should this category be auto-expanded.

## Examples

```JSON
{
  "ruleType": "ContentModifier",
  "class": {"schemaName": "BisCore", "classNames": ["MyElementClass"]},
  "propertyCategories": [{
    "id": "my_custom_root_category",
    "label": "My Custom Root Category"
  }, {
    "id": "my_custom_child_category",
    "parentId": "my_custom_root_category",
    "label": "My Custom Child Category"
  }],
  "propertyOverrides": [{
    "name": "MyProperty1",
    "categoryId": "my_custom_root_category"
  }],
  "relatedProperties": [{
    "relationships": {"schemaName": "BisCore", "classNames": ["SomeRelationship"]},
    "relatedClasses": {"schemaName": "BisCore", "classNames": ["SomeRelatedElementClass"]},
    "requiredDirection": "Forward",
    "properties": [{
      "name": "RelatedProperty2",
      "categoryId": "my_custom_child_category"
    }]
  }]
}
```
