# Spatial Composition

## Introduction

Infrastructure assets are typically decomposed spatially when they are modelled physically. The spatial structure of an infrastructure asset might define as many levels of decomposition as necessary for a project. The following tree shows a sample project that involves a building, a road and a bridge at a Bus Terminal.

| Project Facilities | Spatial Decomposition |
| ----------- | -----------|
| Bus Terminal | Site |
| -- Bus Terminal Building | Building (Facility) |
| ---- First floor | Story (Facility Part) |
| ------ Restroom 1 | Space (Facility Part) |
| -- Access Road | Road (Facility) |
| ---- Southbound Roadway | Roadway (Facility Part) |
| ------ Travel Lane | Traffic Lane (Facility Part) |
| ---- Median | Central Reserve (Facility Part) |
| ---- Northbound Roadway | Roadway (Facility Part) |
| -- Ramp | Bridge (Facility) |
| ---- Superstructure | Bridge Superstructure (Facility Part) |
| ------ Deck | Bridge Deck (Facility Part) |
| ---- Substructure | Bridge Substructure (Facility Part) |
| ------ Pier | Bridge Pier (Facility Part) |

This approach is offered in BIS via the [SpatialComposition](../../domains/spatialcomposition.ecschema/) schema. This data organization scheme presents a Facility-centric hierarchy of an iModel.

## Semantics

The `SpatialComposition` organization captures important semantics of a facility and its parts. All related Physical or SpatialLocation elements are then associated to a concept captured by the resulting hierarchy, at the appropriate level, with the corresponding semantics.

The following table shows the Physical and SpatialLocation elements that could be associated to the Bus Terminal example presented earlier.

| Project Facilities | Associated elements | Spatial Relationship |
| ----------- | ----------- | ------------ |
| Bus Terminal | Road Alignments | Contains (Holds) |
| -- Bus Terminal Building | Grids | Contains (Holds) |
| ---- First floor | Columns, Beams, Walls, Doors |  Contains (Holds) |
| ------ Restroom 1 | Sinks, Toilets | Contains (Holds) |
| -- Access Road |  |  |
| ---- Southbound Roadway | Pavement courses | Contains (Holds) |
| ------ Travel Lane | Lane Markings  | References |
| ---- Median | Barriers | Contains (Holds) |
| ---- Northbound Roadway | Pavement courses | Contains (Holds) |
| -- Ramp |  |  |
| ---- Superstructure | Beams | Contains (Holds) |
| ------ Deck | Slab, Guard-rails | Contains (Holds) |
| ---- Substructure |  |  |
| ------ Pier | Columns, Footings, Caps | Contains (Holds) |

As it can be seen in the example above, the semantics of an overall Infrastructure Project can be modeled via parallel hierarchies, such as the Spatial decomposition of facilities, physical assemblies as well as elements contained in models. This approach of distributing semantical responsabilities among multiple parallel hierarchies enables great flexibility to both schema designers as well as end-users in general.

See the documentation of the [SpatialComposition](../../domains/spatialcomposition.ecschema/) BIS schema for more information.

---
| Next: [Modeling Systems](./modeling-systems.md)
|:---
