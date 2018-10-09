# Modeling with BIS

This section describes how [BIS](./glossary.md#bis) models the world, and why. First, we introduce the way that BIS perceives the real world. Next, we describe the fundamental building blocks for modeling with BIS and how those blocks are used to construct a cohesive "Digital Twin"—which is significantly different from how one would define the data model of an application-specific "silo" database.

This section uses terms without fully defining them. See more-detailed definitions in the [BIS Glossary](./glossary.md).

## The BIS View of the World

To "model" reality is to represent it in a simplified, purposeful way that we call a modeling [Perspective](./glossary.md#perspective). Consider a real-world physical [Object](./glossary.md#object). We can model both its physical form (Physical Perspective) and the role it plays in a functioning system (Functional Perspective). BIS conceives of Objects as composed of multiple Entities, where each [Entity](./glossary.md#entity) has a subset of the Object's attributes (relevant to a given Perspective).
![01](./media/bis-modeling-01.png "An Object is comprised of multiple Entities") <!--style="width:5.51546in;height:1.97637in"-->

A BIS [Digital Twin](./glossary.md#digital-twin) models Entities like:

- The physical forms of built infrastructure

- The roles that physical objects play in various systems

- Intangible Objects (e.g. documents, requirements, electronic drawings, etc.) that support the design, construction, and operation of built infrastructure.

A [BIS Repository](./glossary.md#bis-repository) is an information repository with structure and semantics governed by BIS. It is the "digital universe" in which BIS Digital Twin(s) reside.

BIS supports multiple modeling "[Perspectives](./glossary.md#perspective)" within one BIS Repository. For physical Objects, the physical Perspective is primary, but there are additional Perspectives for the roles the Object plays in different systems, e.g. in a functional process, a thermal system, a safety analysis, a spatial layout, a structural system, a financial system, a logistics system, etc.

BIS also supports modeling an Object at multiple [Granularities](./glossary.md#granularity) within one BIS Repository, e.g. as both an "atomic" thing and as a collection of smaller parts.

## The BIS Building Blocks and How to Use Them

The fundamental building blocks for a Digital Twin in a BIS Repository are information records called: [Model](./glossary.md#model), [Element](./glossary.md#element), [ElementAspect](./glossary.md#elementaspect), and [Relationship](./glossary.md#relationship).

### Element

An [Element](./glossary.md#element) models a real-world Entity. A set of closely-related Elements (each modeling a different Entity comprising the Object) collectively model the complete Object. One Element will be the "lead" Element, based on the nature of the Object being modeled. For example, if it is a Physical Object, then the PhysicalElement (modeling the Physical Entity) will be the "lead" Element, and all other Elements (modeling the other Entities comprising the Object) will relate back to the lead PhysicalElement. For a purely spatial Object (e.g. a political border) the SpatialLocationElement would be the "lead". For an "information" Object, an InformationContentElement would be the "lead".

![02](./media/bis-modeling-02.png "Elements model Entities")

### Model

A [Model](./glossary.md#model) is a collection of Elements, all from a **single** Perspective. Collectively, those Elements model some Entity that is "larger" than the Entities modeled by the Elements contained in the Model. For example, consider a PhysicalModel containing PhysicalElements that model the physical form of car parts. Collectively, they model the Physical Entity of a car-as-a-whole.

![03](./media/bis-modeling-03.png "Models are collections of Elements with a common Perspective")
An Element in a different Model (see "P-0" below) models the car-as-a-whole as an "atomic" thing. The Model containing the "car part" Elements has a "breaks-down" relationship to the Element modeling the car-as-a-whole because it "breaks down" the Element (a simple, atomic model) into a finer-grained Model. Thus a BIS repository can cohesively model the car at two different Granularities--**both** as an "atomic" thing **and** as a fine-grained collection of parts.

![04](./media/bis-modeling-04.png "Models break-down Elements for finer-grained modeling")

The Element modeling the car-as-a-whole is also in a Model. What Element is **that** Model breaking down? BIS escapes from infinite regression by defining a special RepositoryModel that is not required to "break down" some other Element. The RepositoryModel acts as the "Table of Contents" of the BIS Repository. It contains a "Subject" Element that textually references the Object that the BIS Repository is about. The RepositoryModel also contains one or more InformationPartitionElements. Each declares a modeling Perspective used to model the Subject. Each Partition will be "broken down" by Models of the same Perspective, e.g. a PhysicalModel will "break down" a PhysicalPartition.

![05](./media/bis-modeling-05.png "The RepositoryModel acts as the Table of Contents of the BIS Repository")

### Relationships

There can be many different kinds of Relationships among Elements within a Model or spanning Models. The various specializations of the ElementHasChildElements relationship are particularly important—they implement parent-child/whole-part relationships among Elements. For example, if Object 1 is a Door, it might have DoorHardware as a Child.

![06](./media/bis-modeling-06.png "Within a Model, parent Elements allow child Elements")

Thus, BIS supports two ways of modeling an Object and its parts:

1. The class of Element modeling the Object can be "atomic" (not allowing any child Elements) and be broken-down as many Elements in a finer-grained "sub-Model". BIS calls this a "sub-modeled Element". The sub-modeled Element is intentionally redundant with the Elements in its sub-Model.

2. The class of Element modeling the Object can allow "child" Elements, but then it is not allowed to be broken-down in a sub-Model. BIS calls this a "parent Element"—essentially modeling an Entity as an aggregate. A parent Element is not redundant with its child Elements.

At a minimum, a parent Element represents the identity of the aggregate. Optionally, it may model part the "substance" of the aggregate, in which case, its part of the "substance" should not be redundant with it child Elements. For example, the physical geometry of the DoorElement should not contain the geometry of the door hardware (assuming it has a DoorHardware child Element that contains that geometry.) You can model a "pure" assembly PhysicalElement by giving the parent Element no geometry and add child Elements that hold all of the geometry of the aggregate Entity.

These two rules imply that a given class of Element cannot be both sub-modeled **and** a parent. The schema author must choose one or the other (or choose to make the Element "strictly atomic", meaning it can neither be sub-modeled nor have children.)

### ElementAspect

[ElementAspects](./glossary.md#elementaspect) are a flexible way to augment the properties of an Element. They are sets of properties that typically hold information needed only in certain contexts, e.g. during the construction phase or when we have a link to information about the modeled Entity in a different repository. ElementAspects are not individually identifiable (thus relationships cannot point to them), but they may be the "source" of a relationship pointing to an Element.

### Identifiers

Elements have one primary identifier ([ElementId](./glossary.md#elementid)) and hold two identifiers of the real-world [Entity](./glossary.md#entity) that the Element models: [Code](./codes.md) and [FederationGuid](./glossary.md#federationguid).

[**ElementId**](./glossary.md#elementid) is a 64-bit integer property that is the Element's primary identifier and must be unique within the BIS Repository. Different implementations of BIS Repository manage this identifier differently.

The [**Code**](./codes.md) is a human-readable string identifier of the represented Entity. The Code en**code**s some business meaning.
There are three Element properties related to the Code: [CodeValue](./glossary.md#codevalue-property) holds the Code, [CodeSpec](./glossary.md#codespec-property) governs its encoding/decoding, and [CodeScope](./glossary.md#codescope-property) defines the scope within which it is unique. The combination of the three code-related properties must be unique within the BIS repository and could be considered a secondary identifier of the Element.

The [**FederationGuid**](./glossary.md#federationguid) is optional but can be used to identify an Entity that is represented in many different repositories (BIS or otherwise).

**UserLabel** is an optional property of an Element that can be used as an informal name in the GUI, but it does not have to be unique. In some GUIs, if the UserLabel is null, the CodeValue will be used as a display label.

> Next: [BIS Organization](./bis-organization.md)