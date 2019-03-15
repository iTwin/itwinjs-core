# RootNodeRule

Root node rules are used to define nodes that are displayed at the root hierarchy level.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Placement attributes* |
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`condition` | No | [ECExpression](../ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`stopFurtherProcessing` | No | `boolean` | `false` | Stop processing rules that have lower priority. Used in cases when recursion suppression is needed. **Note:** If this flag is set, `specifications` and `subConditions` are not processed.
*Branch content attributes* |
`autoExpand` | No | `boolean` | `false` | Automatically expand nodes created by this rule.
`specifications` | No | `ChildNodeSpecification[]` | `[]` | Specifications that define what content the rule returns.
`customizationRules` | No | `CustomizationRule[]` | `[]` | Customization rules that are applied for the content returned by this rule.
`subConditions` | No | `SubCondition[]` | `[]` | Specifies child node rules which are only used when specific condition is satisfied

## Example

```JSON
{
  "ruleType": "RootNodes",
  "priority": 999,
  "stopFurtherProcessing": true,
  "autoExpand": true,
  "specifications": [],
  "customizationRules": []
}
```
