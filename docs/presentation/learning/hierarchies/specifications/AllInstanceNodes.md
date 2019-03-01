# AllInstanceNodes

Returns nodes for all instances in the imodel filtered only by the
`supportedSchemas` attribute.

## Attributes

Name | Required? | Type | Default | Meaning | Performance Notes
-|-|-|-|-|-
*Filtering* |
`supportedSchemas` | No | `SchemasSpecification` | `supportedSchemas` attribute of the ruleset | Schemas whose instances should be returned
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
  "specType": "AllInstanceNodes",
  "groupByClass": true,
  "groupByLabel": false,
  "supportedSchemas": {
    "schemaNames": ["BisCore", "MyDomain"]
  }
}
```
