# Fabric of the Universe

## Introduction

This section briefly describes the few core concepts that form the foundation for all of BIS. All information in a BIS Repository is defined using `Element`s, `ElementAspect`s, `Model`s and relationships. We refer to these core concepts a “the fabric of the universe”.

BIS is expressed using the [EC Information Modeling Language](../../ec/index.md) (aka “using ECSchemas”). However BIS imposes additional rules, naming conventions, and other restrictions. It is assumed that the reader is familiar with ECSchemas.

The concepts below (written as  `{ClassName}` ) are defined as ECClasses in the [“BisCore” domain schema](../../domains/biscore.ecschema.md).

## Elements

An `Element` is an object in the digital world that represents some entity in the real world, e.g. pumps, beams, contracts, companies, etc.). Elements are contained in Models. Elements are defined through ECProperties. Elements are the finest-grained object in BIS that can be individually identified and locked.

See [Element Fundamentals](../fundamentals/element-fundamentals.md) for a more detailed discussion.

## ElementAspects

An `ElementAspect` is a set of ECProperties that “belong” to a particular Element, but which have an independent lifecycle (they may come and go over the lifetime of the Element). ElementAspect instances are *owned* by a single Element; ElementAspects are never shared by more than one Element. An ElementAspect is considered part of the Element and therefore can not be the target of any “incoming” relationships (other than from the single Element that owns it.) There are ElementUniqueAspects that have a maximum of one instance per Element and ElementMultiAspects that may potentially have many instances per Element.

See [ElementAspect Fundamentals](../fundamentals/elementaspect-fundamentals.md) for a more detailed discussion of ElementAspects.

## Models

A `Model` is a *container* of Elements that provides a context (and a Modeling Perspective) for the contained Elements.

See [Model Fundamentals](../fundamentals/model-fundamentals.md) for a more detailed discussion of Models.

## Relationships

Various ECRelationship classes are defined in BisCore to relate Models, Elements and ElementAspects. See [Relationship Fundamentals](../fundamentals/relationship-fundamentals.md) for a more detailed discussion of Relationships.

## No other Data Types

All BIS information is defined using the `Element`, `ElementAspect`, `Model` classes or by using relationships. BIS domain schemas (other than `BisCore`) can only define classes that (directly or indirectly) subclass classes defined in the `BisCore` domain.

---
| Next: [Element Fundamentals](../fundamentals/element-fundamentals.md)
|:---
