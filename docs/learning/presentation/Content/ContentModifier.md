# ContentModifier

> Based on [ContentModifier]($presentation-common) interface.

Content modifiers are used to modify how instances of specified ECClasses are displayed in content which is produced using [content rules](./ContentRule.md). They do not produce any content by themselves.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Picking attributes* |
`class` | No | `SingleSchemaClassSpecification` | `` | Specification of ECClass whose content displayed should be modified. The modifier is applied to all ECClasses if this attribute is not specified.
`requiredSchemas` | No | [`RequiredSchemaSpecification[]`](../SchemaRequirements.md) | `[]` | Specifications that define schema requirements for the rule to take effect.
*Content Modifiers* |
`relatedProperties` | No | `RelatedPropertiesSpecification[]` | `[]` | Specifications of [related properties](./Terminology.md#related-properties) which are included in the generated content. *See [this page](./RelatedPropertiesSpecification.md) for more details*
`calculatedProperties` | No | `CalculatedPropertiesSpecification[]` | `[]` | Specifications of calculated properties whose values are generated using provided ECExpressions. *See [this page](./CalculatedPropertiesSpecification.md) for more details*
`propertyCategories` | No | `PropertyCategorySpecification[]` | `[]` | Specifications for custom categories. Simply defining the categories does nothing - they have to be referenced from `PropertySpecification` defined in `propertyOverrides` by `id`. *See [this page](./PropertyCategorySpecification.md) for more details*
`propertyOverrides` | No | `PropertySpecification[]` | `[]` | Specifications for various property overrides. *See [this page](./PropertySpecification.md) for more details*

## Example

```JSON
{
  "ruleType": "ContentModifier",
  "class": { "schemaName": "BisCore", "className": "Element" },
  "requiredSchemas": [{ "name": "BisCore", "minVersion": "1.0.1" }],
  "propertyOverrides": [{
    "name": "Model",
    "isDisplayed": false,
  }],
}
```
