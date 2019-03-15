# ContentRule

Content rules are used to define content that is displayed for specific type of selection.

Selection consists of either instances or nodes and to make things
simpler everything is considered a node - instances get converted to
ECInstance nodes (thus the `SelectedNode` symbol in [`condition` ECExpression](ECExpressions.md#rule-condition)).

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Picking attributes* |
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`condition` | No | [ECExpression](../ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
*Content attributes* |
`specifications` | No | `ContentSpecification[]` | `[]` | Specifications that define what content the rule returns.

## Example

```JSON
{
  "ruleType": "Content",
  "priority": 999,
  "condition": "SelectedNode.IsOfClass(\"Model\", \"BisCore\")",
  "specifications": [],
}
```
