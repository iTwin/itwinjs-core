# CustomNode

> TypeScript type: [CustomNodeSpecification]($presentation-common).

Returns a custom-defined node that's not based on an ECInstance.

## Attributes

| Name                   | Required? | Type                                             | Default     | Meaning                                                                                            | Performance Notes |
| ---------------------- | --------- | ------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| *Node values*          |
| `type`                 | Yes       | `string`                                         |             | Type of the node.                                                                                  |
| `label`                | Yes       | `string`                                         |             | Label of the node. May be [localized](../Advanced/Localization.md).                                |
| `description`          | No        | `string`                                         | `""`        | Description of the node. May be [localized](../Advanced/Localization.md).                          |
| `imageId`              | No        | `string`                                         | `""`        | Id of the image to use for this custom node.                                                       |
| *Filtering*            |
| `hideExpression`       | No        | [ECExpression](./ECExpressions.md#specification) | `""`        | An ECExpression that indicates whether a node should be hidden or not.                             | Expensive         |
| `hideIfNoChildren`     | No        | `boolean`                                        | `false`     | Hide nodes if they don't have children.                                                            | Expensive         |
| `hideNodesInHierarchy` | No        | `boolean`                                        | `false`     | Hide nodes provided by this specification and directly show their children.                        | Expensive         |
| *Ordering*             |
| `priority`             | No        | `number`                                         | `1000`      | Changes the order of specifications used to create nodes for specific branch.                      |
| *Misc.*                |
| `hasChildren`          | No        | `"Always" \| "Never" \| "Unknown"`               | `"Unknown"` | Tells the rules engine that nodes produced using this specification always or never have children. | Improves          |
| `nestedRules`          | No        | [`ChildNodeRule[]`](./ChildNodeRule.md)          | `[]`        | Specifications of [nested child node rules](./Terminology.md#nested-rule).                         |

## Example

```JSON
{
  "specType": "CustomNode",
  "type": "T_NodeA",
  "label": "@MyApp:Label_NodeA@",
  "description": "@MyApp:Description_NodeA@",
  "priority": 2000
}
```
