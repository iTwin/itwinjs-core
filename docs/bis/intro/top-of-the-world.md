# Top of the World

<!-- Responsible for this page: ??? -->

BIS repositories have a strict hierarchical organization. This page describes the top of that hierarchy and how it functions as a *table of contents* for the repository as a whole.  This *table of contents* consists of:

* `RepositoryModel`
* `Subject`s
* `InformationPartitionElement`s

<!-- TODO
The following figure shows a simple example of a the top of the hierarchy.
TODO: add figure
-->

## RepositoryModel

Every BIS repository has exactly one `RepositoryModel` that defines the top of the hierarchy. `Element`s can be inserted into or updated within the `RepositoryModel`, but the `RepositoryModel` itself cannot be deleted.

*The RepositoryModel is the only Model in a BIS repository that does not have a `ModelModelsElement` relationship and an "owning" `Element`*

## Subjects

`Subject`s are `Element`s that are used to identify things that the repository is *about*. The `Subject` class cannot be specialized (subclassed). The most important capabilities of `Subject` are:

* It can have a UserLabel (inherited from Element)
* It can have a Description
* It can have child `Subject`s
* It can have child `InformationPartitionElement`s

`Subject`s only exist in the `RepositoryModel`.

Every BIS repository has exactly one *root* `Subject` that describes what the repository as a whole is about.

* The root `Subject` - like all `Subject`s - is contained by the `RepositoryModel`.
* The root `Subject` has no parent element as it is the top of the `Subject` hierarchy.
* The root `Subject` can be updated, but it cannot be deleted.

Child `Subject`s (optional) can be introduced to further organize the contents of the repository.

* Child `Subject`s - like all `Subject`s - are contained by the `RepositoryModel`.
* Child `Subject`s  have another `Subject` as a parent.

## InformationPartitionElements

As discussed in [Modeling Perspectives](./modeling-perspectives.md) `Subject`s can be viewed and modeled from multiple modeling perspectives (physical, functional, analytical, etc.). `InformationPartitionElement`s are used to "partition" a `Subject` into different modeling perspectives.

When it is determined that a `Subject` is to be modeled from a particular modeling perspective, an `InformationPartitionElement` of the appropriate modeling perspective is added as a child of the `Subject`. That InformationPartitionElement is the start of a Model hierarchy representing the modeling perspective. The `InformationPartitionElement` is immediately broken down into a `Model` of the same modeling perspective.

It is possible for a `Subject` to have multiple `InformationPartitionElement`s of the same modeling perspective. An example of this would be having two `StructuralAnalyticalPartition`s for a building (the `Subject`) that has an isolation joint that divides the building into two separate structures.

`InformationPartitionElement`s always have a parent `Subject` and are never used outside of the `RepositoryModel`.

<!-- the following is commented out for now. Most of the content exists or belongs in the modeling-perspectives chapter...but after all the details of that chapter are figured out, we should revisit what goes here -->

<!--
### PhysicalPartitions

The top of a physical hierarchy starts with a `PhysicalModel` that models a `PhysicalPartition`.
It continues when another PhysicalModel breaks down a `PhysicalElement`.
For example, a plant physical layout model can break down a PhysicalElement that represents the overall plant.

See [Physical Models and Elements](./physical-models-and-elements.md) for details of physical modeling.

### FunctionalPartitions
TODO: write text
See [Functional Models and Elements](./functional-models-and-elements.md) for details of physical modeling.

### AnalysisPartitions
TODO: write text
See [Analysis Models and Elements](./functional-models-and-elements.md) for details of physical modeling.

### DefinitionPartition

The top of a definition hierarchy starts with a `DefinitionModel` that models a `DefinitionPartition`.
This allows `DefinitionElements` to be organized by how they relate to the parent `Subject` of the `DefinitionPartition`.
The can be multiple `DefinitionPartition` Elements and corresponding `DefinitionModel` Models so that definitions (instances of `DefinitionElement`) can be organized by source, discipline, or other criteria.
Each `DefinitionPartition` is identified by its [Code](./glossary.md#code).

### DocumentPartition

The top of a document hierarchy starts with a `DocumentListModel` that models a `DocumentPartition`.
This allows `Document` elements to be organized by how they relate to the parent `Subject` of the `DocumentPartition`.
`Drawing` and `Sheet` are 2 example subclasses of `Document`.
`Drawings` and `Sheets` are further broken down by `DrawingModels` and `SheetModels` which graphically break down the content of the drawing or sheet.

-->
---
| Next: [Single Responsible Party Principle](./srpp.md)
|:---
