# Hierarchies-related terminology

## Nested rule

Nested rules are defined as child elements of rule specification(s).

They are evaluated and executed only when user expands nodes provided by parent
specification. This allows to have isolated/non-global rules at specific level
of the hierarchy.

## Node

A _node_ is the core piece of all hierarchies, it may have 0 or 1 parent node and 0 or more child nodes. All nodes created
by the Presentation library can be grouped into several categories:

- _ECInstance node_ is a node that represents one or more ECInstances.
- _Class grouping node_ is a node that represents one or more ECInstance nodes grouped by ECClass.
- _Property grouping node_ is a node that represents one or more ECInstance nodes grouped by ECProperty.
- _Label grouping node_ is a node that represents multiple ECInstance nodes grouped by label.
- _Custom node_ is a dynamically created node that doesn't represent anything from the iModel.
