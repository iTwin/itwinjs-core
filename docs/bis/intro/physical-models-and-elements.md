# Physical Models and Elements

## Introduction

In BIS, PhysicalElements and the models around PhysicalElements are ubiquitous.

TODO: *AB> "models around"?*

A PhysicalElement can be the result of a project; be materials consumed by an activity; or *be* the mechanisms that perform the work. They have form and function, and they exist in a spatial location. They can be imagined and remembered. They can be sensed and most often, moved and modified. PhysicalElements can stand alone or be part of an assembly. PhysicalElements form the backbone of BIS.

TODO: *AB> Suggest practical/simple explanation before theoretical/complex one*

## PhysicalElements
**Spatial.** All things physical have mass [energy] and exist within a contiguous spatial boundary [form] and is, of course, at a specific location. With SpatialElement already a fundamental concept in BIS, it is natural to have it as the base class for PhysicalElement. In essence; a PhysicalElement brings matter to a SpatialElement.

TODO: *AB> Guaranteed to be contiguous?*

TODO: *AB> PhysicalElement is SpatialElement3d, so they always have 3d location. Perhaps show class diagram.*

TODO: If FormAspects should be a separate chapter (appendix?), Allan volunteers to write it.

**Functional.** Functions inhere in PhysicalElements. A service is a realization of such an inherent function. A physical entity is designed or selected specifically with such functionality in mind. So, there is a close relationship between a physical entity and its function. E.g. a physical entity can deteriorate until its functionality is affected, at which point it will fail to deliver services thus rendering it dysfunctional.

A FunctionalModel models a system from a functional perspective by making use of FunctionalElements. These FunctionalElements represent the functionality and SpatialLocation that is inherent in a PhysicalElement – but without employing the use of an actual PhysicalElement. This enables FunctionalModels to describe the most salient functional aspects of the system but without elaborating on specific physical aspects.

TODO: *AB> This functional stuff should be in a different section, perhaps "workflows"? We should also reference the Functional chapter. And remember that not all PhysicalElements are associated with a function.*

In much the same way a PhysicalModel will describe the system from a physical perspective without elaborating on the functional aspects.

Of course, at some point these two perspectives must converge. The PhysicalElementFulfillsFunction relationship is used for this purpose. With such a relationship in place it is implied that the PhysicalElement’s function and spatial location is “the same as” that of the FunctionalElement. So PhysicalElementFulfillsFunction brings the physical to the functional.

See: [Functional models and Elements](functional-models-and-elements)

**Identifiable.** A PhysicalElement – as with all elements – only exist in a model because someone identified it as important. For some physical entities, like the “Golden Gate Bridge”, this unique identification is natural. But for others; like a single "Red Face Brick C216-16 SW" (of which there may be millions) this would seem inappropriate. It is however not a matter of size, quantity or configuration that determines whether an PhysicalElement is identifiable – they all are. *See Element Identifiers, Code, and AlternateCode Aspect.*

TODO: *AB> Are we adding much in the Identifiable paragraph?. We don't require identifiability. Perhaps just one sentence and a reference to another chapter*

**Strong vs Weak Boundaries.** In the real world some physical elements may be harder to identify than others. E.g. when dealing with fluids or when trying to isolate parts of, say, a road surface. To address this BIS provides a subclass of PhysicalElement called a PhysicalPortion. A PhysicalPortion represents an arbitrary portion of a larger PhysicalElement that may be broken down in more detail in a separate (sub) PhysicalModel.

TODO:*AB> Not sure if this portion stuff is right*

TODO: is a fluid a portion element?
TODO:*AB> I wouldn't think so...*

TODO: what is the relation between portion and ElementEncapsulatesChildElements

TODO: what about aggregation BIS also supports elaboration and modification assemblies?
TODO: not clear which one deals with “road surface example”

**Instance vs Type.** It’s easy to miss, but important to remember that PhysicalElements are instance; not types. (I.e. not types of real world entities; they are real world entities). The PhysicalElement doesn’t have to exist yet, but when it does, there can be only one. Therefore, what’s identified by a PhysicalElement is the single physical entity as it exists - actually or potentially - in the real world. 

Of course, there is the undeniable need for types of physical entities. E.g. an entry in a masonry catalog may contain the type "Red Face Brick C216-16 SW”. In BIS these are called PhysicalTypes. PhysicalTypes falls under InformationContentElements. They are optional as far as the PhysicalElement is concerned. A PhysicalElement may reference [zero or one] such a type definition via the PhysicalElementIsOfType relationship. PhysicalTypes have their own properties and relationships. PhysicalElements with the PhysicalElementIsOfType relationship can gain a lot of common properties and behavior from their shared type definition.

TODO: *AB> Types (and relationship to PhysicalElements) is good topic, but we can mostly refer to the existing chapter. Feel free to add material there.*

TODO: How is PhysicalMaterial different from PhysicalType? I see ‘PhysicalMaterial’ derived from DefinitionElement. Shouldn’t this be from PhysicalType?

TODO: *AB> Materials never have form. PhysicalTypes always have form and may have multiple materials.*

**Past, Present, Future.** PhysicalElements may refer to potential real-world entities - ones that don’t exist yet. They may also refer to physical entities that existed at some point in the past. Whether future, present or past the only thing that’s important is that when it exists (or existed) in the real world there will be (or was) only one.

TODO: *AB> Shaun suggested using the bio definition.*

**Change.** Real world physical entities change; so PhysicalElements must change with them. There may me many known “versions” but only one of those represent the real world entity. The others represent the historic or future version. If version is used to indicate variation, then we are dealing with PhysicalType rather than PhysicalElement. 

TODO: this needs more description, perhaps move it to a common section.

TODO: *AB> Yes. Is there something special about change and PhysicalElements vs change and other Elements? If not it seems to be a topic for a different chapter.*

**Generic PhysicalObject.** PhysicalElement is an abstract class from which all physical entity classes derive. It is however useful to work with physical entities in an anonymized way. The PhysicalObject class, from the Generic schema, serves this purpose.

TODO: *AB> This seems like too much of a presentation for a simple concept. Perhaps the class hierarchy elsewhere (in this chapter) will cover it.*

**Physical Layer.** The notion of a PhysicalElement is a core concept and therefor exists, along with related key concepts such as PhysicalType and FunctionalElement, in the BisCore layer. Detail physical aspects as well as specific physical entities, such as pumps, valves, pipes and the like are modeled in the Physical [Schema Domain] Layer.

TODO: *AB> Probably best to leave in the Schemas and Domains chapter* 

TODO: relationship to Activities (and Plans)

TODO:*AB> Seems like a topic for a different chapter. The chapter on the "backbone" can't be expected to explain everything that is supported by the backbone.*

See: [Element Fundamentals](element-fundamentals)

## PhysicalModels
PhysicalModels model physical entities [PhysicalElement ] as they exist – actually or potentially – in the real world. A PhysicalEntity can be an abstraction of a more elaborate physical entity. BIS provides aggregation, elaboration and modification relationship with child element to support such abstractions. 

TODO:*AB> PhysicalModel contain PhysicalElement, and can also break down PhysicalElements. PhysicalModel can also contain SpatialLocationElements, InformationElements*

TODO: *AB> There is no formal PhysicalEntity concept in BIS. Not clear to me what you are trying to say.*

See: [Model Hierarchy](model-hierarchy) and [Model Fundamentals](model-fundamentals).

TODO: I don’t know of much more to say since more is already covered by the information hierarchy 

## Example

TODO: want to show a real simple and also a very complicated example
Simple: pump, pipe, valve
Complicated: pavement layers with linear location
