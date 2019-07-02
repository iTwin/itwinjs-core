# Modeling Systems

Physical infrastructure exists to implement one-or-more functions. A campus functions to provide learning to people. A building shelters people for work and play. A lock assembly helps provide security for a space. A landscape system may primarily function to provide pleasing aesthetics. Some functions are modeled explicitly (see [Functional Models and Elements](./functional-models-and-elements.md)), but even if they are not modeled, the real-world functions are the reason that the physical infrastructure exists.

A “physical system” is a physical Entity (or a set of physical Entities) that implements a function. In this topic, *“System”* refers to a `PhysicalElement` that models a physical Entity that implements a function. *Systems* do not necessarily have “system” in their name, e.g. by this definition a “Facility” is a *System* implementing a high-level function and an “Assembly” is a *System* implementing a smaller function.

For a *System* that is sub-modeled, the sub-Model should only contain `PhysicalElement`s that are part of that *System* and that are “owned” by the party responsible for the *System*, satisfying the [SRPP](./srpp.md). A *System* may be split into multiple `Model`s for responsibility or other reasons. `PhysicalElement`s that are part of more than one *System* reside in the `Model` of the *System* that “owns” them and can be “included” in other *Systems* using the `PhysicalElementIncludesPhysicalElement` relationship—allowing a single `PhysicalElement` to be shared by multiple *Systems*.

## Systems tend to align with responsibilities

Organizing `PhysicalModel`s by physical systems aligns with the [SRPP](./srpp.md), because responsibilities are typically assigned per system.

For example, the architect is responsible for the architectural *Systems* of the building. Those *Systems* partition and shelter spaces in useful ways. The architect will use one or more *Systems* with sub-Models containing the detailed walls, windows, and doors that make up a portion of an architectural System.

The structural engineer is responsible for structural members of the structural *System* that holds up the building. The structural engineer will use one or more *Systems* with sub-Models containing the beams, columns, and load-bearing walls that make up the structural *System*.

Since load-bearing walls (the responsibility of the structural engineer) are often part of the architecture *System*, the `PhysicalElementIncludesPhysicalElement` relationship can be used to “include” them in the architecture *System*.

In different contexts (like different lifecycle phases), responsibilities will change, and domain schemas should have enough flexibility to handle those cases. During design, the architect and structural engineer have legal responsibilities for the system they design. During operations, the architecture and structure are both the responsibility of the facilities manager. Theoretically the architectural and structural Models could be merged into one when transforming a Design Digital Twin into an Operations Digital Twin. In practice, that may be uncommon, because the segregation of the `Model`s is not a real problem for the facilities manager, and keeping them segregated will make it easier to kick off a new renovation capital project. In any case, **software should not be too “rigid” in its expectations of how `Element`s are organized into `Model`s**.

See [Overlapping Systems](./overlapping-systems.md) for guidance on dealing with `PhysicalElement`s that are part of two physical systems.

> Next: [Overlapping Systems](./overlapping-systems.md)
