# Quick Tour

These are some key terms for getting started with BIS. The full documentation contains more terms and more extensive definitions.

Term|Description
--|--
**Digital Twin** | A digital representation of some portion of the real world. A Digital Twin is designed to be used by multiple applications (in contrast to application-specific “silo” databases).
**BIS** | Base Infrastructure Schemas. A coordinated family of modular schemas for modeling built infrastructure (e.g. buildings, roads, bridges, factories, etc.) BIS also addresses concepts needed for infrastructure-related workflows (e.g. documents, drawings, requirements, issues, etc.).
**BIS Repository** | An information repository with semantics and structure defined by BIS. Typically (but not necessarily) used to implement a Digital Twin.
**iModel**| A BIS Repository implemented as a distributed database using [SQLite](https://www.sqlite.org). iModels are the native BIS Repository. Many copies of an iModel may be extant simultaneously, each held in a Briefcase and synchronized via ChangeSets from iModelHub.
**Object** | A real-world thing. May be physical or non-physical.
**Modeling Perspective** | A way of *looking at* or *thinking about* an object (e.g. functional, physical, spatial, financial, etc.)
**Entity**|A BIS class that models an Object from a given Modeling Perspective. The complete Object is the sum of its Entities. For example, an Entity can be the role that the Object plays in a particular system.
**Code**|An optional three part *human readable* identifier for a bis:Element. A code consists of a `CodeSpec`, `CodeScope`, and `CodeValue`. The combination of all three parts must be unique within a Repository.
**bis:Element** |The base class in BIS for an *Entity that may have a Code*. A `bis:Element` is smallest individually identifiable building-block for modeling in a BIS Repository. There can be different subclasses of bis:Element corresponding to different Modeling Perspectives. Multiple Elements (with different Perspectives) can be related together to model multiple Aspects of an Object.
**bis:Model**| A set of `bis:Element`s used to model another bis:Element. More precisely, used to model the Entity modeled by another bis:Element in more detail. There are many specializations of `bis:Model`s corresponding to  different Modeling Perspectives, e.g. PhysicalModel, FunctionalModel, etc.
**bis:ModelContainsElements** | A relationship that enforces that each bis:Element belongs to exactly one `bis:Model`.
**bis:ModelModelsElement** | Relates a `bis:Model` to the `bis:Element` that it models in more detail. In other words, the bis:Model breaks-down the coarser-grained Element into a more-detailed bis:Model consisting of finer-grained Elements. This relationship allows BIS to cohesively model reality at multiple granularities within the same BIS Repository.
**bis:ElementAspect** | A BIS class that can be used to add properties to a single bis:Element to add more detail. ElementAspects can be used, for example, to relate information only be needed in certain situations or in some stages of the Element's lifecycle. An ElementAspect is *owned by*, and thus are deleted with, their owning Element.
**bis:ElementOwnsChildElements** | Relates a bis:Element to *child* bis:Elements that represent *parts* of the Entity modeled by the parent Element. Element subclasses can either allow the use child Elements to model its parts, or allow use of the ModelModelsElement relationship with another bis:Model to express a detailed model of the parts, but not both.
**bis:RepositoryModel** | A special bis:Model that is the root of the hierarchy of bis:Models that make up a Digital Twin. Every Repository has one and only one RepositoryModel, and it is the only bis:Model that does not have a bis:ModelModelsElement relationship to another bis:Element.
**bis:Subject** | A bis:Element in the RepositoryModel that names or briefly describes (as a text string) the real-world Object that the overall Digital Twin is modeling.
**bis:InformationPartitionElement** | An element in the `RepositoryModel` that identifies a portion of the BIS Repository that models the Subject from the Partition's Modeling Perspective. The "portion" consists of the hierarchy of Models that break-down the Partition Element (using the ModelModelsElement relationship). [A Partition must be the child of a Subject, that can have multiple specialized Partition Elements (e.g. PhysicalPartition, FunctionalPartition) as children.]

## Relevant links

iModelJs

iModelHub

Bridges

Links to existing domains
