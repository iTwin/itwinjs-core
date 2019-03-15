# RelatedInstanceNodes

Returns nodes for instances related to parent instance node.

**Precondition:** can be used only if parent node is ECInstance node.
If there is no immediate parent instance node, the rules engine walks
up the hierarchy until it finds one. If that fails, this specification
has no effect.

## Attributes

Name | Required? | Type | Default | Meaning | Performance Notes
-|-|-|-|-|-
*Filtering* |
`relationships` | No | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | Relationships that should be followed when looking for related instances.
`relatedClasses` | No | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | Related classes whose instances should be used.
`supportedSchemas` | No | `string[]` | `supportedSchemas` attribute of the ruleset | Schemas used to look up relationships and classes when `relationships` or `relatedClasses` attributes are not specified.
`requiredDirection` | No | `"Forward" | "Backward" | "Both"` | `"Both"` | Relationship directions that's following when walking from the parent instance.
`skipRelatedLevel` | No | `number` | `0` | [Skips defined level of related items](../Terminology.md#skip-related-level) and shows next level related items.
`instanceFilter` | No | [ECExpression](../ECExpressions.md#instance-filter) | `""` | Condition for filtering instances
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
  "specType": "RelatedInstanceNodes",
  "groupByClass": false,
  "groupByLabel": false,
  "relationships": {
    "schemaName": "BisCore",
    "classNames": ["ModelContainsElements"]
  },
  "requiredDirection": "Forward",
  "relatedClasses": {
    "schemaName": "BisCore",
    "classNames": ["Element"]
  }
}
```
