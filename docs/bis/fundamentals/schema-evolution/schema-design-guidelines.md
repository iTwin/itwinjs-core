# Schema Design Recomendations and Guidelines

## Data Classification Recommendations

- If a concept can be further classified beyond what is covered by the chosen primary data-classification scheme, it typically leads to the need of introducing `bis:TypeDefinitionElement` subclasses.
- Deep physical-element hierarchies typically model multiple levels of containment. Such cases are usually better modeled via *Spatial Composition*. That usually results in the more fundamental and granular physical concepts modeled via `bis:PhysicalElement`s while the higher-level containment semantics are captured in classes that follow the patterns defined by the `SpatialComposition` schema.
- Categories are usually introduced driven by element-visualization needs. However, there are cases in which it is appropriate to introduce them for data-classification purposes. This is typically done when a classification orthogonal to the element-class and Type-Definition schemes.

## Lower-layer schemas

Schemas at the Core, Common or Discipline layers are meant to be shared by multiple use-cases. The lower the layer of a schema, the more widely used it is expected to be. With that in mind, the following recommendations are especially useful for shared schemas:

- Study other schema ecosystems and formats covering the domain of interest for inspiration.
- Create a list of the main terms and their definitions in your domain. They typically lead to the primary data-classification scheme, which translates into the main element-classes to be introduced.
-

## iModel Connector schemas

-