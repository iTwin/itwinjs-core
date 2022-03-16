# ImageIdOverride Customization Rule

> **Note** This rule is deprecated. Use [extended data](./ExtendedDataUsage.md#customize-tree-node-item-icon) instead.

> TypeScript type: [ImageIdOverride]($presentation-common).

ImageId override rules allow setting an image ID to specific types of ECInstances.

## Attributes

| Name                                                | Required? | Type                                                                 | Default |
| --------------------------------------------------- | --------- | -------------------------------------------------------------------- | ------- |
| *Filtering*                                         |
| [`requiredSchemas`](#attribute-requiredschemas)     | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`    |
| [`priority`](#attribute-priority)                   | No        | `number`                                                             | `1000`  |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)   | No        | `boolean`                                                            | `false` |
| [`condition`](#attribute-condition)                 | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    |
| [`imageIdExpression`](#attribute-imageidexpression) | Yes       | [ECExpression](./ECExpressions.md#override-value)                    |         |

### Attribute: `requiredSchemas`

> **Default value:** `[]`

Specifications that define schema requirements for the rule to take effect.

### Attribute: `priority`

> **Default value:** `1000`

Defines the order in which presentation rules are evaluated.

### Attribute: `onlyIfNotHandled`

> **Default value:** `false`

Should this rule be ignored if there is already an existing rule with a higher priority.

### Attribute: `condition`

> **Default value:** `""`

Defines a condition for the rule, which needs to be met in order to execute it.

### Attribute: `imageIdExpression`

An expression whose result becomes the image ID.

## Example

```JSON
{
  "ruleType": "ImageIdOverride",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "priority": 999,
  "stopFurtherProcessing": true,
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "imageIdExpression": "\"ImageId_\" & this.MyProperty"
}
```
