# Schema Design Recommendations and Guidelines

## General Recommendations

- Focus on one modeling perspective per schema. That is, separate concepts focusing on *Physical* modeling from concepts implementing *Analytical* or *Functional* modeling, each into their own schema. This separation becomes mandatory if the target schemas are meant to be shared. In that case, the target [schema-layer](../intro/bis-organization.md) for the resulting schemas will be different (e.g. *Discipline-Physical* vs. *Discipline-Other*). It is fine for the *Physical* schema to include `SpatialLocationElement` subclasses and definition and other information classes used for physical modeling.
- Concepts introduced only as helpers of an authoring workflow are typically considered application-specific. Separate them into their own Application-layer schema from other concepts focusing on the result (e.g. modeling of Physical objects in light of a given discipline).
- In general, mix-ins should not have any properties defined in them. They lead to complex UNION queries in iModels, causing a slow-down in data retrieval from them.
- Only make use of dynamic schemas (generated at runtime) to capture concepts that truly vary per iModel. If a given connector has some connector-specific fixed concepts, capture them in an Application-layer schema and have any dynamic classes subclass those Application-layer classes. This makes it easier for downstream consumers to understand what is fixed and what is dynamic.

## Data Classification Recommendations

- If a concept can be further classified beyond what is covered by the chosen [strategies for classifying elements](../fundamentals/data-classification.md), you it typically leads to the need of introducing `bis:TypeDefinitionElement` subclasses.
- Deep physical-element hierarchies typically model multiple levels of containment. Such cases are usually better modeled via *Spatial Composition*. That usually results in the more fundamental and granular physical concepts modeled via `bis:PhysicalElement`s while the higher-level containment semantics are captured in classes that follow the patterns defined by the `SpatialComposition` schema.
- Categories are usually introduced driven by element-visualization needs. However, there are cases in which it is appropriate to introduce them for data-classification purposes. This is typically done when a classification in need is orthogonal to the element-class and Type-Definition schemes.

## Lower-layer schemas

Schemas at the Core, Common or Discipline layers are meant to be shared by multiple use-cases. The lower the layer of a schema, the more widely used it is expected to be. With that in mind, the following recommendations are especially useful for shared schemas:

- Study other schema ecosystems and formats covering the domain of interest for inspiration.
- Create a list of the main terms and their definitions in your domain. They typically lead to the primary data-classification scheme, which translates into the main element-classes to be introduced.

## iModel Connector schemas

- Make use of Type-Definitions when appropriate in order to avoid an unnecessary large number of classes in a schema.
- Categorize properties from the source format into:

  1) **Standard - intrinsic** to the primary or secondary classification of its owning concept. These are candidates to be first-class properties on an *Element* or *TypeDefinition* class.
  2) **Standard - not intrinsic** to the classification of its owning concept. These are candidates to be captured in an *Aspect* class.
  3) **User-defined**. These should be captured by an *Aspect* class in a dynamic schema (generated at runtime).

Another way to think about it is to ask if a given set of properties would appear on many different classes. If there is a single natural "base class" for all of the classes that need those properties and only classes that need those properties, then it makes sense to add the properties to that *Element Class or* its related *TypeDefinition* class. Otherwise, it may be better to use an *Aspect* class.