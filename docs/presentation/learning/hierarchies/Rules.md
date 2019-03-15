# Hierarchies-related Rules

There are 2 primary concepts for creating hierarchies: rules and specifications.

## Rules

Define *where* and *if* specific branch should be created in the hierarchy. There are 2 types of rules:
- [RootNodeRule](./rules/RootNodeRule.md)
- [ChildNodeRule](./rules/ChildNodeRule.md)

## Specifications

Define *contents* for each branch. There are 6 types of specifications:
- [AllInstanceNodes](./specifications/AllInstanceNodes.md)
- [AllRelatedInstanceNodes](./specifications/AllRelatedInstanceNodes.md)
- [RelatedInstanceNodes](./specifications/RelatedInstanceNodes.md)
- [InstanceNodesOfSpecificClasses](./specifications/InstanceNodesOfSpecificClasses.md)
- [CustomQueryInstanceNodes](./specifications/CustomQueryInstanceNodes.md)
- [CustomNode](./specifications/CustomNode.md)

Multiple specifications can contribute to the same branch by specifying multiple
specifications in a single rule or specifying multiple rules that match the same
parent node.

**Note:**  grouping and sorting is done at specification level which
means nodes generated from different specifications do not get grouped and sorted together.

## Grouping

There's an additional hierarchy-related rule used for advanced grouping:
- [GroupingRule](./rules/GroupingRule.md)
