# PropertyCategory Content Modifier

This content modifier allows defining a custom property category. Simply defining it doesn't affect the content,
but a defined category can be used in property overrides.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`id` | Yes | `string` | | Category identifier which has to be unique at the scope of it's definition.
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
    "id": "my_custom_category",
    "label": "My Custom Category"
  }],
  "propertyOverrides": [{
    "name": "MyProperty1",
    "categoryId": "my_custom_category"
  }],
  "relatedProperties": [{
    "relationships": {"schemaName": "BisCore", "classNames": ["SomeRelationship"]},
    "relatedClasses": {"schemaName": "BisCore", "classNames": ["SomeRelatedElementClass"]},
    "requiredDirection": "Forward",
    "properties": [{
      "name": "RelatedProperty2",
      "categoryId": "my_custom_category"
    }]
  }]
}
```
