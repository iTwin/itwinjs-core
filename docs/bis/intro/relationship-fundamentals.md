# Relationship Fundamentals

## Introduction

Relationships are one of the main building blocks of BIS. They are used to define associations among entities. More specifically, BIS depends heavily upon EC relationships to define its conceptual schema. With the exception of relationships used by navigation properties, all relationships in BIS must inherit from some relationship in the core. The most commonly used core relationships are:

- ElementOwnsChildElements
- ElementRefersToElements
- ElementOwnsUniqueAspect / ElementOwnsMultiAspects
- ModelContainsElements

## Relationship Inheritance in BIS

Relationship inheritance is supported in BIS, but is tightly constrained. All relationships must be abstract, concrete or sealed:

- Abstract relationship classes can never be instantiated. ElementRefersToElements is an example of an abstract relationship. It must be subclassed in order to be instantiated.

- Concrete relationship classes can be inherited from and can be instantiated. ElementOwnsUniqueAspect is an example of a Concrete relationship.

- Sealed relationship classes can never be inherited from. ModelContainsElements is an example of a sealed relationship.

In addition, all BIS relationships, excepting the ones used to define new navigation properties, must inherit (directly or indirectly) from a relationship in the BIS core.

Inheriting relationships must “narrow” the relationship:

- Equal or more-specific sources and targets.
- Equal or more-restrictive multiplicity.
- The polymorphic flag may be changed from `true` to `false` but not `false` to `true`.
- Strength and direction must be the same.

## Relationship Strength

The strength of a relationship defines the lifetime of objects on its target end point and therefore, it must be specified. The two accepted strengths in BIS are:

- Embedding: Objects control the lifetime of some other objects, considered their children. That is, when a parent object is deleted, related child objects will be deleted as well. ElementOwnsChildElements is an example of an embedding relationship.

- Referencing: Objects point to some other objects without controlling their lifetime. ElementRefersToElements is an example of a referencing relationship.

The strength direction of a relationship specifies the orientation in which the strength is interpreted. That is, in a `Forward` relationship, its strength is enforced from Source to Target. Whereas in a `Backward` relationship, its strength is enforced from Target to Source. If a relationship does not specify a strength direction, `Forward` is assumed by default.

ElementOwnsChildElements is an example of a `Forward` relationship.  ModelModelsElement is an example of a `Backward` relationship since its embedding strength is enforced from an Element to its Model.

In most cases, both the strength and direction of a relationship are already defined by base relationships defined at the core. These settings cannot be modified or overridden by subclasses.

## Relationship multiplicity

Each endpoint of a relationship must define a multiplicity, they together define the cardinality of the relationship.  The multiplicity format specifies the number of times an endpoint may be used in this relationship.  It is defined using the format `(<lower>..<upper>)`.  Lower must be between `0` and `*` and upper between `1` and `*`, where `*` represents unbounded.

### Example

```xml
<ECRelationshipClass typeName="ElementOwnsChildElements" strength="embedding" modifier="None">
    <Source multiplicity="(0..1)" roleLabel="owns child" polymorphic="true">
        <Class class="Element"/>
    </Source>
    <Target multiplicity="(0..*)" roleLabel="is owned by parent" polymorphic="true">
        <Class class="Element"/>
    </Target>
</ECRelationshipClass>
```

The ElementOwnsChildElements relationship defines the following constraints:

- The parent Element (Source) may own any number of child Elements (Target).  Determined by the Target multiplicity.

- The parent Element controls the lifetime of the child Elements, so deleting the parent deletes the children.  Determined by the relationship strength.  NOTE: Direction is assumed to be from Source to Target because none is specified.

- An Element may only have one parent. Determined by the Source multiplicity.

Relationships that derive from ElementOwnsChildElements may make the following changes

- Make the relationship mandatory for the parent by changing the target multiplicity to `(1..*)`.

- Make the relationship mandatory for the child by changing the source multiplicity to `(1..1)`.

- Limit the parent to only one child by changing the target multiplicity to `(0..1)`.

- Limit either endpoint to a classes more specialized than Element by changing the Class constraint to an entity class which derives from Element.

- Limit either endpoint to a specific class by changing the polymorphic flag to `false`.

- Make the relationship abstract or sealed by changing the modifier to `Abstract` or `Sealed`.

## Supported Relationship Capabilities

Relationships in BIS are restricted more than in plain EC.

- Relationship inheritance is strictly limited, as discussed previously. A relationship may only have a single base class.

- Relationship end points must be either entity classes or link-table relationships.

- Relationship end points must have a single constraint class.

- Aspects are only allowed as the source of relationships behind navigational properties, or as the target of element-owns-aspect relationships.

- Plain EC supports `Holding` as an additional type of relationship strength, but it is not supported by BIS.

## Implementation Details Limiting Relationship Flexibility

For the purposes of optimized performance of BIS applications using iModel technology, the full power of relationships is not available in all cases. To understand these limitations, it helps to understand the 2 implementations of relationships in iModel databases.

### iModel-specific implications of Relationship Inheritance

- If the relationship is not sealed (can be subclassed) then an additional database column is required to store the relationship class Id. This is the case of the ElementOwnsChildElements relationship which is expected to be subclassed.

- Sealed relationships with no base class and no subclasses will not need an extra column to store the relationship class Id. This is the case of the ModelContainsElements relationship, which is marked as sealed with no base class.

### Link Table

In iModel databases, there is a single link table (bis\_ElementRefersToElements) that supports all relationships between elements with either of these requirements:

- Both the source and the target have unconstrained multiplicity `(*..*)`

- The relationship can contain properties.

All relationships that have either of these requirements must inherit from the ElementRefersToElements relationship in the BIS Core schema.

Note that neither Models nor Aspects may be the source nor target of relationships in the link table, and therefore Models and Aspects cannot be involved in relationships with properties or relationships with `(*..*)` multiplicity.

An example of a relationship stored in the Link Table is the ElementGroupsMembers relationship that has the unconstrained multiplicity `(*..*)`.

### Navigation Properties

Navigation Properties are analogous to foreign keys but exposed as EC properties and  EC relationships. As an implementation detail for iModels, their relationship storage (and presentation) strategy enables access via a foreign key of the object being pointed to in the object pointing to it. The side of the relationship stored in the foreign key must have a multiplicity of `(0..1)` or `(1..1)`. The Navigation property is always defined in the base relationship and never via subclassing.

For sealed Navigation Properties, a single foreign key database column is used to store the relationship. An example of the use of a navigation property for a sealed relationship is the ModelContainsElements relationship. The relationship has a multiplicity of `(1..1)` on the source side (every Element must be in a Model), so the relationship is stored in the Model navigation property of the target Element.

Regarding subclassable Navigation Property relationships, ElementOwnsChildElements relationship can be reviewed as an example. This relationship is not sealed (it can be, and often is, subclassed) so two database columns are used to store it. The relationship has a multiplicity of `(0..1)` on the source side (every Element has 0 or 1 parent), so the relationship is stored in the Parent navigation property of the target.

Lastly, Navigation Properties can also be defined for Link table relationships. In this case, the link table relationship is specified as an end point of the Navigation Property relationship.

> Next: [Schemas](./schemas-domains.md)