# Physical Models and Elements

<!-- Responsible for this page: ?????? -->

## Introduction

`PhysicalModels` and `PhysicalElements` are used to model the physical world, as it exists currently, as it existed in the past, or as it is expected to exist in the future.

Any object in the real world is modeled as a PhysicalElement a maximum of once within a BIS repository. The various disciplines that work together on infrastructure can *not* each have their own PhysicalElement for the same real-world object. Modeling the physical world is a cooperative, coordinated effort.

In BIS, the following classes are central in modeling the physical world:

- PhysicalElement
- PhysicalType
- PhysicalModel

## PhysicalElements

`PhysicalElement`s are use to model real world physical entities. PhysicalElements always have a position in real world coordinates that is relevant for infrastructure construction, operation or maintenance.

It is usually easy to determine which objects should be modeled by a PhysicalElement. If the answers to the following three questions are "yes", then the object is a good candidate for modeling with a PhysicalElement:

1. Does the object have mass?
2. Can the object be touched?
3. Are the spatial and location characteristics of the object important in constructing, operating or maintaining infrastructure?

For example, a paper contract has mass and can be touched, but its spatial and location characteristics are not important for infrastructure purposes, so it should *not* be modeled with a PhysicalElement.

Examples of entities that are modeled with PhysicalElements are:

- Pumps
- Roads
- Sewer Lines
- Cranes (when true shape and position is used in construction planning)

Examples of entities that are NOT modeled with PhysicalElements are:

- Property Lines
- Groundwater Elevations
- Construction Superintendents
- Cranes (when used only for resource planning)

See [Element Fundamentals](./element-fundamentals.md) for more information on Elements.

## PhysicalType

When many PhysicalElements are conceptually identical (such as pumps of the same model) except for a few details (such as location), PhysicalTypes are often used to provide simpler and more efficient modeling.

PhysicalTypes are often used when a particular PhysicalElement can be ordered from a catalog.
PhysicalTypes can provide geometry and properties to the PhysicalElements to which they are related.
Each PhysicalElement can be related to a maximum of one PhysicalType.

## PhysicalModels

Each PhysicalElement is contained in exactly one PhysicalModel. A PhysicalModel is a container of PhysicalElements (and potentially related Elements of other classes) that together model some real-world physical entity. For example, a PhysicalModel might model a campus, a building, a sewer system or a pipe rack.

See [Model Fundamentals](./model-fundamentals.md) for more information on Models.

## Physical Breakdown

Some PhysicalElements have associated "breakdown" PhysicalModels that model the same real world physical entity in finer granularity. For example, a SewerSystem PhysicalElement might be broken down into a SewerSystemModel that contains Pipe PhysicalElements that model the individual pipes in the sewer system.

See  [Element Fundamentals](./element-fundamentals.md) for more information on Model breakdown concepts.

### Top of the World - PhysicalPartition

At the top of the PhysicalElement-PhysicalModel tree is a PhysicalPartition Element in the RepositoryModel. The PhysicalPartition Element is a child of a Subject Element and starts the modeling of that Subject from a physical perspective.

## Aggregate PhysicalElements

As an alternate modeling technique PhysicalElement can have child Elements instead of breakdown Models. Elements with child Elements are essentially aggregates. For example, a SteelConnection might be an aggregate of Bolts, Plates and Welds.

See  [Element Fundamentals](./element-fundamentals.md) for more information on aggregates and child Elements.

## Physical Backbone

As discussed in [Modeling with BIS](./modeling-with-bis.md), there are many entities (physical, functional, analytical, etc.) for each real-world object that can be modeled in a BIS repository. There is a need to coordinate the Elements that model these entities. The strategy of BIS is to relate each of these Elements with the PhysicalElement that models the real world object. The hierarchy of PhysicalElements and PhysicalElements provides the "backbone" to which Elements representing the other modeling perspectives related.

<!-- Future work:
1. Explain Physical breakdowns strategy (Site, Facility, System, etc.)...after we lock it down.
2. Provide example hierarchies
3. Redo outline. Likely strategy:
    ## Introduction
    ## PhysicalElements, PhysicalTypes and PhysicalModels
    ## Physical Backbone
    ## Physical Model Hierarchy
4. Supplement with more figures.
-->

> Next: [Functional Models and Elements](./functional-models-and-elements.md)