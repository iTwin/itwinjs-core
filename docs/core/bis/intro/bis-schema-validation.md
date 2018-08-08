# BIS Schema Validation

The variability and potential magnitude of schema rules lead to the need for quality control and long-term maintainability over BIS schemas.

## BIS uses EC v3

BIS is defined using EC v3. EC v3 is a more clearly defined and rigorous version of the EC that has been used widely in Bentley over the past 10+ years.

BIS is modularized into a set of interrelated *domains* (each expressed in a separate ECSchema) that are consistent, coordinated and constrained to maximize the functionality of the entire BIS-based ecosystem. Some flexibility that is available in "raw" EC is not available in BIS. For example, all ECClasses defined in domain ECSchemas (other than BisCore itself) are required to sub-class from some ECClass in BisCore. Other BIS rules are documented at [BIS Schema Validation](./bis-schema-validation.md).

Unless noted otherwise, all references to “schema”, “class” and “property” in this document refer to ECSchema, ECClass and ECProperty.

## Validation Rules

BIS Schemas are validated against a set of rules. If one rule is violated, the whole schema will fail validation.

The rules are broken into the different parts of the Schema they are validated against.

### General (Schema) Rules

- A schema must load and pass EC3.1 spec validation. **_XXXX NEED LINK XXXX_**.
- A schema's ECXML version must be at least, 3.1
  - http://www.bentley.com/schemas/Bentley.ECXML.3.1
- A schema may not reference any EC2 or EC3.0 schemas
- A schema must specify a three-part version number
  - The version number must be in the format RR.WW.mm (that is, Read.Write.Minor)
  - Each version component must be zero-padded to two digits (e.g. 01.02.00)
- A schema reference must specify a three-part version number (in the same format described above)
- If the schema contains 'dynamic' (case-insensitive) in its name it must apply the **CoreCA:DynamicSchema** custom attribute

### Mixin Rules

- Mixin classes may not override an inherited property.

### Entity Classes

- Entity classes must derive from the BIS hierarchy.
- Entity classes may only derive from one base Entity class.
- Entity classes may not inherit a property from more than one base class.
- A mixin property cannot override an Entity property inherited from a base Entity class.
- Properties should not be of type **long**. These properties should be navigation properties if they represent a FK or be of type **int** or **double** if they represent a number.
- If any aspect (ECClass which derives from **ElementMultiAspect**) exists, there must be a relationship that derives from the **ElementOwnsMultiAspects** relationship with this class supported as a target constraint.
- If any aspect (ECClass which derives from **ElementUniqueAspect**) exists, there must be a relationship that derives from the **ElementOwnsUniqueAspect** relationship with this class supported as a target constraint.
- Entity classes cannot implement both **bis:IParentElement** and **bis:ISubModeledElement**.
- Entity classes cannot subclass **bis:PhysicalModel**.
- Entity classes cannot subclass **bis:SpatialLocationModel**.
- Property overrides cannot change the persistence unit.

### Relationship Classes

- Relationship classes must not use the holding strength.
- Relationship classes must not have a source constraint multiplicity upper bound greater than 1 if the strength is embedding and the direction is forward.
- Relationship classes must not have a target constraint multiplicity upper bound greater than 1 if the strength is embedding and the direction is backward.
- Relationship classes must not have an abstract constraint if there is only one concrete constraint set.
- Embedding relationships should not have 'Has' in the class name.

### Struct Classes

- Struct classes must not have base classes.

### Custom Attribute Classes

- Custom Attribute classes must not have base classes.

### KindOfQuantities

- Kind Of Quantities must not use 'PERCENTAGE' or other unitless ratios.
- Kind Of Quantities must use an SI Unit for their persistence unit.
