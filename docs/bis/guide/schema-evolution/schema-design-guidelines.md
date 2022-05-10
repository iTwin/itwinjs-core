# Schema Design Recommendations and Guidelines

## General Recommendations

- Focus on one modeling perspective per schema. That is, separate concepts focusing on *Physical* modeling from concepts implementing *Analytical* or *Functional* modeling, each into their own schema. This separation becomes mandatory if the target schemas are meant to be shared. In that case, the target [schema-layer](../intro/bis-organization.md) for the resulting schemas will be different (e.g. *Discipline-Physical* vs. *Discipline-Other*). It is fine for the *Physical* schema to include `SpatialLocationElement` subclasses and definition and other information classes used for physical modeling.
- Some authoring workflows in certain disciplines are complex and need special algorithms based on helper recipe-like concepts. The output from these complex algorithms is typically the real-world entities being modeled. In such situation, it is important to separate those concepts into different schemas. That is, the helper concepts of an authoring workflow are typically considered application-specific and should be defined in an Application-layer schema. The concepts associated to the real-world entities being modeled should be defined in a separate schema. The latter is typically a candidate to be defined at a lower schema-layer (e.g. Discipline-Physical or Discipline-Other) for the applicable discipline, if appropriate.
- In general, mix-ins should not have any properties defined in them. They lead to complex UNION queries in iModels, causing a slow-down in data retrieval from them.
- Only make use of dynamic schemas (generated at runtime) to capture concepts that truly vary per iModel. If a given connector has some connector-specific fixed concepts, capture them in an Application-layer schema and have any dynamic classes subclass those Application-layer classes. This makes it easier for downstream consumers to understand what is fixed and what is dynamic.

## Element Classification Recommendations

See [Classifying Elements](../fundamentals/data-classification.md#general-recommendations) for general recommendations about the classification of element-semantics.

## Lower-layer schemas

Schemas at the Core, Common or Discipline layers are meant to be shared by multiple use-cases. The lower the layer of a schema, the more widely used it is expected to be. With that in mind, the following recommendations are especially useful for shared schemas:

- Study other schema ecosystems and formats covering the domain of interest for inspiration.
- Create a list of the main terms and their definitions in your domain. They typically lead to the primary data-classification scheme, which translates into the main element-classes to be introduced.

## iModel Connector schemas

- Use an existing element-class or type-definition class from a schema in the Discipline-Physical or Discipline-Other layers as target of the mapping done by an iModel Connector when possible.
- Make use of Type-Definitions when appropriate in order to avoid an unnecessary large number of classes in a schema.
- Categorize properties from the source format into:

  1) **Standard - intrinsic** to the primary or secondary classification of its owning concept. These are candidates to be first-class properties on an *Element* or *TypeDefinition* class.
  2) **Standard - not intrinsic** to the classification of its owning concept. These are candidates to be captured in an *Aspect* class.
  3) **User-defined**. These should be captured by an *Aspect* class in a dynamic schema (generated at runtime).

Another way to think about it is to ask if a given set of properties would appear on many different classes. If there is a single natural "base class" for all of the classes that need those properties and only classes that need those properties, then it makes sense to add the properties to that *Element Class or* its related *TypeDefinition* class. Otherwise, it may be better to use an *Aspect* class.

- Regarding concepts whose semantics are not well understood by the iModel Connector, they can be addressed by either:

  1) Targeting the appropriate class from the `Generic` schema, or,
  2) Directly subclassing the appropriate base-class from the `BisCore` schema if Standard-intrinsic properties need to be introduced on such concept. Avoid introducing an intermediate base-class for this kind of subclasses. They will get in the way of re-targeting a more appropriate base-class from a schema in the Discipline-Physical or Discipline-Other layers if the iModel Connector is able to understand the concept's semantics at a later time.