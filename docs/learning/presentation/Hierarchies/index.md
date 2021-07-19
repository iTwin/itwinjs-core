# Hierarchies

There are 2 primary concepts for creating hierarchies: rules and specifications.

## Rules

Define *where* and *if* specific branch should be created in the hierarchy. There are 2 types of rules:

- [RootNodeRule](./RootNodeRule.md)
- [ChildNodeRule](./ChildNodeRule.md)

## Specifications

Define *contents* for each branch. There are 6 types of specifications:

- [RelatedInstanceNodes](./RelatedInstanceNodes.md)
- [InstanceNodesOfSpecificClasses](./InstanceNodesOfSpecificClasses.md)
- [CustomQueryInstanceNodes](./CustomQueryInstanceNodes.md)
- [CustomNode](./CustomNode.md)

Multiple specifications can contribute to the same branch by specifying multiple
specifications in a single rule or specifying multiple rules that match the same
parent node.

**Note:**  grouping and sorting is done at specification level which
means nodes generated from different specifications do not get grouped and sorted together.

## Hierarchy Customization

All [general use customization rules](../Customization/index.md#rules) can be applied to hierarchies. In addition, there
are some hierarchy-specific customization rules:

- [GroupingRule](./GroupingRule.md) for advanced grouping
- [NodeArtifactsRule](./NodeArtifactsRule.md) to help create hierarchies for specific cases

## Related Topics

- [Infinite hierarchies prevention](./InfiniteHierarchiesPrevention.md)
- [ECExpressions](./ECExpressions.md)
- [Terminology](./Terminology.md)
