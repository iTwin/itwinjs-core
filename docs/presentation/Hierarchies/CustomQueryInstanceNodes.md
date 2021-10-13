# CustomQueryInstanceNodes

> TypeScript type: [CustomQueryInstanceNodesSpecification]($presentation-common).

Returns nodes for instances which are returned by an ECSQL query.

## Attributes

| Name                            | Required? | Type                                                                                | Default     | Meaning                                                                                                                                   | Performance Notes |
| ------------------------------- | --------- | ----------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| *Filtering*                     |
| `queries`                       | No        | [`QuerySpecification[]`](#query-specifications)                                     | `[]`        | Specifications of queries used to create the content.                                                                                     |
| `hideNodesInHierarchy`          | No        | `boolean`                                                                           | `false`     | Hide instance nodes provided by this specification and directly show their children.                                                      | Expensive         |
| `hideIfNoChildren`              | No        | `boolean`                                                                           | `false`     | Hide nodes if they don't have children.                                                                                                   | Expensive         |
| `hideExpression`                | No        | [ECExpression](./ECExpressions.md#specification)                                    | `""`        | An ECExpression that indicates whether a node should be hidden or not.                                                                    | Expensive         |
| `suppressSimilarAncestorsCheck` | No        | `boolean`                                                                           | `false`     | Suppress similar ancestor nodes' checking when creating nodes based on this specification. [See more](./InfiniteHierarchiesPrevention.md) |
| *Ordering*                      |
| `priority`                      | No        | `number`                                                                            | `1000`      | Changes the order of specifications used to create nodes for specific branch.                                                             |
| `doNotSort`                     | No        | `boolean`                                                                           | `false`     | Suppress default sorting of nodes returned by this specification.                                                                         | Improves          |
| *Grouping*                      |
| `groupByClass`                  | No        | `boolean`                                                                           | `true`      | Group instances by ECClass                                                                                                                |
| `groupByLabel`                  | No        | `boolean`                                                                           | `true`      | Group instances by label                                                                                                                  | Expensive         |
| *Misc.*                         |
| `hasChildren`                   | No        | `"Always" \| "Never" \| "Unknown"`                                                  | `"Unknown"` | Tells the rules engine that nodes produced using this specification always or never have children.                                        | Improves          |
| `relatedInstances`              | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md) | `[]`        | Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used in nodes' creation.               |
| `nestedRules`                   | No        | [`ChildNodeRule[]`](./ChildNodeRule.md)                                             | `[]`        | Specifications of [nested child node rules](./Terminology.md#nested-rule).                                                                |

## Query Specifications

Query specifications define the actual results of the `CustomQueryInstanceNodes` specification. There are 2 types of supported query specifications: [string](#string)
and [ECProperty value](#ecpropertyvalue).

The queries used in the specifications **must** return `ECClassId` and `ECInstanceId` columns, e.g.:

```SQL
SELECT ECClassId, ECInstanceId
  FROM [bis].[Element] e
 WHERE e.ParentId = 10
```

> **Note:** sorting and grouping happens after results of multiple query specifications are
aggregated.

### String

The specification contains an ECSQL query which is used to query for instances.

#### Attributes

| Name    | Required? | Type                             | Meaning                                                     |
| ------- | --------- | -------------------------------- | ----------------------------------------------------------- |
| `class` | Yes       | `SingleSchemaClassSpecification` | Specification of ECClass whose instances the query returns. |
| `query` | Yes       | `string`                         | Specifies the search ECSQL query.                           |

### ECPropertyValue

The specification specifies the name of the parent node instance property whose
value is the ECSQL used to query for instances.

**Precondition:** can be used only if parent node is ECInstance node.
If there is no immediate parent instance node, the rules engine walks
up the hierarchy until it finds one. If that fails, this specification
has no effect.

#### Attributes

| Name                 | Required? | Type                             | Meaning                                                                                                                                                        |
| -------------------- | --------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`              | Yes       | `SingleSchemaClassSpecification` | Specification of ECClass whose instances the query returns.                                                                                                    |
| `parentPropertyName` | Yes       | `string`                         | Specifies name of the parent instance property whose value contains the ECSQL query. **Warning:** the property whose name is specified must be of string type. |

## Example

```JSON
{
  "specType": "CustomQueryInstanceNodes",
  "groupByClass": false,
  "groupByLabel": false,
  "queries": [{
    "specType": "String",
    "class": {"schemaName": "BisCore", "className": "Element"},
    "query": "SELECT ECClassId, ECInstanceId FROM [bis].[Element] e WHERE e.ParentId = 10"
  }, {
    "specType": "ECPropertyValue",
    "class": {"schemaName": "BisCore", "className": "GeometricElement3d"},
    "parentPropertyName": "ChildrenQuery"
  }]
}
```
