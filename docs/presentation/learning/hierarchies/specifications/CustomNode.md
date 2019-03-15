# CustomNode

Returns a custom-defined node that's not based on an ECInstance.

## Attributes

Name | Required? | Type | Default | Meaning | Performance Notes
-|-|-|-|-|-
*Node values* |
`type` | Yes | `string` | | Type of the node.
`label` | Yes | `string` | | Label of the node. May be [localized](../Localization.md).
`description` | No | `string` | `""` | Description of the node. May be [localized](../Localization.md).
`imageId` | No | `string` | `""` | Id of the image to use for this custom node.
*Ordering* |
`priority` | No | `number` | `1000` | Changes the order of specifications used to create nodes for specific branch.
*Misc.* |
`nestedRules` | No | `ChildNodeRule[]` | `[]` | Specifications of [nested child node rules](../Terminology.md#nested-rules).

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
