# AllRelatedInstanceNodes

Returns nodes for all instances related to parent instance node.

**Precondition:** can be used only if parent node is ECInstance node.
If there is no immediate parent instance node, the rules engine walks
up the hierarchy until it finds one. If that fails, this specification
has no effect.

## Attributes

Name | Required? | Type | Default | Meaning | Performance Notes
-|-|-|-|-|-
*Filtering* |
`supportedSchemas` | No | `SchemasSpecification` | `supportedSchemas` attribute of the ruleset | Schemas whose instances should be returned
`requiredDirection` | No | `"Forward" | "Backward" | "Both"` | `"Both"` | Relationship directions that's following when walking from the parent instance.
`skipRelatedLevel` | No | `number` | `0` | [Skips defined level of related items](../Terminology.md#skip-related-level) and shows next level related items.
`hideNodesInHierarchy` | No | `boolean` | `false` | Hide nodes provided by this specification and directly show their children. | Expensive
`hideIfNoChildren` | No | `boolean` | `false` | Hide nodes if they don't have children. | Expensive
*Ordering* |
`priority` | No | `number` | `1000` | Changes the order of specifications used to create nodes for specific branch.
`doNotSort` | No | `boolean` | `false` | Suppress default sorting of nodes returned by this specification. | Improves
*Grouping* |
`groupByClass` | No | `boolean` | `true` | Group instances by ECClass
`groupByLabel` | No | `boolean` | `true` | Group instances by label | Expensive
*Misc.* |
`hasChildren` | No | `"Always" | "Never" | "Unknown"` | `"Unknown"` | Tells the rules engine that nodes produced using this specification always or never have children. | Improves
`relatedInstances` | No | `RelatedInstanceSpecification[]` | `[]` | Specifications of [related instances](../../RelatedInstanceSpecification.md) that can be used in nodes' creation.
`nestedRules` | No | `ChildNodeRule[]` | `[]` | Specifications of [nested child node rules](../Terminology.md#nested-rules).

## Example

```JSON
{
  "specType": "AllRelatedInstanceNodes",
  "groupByClass": true,
  "groupByLabel": false,
  "supportedSchemas": {
    "schemaNames": ["BisCore", "MyDomain"]
  },
  "requiredDirection": "Forward",
  "skipRelatedLevel": 1
}
```
