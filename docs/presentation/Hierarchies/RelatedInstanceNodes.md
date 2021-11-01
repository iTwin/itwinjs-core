# RelatedInstanceNodes

> TypeScript type: [RelatedInstanceNodesSpecification]($presentation-common).

Returns nodes for instances related to parent instance node.

**Precondition:** can be used only if parent node is ECInstance node.
If there is no immediate parent instance node, the rules engine walks
up the hierarchy until it finds one. If that fails, this specification
has no effect.

## Attributes

| Name                            | Required? | Type                                                                                  | Default     | Meaning                                                                                                                                          | Performance Notes |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| *Filtering*                     |
| `relationshipPaths`             | Yes       | [`RelationshipPathSpecification[]`](../Common-Rules/RelationshipPathSpecification.md) |             | List of [relationship path specifications](../Common-Rules/RelationshipPathSpecification.md) to follow when looking for related class instances. |
| `instanceFilter`                | No        | [ECExpression](./ECExpressions.md#instance-filter)                                    | `""`        | Condition for filtering instances                                                                                                                |
| `hideNodesInHierarchy`          | No        | `boolean`                                                                             | `false`     | Hide instance nodes provided by this specification and directly show their children.                                                             | Expensive         |
| `hideIfNoChildren`              | No        | `boolean`                                                                             | `false`     | Hide nodes if they don't have children.                                                                                                          | Expensive         |
| `hideExpression`                | No        | [ECExpression](./ECExpressions.md#specification)                                      | `""`        | An ECExpression that indicates whether a node should be hidden or not.                                                                           | Expensive         |
| `suppressSimilarAncestorsCheck` | No        | `boolean`                                                                             | `false`     | Suppress similar ancestor nodes' checking when creating nodes based on this specification. [See more](./InfiniteHierarchiesPrevention.md)        |
| *Ordering*                      |
| `priority`                      | No        | `number`                                                                              | `1000`      | Changes the order of specifications used to create nodes for specific branch.                                                                    |
| `doNotSort`                     | No        | `boolean`                                                                             | `false`     | Suppress default sorting of nodes returned by this specification.                                                                                | Improves          |
| *Grouping*                      |
| `groupByClass`                  | No        | `boolean`                                                                             | `true`      | Group instances by ECClass                                                                                                                       |
| `groupByLabel`                  | No        | `boolean`                                                                             | `true`      | Group instances by label                                                                                                                         | Expensive         |
| *Misc.*                         |
| `hasChildren`                   | No        | `"Always" \| "Never" \| "Unknown"`                                                    | `"Unknown"` | Tells the rules engine that nodes produced using this specification always or never have children.                                               | Improves          |
| `relatedInstances`              | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md)   | `[]`        | Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used in nodes' creation.                      |
| `nestedRules`                   | No        | [`ChildNodeRule[]`](./ChildNodeRule.md)                                               | `[]`        | Specifications of [nested child node rules](./Terminology.md#nested-rule).                                                                       |

## Example

```JSON
{
  "specType": "RelatedInstanceNodes",
  "groupByClass": false,
  "groupByLabel": false,
  "relationshipPaths": [{
    "relationship": { "schemaName": "BisCore", "className": "ModelContainsElements" },
    "direction": "Forward",
    "targetClass": { "schemaName": "BisCore", "className": "PhysicalElement" }
  }]
}
```
