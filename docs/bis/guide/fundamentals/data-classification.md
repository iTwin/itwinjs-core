# Classifying Elements

## Introduction

There are at least four ways of expressing the semantic meaning of an Element which authors and consumers of BIS schemas should understand:

- [Element Classes](#element-class): Primary. A static part of metadata. Determine properties.
- [Type Definitions](#type-definitions): Further specialization within an Element Class. Optional. Dynamically defined in "reference data". May map to "catalog entries".
- [Categories](#categories): Only for geometric elements. Used as display criteria like CAD "layers" or "levels".
- [Classification Systems](#classification-systems): Optional. Typically express industry or company-specific classification that may be orthogonal to Element Class and Category.

## Element Class

Every Element has an [ECEntityClass](../../ec/ec-entity-class.md) that defines its primary semantic meaning and defines its properties.

Examples of Element Classes include `Pipe`, `Column` or `Pump` and are defined in [Domain Schemas](../../domains/index.md).

The [BisCore](../../domains/biscore.ecschema.md) schema defines the core Element classes from which all other Element classes must derive. See [Element Fundamentals](./element-fundamentals.md#core-element-classes) for more details on *Core Element Classes*.

## Type Definitions

Class and Type organize Elements along roughly the same semantic/property dimension. The Type is a further specialization of the Element Class, but is defined more-dynamically in data as TypeDefinition instances.

A schema author must *enable* such further specialization of a particular Class by defining a TypeDefinition Class that "applies to" that Class and creating a RelationshipClass that expresses that constraint.

The properties of the TypeDefinition define the properties whose values will be common among all instances of a given Type.

Types often correspond to "manufacturer's models" in a catalog, e.g. catalog entries for *Pump RCP-24* and *Pump RCP-26* can be thought of as specializations of the `Pump` Class. In some domains, the set of TypeDefinition instances may not be thought of as a "catalog", e.g. *Wearing course layer*, *Base course layer* and *Sub-base course layer* are specializations of the `Course` Class.

For a real-world specialization hierarchy, how much of it should translate into a Class hierarchy vs a set of Types? Generally, Classes are used for specializations that are known when the schema is designed and tend not to vary per project or facility. Types can easily vary among different digital twins. Types can also be used to hold property values shared by many Entity instances, whereas classes assume that all property values can vary per Entity instance.

See [Type Definitions](./type-definitions.md) for more details.

## Categories

Categories can organize Elements along a different dimension than Class/Type, though in practice often correlate with the Class/Type dimension.

Categories are used by the visualization systems to efficiently categorize `GeometricElement` instances for display purposes. Categories could be defined by end-users, specified by schema designers or iModel authors.

Please refer to [Categories](./categories.md) for more details.

## Classification Systems

Relating an Element to one or more Classifications in one or more ClassificationSystems allows even more dimensions along which to organize and express the meaning of Elements. These systems can be specific to a particular digital twin, but they are commonly representation of an externally-defined standard used in a given discipline. Examples include [Uniclass](https://www.thenbs.com/our-tools/uniclass) and [OmniClass](https://www.csiresources.org/standards/omniclass).

See [ClassificationSystems](../../domains/classificationsystems.ecschema.md/).

## General Recommendations

- If a concept can be further classified beyond what is covered by the chosen Element-Class strategy, it typically leads to the need of introducing `bis:TypeDefinitionElement` subclasses.
- Deep hierarchies of physical-element instances typically model multiple levels of containment. Such cases are usually better modeled via [*Spatial Composition*](./../data-organization/spatial-composition.md). That usually results in the more fundamental and granular physical concepts modeled via `bis:PhysicalElement`s while the higher-level containment semantics are captured in classes that follow the patterns defined by the `SpatialComposition` schema.
- Categories are usually introduced driven by element-visualization needs. However, there are cases in which it is appropriate to introduce them for data-classification purposes. This is typically done when a classification in need is orthogonal to the element-class and Type-Definition schemes.

---
| Next: [Type Definitions](./type-definitions.md)
|:---
