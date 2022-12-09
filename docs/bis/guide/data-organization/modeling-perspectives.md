# Modeling Perspectives

<!-- Responsible for this page: ??? -->

As discussed in [Modeling with BIS](../intro/modeling-with-bis.md), objects in the real world can be thought about from different *modeling perspectives*. A modeling perspective is a way of conceptualizing the real world for a particular purpose. For example, a Sewer System can be thought about from many modeling perspectives:

* As a physical 3D reality with form, material and mass (the *physical* perspective).
* As a system for hydrological conveyance (an *analytical* perspective)
* As a set of components that require scheduled and emergency maintenance (a *maintenance* perspective)
* As a load on a wastewater treatment facility that needs to have adequate capacity (a *functional* perspective)

## Keeping Modeling Perspectives Segregated

Each modeling perspective simplifies objects in the real world in a different way; this requires different specialized data structures for each perspective. This is manifested in BIS classes as explained in the following section.

Each perspective's data
(`InformationPartitionElement`s, `Model`s, `Element`s, etc.) is segregated from other perspectives' data in order to allow each perspective to be optimally organized. Relationships between the `Element`s of different perspectives are used to indicate that they are all modeling the same objects, just from different perspectives.

### Modeling Perspectives and BIS Class Hierarchy

Modeling perspectives are represented directly in the BIS class hierarchies as:

* `InformationPartitionElement` subclasses
* `Model` subclasses
* `Element` subclasses

For every modeling perspective there is a corresponding `InformationPartitionElement` subclass and a `Model` subclass.

Modeling perspectives are also manifested in `Element` subclasses. Often there is an `Element` subclass that directly corresponds to a modeling perspective. `Element`s placed in a `Model` need to have a modeling perspective that is compatible with the `Model`.

<!-- The above paragraph is intentionally vague. I am hoping we can approve it for now and improve it when we figure out our mixin (or whatever strategy)-->

[Top of the World](./top-of-the-world.md) discusses `InformationPartitionElement`s and [Model Fundamentals](../fundamentals/model-fundamentals.md) discusses `Model`s.

<!-- Temporarily left this out:>

Some `Model` subclasses do not correspond to modeling perspectives. `RepositoryModel` is one case.
-->

### Modeling Perspective Consistency of Partitions, Models and Elements

As is described in [Top of the World](./top-of-the-world), for every Subject, there may be zero or more `InformationPartitionElement` child `Element`s. Each of those `InformationPartitionElement`s is effectively a declaration of a modeling perspective and starts a `Model` hierarchy that is of that the declared modeling perspective.

Each `InformationPartitionElement` has a sub-`Model` that is of the same modeling perspective. That sub-`Model` contains only `Element`s of the same modeling perspective. Some of those `Element`s will have sub-`Model`s of their own, which must be of the same modeling perspective as the `Element` they sub-model.

These modeling perspective rules enforce a minimum level of logical data consistency. For example, they prevent the placement of a physical fire hydrant `Element` into a section drawing `Model`.

<!-- I have intentionally avoided complicating this discussion with Elements of a compatible modeling perspective. Until we decide what that is, I don't think we should attempt to document it -->

<!--
We will need to document 3 cases:
- Element of exactly the same modeling perspective
- Element of compatible modeling perspective via modeling perspective abstraction/inheritance
- Element of compatible modeling perspective via mixins or some other mechanism
-->

### Abstract, Concrete and Sealed Modeling Perspectives

Modeling Perspectives can be considered to be abstract, concrete, or sealed to correspond with the `InformationPartitionElement` and `Model` subclasses that implement them:

* An *abstract* modeling perspective is used only to logically group more-specialized perspectives and is implemented by abstract `InformationPartitionElement` and `Model` subclasses.

* A *concrete* modeling perspective is used directly to model reality and is implemented by concrete `InformationPartitionElement` and `Model` subclasses.

* A *sealed* modeling perspective is a concrete modeling perspective that is not allowed to be further specialized. A sealed modeling perspective is implemented with sealed `InformationPartitionElement` and `Model` subclasses.

## Standard Modeling Perspectives

It is not possible to predict all of the modeling perspectives that may eventually be needed in BIS. BIS does, however, provide a core set of modeling perspectives from which other modeling perspectives must derive.

The core modeling perspectives are:

* InformationPartitionElement (abstract)
  * AnalyticalPartition (abstract)
  * DefinitionPartition (sealed)
  * DocumentPartition (sealed)
  * FunctionalPartition (concrete but considered abstract)
  * GraphicalPartition3d (sealed)
  * GroupInformationPartition (sealed)
  * InformationRecordPartition (sealed)
  * LinkPartition (sealed)
  * PhysicalPartition (sealed)
  * PhysicalSystemPartition (sealed)
  * SpatialLocationPartition (sealed)

If the need for a new core modeling perspective is discovered (none of the existing core modeling perspectives is appropriate as a parent perspective), new ones can be added.

### Physical Modeling Perspective

The Physical modeling perspective views reality as objects with form, material(s) and mass in 3D space. The Physical modeling perspective merits special discussion as it plays such an important role in BIS.

There is one and only one Physical modeling perspective for a given `Subject` instance. If there is one sewer pipe in reality, there can only be one physical representation of that sewer pipe.

The Physical modeling perspective cannot be "subclassed". (For legacy reasons there are some subclasses of `PhysicalModel` in BIS schemas, but those subclasses are never used.)

See [Physical Models and Elements](../physical-perspective/physical-models-and-elements.md) for details of physical modeling.

#### Physical Backbone

The principle of a "physical backbone" in BIS states that the one thing that all disciplines can agree upon is physical reality, and thus the physical perspective should be the "touchstone" among other perspectives. `Elements` representing a non-physical perspective of a physical object will typically have a relationship to a `PhysicalElement` modeling the object from a Physical perspective.

### Functional Modeling Perspectives

Functional modeling perspectives view reality as objects intended to perform a function. Often those objects are connected to form a functional system.

An example of a functional modeling perspective is viewing the interconnected components of a process plant as a system that performs a function.

See [Functional Models and Elements](../other-perspectives/functional-models-and-elements.md) for details of functional modeling.

### Analytical Modeling Perspectives

The analytical modeling perspective views reality as objects in 3D space that participate in a phenomenon that can be analyzed.

An example of an analytical modeling perspective is thermal analysis of a building, where the components of the building have thermal properties and may be heat sources or sinks.

There are similarities between the Functional and Analytical perspectives. The primary difference between the two is that for the Analytical perspective, 3D locations are critical to the behavior.

Note that some analyses can be performed directly on the Physical Perspective data; these analyses do not require conceptually reality from a custom perspective.

See [Analytical Models and Elements](../other-perspectives/analysis-models-and-elements.md) for details of analytical modeling.

<!-- Allan believes the following partitions/models have much value, but are a force-fit as a modeling perspective:
- Definition
- Repository
-->

<!-- Allan questions the value of following partitions/models but is willing to accept that the decision is water under the bridge....but do we want to consider them as modeling perspectives:
- Link
- Dictionary
- DocumentList
-->

<!-- Allan is not sure about the many of the others -->

### Definition Partitions

The top of a definition hierarchy starts with a `DefinitionModel` that models a `DefinitionPartition`.
This allows `DefinitionElements` to be organized by how they relate to the parent `Subject` of the `DefinitionPartition`.
The can be multiple `DefinitionPartition` Elements and corresponding `DefinitionModel` Models so that definitions (instances of `DefinitionElement`) can be organized by source, discipline, or other criteria.
Each `DefinitionPartition` is identified by its [Code](../references/glossary.md#code).

See [Organizing Repository-global Definition Elements](./organizing-definition-elements.md) for details on the expected organization of repository-global definition elements in the *DictionaryModel*.

### Document Partitions

The top of a document hierarchy starts with a `DocumentListModel` that sub-models a `DocumentPartition`.
This allows `Document` elements to be organized by how they relate to the parent `Subject` of the `DocumentPartition`.
`Drawing` and `Sheet` are 2 example subclasses of `Document`.
`Drawings` and `Sheets` are further sub-modeled by `DrawingModels` and `SheetModels` which graphically break down the content of the drawing or sheet.

The following instance-diagram depicts that hierarchy for a hypothetical iModel about a Plant building. Two drawing documents are shown as well as associations between 2D graphics from one of them with the Physical elements of the iModel. BIS offers the `DrawingGraphicRepresentsElement` relationship to address the need of associations between elements in a *Drawing* with elements in a different modeling perspective. See [Instance-diagram Conventions](../references/instance-diagram-conventions.md) for details about the conventions used.

&nbsp;
![Document Partitions](../media/document-partition.png)
&nbsp;

## Domains and Modeling Perspectives

A domain may or may not require a custom modeling perspective. The need for a custom modeling perspective corresponds to a need to model reality using concepts that are significantly different from other existing modeling perspectives.

Structural Steel Detailing is an example of a domain that does ***not*** require its own modeling perspective. That domain will require custom classes to represent the physical items that are important to it, but all of those items are viewed from the Physical modeling perspective. Structural Steel Detailing might also need some scheduling or costing information; that information is unlikely to require a custom modeling perspective, as costing and scheduling are common needs.

Hydraulic Analysis, on the other hand, does require a custom modeling perspective. This perspective will model reality as a system that transports and stores water. Reality will be simplified into a network of conduits and other items, with properties and relationships appropriate for hydraulic analysis.

---
| Next: [Top of the World](./top-of-the-world.md)
|:---
