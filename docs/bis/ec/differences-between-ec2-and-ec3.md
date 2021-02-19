# What's changed between ECObjects 2 supported in Power Platform and ECObjects 3 supported in iTwin.js

This page if for people who have used ECObjects in Power Platform and want to learn how it has changed in iTwin.js.  It does not cover all new features of EC 3, rather it focuses on what has changed between the two versions.

## Changes to Schema

1. Schema version now has three digits RR.WW.mm where equal RR indicates read compatibility, equal WW indicates write compatibility, mm is for additive changes or modifications that do not break read or write compatibility.
2. The namespacePrefix attribute has been replaced with 'alias'.

## Changes to Classes

1. ECClass has been split into 3 discrete sub types, [ECEntityClass](./ec-entity-class.md), [ECStructClass](./ec-struct-class.md) and [ECCustomAttributeClass](./ec-custom-attribute-class.md).  These three types replace the individual 'isDomainClass', 'isStruct' and 'isCustomAttributeClass' attributes respectively.  A consequence of this is that a class may be of only one type in EC 3, where you could make classes which were domain, struct and custom attribute in EC 2.
2. All 4 class types add a 'modifier' flag which can be None (concrete and not sealed/final), Abstract or Sealed.
3. A class may only have a base class of the same type (e.g. an ECRelationshipClass cannot have an ECEntityClass as a base class)
4. Multiple base classes are only supported on ECEntityClasses in EC 3 and additional restrictions are applied.
    1. Only one base class may be a concrete class (modifier=None)
    2. Additional base classes must be abstract and have the IsMixin custom attribute applied
    3. Properties must be unique across all base classes (e.g. Only one base class may have a 'Name' property defined or inherited)
5. ECStructClass and ECCustomAttributeClass definitions should not have any base classes

## Changes to Relationships

1. Relationship classes may only have one base class and that base class must have constraints which are equal to or more broad than the derived class
2. Relationship constraint classes and multiplicity on an endpoint of a relationship must have a common base class and that base class must be specified as the 'abstract constraint' of the relationship.
3. The cardinality attribute has been renamed multiplicity and the format has changed from (x,y) to (x..y), unbounded y is represented by * instead of N.
See [ECRelationships](./ec-relationship-class.md) for more details on relationship constraints.

## Changes to Properties

1. ECStructArrayProperty replaces ECArrayProperty with 'isStruct' set to true

## Changes to important metadata

1. Units - Now a first class concept with [Unit](./ec-unit.md), [KindOfQuantity](./kindOfQuantity.md) and [Format](./ec-format.md) definitions as top level EC items.  The UnitSpecification custom attribute on ECProperty has been replaced with the 'kindOfQuantity' attribute.  A KindOfQuantity definition defines the persistence and presentation of the value.
2. Property Category - Now a first class concept with [PropertyCategory](./property-category.md), a top level EC item.
3. The StandardValues custom attribute has been replaced with [ECEnumerations](./ec-enumeration.md), a top level EC item.
4. All standard custom attributes supported in EC 3 have been moved to the CoreCustomAttributes schema.  EditorCustomAttributes and Bentley_Standard_CustomAttributes should no longer be used.
