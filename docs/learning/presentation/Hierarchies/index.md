# Hierarchies
There are 2 primary concepts for creating hierarchies: rules and specifications.

## Rules

Define *where* and *if* specific branch should be created in the hierarchy. There are 2 types of rules:
- [RootNodeRule](./RootNodeRule.md)
- [ChildNodeRule](./ChildNodeRule.md)

## Specifications

Define *contents* for each branch. There are 6 types of specifications:
- [AllInstanceNodes](./AllInstanceNodes.md)
- [AllRelatedInstanceNodes](./AllRelatedInstanceNodes.md)
- [RelatedInstanceNodes](./RelatedInstanceNodes.md)
- [InstanceNodesOfSpecificClasses](./InstanceNodesOfSpecificClasses.md)
- [CustomQueryInstanceNodes](./CustomQueryInstanceNodes.md)
- [CustomNode](./CustomNode.md)

Multiple specifications can contribute to the same branch by specifying multiple
specifications in a single rule or specifying multiple rules that match the same
parent node.

**Note:**  grouping and sorting is done at specification level which
means nodes generated from different specifications do not get grouped and sorted together.

## Grouping

There's an additional hierarchy-related rule used for advanced grouping:
- [GroupingRule](./GroupingRule.md)

## Expressions
- [ECExpressions](./ECExpressions.md)

## Terminology
- [Terminology](./Terminology.md)
