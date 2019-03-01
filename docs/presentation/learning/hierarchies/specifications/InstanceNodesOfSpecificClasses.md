# InstanceNodesOfSpecificClasses

Returns nodes for instances of specific ECClasses.

## Attributes

Name | Required? | Type | Default | Meaning | Performance Notes
-|-|-|-|-|-
*Filtering* |
`classes` | Yes | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | Classes whose instances should be used.
`arePolymorphic` | No | `boolean` | `false` | Should all `classes` be handled polymorphically.
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
  "specType": "InstanceNodesOfSpecificClasses",
  "groupByClass": false,
  "groupByLabel": false,
  "classes": {
    "schemaName": "BisCore",
    "classNames": ["GeometricElement2d", "GeometricElement3d"]
  },
  "arePolymorphic": true
}
```
