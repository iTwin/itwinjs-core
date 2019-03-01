# LabelOverride Customization Rule

Label override rules provide advanced ways to override instance labels and descriptions in
exchange of some performance penalty. When possible, it's advised to use
[InstanceLabelOverride](./InstanceLabelOverride.md) rules instead.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`condition` | No | [ECExpression](../ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
*Overrides* |
`label` | No | [ECExpression](../ECExpressions.md#override-value) | `""` | An expression whose result becomes the label
`description` | No | [ECExpression](../ECExpressions.md#rule-condition) | `""` | An expression whose result becomes the description

## Example

```JSON
{
  "ruleType": "LabelOverride",
  "priority": 999,
  "stopFurtherProcessing": true,
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "label": "\"Volume: \" & (this.Height * this.Width * this.Length)",
  "description": "\"Physical item\""
}
```
