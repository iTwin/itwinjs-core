# ChildNodeRule

Child node rules are used to define child nodes. Generally, `priority`, `condition`, `onlyIfNotHandled` and `stopFurtherProcessing` attributes are used to determine where (under
which parent node) the branch is placed.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Placement attributes* |
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`condition` | No | [ECExpression](../ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`stopFurtherProcessing` | No | `boolean` | `false` | Stop processing rules that have lower priority. Used in cases when recursion suppression is needed. **Note:** If this flag is set, `specifications` and `subConditions` are not processed.
*Branch content attributes* |
`specifications` | No | [`ChildNodeSpecification[]`](../Rules.md#specifications) | `[]` | Specifications that define what content the rule returns.
`customizationRules` | No | [`CustomizationRule[]`](../../customization/Rules.md) | `[]` | Customization rules that are applied for the content returned by this rule.
`subConditions` | No | `SubCondition[]` | `[]` | Specifies child node rules which are only used when specific condition is satisfied

## Example

```JSON
{
  "ruleType": "ChildNodes",
  "condition": "ParentNode.IsOfClass(\"Model\", \"BisCore\")",
  "priority": 999,
  "stopFurtherProcessing": true,
  "specifications": []
}
```
