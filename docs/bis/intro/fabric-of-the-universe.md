# Fabric of the Universe

## Introduction

This section briefly describes a few core concepts that form the foundation of BIS. All information in a BIS Repository is defined using Elements, ElementAspects, Models and Relationships. We refer to these core concepts a “the fabric of the universe”.

BIS is expressed using the EC Information Modeling Language (aka “using ECSchemas”). However BIS imposes additional rules, naming conventions, and other restrictions. It is assumed that the reader is familiar with ECObjects. See \_\_\_\_\_ ECObjects 3.0 Specification\_\_\_\_\_.

Most of the concepts below are defined as ECClasses in the “BisCore” domain schema, which has the alias “bis”, and thus we write “{ClassName}” to denote an ECClass defined in BisCore.

## Elements

An `Element` is an object in the virtual world that represents some entity in the real world, e.g. pumps, beams, contracts, companies, etc.). Elements are contained in Models. Elements are defined through ECProperties. Elements are the finest-grained object in BIS that can be individually identified and locked.

See [Element Fundamentals](element-fundamentals) for a more detailed discussion.

## ElementAspects

An `ElementAspect` is a set of ECProperties that “belong” to a particular Element, but which have an independent lifecycle (they may come and go over the lifetime of the Element). ElementAspect instances are *owned* a single Element; ElementAspects are never shared by more than one Element. An ElementAspect is considered part of the Element and therefore can not be the target of any “incoming” relationships (other than from the single Element that owns it.) There are ElementUniqueAspects that have a maximum of one instance per Element and ElementMultiAspects that may potentially have many instances per Element.

See [ElementAspect Fundamentals](elementaspect-fundamentals) for a more detailed discussion of ElementAspects.

## Models

A `Model` is a “container” of Elements that provides a context (and a Modeling Perspective) for the contained Elements.

See [Model Fundamentals](model-fundamentals) for a more detailed discussion of Models.

## Relationships

Various ECRelationshipClasses are defined in BisCore to relate Models, Elements and ElementAspects. See [Relationship Fundamentals](relationship-fundamentals) for a more detailed discussion of Relationships.

## No other Data Types

All BIS information is defined using `Element`s, `ElementAspect`s, `Model`s and Relationships. BIS domain schemas (other than “BisCore”) can only define classes that (directly or indirectly) subclass classes defined in the “BisCore” domain.

<!-- TODO
## Breaking Down the World with Models, Elements, ElementAspects and Relationships

All data in an iModel is defined in a hierarchy of `Model`s, `Element`s and `ElementAspect`s, with relationships connecting them, as is shown below:

Xxxxxxxxxxx add figure xxxxxxxxxxx

This hierarchy is described in more detail in xxxxxxxxxxx and xxxxxxxx.
-->
