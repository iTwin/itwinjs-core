# Main Data Classification Schemes

## Introduction

BIS offers a number of classification schemes that enable schema designers and iModel writers in general group the entities of interest in a particular discipline according to similar qualities and relationships that they share. It is also important for consumers of information modeled in BIS schemas to understand these classification schemes in order to take full advantage of the semantics they communicate.

The following are the main data classification schemes offered in BIS to schema designers:
- Element Classes
- Type Definitions
- Categories
- Classification Systems

## Data classification via Element Classes

BIS requires a schema to define a primary classification for every concept modeled with it. Such primary classification is the *Element class* chosen to model it.

Common examples of Element classes include concepts such as `Pipe`, `Column` or `Pump`.

The `BisCore` schema defines the core Element classes from which all other Element classes must descend. Please refer to [Element Fundamentals](./element-fundamentals.md#core-element-classes) for more details on *Core Element Classes*.

## Data classification via Type Definitions

Elements of the same *Element class* need to be often further classified. Such a need leads to the introduction of a secondary classification scheme along the same line of the primary classification chosen for a particular concept.

Common examples of secondary classifications include elements that can be ordered from catalogs: *Pump ABC-123* and *Pump XYZ-123* are secondary classifications of `Pump` as a primary concept. This classification scheme can be applied to elements not organized into catalogs too. *Wearing course layer*, *Base course layer* and *Sub-base course layer* are secondary classifications of `Course` as a primary concept.

BIS includes the concept of `Type Definitions` to cover such needs. Please refer to [Type Definitions](../physical-perspective/type-definitions.md) for more details.

## Data classification via Categories

Categories are typically used to offer end-users control over the visualization of a group of `GeometricElement` instances. Categories could be defined by end-users, specified by schema designers or iModel writers. Since Categories can group elements of various primary and secondary classifications, they can be seen as a scheme that can be used to achieve orthogonal classifications.

Please refer to [Categories](./categories.md) for more details.

## Data classification driven by External Standards

Various externally-defined standards exist that introduce classification systems targeting specific disciplines or workflows. BIS can capture those classification systems in parallel to the schemes described above via the classes and patterns introduced by the [ClassificationSystems](../../domains/classificationsystems.ecschema/) schema.

---
| Next: [Categories](./categories.md)
|:---
