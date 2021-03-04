# EC Schema Validation

The variability and potential magnitude of schema rules lead to the need for quality control and long-term maintainability over EC schemas.

## EC v3

EC v3 is a more clearly defined and rigorous version of the EC that has been used widely in Bentley over the past 10+ years.

An **[ECSchema](./ec-schema.md)** describes one "domain"—its primary contents are a closely related set of "ECClasses" of various kinds.

Unless noted otherwise, all references to “schema”, “class” and “property” in this document refer to ECSchema, ECClass and ECProperty.

## Validation Rules

EC Schemas are validated against a set of rules. If one rule is violated, the whole schema will fail validation.

The rules are broken into the different parts of the Schema they are validated against.

### General [Class](./ec-class.md) Rules

#### EC-100 <a name="EC-100"></a>

A class may not not derive from a sealed base class.

#### EC-101 <a name="EC-101"></a>

A class may not derive from a base class of a different EC type (i.e. EntityClass => RelationshipClass).

#### EC-102 <a name="EC-102"></a>

A abstract class may not derive from a non-abstract base class.

### [CustomAttribute Container](./customattribute-container-types.md) Rules

#### EC-500 <a name="EC-500"></a>

A CustomAttribute applied to a container must be of a concrete (non-abstract) class.

### [Enumeration](./ec-enumeration.md) Rules

#### EC-700 <a name="EC-700"></a>

The type of the enumeration must be either a String or an Integer.

### [Mixin](./ec-mixin-class.md) Rules

#### EC-1100 <a name="EC-1100"></a>

The class that a Mixin is applied to must satisfy the Mixin applies to constraint.

### [Property](./ec-property.md) Rules

#### EC-1300 <a name="EC-1300"></a>

Property overrides cannot change the property's value type (ie. String, Integer, Boolean, etc.)

#### EC-1301 <a name="EC-1301"></a>

Property overrides cannot change the property's type (ie. PrimitiveProperty, EnumerationProperty, StructProperty, etc.)

#### EC-1302 <a name="EC-1302"></a>

Property overrides cannot change the persistence unit.

### [Relationship Class](./ec-relationship-class.md) Rules

#### EC-1500 <a name="EC-1500"></a>

A derived Relationship's abstract constraint must be supported by the base Relationship class constraint(s).

#### EC-1501 <a name="EC-1501"></a>

A derived Relationship's class constraint(S) must be supported by the base Relationship class constraint(s).

#### EC-1502 <a name="EC-1502"></a>

The constraints of a RelationshipClass must derive the the abstract constraint class.

#### EC-1600 <a name="EC-1600"></a>

Relationship constraints must contain at least one constraint class.

#### EC-1601 <a name="EC-1601"></a>

An abstract constraint is required if a Relationship constraint has multiple constraint classes.
