# Spatial Composition

## Introduction

BIS's [SpatialComposition Domain Schema](../../domains/spatialcomposition.ecschema.md/) allows an iModel author to cleanly express the spatial structure of a site/facility and use that structure to organize `PhysicalElement`s and `SpatialLocationElement`s regardless of how they are organized into separate Models.

As many levels of composition as necessary can be used when modeling the spatial structure of an infrastructure asset. `SpatialCompositon` defines base `SpatialStructureElement` classes for `Region`, `Site`, `Facility`, `FacilityPart`, and `Space` that are used to express the primary spatial structure of an infrastructure asset.  Discipline-specific domains supply more-specialized semantics through subclasses of these base classes. Instances of these classes are organized into a hierarchy using an "Aggregates" relationship.

 The following table shows a sample infrastructure asset that involves a building, a road, and a bridge at a Bus Terminal. The table lists a name for the real-world Entity along with the discipline-specific class that it maps to (with its `SpatialComposition` base class in parenthesis).

| Entity | Discipline-specific class label (`SpatialComposition` class) |
| ----------- | -----------|
| Bus Terminal | Site (`Site`) |
| -- Bus Terminal Building | Building (`Facility`) |
| ---- First floor | Story (`FacilityPart`) |
| ------ Restroom 1 | Space (`Space`) |
| -- Access Road | Road (`Facility`) |
| ---- Southbound Roadway | Roadway (`FacilityPart`) |
| ------ Travel Lane | Traffic Lane (`FacilityPart`) |
| ---- Median | Central Reserve (`FacilityPart`) |
| ---- Northbound Roadway | Roadway (`FacilityPart`) |
| -- Ramp | Bridge (`Facility`) |
| ---- Superstructure | Bridge Superstructure (`FacilityPart`) |
| ------ Deck | Bridge Deck (`FacilityPart`) |
| ---- Substructure | Bridge Substructure (`FacilityPart`) |
| ------ Pier | Bridge Pier (`FacilityPart`) |

`SpatialComposition` also defines a `Zone` which can be used to express some alternate spatial-based grouping.

## Using the Spatial Structure to organize other Elements

Once the spatial structure is modeled, its elements can be used to organize any `bis:SpatialElement` (the base class for both `bis:PhysicalElement` and `bis:SpatialLocationElement`) using "Holds" and "References" relationships. "Holds" implies that the related element (or some significant part of it, like the base of an elevator shaft) is contained in the `SpatialStructureElement` or `Zone`. "References" implies some weaker relationship (e.g. the elevator shaft passes through the space). See the ["Element Organized by Spatial Organizer"](./information-hierarchy.md#element-organized-by-spatial-organizer) section of the ["Information Hierarchy"](information-hierarchy.md) article.

The following table shows `bis:SpatialElement`s that could be associated to the Bus Terminal example presented earlier.

| Entity | Spatial Structure Element | Physical/Spatial Elements | Relationship |
| ----------- | --- | ----------- | ------------ |
| Bus Terminal | Site | Holds | Road Alignments |
| -- Bus Terminal Building | Building | Holds | Grids |
| ---- First floor | Story |  Holds |Columns, Beams, Walls, Doors |
| ------ Restroom 1 | Space | Holds | Sinks, Toilets |
| -- Access Road | Road |  |
| ---- Southbound Roadway | Roadway | Holds | Pavement courses |
| ------ Travel Lane | Traffic Lane | References | Lane Markings  |
| ---- Median | Central Reserve | Holds | Barriers |
| ---- Northbound Roadway | Roadway | Holds | Pavement courses |
| -- Ramp |  Bridge |  | |
| ---- Superstructure | Bridge Superstructure | Holds | Beams |
| ------ Deck | Bridge Deck | Holds | Slab, Guard-rails |
| ---- Substructure | Bridge Substructure |  | |
| ------ Pier | Bridge Pier | Holds | Columns, Footings, Caps |

As seen in the example above, real-world infrastructure entities can be modeled using multiple parallel organizational structures, including the spatial composition hierarchy, spatial zones, physical assemblies, and partitioning of elements into models. Each modeling technique independently expresses a different aspect of meaning, enabling flexibility for schema designers and end-users.

---
| Next: [Modeling Systems](./modeling-systems.md)
|:---
