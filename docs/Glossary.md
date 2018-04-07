# Frequently used terms in iModelJs

|Term | Definition
|------------|------------|--------|--------|-------|
|**BIS**|Base Infrastructure Schema. Defines the hierarchy and organization of information about an infrastructure asset. BIS can have relevance outside of iModels, but all information stored in an iModel conforms to BIS.
|**BisCore**|The base BIS Domain for iModels. All EC Classes stored in an iModel must derive from a BisCore class.
|**Briefcase**|A file holding a *copy of* an iModel. Briefcases are obtained from iModelHub and are each assigned a unique Id called a BriefcaseId. Briefcase files have a ".bim" (briefcase of iModel) extension. Briefcases are synchronized via changesets.
|**Cartographic Coordinates**| A [geographic coordinate system](https://en.wikipedia.org/wiki/Geographic_coordinate_system) based on lat/long/height. If an iModel is geo-located via an ECEF location, spatial coordinates may be converted to Cartographic coordinates.
|**Category**|A property of a GeometricElement that "categorizes" its geometry. That is, every GeometricElement is "in" one and only one Category. The visibility (on/off) of a category may be controlled per-view. Categories are similar to *levels* in DGN, *layers* in DWG, and *categories* in RVT. Note that Categories are not relevant for Elements that are not GeometricElements.
|**ChangeSet**|A group of changes to an iModel. Changesets are created whenever an Briefcase is modified and reflect the union of all Additions, Deletions, and Modifications over a period of time. ChangeSet are assigned an identifier when they are uploaded to iMod3elHub and every ChangeSet stores the identifier of its parent ChangeSet. In this way the chain of ChangeSets for an iModel in iModelHub forms its "timeline of changes".
|**ChangeSummary**|A summary of the changes in a ChangeSet.
|**Class Registry**|A registry of known JavaScript classes that handle EC Classes. The TypeScript class **must** have the same name as the EC Class. When an Entity is loaded from an iModel, a JavaScript instance of the registered class will be created. If no JavaScript class is registered for the EC Class, one is created dynamically.
|**Code**|An optional three part *human readable* identifier for an Entity. A code consists of a CodeSpec, CodeScope, and CodeValue. The combination of all three parts must be unique within an iModel.
|**CodeScope**|A Code Scope determines a *scope for uniqueness* for the code value (e.g. the whole iModel, within a Model, within an assembly, etc.)
|**CodeSpec**|A CodeSpec defines the "specification" (i.e. type) of a code. Often the specification is defined by some external system that enforces conventions, consistency, and validation. A Code Specification captures the rules for encoding and decoding significant business information into and from a CodeValue. This specification is used to generate and validate Codes. iModels hold a table of the known CodeSpecs, defined by the CodeSpec EC Class, and Entities refer to one of them by Id.
|**CodeValue**|A human-readable string with the *name* of an Element. CodeValues are formatted according to the rules of its CodeSpec.
|**DisplayStyle**|A named set of choices for the way Geometry is displayed in a view. Many ViewDefinitions may refer to the same DisplayStyle.
|**Domain**|A named set of EC Classes that define the information for a particular discipline or field of work. All classes in a Domain ultimately must derive from a BisCore class. The ECClasses for a Domain are defined in a ECSchema file, an hence the terms *Domain* and *ECSchema* are often used interchangeably.
|**Drawing Model**|A 2d model.
|**EC**|An abbreviation for Entity Content. This prefix is used to refer to the metadata system of iModels.
|**ECClass**|A named set of properties and relationships that defines a type of thing. Data in iModels are defined by ECClasses.
|**ECDb**|A [SQLite](https://www.sqlite.org/index.html) database conforming to the rules of EC. iModels are a type of ECDb.
|**ECEF**|[Earth Centered Earth Fixed](https://en.wikipedia.org/wiki/ECEF) Coordinates (also known as ECR "earth-centered rotational").
|**ECProperty**|A named member of an ECClass.
|**ECRelationship**|A named type of relationship and cardinality between instances of ECClasses.
|**ECSchema**|A named group of ECClasses and ECRelationships.
|**ECSql**|A superset of SQL that uses ECClass and ECProperties names in place of table and column names.
|**Electron**|A tool for building [desktop apps in JavaScript and HTML](https://electronjs.org).
|**Element**|The base class in Bis for an Entity with a Code. Elements also hold a ElementId, a FederationGuid, and an ElementUserLabel.
|**ElementAspects**|An ECClass that holds information related to (and owned by) a single Element. Semantically, an ElementAspect can be considered part of the Element. Thus, ElementAspects are deleted when their owning Element is deleted.
|**ElementState**|The properties of an Element in the frontend.
|**ElementUserLabel**|An optional string that holds a user-assigned *alias* for an Element. ElementUserLabels are not enforced to be unique.
|**Entity Metadata**|The names and types of the ECProperties of an Entity ECClass.
|**Entity**|Something defined by an ECClass.
|**FeatureGate**|A technique for controlling the behavior of an iModelJs program at runtime. FeatureGates are created in JSON and may be tested at runtime.
|**FederationGuid**|An optional 128 bit [universally unique identifier](https://en.wikipedia.org/wiki/Universally_unique_identifier) for an Element. Generally it is intended that FederationGuids are assigned by external systems ahd held in iModels to relate Elements to their external meaning.
|**FileProperty**|
|**Frustum**|
|**Gateway**|
|**geometry-core**|
|**GeometryStream**|
|**GeomPart**|
|**I18N**|An abbreviation for [Internationalization](https://en.wikipedia.org/wiki/Internationalization_and_localization).
|**Id64**|A TypeScript class that holds hexadecimal-encoded string for a 64-bit Id.
|**iModelConnection**|
|**iModel**|
|**IModelHost**|
|**iModelHub**|
|**L10N**|An abbreviation for [Localization](https://en.wikipedia.org/wiki/Internationalization_and_localization).
|**LineStyle**|
|**LinkTableRelationship**|
|**Metadata**|
|**Model**|
|**ModelSelector**|
|**Node.js**|An [engine for running JavaScript](https://nodejs.org) outside a web browser.
|**Npm**|[Node Package Manager](https://www.npmjs.com/). A tool for distributing JavaScript packages.
|**Physical Model**|
|**Props Interface**|iModelJs uses the convention that the members and types of a *JSON wire format* are expressed in TypeScript by an [interface](https://www.typescriptlang.org/docs/handbook/interfaces.html) or [type alias](http://www.typescriptlang.org/docs/handbook/advanced-types.html) with the suffix **Props** (for *prop*erties.)
|**Relationship**|
|**Repository**|A synonym for Briefcase
|**Root Subject**|
|**Rush**|A tool for [managing multiple NPM packages](http://rushjs.io/) within a single git repository.
|**Schema**|See ECSchema
|**Sheet Model**|
|**Spatial Coordinates**|
|**Spatial Model**|
|**SubCategory Appearance**|
|**SubCategory**|
|**Tentative Point**|
|**TextString**|
|**Thumbnail**|
|**Tool**|
|**Viewport**|
|**Views**|
|**ViewState**|
|**WebGL**|
|**Webpack**|
