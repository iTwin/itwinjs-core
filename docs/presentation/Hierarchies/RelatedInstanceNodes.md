# Related Instance Nodes

> TypeScript type: [RelatedInstanceNodesSpecification]($presentation-common).

Produces ECInstance nodes that are related to some source ECInstance. The source instance is determined by traversing the hierarchy upwards until an ECInstance node is encountered.

## Attributes

| Name                                                                        | Required? | Type                                                                                  | Default     |
| --------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------- | ----------- |
| *Filtering*                                                                 |
| [`relationshipPaths`](#attribute-relationshippaths)                         | Yes       | [`RelationshipPathSpecification[]`](../Common-Rules/RelationshipPathSpecification.md) |             |
| [`instanceFilter`](#attribute-instancefilter)                               | No        | [ECExpression](./ECExpressions.md#instance-filter)                                    | `""`        |
| [`hideNodesInHierarchy`](#attribute-hidenodesinhierarchy)                   | No        | `boolean`                                                                             | `false`     |
| [`hideIfNoChildren`](#attribute-hideifnochildren)                           | No        | `boolean`                                                                             | `false`     |
| [`hideExpression`](#attribute-hideexpression)                               | No        | [ECExpression](./ECExpressions.md#specification)                                      | `""`        |
| [`suppressSimilarAncestorsCheck`](#attribute-suppresssimilarancestorscheck) | No        | `boolean`                                                                             | `false`     |
| *Ordering*                                                                  |
| [`priority`](#attribute-priority)                                           | No        | `number`                                                                              | `1000`      |
| [`doNotSort`](#attribute-donotsort)                                         | No        | `boolean`                                                                             | `false`     |
| *Grouping*                                                                  |
| [`groupByClass`](#attribute-groupbyclass)                                   | No        | `boolean`                                                                             | `true`      |
| [`groupByLabel`](#attribute-groupbylabel)                                   | No        | `boolean`                                                                             | `true`      |
| *Misc.*                                                                     |
| [`hasChildren`](#attribute-haschildren)                                     | No        | `"Always" \| "Never" \| "Unknown"`                                                    | `"Unknown"` |
| [`relatedInstances`](#attribute-relatedinstances)                           | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md)   | `[]`        |
| [`nestedRules`](#attribute-nestedrules)                                     | No        | [`ChildNodeRule[]`](./ChildNodeRule.md)                                               | `[]`        |

### Attribute: `relationshipPaths`

Specifies a chain of [relationship path specifications](../Common-Rules/RelationshipPathSpecification.md) that forms a path from a source instance to the output instances. When this array is empty, the specification produces no results.

```ts
[[include:Hierarchies.RelatedInstanceNodesSpecification.RelationshipPaths.Ruleset]]
```

![Example of using "relationship paths" attribute](./media/hierarchy-with-specification-relationshippaths-attribute.png)

### Attribute: `instanceFilter`

> **Default value:** `""`

Specifies an [ECExpression](./ECExpressions.md#instance-filter) for filtering instances of ECClasses targeted through the [`relationshipPaths` attribute](#attribute-relationshippaths).

```ts
[[include:Hierarchies.InstanceNodesOfSpecificClassesSpecification.InstanceFilter.Ruleset]]
```

![Example of using "instance filter" attribute](./media/hierarchy-with-specification-instancefilter-attribute.png)

### Attribute: `hideNodesInHierarchy`

> **Default value:** `false`

When `true`, instances nodes produced by this specification are omitted and their children appear one hierarchy level higher. **Note:** only instance nodes are hidden - grouping nodes are not affected by this attribute.

```ts
[[include:Hierarchies.Specification.HideNodesInHierarchy.Ruleset]]
```

| `hideNodesInHierarchy: false`                                                                                                                         | `hideNodesInHierarchy: true`                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "hide nodes in hierarchy" attribute set to "false"](./media/hierarchy-with-specification-hidenodesinhierarchy-attribute-false.png) | ![Example of using "hide nodes in hierarchy" attribute set to "true"](./media/hierarchy-with-specification-hidenodesinhierarchy-attribute-true.png) |

### Attribute: `hideIfNoChildren`

> **Default value:** `false`

Specifies whether nodes created through this specification should be hidden if they have no child nodes.

```ts
[[include:Hierarchies.Specification.HideIfNoChildren.Ruleset]]
```

| `hideIfNoChildren: false`                                                                                                                     | `hideIfNoChildren: true`                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "hide if no children" attribute set to "false"](./media/hierarchy-with-specification-hideifnochildren-attribute-false.png) | ![Example of using "hide if no children" attribute set to "true"](./media/hierarchy-with-specification-hideifnochildren-attribute-true.png) |

### Attribute: `hideExpression`

> **Default value:** `""`

When specified [ECExpression](./ECExpressions.md#specification) evaluates to `true`, nodes produced by this specification are omitted and their children appear one hierarchy level higher.

```ts
[[include:Hierarchies.Specification.HideExpression.Ruleset]]
```

| `hideExpression` evaluates to `false`                                                                                                          | `hideExpression` evaluates to `true`                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "hide expression" attribute evaluating to "false"](./media/hierarchy-with-specification-hideexpression-attribute-false.png) | ![Example of using "hide expression" attribute evaluating to "true"](./media/hierarchy-with-specification-hideexpression-attribute-true.png) |

### Attribute: `suppressSimilarAncestorsCheck`

> **Default value:** `false`

Specifies whether similar ancestor nodes' checking should be suppressed when creating nodes based on this specification. See more in [Infinite Hierarchies Prevention page](./InfiniteHierarchiesPrevention.md).

```ts
[[include:Hierarchies.Specification.SuppressSimilarAncestorsCheck.Ruleset]]
```

![Example of using "suppress similar ancestors check" attribute](./media/hierarchy-with-specification-suppresssimilarancestorscheck-attribute.png)

### Attribute: `priority`

> **Default value:** `1000`

Controls the order in which specifications are handled — specification with higher priority value is handled first. If priorities are equal, the specifications are handled in the order they appear in the ruleset.

```ts
[[include:Hierarchies.Specification.Priority.Ruleset]]
```

![Example of using "priority" attribute](./media/hierarchy-with-specification-priority-attribute.png)

### Attribute: `doNotSort`

> **Default value:** `false`

> **Performance note:** Setting the attribute may substantially improve performance when creating large numbers of nodes.

Suppress sorting of nodes returned by this specification. With this attribute set to `true`, the order of returned nodes is undefined.

```ts
[[include:Hierarchies.Specification.DoNotSort.Ruleset]]
```

![Example of using "do not sort" attribute](./media/hierarchy-with-specification-donotsort-attribute.png)

### Attribute: `groupByClass`

> **Default value:** `true`

Controls whether returned instances should be grouped by ECClass.

```ts
[[include:Hierarchies.Specification.GroupByClass.Ruleset]]
```

| `groupByClass: false`                                                                                                          | `groupByClass: true`                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "group by class" attribute set to "false"](./media/hierarchy-with-specification-groupbyclass-attribute.png) | ![Example of using "group by class" attribute set to "true"](./media/hierarchy-with-specification-groupbyclass-attribute-grouped.png) |

### Attribute: `groupByLabel`

> **Default value:** `true`

Controls whether returned instances should be grouped by label.

Label grouping node is created only if all of these conditions match:

- There are at least two nodes with the same label.
- There's at least one sibling node with a different label.

```ts
[[include:Hierarchies.Specification.GroupByLabel.Ruleset]]
```

| `groupByLabel: false`                                                                                                          | `groupByLabel: true`                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "group by label" attribute set to "false"](./media/hierarchy-with-specification-groupbylabel-attribute.png) | ![Example of using "group by label" attribute set to "true"](./media/hierarchy-with-specification-groupbylabel-attribute-grouped.png) |

### Attribute: `hasChildren`

> **Default value:** `"Unknown"`

> **Performance note:** Setting the attribute to `Always` or `Never` may substantially improve performance of creating nodes in cases when
> getting child nodes is expensive.

Generally, when a node is created, the rules engine has to determine whether it has children before returning it. This requires
evaluating child node rules and, usually, executing additional queries. This attribute allows telling the engine that nodes created
by this specification always or never have children.

In case when the attribute value "lies":

- When set to `Always`, the returned nodes always have `hasChildren` flag set to `true`. Requesting children for such nodes returns
empty list. It's up to the UI component to handle the case of parent node saying it has children but data source not returning any.

- When set to `Never`, the returned nodes always have `hasChildren` set to `false`. Requesting children for such nodes returns empty
list even if there are child node rules that define children for it.

```ts
[[include:Hierarchies.Specification.HasChildren.Ruleset]]
```

| `hasChildren: "Always"`                                                                                                             | `hasChildren: "Never"`                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "has children" attribute set to "always"](./media/hierarchy-with-specification-haschildren-attribute-always.png) | ![Example of using "has children" attribute set to "never"](./media/hierarchy-with-specification-haschildren-attribute-never.png) |

### Attribute: `relatedInstances`

> **Default value:** `[]`

Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used when creating the nodes. There
are several use cases when this is useful:

- When there's a need to only load instances that have a related instance. Providing a [related instance](../Common-Rules/RelatedInstanceSpecification.md)
  specification with [isRequired](../Common-Rules/RelatedInstanceSpecification.md) set to `true` filters-out the instances that don't have the related instance.

- When there's a need to filter instances by a related instance value. The [alias](../Common-Rules/RelatedInstanceSpecification.md) attribute may then be used
  in the [`instanceFilter` attribute](#attribute-instancefilter) to reference related instance property values.

- When there's a need to group by related instance property values. Related instance classes are included when looking for [grouping rules](./GroupingRule.md), which allows
  using related instance values for [property grouping](./GroupingRule.md#property-grouping).

- When there's a need to customize nodes based on related instance property values. Related instance classes are included when looking for [customization rules](../Customization/index.md),
  which allows referencing related instances and their properties in [customization rule ECExpressions](../Customization/ECExpressions.md#override-value) by their
  [alias](../Common-Rules/RelatedInstanceSpecification.md).

```ts
[[include:Hierarchies.Specification.RelatedInstances.Ruleset]]
```

![Example of using "related instances" attribute](./media/hierarchy-with-specification-relatedinstances-attribute.png)

### Attribute: `nestedRules`

> **Default value:** `[]`

Specifications of [nested child node rules](./Terminology.md#nested-rule) that allow creating child nodes without the need of supplying a condition to
match the parent node.

This is useful when the same instance node at different hierarchy levels needs to have different child nodes. Specifying a [child node rule](./ChildNodeRule.md)
at the root level with condition to match the instance ECClass makes the rule create children for all nodes of that ECClass. When that's not desired, different
[child node rules](./ChildNodeRule.md) may be specified as nested rules for specifications that return instance nodes of the same ECClass - that makes them have
different children.

```ts
[[include:Hierarchies.Specification.NestedRules.Ruleset]]
```

![Example of using "nested rules" attribute](./media/hierarchy-with-specification-nestedrules-attribute.png)
