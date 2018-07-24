---
tableRowAnchors: true
---

# Glossary of terms in iModelJs

|Term | Definition
|------------|------------|--------|--------|-------|
|**ACS**|Auxiliary Coordinate System. Views may choose to use an Auxiliary Coordinate System to show coordinate information with a different orientation and units.
|**Backend**|The part of an iModelJs app that is concerned with accessing data in a briefcase. See [frontends and backends](https://en.wikipedia.org/wiki/Front_and_back_ends). See [learning about backend code](./backend/index.md).
|**BIS**|Base Infrastructure Schema. Defines the hierarchy and organization of information about an infrastructure asset. BIS is relevant outside of iModels, but all information stored in an iModel conforms to BIS.
|**BisCore**|The *base* BIS Domain for iModels. All ECClasses stored in an iModel must derive from a BisCore class.
|**Briefcase**|A file holding a *copy of* an iModel. See [IModelDb](./backend/IModelDb.md).
|**Cartographic Coordinates**| A [geographic coordinate system](https://en.wikipedia.org/wiki/Geographic_coordinate_system) based on lat/long/height. If an iModel is geo-located via an EefLocation, Spatial Coordinates may be converted to Cartographic coordinates.
|**Category**|A property of a GeometricElement that "categorizes" its geometry. That is, every GeometricElement is "in" one and only one Category. The visibility (on/off) of a category may be controlled per-view. Categories are similar to *levels* in DGN, *layers* in DWG, and *categories* in RVT. Note that Categories are not relevant for Elements that are not GeometricElements. Category is a subclass of DefinitionElement.
|**CategorySelector**|A named group of Categories displayed in a View. Many ViewDefinitions may refer to the same CategorySelector.
|**ChangeSet**|A group of changes to an iModel. Changesets are created whenever an Briefcase is modified and reflect the union of all Additions, Deletions, and Modifications over a period of time. ChangeSet are assigned an identifier when they are uploaded to iModelHub and every ChangeSet stores the identifier of its parent ChangeSet. In this way the chain of ChangeSets for an iModel in iModelHub forms its "timeline of changes".
|**ChangeSummary**|A [summary of the changes](./ChangeSummaries) in a ChangeSet in the form of ECClasses and ECProperties.
|**Class Registry**|A registry of known JavaScript classes that handle ECClasses. The JavaScript class **must** have the same name as the ECClass. When an Entity is loaded from an iModel, a JavaScript instance of the registered class will be created. If no JavaScript class is registered for the ECClass, one is created dynamically.
|**Code**|An optional [three part *human readable* identifier]($docs/bis/intro/codes.md) for an Element. A code consists of a CodeSpec, CodeScope, and CodeValue. The combination of all three parts must be unique within an iModel.
|**CodeScope**|A Code Scope determines a *scope for uniqueness* for the code value. For example, a scope may specify the whole iModel, only within a certain Model, within an assembly, etc. For a given CodeSpec and CodeScope, all CodeValues must be unique.
|**CodeSpec**|A CodeSpec defines the *specification* (i.e. type) of a code. Often the specification is defined by some external system that enforces conventions, consistency, and validation. A CodeSpec captures the rules for encoding and decoding significant business information into and from a CodeValue. iModels hold a table of the known CodeSpecs, defined by the CodeSpec ECClass, and Elements refer to one of them by Id.
|**CodeValue**|A human-readable string with the *name* of an Element. CodeValues are formatted according to the rules of its CodeSpec.
|**DefinitionElement**|A subclass of InformationContentElement that holds configuration-related information that is meant to be referenced (i.e. shared) by other Elements.
|**DisplayStyle**|A named set of choices for the way Geometry is displayed in a view. Many ViewDefinitions may refer to the same DisplayStyle.
|**Domain**|A named set of ECClasses that define the information for a particular discipline or field of work. All classes in a Domain ultimately must derive from a BisCore class. The ECClasses for a Domain are defined in a ECSchema file,  hence the terms *Domain* and *ECSchema* are often used interchangeably.
|**DrawingModel**|A 2d model that holds drawing graphics. DrawingModels may be dimensional or non-dimensional (i.e. unitless).
|**EC**|An abbreviation for *Entity Classification*. This prefix is used to refer to the metadata system of iModels.
|**ECClass**|A named set of properties and relationships that defines a type of object. Data in iModels are defined by ECClasses.
|**ECDb**|A [SQLite](https://www.sqlite.org/index.html) database conforming to the rules of EC. iModels are a type of ECDb.
|**EcefLocation**|The position and orientation, in [Earth Centered Earth Fixed](https://en.wikipedia.org/wiki/ECEF) (also known as ECR "earth-centered rotational") coordinates, of the origin of the Spatial Coordinate System of an iModel.
|**ECProperty**|A named member of an ECClass.
|**ECRelationship**|A named type of relationship and cardinality between instances of ECClasses.
|**ECSchema**|A named group of ECClasses and ECRelationships.
|**ECSQL**|A [superset of SQL](./ECSQL.md) that uses ECClass and ECProperties names in place of table and column names.
|**Electron**|A tool for building [desktop apps in JavaScript and HTML](https://electronjs.org).
|**Element**|The base class in Bis for an *Entity with a Code*. [Elements](../bis/intro/element-fundamentals.md) also have an ElementId, a FederationGuid, and an ElementUserLabel. There is also a backend TypeScript class called [Element]($backend).
|**ElementAspect**|An ECClass that holds information related to (and owned by) a single Element. Semantically, an ElementAspect can be considered part of the Element, but defined independently. Thus, ElementAspects are deleted when their owning Element is deleted.
|**ElementState**|A TypeScript class that holds the properties of an Element in the frontend. See [ElementState]($frontend).
|**Entity Metadata**|The names and types of the ECProperties and ECRelationships of an Entity ECClass.
|**Entity**|A physical or non-physical object in the real world, defined by an ECClass.
|**FeatureGate**|A technique for controlling the behavior of an iModelJs program at runtime. [FeatureGates](./common/FeatureGates.md) are created in JSON and may be tested at runtime to *gate off* access to a feature.
|**FederationGuid**|An optional 128 bit [Globally Unique Identifier](https://en.wikipedia.org/wiki/Universally_unique_identifier) for an Element. Generally it is intended that FederationGuid are assigned by external systems and are held in iModels to *federate* Elements to their external meaning.
|**FileProperty**|A named string or blob that holds *metadata* about an iModel. FileProperties are meant to be accessible directly from SQLite and are the only data in an iModel not defined by an ECClass. For example, thumbnails are stored as FileProperties.
|**Frontend**|The part of an interactive app that is concerned with displaying data and user interaction. See [frontends and backends](https://en.wikipedia.org/wiki/Front_and_back_ends). See [App frontends](../overview/App.md#app-frontend)
|**Frustum**|An 8-point [truncated pyramid](https://en.wikipedia.org/wiki/Viewing_frustum) that defines the volume of space visible in a View. The front and back planes must be parallel and their centers must align at right angles.
|**GeometricElement**|A subclass of Element that can include geometry (in its GeometryStream.) Only GeometricElements are visible in Views.
|**GeometricModel**|A subclass of Model that can hold GeometricElements.
|**GeometryPart**|A named GeometryStream that can be shared by many GeometricElements.
|**GeometryStream**|A collection of geometric primitives that describes the geometric properties of a GeometricElement. Individual members of GeometryStream may be on different SubCategories and may reference GeometryParts.
|**I18N**|An abbreviation for [Internationalization](https://en.wikipedia.org/wiki/Internationalization_and_localization).
|**Id64**|A TypeScript class that holds hexadecimal-encoded string for a 64-bit Id.
|**iModel**|A distributed relational database holding information about an infrastructure asset defined in BIS. Many copies of an iModel may be extant simultaneously, each held in a Briefcase and synchronized via ChangeSets from iModelHub.
|**IModelApp**|The *administrator* class for frontend applications. By subclassing IModelApp, applications can control the behavior of the frontend services.
|**IModelConnection**|A TypeScript class in the frontend that represents the connection to the iModel on the backend.
|**iModelHub**|A cloud service that coordinates access to iModels. It grants permission to approved iModelJs applications to access Briefcases of iModels on behalf of a authorized user. It also accepts and distributes ChangeSets to form the immutable and authoritative *timeline of changes* for an iModel.
|**L10N**|An abbreviation for [Localization](https://en.wikipedia.org/wiki/Internationalization_and_localization).
|**LineStyle**|A named pattern that is repeated along a path when it is displayed to represent the meaning of the path.
|**Model**|A set of Elements used to describe another Element (its *ModeledElement*) in more detail. Every Element is *contained in* one and only one Model via a ModelContainsElements relationship. In this manner, Models form a hierarchy of Elements. There are many subclasses of Model (e.g. PhysicalModel, FunctionalModel, etc.)
|**ModeledElement**|An Element that is *broken down in more detail* by a Model. Note that the *name* of a Model **is** the name of its ModeledElement, and the *ParentModel* of a Model **is** the Model of its ModeledElement.
|**ModelSelector**|A named set of Models that are visible in a View. Many ViewDefinitions may point to the same ModelSelector.
|**Node.js**|A [runtime for JavaScript](https://nodejs.org) outside a web browser.
|**NPC**|**N**ormalized **P**lane **C**oordinates. A coordinate system for Frustums where each dimension [x,y,z] is normalized to hold values between 0.0 and 1.0 inside the Frustum. In NPC, [0,0,0] is the left-bottom-rear and [1,1,1] is the right-top-front of the Frustum.
|**Npm**|[Node Package Manager](https://www.npmjs.com/). A tool for distributing JavaScript packages.
|**ParentModel**|A derived property of Model that is equal to the Model of its ModeledElement.
|**PhysicalModel**|A subclass of SpatialModel that holds PhysicalElements.
|**Project Extents**|The *volume of interest* for an iModel's Spatial Coordinate System. All spatial elements in an iModel must be completely inside its Project Extents.
|**Props**|iModelJs uses the convention that the members and types of a *JSON wire format* are expressed in TypeScript by an [interface](https://www.typescriptlang.org/docs/handbook/interfaces.html) or [type alias](http://www.typescriptlang.org/docs/handbook/advanced-types.html) with the suffix **Props** (for *prop*erties). E.g. `ElementProps`, `ViewDefinitionProps`, etc.
|**RootSubject**|An Element in the iModel that describes (in text) the asset modeled by an iModel. There is always one and only one RootSubject. All information in an iModel will have some relationship to the RootSubject, making it the root of a *table of contents*.
|**RPC**|Remote procedure call. Allows a client to invoke an operation in a service. Web apps use HTTP to implement RPC calls, while desktop apps use pipes.
|**RpcInterface**|An interface exposed by a service and callable by clients via RPC. See  [RpcInterface](../overview/RpcInterface.md) for more information.
|**Rush**|A tool for [managing multiple NPM packages](http://rushjs.io/) within a single git repository.
|**Schema**|See ECSchema
|**SheetModel**|A digital representation of a *sheet of paper*. Sheet Models are 2d models in bounded paper coordinates. SheetModels may contain annotation Elements as well as references to [DrawingViewDefinition]($backend)s. or [SpatialViewDefinition]($backend)s.
|**Spatial Coordinate System**|The 3d coordinate system of an iModel. The units are always meters (see ACS). The origin (0,0,0) of the Spatial Coordinate System may be oriented on the earth via an EcefLocation.
|**SpatialModel**|A subclass of GeometricModel that holds 3d Elements in the iModel's Spatial Coordinate System.
|**SpatialViewDefinition**|A subclass of ViewDefinition that displays one or more SpatialModels.
|**SubCategory**|A subdivision of a Category. SubCategories allow GeometricElements to have multiple pieces of Geometry that can be made independently visible and styled. It is important to understand that a SubCategory is **not** a Category (i.e. Categories do *not* nest) and that a SubCategory always subdivides a single Category.
|**SubCategoryAppearance**|The appearance (e.g. color, weight, style, etc.) of geometry on a SubCategory. Every SubCategory has a default SubCategoryAppearance and Views can optionally override its values.
|**TentativePoint**|A TypeScript class in the frontend that implements a technique for *tentatively* snapping to interesting points in a View. Usually the TentativePoint action is mapped to the center mouse button.
|**TextString**|A TypeScript class that holds a *run* of unicode-encoded text that all has the same size, font, style, etc.
|**Thumbnail**|A small JPEG or PNG encoded image that provides a *rough snapshot* of an Element. Some thumbnails (e.g. view thumbnails and the overall iModel thumbnail) are stored as FileProperties.
|**Tool**|A TypeScript class in the frontend that associates a ToolId with an action. Subclasses of [Tool]($frontend) can react to user input.
|**ToolId**|A short **string** that unambiguously identifies a Tool.
|**UserLabel**|An optional string that holds a user-assigned *alias* for an Element. UserLabels are **not** enforced to be unique.
|**View**|An abstract concept that forms a relationship between a rectangular region on a screen and content in an iModel. All of the classes involved in that mapping are collectively referred to as a View.
|**ViewDefinition**|A subclass of DefinitionElement that holds the persistent state of a View. There is also an eponymous Typescript class in the backend.
|**Viewport**|A TypeScript class in the frontend that connects an HTMLCanvasElement to a ViewState.
|**ViewState**|A TypeScript class in the frontend that holds a copy of the *state* of a [ViewDefinition]($backend). A [ViewState]($frontend) is modified by viewing operations (e.g. pan, zoom, rotate, etc.). There are a parallel set of subclasses of ViewState for the subclasses of ViewDefinition.
|**WebGL**|A [JavaScript API](https://www.khronos.org/webgl/) for rendering into an HTML document via OpenGL.
|**Webpack**|A tool for [bundling JavaScript applications](https://webpack.js.org/)
|**Wire format**|The JSON representation of objects that must be used when transferring data in iModelJs. See Props.
