# DefaultPropertyCategoryOverride

> Based on [DefaultPropertyCategoryOverride]($presentation-common) interface.

A rule that allows overriding the default property category.

The default property category is a category that gets assigned to properties that otherwise have no category.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Picking attributes* |
`requiredSchemas` | No | [`RequiredSchemaSpecification[]`](../SchemaRequirements.md) | `[]` | Specifications that define schema requirements for the rule to take effect.
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
*Content Modifiers* |
`specification` | Yes | [`PropertyCategorySpecification`](./PropertyCategorySpecification.md) | | Specification for the custom property category

## Example

```JSON
{
  "ruleType": "DefaultPropertyCategoryOverride",
  "requiredSchemas": [{ "name": "BisCore", "minVersion": "1.0.1" }],
  "priority": 9999,
  "onlyIfNotHandled": true,
  "specification": {
    "id": "default",
    "label": "General Properties"
  }
}
```
