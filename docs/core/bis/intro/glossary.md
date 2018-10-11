---
tableRowAnchors: true
---

# BIS Glossary

Key BIS terms used in this documentation are defined on this page.

<!-- NOTE: Need to use HTML named anchors because markdown doesn't have that concept yet. -->
<!-- NOTE: The named anchor should be the glossary term in lowercase with words separated by "-" -->

<!-- markdownlint-disable MD033 -->

| Term | Description |
|------|-------------|
| **BIS Repository** | An information repository with semantics and structure defined by BIS. [iModels](#imodel) are an implementation of a BIS Repository. |
| **BIS** | Base Infrastructure Schemas. A coordinated family of schemas for modeling built infrastructure (e.g. buildings, roads, bridges, factories, etc.) BIS also addresses concepts needed for infrastructure-related workflows (e.g. documents, drawings, requirements, issues, etc.). |
| **BisCore** | The base BIS Domain for BIS. All ECClasses in any other Domain must derive (directly or indirectly) from a BisCore class. |
| **Category** | A property of a GeometricElement that "categorizes" its geometry. Every GeometricElement is assigned to one and only one Category. The visibility (on/off) of a category may be controlled per-view. Categories are similar to *levels* in DGN, *layers* in DWG, and *categories* in RVT. |
| **Class** | See [ECClass](#ecclass). |
| **Code** | A synonym for [CodeValue](#code-value-property). See [Codes](./codes.md). |
| **CodeScope Property** | A navigation property of Element that points to an Element that indicates the *scope for uniqueness* for the CodeValue. See [Codes](./codes.md). |
| **CodeSpec** | A "Code Specification" that specifies how a Code is encoded and decoded. See [Codes](./codes.md). |
| **CodeSpec Property** | A navigation property of Element that points to a [CodeSpec](#codespec) that specifies how the Code is encoded and decoded. See [Codes](./codes.md). |
| **CodeValue Property** | A nullable string property of Element that holds a human-readable identifier of the [Entity](#entity) that the Element represents. See [Codes](./codes.md). |
| **DefinitionElement** | A subclass of InformationContentElement that holds information that helps *define* other Elements and is intended to be referenced (i.e. shared) by multiple of those Elements. |
| **Digital Twin** | A digital representation of some portion of the real world. A Digital Twin should be designed to be used by multiple applications (in contrast to application-specific “silo” databases). A complete Digital Twin is normally a federation of data from multiple repositories (e.g. a BIS Repository such as an iModel, plus Reality Data services, plus IoT data services, plus Asset Lifecycle Information Management services, etc.) |
| **Domain** | A named set of ECClasses that define the information for a particular discipline or field of work. All classes in a Domain ultimately must derive from a BisCore class. The ECClasses for a Domain are defined in a ECSchema file, an hence the terms *Domain* and *ECSchema* are often used interchangeably. |
| **DrawingModel** | A 2d model that holds drawing graphics. DrawingModels may be dimensional or non-dimensional. |
| **EC** | An abbreviation for *Entity Classification*. This prefix is used to refer to the metadata system of BIS. |
| **ECClass** | A named set of properties and relationships that defines a type of object. Data in BIS Repositories are defined by ECClasses. |
| **ECProperty** | A named member of an ECClass. |
| **ECRelationship** | A named type of relationship and cardinality between instances of ECClasses. |
| **ECSchema** | A named group of ECClasses and ECRelationships. |
| **Element** | The base class in BIS for an *Entity with a Code*. An Element is smallest individually identifiable building-block for modeling in a BIS Repository. There can be different subclasses of Element corresponding to different Modeling Perspectives. Multiple Elements can be related together to model different Perspectives of an Object. |
| **ElementAspect** | A BIS class that adds properties and/or relationships to a single Element to add more detail. ElementAspects can be used, for example, to record information that is only be needed in certain situations or in some stages of the Element's lifecycle. An ElementAspect is *owned by*, and thus is deleted with, its owning Element. |
| **ElementId** |A 64-bit unique Id for an Element within a BIS Repository. For iModels, ElementIds are assigned by combining a 24-bit BriefcaseId with a 40-bit sequentially assigned value.  |
| **ElementOwnsChildElements** | Relates an Element to *child* Elements which represent *parts* of the [Entity](#entity) modeled by the parent Element. Element subclasses can either allow the use of child Elements to model its parts, or allow use of the ModelModelsElement relationship with another Model to express a detailed model of the parts, but not both. |
| **Entity** | A portion of a real-world Object that is relevant for a given Modeling Perspective. The complete Object is the sum of its Entities. For example, an Entity can be the role that the Object plays in a particular system. |
| **FederationGuid** | An optional 128 bit [Globally Unique Identifier](https://en.wikipedia.org/wiki/Universally_unique_identifier) for the [Entity](#entity) that an Element models. Generally it is intended that FederationGuids are assigned by external systems and are used to *federate* Elements to their external meaning. Within a BIS Repository, FederationGuids must be unique, and thus can be used as secondary identifiers for an Element (when they are present). |
| **GeometricElement** | A subclass of Element that can include geometry (in its GeometryStream property.) Only GeometricElements are visible in Views. |
| **GeometricModel** | A subclass of Model that can hold GeometricElements. |
| **GeometryPart** | A named GeometryStream that can be shared by many GeometricElements. |
| **GeometryStream** | A collection of geometric primitives that describes the geometric properties of a GeometricElement. Individual members of GeometryStream may be in different [SubCategories](#sub-category) and may reference GeometryParts. |
| **Granularity** | The scale or level of detail of Elements in a Model. |
| **iModel** | A BIS Repository implemented as a distributed database using [SQLite](https://www.sqlite.org) and iModelHub. See [iModels](..\..\learning\iModels.md) are the most common BIS Repository. Many copies of an iModel may be extant simultaneously, each held in a Briefcase and synchronized via ChangeSets from iModelHub. |
| **InformationPartitionElement** | An Element in the RepositoryModel that identifies a portion of the BIS Repository that models a Subject from the Partition's Modeling Perspective. A Partition must be the child of a Subject, which can have multiple specialized Partition Elements (e.g. PhysicalPartition, FunctionalPartition) as children. |
| **Model** | A set of Elements used to describe another Element (its *ModeledElement*) in more detail. Every Element is *contained in* one and only one Model via a ModelContainsElements relationship. In this manner, Models form a hierarchy of Elements. There are many subclasses of Model (e.g. PhysicalModel, FunctionalModel, etc.)|
| **ModelContainsElements** | A relationship that enforces that each Element belongs to exactly one Model. |
| **ModeledElement** | An Element that is *broken down in more detail* by a Model. Note that the *name* of a Model **is** the name of its ModeledElement, and the *ParentModel* of a Model **is** the Model of its ModeledElement. |
| **Modeling Perspective** | A way of “looking at” or “thinking about” an Object, e.g. functional, physical, spatial, financial, etc. |
| **ModelModelsElement** | A relationship that relates a Model to the Element which the Model models in more detail. In other words, the Model breaks-down the coarser-grained Element into a more-detailed Model consisting of finer-grained Elements. This relationship allows BIS to cohesively model reality at multiple granularities within the same BIS Repository. |
| **Object** | A real-world object that may be physical or non-physical. Not used to refer to instances of ECClasses. |
| **Perspective** | See [Modeling Perspective](#modeling-perspective) |
| **PhysicalModel** | A subclass of `SpatialModel` for the physical perspective that holds `PhysicalElement`s and `SpatialLocationElement`s. |
| **Relationship** | See [ECRelationship](#ecrelationship). |
| **RepositoryModel** | A special Model that is the root of the hierarchy of Models in a BIS Repository. Every BIS Repository has one and only one RepositoryModel, and it is the only Model that does not have a ModelModelsElement relationship to another Element. |
| **Schema** |See [ECSchema](#ecschema). |
| **SheetModel** | A digital representation of a *sheet of paper*. Sheet Models are 2d models in bounded paper coordinates. SheetModels may contain annotation Elements as well as references to 2d or 3d Views. |
| **Spatial Coordinate System** | The 3d coordinate system of a BIS Repository. The units are always meters (see ACS). The origin (0,0,0) of the Spatial Coordinate System may be oriented on the earth via an [EcefLocation](https://en.wikipedia.org/wiki/ECEF). |
| **SpatialModel** | A subclass of GeometricModel that holds 3d Elements in the BIS Repository's Spatial Coordinate System. |
| **SpatialViewDefinition** | A subclass of ViewDefinition that displays one or more SpatialModels. |
| **SubCategory** | A subdivision of a [Category](#category). SubCategories allow GeometricElements to have multiple pieces of Geometry that can be made independently visible and styled. It is important to understand that a SubCategory is **not** a Category (i.e. Categories do *not* nest) and that a SubCategory always subdivides a single Category. |
| **Subject, Root** | The primary Subject in the RepositoryModel that names or briefly describes (in text) the real-world Object that the repository is modeling. There is always one and only one Root Subject in a repository. The Root Subject and its child Subjects effectively form a *table of contents* for the repository. |
| **Subject** | An Element in the RepositoryModel that names or briefly describes (in text) a significant real-world Object that the repository is modeling. Every Subject is either the Root Subject, or a child of another Subject. |
| **ViewDefinition** | A subclass of `DefinitionElement` that holds the persistent state of a View. |
