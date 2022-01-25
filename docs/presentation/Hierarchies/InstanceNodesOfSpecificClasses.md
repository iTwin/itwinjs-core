# InstanceNodesOfSpecificClasses

> TypeScript type: [InstanceNodesOfSpecificClassesSpecification]($presentation-common).

Returns nodes for instances of specific ECClasses.

## Attributes

| Name                             | Required? | Type                                                                                | Default     | Meaning                                                                                                                                                                                                                                                             | Performance Notes |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| *Filtering*                      |
| `classes`                        | Yes       | `MultiSchemaClassesSpecification \| MultiSchemaClassesSpecification[]`              | `[]`        | Classes whose instances should be used.                                                                                                                                                                                                                             |
| `handleInstancesPolymorphically` | No        | `boolean`                                                                           | `false`     | Should instances be queried using a polymorphic query - from `classes` and all their subclasses. This doesn't mean the resulting content will have all properties of the subclasses though - they're only taken from base classes specified in `classes` attribute. |
| `instanceFilter`                 | No        | [ECExpression](./ECExpressions.md#instance-filter)                                  | `""`        | Condition for filtering instances                                                                                                                                                                                                                                   |
| `hideNodesInHierarchy`           | No        | `boolean`                                                                           | `false`     | Hide instance nodes provided by this specification and directly show their children.                                                                                                                                                                                | Expensive         |
| `hideIfNoChildren`               | No        | `boolean`                                                                           | `false`     | Hide nodes if they don't have children.                                                                                                                                                                                                                             | Expensive         |
| `hideExpression`                 | No        | [ECExpression](./ECExpressions.md#specification)                                    | `""`        | An ECExpression that indicates whether a node should be hidden or not.                                                                                                                                                                                              | Expensive         |
| `suppressSimilarAncestorsCheck`  | No        | `boolean`                                                                           | `false`     | Suppress similar ancestor nodes' checking when creating nodes based on this specification. [See more](./InfiniteHierarchiesPrevention.md)                                                                                                                           |
| *Ordering*                       |
| `priority`                       | No        | `number`                                                                            | `1000`      | Changes the order of specifications used to create nodes for specific branch.                                                                                                                                                                                       |
| `doNotSort`                      | No        | `boolean`                                                                           | `false`     | Suppress default sorting of nodes returned by this specification.                                                                                                                                                                                                   | Improves          |
| *Grouping*                       |
| `groupByClass`                   | No        | `boolean`                                                                           | `true`      | Group instances by ECClass                                                                                                                                                                                                                                          |
| `groupByLabel`                   | No        | `boolean`                                                                           | `true`      | Group instances by label                                                                                                                                                                                                                                            | Expensive         |
| *Misc.*                          |
| `hasChildren`                    | No        | `"Always" \| "Never" \| "Unknown"`                                                  | `"Unknown"` | Tells the rules engine that nodes produced using this specification always or never have children.                                                                                                                                                                  | Improves          |
| `relatedInstances`               | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md) | `[]`        | Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used in nodes' creation.                                                                                                                                         |
| `nestedRules`                    | No        | [`ChildNodeRule[]`](./ChildNodeRule.md)                                             | `[]`        | Specifications of [nested child node rules](./Terminology.md#nested-rule).                                                                                                                                                                                          |

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
