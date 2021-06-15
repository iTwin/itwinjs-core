# ECObjects Information Modeling Language Overview

The ECObjects language is comprised of items that have attributes. Items are grouped into "domains" via an "ECSchema", which provides the container and namespace for the items in that domain. There are several types of items in an ECSchema that describe objects, relationships, value types and quantities.  Each item type is described below in more detail.

The root of any domain is an *ECSchema* itself.

- An **[ECSchema](./ec-schema.md)** describes one "domain"—its primary contents are a closely related set of "ECClasses" of various kinds. The name attribute of the ECSchema serves as a namespace for all items defined within it. All items within an ECSchema have a unique name.

ECSchemas cannot contain other ECSchemas but they can reference ECSchemas:

- **ECSchemaReference** is a member of an ECSchema that expresses a reference another ECSchema. ECSchemaReferences are necessary when an ECSchema contains items that depend on the referenced ECSchema in some way (e.g., its ECClasses subclass from ECClasses in the referenced ECSchema.)

ECObjects has a fixed set of items and those items have a fixed set of attributes, the attributes of ECSchema and its items can be extended via custom attributes:

- **[ECCustomAttributes](./ec-custom-attributes.md)** is an optional child of ECSchema and some schema items that hold extended attribute values for the parent they are applied to.  ECCustomAttributes can be directly applied to most (but not all) kinds of items in an ECSchema, including ECSchema, ECClass and ECProperty.

The next 5 kinds of items are direct members of ECSchema and define different kinds of ECClasses. All of the ECClasses can contain **[ECProperties](./ec-property.md)** that define named properties with data types that are "primitives", "structs", arrays or navigation.

- **[ECEntityClass](./ec-entity-class.md)** describes a class of object whose instances are individually instantiable and identifiable. ECEntityClasses are the only kind of ECClass that can be inserted into a repository.

- **[ECMixinClass](./ec-mixin-class.md)** describes a special type of abstract entity class that can add properties and secondary inheritance hierarchies to an entity class. Mixin classes define concepts that span the primary entity inheritance hierarchy and they hold common property definitions. Mixins can be used as relationship endpoints.

- **[ECStructClass](./ec-struct-class.md)** describes a class of object whose instances are always instantiated as part of a larger entity, and are not individually identifiable or addressable. ECStructClasses are the only kind of ECClass that can be used as the *datatype* of an ECProperty.

- **[ECCustomAttributeClass](./ec-custom-attribute-class.md)** describes a class of object whose instances are "applied to" particular items of an ECSchema in order to extend their metadata beyond the built-in attributes of the items.

- **[ECRelationshipClass](./ec-relationship-class.md)** defines the connection between two entity instances. An ECRelationshipClass can be thought of as a description of a link table or foreign key column in a database. It can define which endpoint owns the other, the multiplicity and valid ECEntityClasses for each endpoint.

The remaining kinds of elements are also direct members of an ECSchema:

- **[ECEnumeration](./ec-enumeration.md)** defines a named type that contains a set of value-label pairs where the label is a non-localized display label (which can be used to form a localization key) and the value is the persistent primitive value. The value may be a string or an integer.

- **[KindOfQuantity](./kindofQuantity.md)** describes the quantity that a property’s value is measuring. For example, an ECProperty named "Pressure" in an "Instrument" ECEntityClass could have KindOfQuantity "RelativePressure". The "RelativePressure" may specify persistence units as being in PSI, as well as other metadata associated with that KindOfQuantity.

- **[PropertyCategory](./property-category.md)** defines a classification that can be associated with a property and help identify the importance of the properties it classifies.

- **[Unit](./ec-unit.md)** defines a unit of measure in terms of other units

- **[InvertedUnit](./ec-unit.md#Inverted-Unit)** inverts an existing unit whose dimensional derivation is unitless, like slope.

- **[Constant](./ec-constant.md)** defines a constant value which can be used in a unit definition

- **[Phenomenon](./ec-phenomenon.md)** defines a measurable physical quantity

- **[UnitSystem](./ec-unitsystem.md)** defines a loose grouping of units

- **[Format](./ec-format.md)** defines how to format a numeric value when displaying it to the user or for a report

- **[Changes Between ECObjects 2 and 3](./differences-between-ec2-and-ec3.md)** helpful if you have used EC in PowerPlatform.

The items that are direct members of an ECSchema must have names that are unique among all items that are direct members of an ECSchema, e.g., an ECEntityClass cannot have the same name as an ECStructClass. Uniqueness is determined using case-insensitive comparisons. See [ECName](./ec-name.md) for EC Naming Rules.
