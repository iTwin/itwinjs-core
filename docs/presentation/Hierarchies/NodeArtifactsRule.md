# Node Artifacts Rule

> TypeScript type: [NodeArtifactsRule]($presentation-common).

Node artifacts rules are used to create and assign artifacts to specific nodes. The artifacts can be
accessed when evaluating parent node's `hideExpression` to decide whether it should be hidden or not.

## Typical Use Case

The hierarchy consists of *Subject* nodes and each *Subject* may or may not have child *Model* nodes. There are 2 types of *Models*: *A* & *B*, we want *ModelA* nodes to be visible and *ModelB* ones to be hidden. We want *Subject* node to be visible only if it has a *Model* (either *A* or *B*).

### Problem

In this case we can't use `hideIfNoChildren` flag on *Subjects*, because a *Subject* node may only have a related *ModelB* which means *Subject* doesn't have children and should be displayed as a leaf node.

### Solution

Use `NodeArtifacts` on the *ModelB* nodes and a `hideExpression` on *Subject* nodes. The expression can access artifacts created by child *ModelB* nodes: `NOT ThisNode.HasChildren AND NOT ThisNode.ChildrenArtifacts.AnyMatches(x => x.IsModelB)`.

## Attributes

| Name               | Required? | Type                                                                 | Default | Meaning                                                                                  |
| ------------------ | --------- | -------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| *Filtering*        |
| `requiredSchemas`  | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`    | Specifications that define schema requirements for the rule to take effect.              |
| `priority`         | No        | `number`                                                             | `1000`  | Defines the order in which presentation rules are evaluated.                             |
| `onlyIfNotHandled` | No        | `boolean`                                                            | `false` | Should this rule be ignored if there is already an existing rule with a higher priority. |
| `condition`        | No        | [ECExpression](../Customization/ECExpressions.md#rule-condition)     | `""`    | Defines a condition for the rule, which needs to be met in order to execute it.          |
| *Artifacts*        |
| `items`            | No        | `{ [key: string]: ECExpression }`                                    |         | A map of ECExpressions whose evaluation results are used as artifact values              |

## Example

```JSON
{
  "ruleType": "NodeArtifacts",
  "priority": 999,
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "condition": "ThisNode.IsOfClass(\"MyClass\", \"MySchema\")",
  "items": {
    "isSpecialItem": "this.IsSpecial"
  }
}
```

## Additional Notes

**Warning:** The rule is costly performance-wise and should only be used in very limited amount of specific cases where hidden child nodes need to be used to used to determine parent node's visibility.
