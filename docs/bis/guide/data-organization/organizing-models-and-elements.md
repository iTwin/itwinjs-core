# Organizing Models and Elements

[Information Hierarchy](./information-hierarchy.md) explains the mechanics of how `Element`s can be organized into various kinds of hierarchies, which can be used together to model [Entities](../references/glossary.md#Entity) in the real-world from various [Modeling Perspectives](./modeling-perspectives.md) and at various [Modeling Granularities](../references/glossary.md#Granularity).

[Top of the World](./top-of-the-world.md) explains how and why Elements are structured within the [RepositoryModel](../references/glossary.md#RepositoryModel) to describe what the [BIS Repository](../references/glossary.md#Bis-Repository) is “about”. The ‘leaf nodes’ in the `RepositoryModel` are [InformationPartitionElements](../references/glossary.md#InformationPartitionElement) (henceforth “partitions”) that establish a [Modeling Perspective](./modeling-perspectives.md) for a given [Subject](../references/glossary.md#Subject).

This topic reviews those fundamentals and provides guidance to [Domain](../references/glossary.md#Domain) authors and client developers on how and why Models and Elements are organized under partitions. Before diving into detailed explanations, we summarize the rules reviewed or established in this topic.

## A Summary of Principles and Rules for Modeling with BIS

These principles and rules govern how `Model`s and `Element`s are organized to model real-world [Objects](../references/glossary.md#Object).

- BIS conceives that a real-world Object consists of multiple [Entities](../references/glossary.md#Entity), each from a different [Modeling Perspective.](./modeling-perspectives.md)
- An `Element` models an [Entity](../references/glossary.md#Entity).
- An `Element` can only be placed in a `Model` of compatible [Modeling Perspective](./modeling-perspectives.md).
- A sub-Model of an `Element` models the same [Entity](../references/glossary.md#Entity) as the `Element`, but at a finer granularity.
- `Model`s can only sub-model `Element`s of a compatible [Modeling Perspective](./modeling-perspectives.md).
- A parent `Element` identifies an [Entity](../references/glossary.md#Entity) and may model a part of it, but it together with its child `Element`s model the [Entity](../references/glossary.md#Entity).
- Parent `Element`s and Child `Element`s must be in the same `Model`.
- A single party should be responsible for all `Element`s in a given `Model`.
- A single party can be responsible for multiple `Model`s.
- Modeling the physical perspective:
  - Use [Spatial Composition](./spatial-composition.md) rules and patterns in order to model `Element`s that spatially organize other `Element`s into a spatial-breakdown hierarchy.
  - Organize `PhysicalModel`s and `PhysicalElement`s primarily around the implementations of physical systems (that implement functions). These will tend to align with responsibility boundaries.
  - Where a physical Entity is part of multiple physical systems, it should be modeled by a `PhysicalElement` in a `Model` owned by the primary responsible party. All parties can “share” the `PhysicalElement` using `PhysicalSystemGroupsMembers` relationships.
- Within the constraints above, the domain author can impose additional organization for domain-specific reasons.
- Domain authors should give users flexibility to further-partition for arbitrary reasons, so what could logically be modeled in a single `Model` could be partitioned into two, via a sibling `Subject`.
- Software should not be too “rigid” in its expectations of how `Element`s are organized in to `Model`s, especially in the physical perspective. Functional and analytical `Model`s can be more rigid, because they are highly-specialized.

## Considerations while Modeling a Domain

As a domain author, you are faced with many options for modeling your domain, which are described below.

### Multiple domain contexts

There will be distinct Digital Twins for design phases like Design, Construction, and Operations, and for major categories of infrastructure like Cities or Buildings or other facilities. There should be as much commonality among these as possible, but the domain author must have an awareness of the kinds of Digital Twins and the range of workflows where their domain is relevant. The modeling decisions discussed below occur in the context of those Digital Twins and workflows.

Domain authors should study examples of other domain schemas to see how others have addressed modeling challenges.

### The many considerations

The domain author has a tough job. They must consider:

- **Object boundaries**: Consider the real-world and conceptually carve it up into [Objects](../references/glossary.md#Object)
- **Entity boundaries**: Carve those Objects up into [Entities](../references/glossary.md#Entity).
- **Whole-part relationships**: Consider the whole-part relationships among the [Entities](../references/glossary.md#Entity) (and how to model them.)
- **Other Relationships**: Consider other relationships among [Entities](../references/glossary.md#Entity) (and how to model them).
- **Attributes**: Consider the attributes of the [Entities](../references/glossary.md#Entity) (and how to model them).

The “Object boundaries” consideration is business-as-usual for data modelers and will not be covered here.

The “Entity boundaries” consideration is covered in discussions of [Modeling Perspectives](./modeling-perspectives.md).

The remaining considerations will be covered in the following sections.

## Whole-Part Relationships

Each Entity will be modeled with an `Element`. Does the [Entity](../references/glossary.md#Entity) have “parts” that are worth modeling individually in the given context? The answer to that question will lead to one of three choices:

- **“Atomic” Element**: There are no “parts” to model. Atomic `Element`s can still model significant internal structure using the GeometryStream, Properties, and `ElementAspect`s.
- **Parent-Child Modeling**: The whole Entity is modeled as “parts” consisting of a parent `Element` and its child `Element`s. The “sum” of the parent and child `Element`s models the whole Entity. These `Element`s implement `IParentElement`. See [Parent-Child Relationships](../fundamentals/element-fundamentals.md#Parent-Child-Relationships).
- **Spatial-Composition**: The whole Entity corresponds to an `Element` that spatially organizes other `Elements`. The whole Entity needs to be decomposed into a hierarchy of major volumetric parts, which ultimately organize `PhysicalElement`s and `SpatialLocationElement`s. See [Spatial Composition](./spatial-composition.md).
- **Sub-modeling**: The “parts” are modeled in a sub-`Model` of this `Element`. The sub-modeled `Element` represents the whole Entity. The “sum” of all `Element`s in the sub-`Model` of the `Element` also represents the whole Entity, but at a finer granularity. These `Element`s implement `ISubModeledElement`.

In the picture below, Entity 0 is the volume occupied by a [Spatial Organizer](../../domains/SpatialComposition.ecschema.md#ispatialorganizer), such as an *Infrastructure Facility*, so it is modeled according to the rules and patterns of the [Spatial Composition](./spatial-composition.md) schema. Thus, `Element` F-0 represents the Whole [Entity](../references/glossary.md#Entity) 0, which *aggregates* three major *FacilityParts*, [Entities](../references/glossary.md#Entity) 1, 2 and 3, modeled by `Elements` FP-1, FP-2 and FP3, which spatially breaks it down. Furthermore, [Entities](../references/glossary.md#Entity) 4 and 5 are *spatially organized* by [Entity](../references/glossary.md#Entity) FP-3, and modeled by `Elements` P-4 and P-5.

![Whole-Part Mapping](../media/organizing-models-and-elements-01.png)

In a different case, depicted by the picture below, Entity 0 is modeled with an `ISubModeledElement`, so `Element` P-0 represents the whole [Entity](../references/glossary.md#Entity) 0, and its sub-`Model` also represents the whole [Entity](../references/glossary.md#Entity) 0, at a different granularity. [Entity](../references/glossary.md#Entity) 4 is modeled as an `IParentElement`, so `Element`s P-4, P-5, and P-6 collectively represent [Entity](../references/glossary.md#Entity) 4 and its parts.

![Whole-Part Mapping](../media/organizing-models-and-elements-02.webp)

Use these questions to determine whether to use parent-child modeling, sub-modeling or spatial composition:

![Whole-Part Mapping Flowchart](../media/organizing-models-and-elements-03.png)

That last question needs elaboration. What are typical reasons why users need to both model the [Entity](../references/glossary.md#Entity) as-a-whole and also model it as a collection of fine-grained parts? Reasons include:

- According to the [SRPP](./srpp.md), if one party determines that X should exist in a particular place, but delegates responsibility for modeling X in detail to a second party, the delegate would need to do their work in their own `Model`.
- If some workflows want to deal with the Entity-as-a-whole, but other workflows (e.g. fabrication for construction) need to deal with it as a set of parts, the fabricator would want a `Model` focused on the parts used to fabricate the whole.

As a boundary case, if one of the parts is clearly a “lead” part, e.g. a “Beam” with specific additions (welded on) or subtractions (cut out) then maybe parent-child is more appropriate. The decision to use parent-child modeling vs sub-modeling can be quite tricky. You should examine schemas from comparable domains and consult experts, if possible.

---
| Next: [Modeling Systems](./modeling-systems.md)
|:---
