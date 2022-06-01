# Modeling Systems

Physical infrastructure exists to implement one-or-more functions. A campus functions to provide learning to people. A building shelters people for work and play. A lock assembly helps provide security for a space. A landscape system may primarily function to provide pleasing aesthetics. Some functions are modeled explicitly (see [Functional Models and Elements](../other-perspectives/functional-models-and-elements.md)), but even if they are not modeled, the real-world functions are the reason that the physical infrastructure exists.

> A “physical system” is a set of physical objects that collectively implement a function.

The objects may or may not be physically connected. A given object may play a role in multiple systems, such as a pump that has a role in a plumbing system, and electrical system, a safety system, a noise abatement system, etc.  Because this notion of a system is not inherent in physical objects or their organization, but is defined by a modeler's perception of the purposes for the arrangement of the physical objects, BIS models physical systems as "information elements" that logically group `PhysicalElement`s according to their functional purpose.

The `PhysicalSystem` Element is thus not a subclass of `bis:PhysicalElement`, but subclasses `bis:GroupInformationElement`. You can think of it as "information about the physical system" rather than directly modeling the physical objects of the physical system themselves. `PhysicalSystem` thus supports a secondary organization of `PhysicalElements` similar to that of [SpatialComposition](spatial-composition.md).

The `bis:PhysicalSystemGroupsMembers` relationship is used to indicate which elements are part of a given system. It allows a single `PhysicalElement` to be part of multiple `PhysicalSystems`.

We anticipate that it will be common for Models to be organized along natural systems boundaries. If the `PhysicalSystemGroupsMembers` relationship points to a sub-modeled Element, the Elements of its sub-Model are all considered part of the system.

> The BIS Working Group is considering ways for a `PhysicalSystem` to indicate that a `PhysicalPartition` (and all of the Elements in its sub-Model) are part of a physical system.

## Systems tend to align with responsibilities

Organizing `PhysicalModel`s by physical systems aligns with the [SRPP](./srpp.md), because responsibilities are typically assigned per system.

For example, the architect is responsible for the architectural *Systems* of the building. Those *Systems* partition and shelter spaces in useful ways. The architect will use one or more *Systems* with sub-Models containing the detailed walls, windows, and doors that make up a portion of an architectural System.

The structural engineer is responsible for structural members of the structural *System* that holds up the building. The structural engineer will use one or more *Systems* with sub-Models containing the beams, columns, and load-bearing walls that make up the structural *System*.

Since load-bearing walls (the responsibility of the structural engineer) are often part of the architecture *System*, the `PhysicalSystemGroupsMembers` relationship can be used to “group” them into the architecture *System*.

In different contexts (like different lifecycle phases), responsibilities will change, and domain schemas should have enough flexibility to handle those cases. During design, the architect and structural engineer have legal responsibilities for the system they design. During operations, the architecture and structure are both the responsibility of the facilities manager. Theoretically the architectural and structural Models could be merged into one when transforming a Design Digital Twin into an Operations Digital Twin. In practice, that may be uncommon, because the segregation of the `Model`s is not a real problem for the facilities manager, and keeping them segregated will make it easier to kick off a new renovation capital project. In any case, **software should not be too “rigid” in its expectations of how `Element`s are organized into `Model`s**.

---
| Next: [Organizing Definition Elements](./organizing-definition-elements.md)
|:---
