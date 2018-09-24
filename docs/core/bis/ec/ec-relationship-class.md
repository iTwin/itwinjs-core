# ECRelationshipClass

This specialization of ECClass has all the same Sub-Elements and attributes as ECClass, as well as additional Sub-Elements to describe relationships among classes. Relationships in ECObjects follow more of a relational paradigm than an OO paradigm, i.e. they are not just simple object references, as in C++ or the .NET Type system. An ECRelationshipClass represents the possibility of (and constraints for) an instance of a relationship between two business object instances. See [ECRelationships](./ec-relationships.md).

Relationship inheritance is conceptually similar to regular ECClass inheritance but has additional restrictions. Derived relationship classes represent a specialization of the base relationship, not a new and distinct relationship. As such, the scope of a derived relationship must be equal to, or more restrictive than, the base relationship.

Relationship class rules:

- Every relationship must be fully defined, even if abstract
  - To be fully defined the source and target endpoints must specify:
    - Allowed ECEntityClasses
    - Multiplicity
    - Role label
    - Polymorphism flag
    - Abstract Constraint ECClass. Only required if there is more than one constraint class.

Relationship inheritance rules:

- Relationships only support single inheritance
- Relationships may only derive from an abstract relationship
- Derived relationships narrow relationship constraints of their parent relationship
  - Constraint classes must be equal to or more derived than those defined in a base class
  - Multiplicities must be equal to or more restrictive than those defined in a base class
  - The minimal number of required endpoints can be increased but not decreased
  - The maximum number of required endpoints can be decreased but not increased
  - The polymorphic flag may be left unchanged or changed from true to false but not false to true
    - **Note**: If the polymorphic flag is set to false for an abstract relationship class, all derived relationships can only apply to the classes specified in the abstract relationship constraints.

- Role labels may be customized with no restrictions in derived relationships.
- An abstract constraint class defined in a derived relationship must be or derive from the base abstract constraint class
- Only base relationships may define properties
- Only base relationships may be referenced by a Navigation property
- Only base relationships may set the order by attribute

## Additional Attributes

**strength** Identifies how the lifetime of the source and target objects are related.

**strengthDirection** indicates if source is the parent or vice versa…
- Forward indicates that the source is the "holder", "embedder" or "referencer". "Forward" is the default. Backward indicates that the target is the holder/embedder/referencer.

## Additional Sub-Elements

BaseClass _(0..1)_

[Source](#source-and-target) _(1..1)_

[Target](#source-and-target) _(1..1)_

# Source and Target

The Source and Target of a relationship define the endpoint classes and their constraints. Each endpoint must define at least one ECEntityClass, the multiplicity, if the endpoint is polymorphic, and if more than one constraint class is defined, an Abstract Constraint.

## Attributes

**isPolymorphic** true if this end can also relate to instances of subclasses of the specific class.

**roleLabel** label of the relationship as read from this end.

- This is the label for the role of the ECClass at this end of the relationship, e.g. in a DocumentCreatedByUser relationship, with Document as a source and User as the target, the source’s roleLabel is the role of the source class (Document) from the Document’s perspective: “created by User”. The roleLabel for the target end is the relationship from the User perspective “created Document”. These should include a mention of the ECClass on the other end, to make it possible to internationalize these (the word order may need to change).

**multiplicity** multiplicity at this end of the relationship. It is specified using the UML format (x..y) where x >= 0 and (y >= 1 or y == “\*”) and x <= y. It is typically set to (1..1) or (0..\*) if there is no limit.

**abstractConstraint** an ECClass which all the constraint classes at this end of the relationship must be or derive from. Required in base relationship classes if there is more than one constraint class in this end of the relationship, otherwise is optional.

## Sub-Elements

[ECCustomAttributes](./ec-custom-attributes.md) _(0..1)_

[Class](./ec-class.md) _(1..*)_

- the ECClass on this end of the relationship