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

#### BIS-001 <a name="BIS-001"></a>

A schema must load and pass EC3.1 [spec validation](../ec/ec-schema-validation.md).

#### BIS-002 <a name="BIS-002"></a>

A schema's ECXML version must be at least, 3.1.

- `<ECSchema ... xmlns=http://www.bentley.com/schemas/Bentley.ECXML.3.1 />`

#### BIS-003 <a name="BIS-003"></a>

A schema may not reference any EC2 or EC3.0 schemas.

#### BIS-004 <a name="BIS-004"></a>

A schema must specify a three-part version number

- The version number must be in the format RR.WW.mm (that is, Read.Write.Minor).
- Each version component must be zero-padded to two digits (e.g. 01.02.00).

#### BIS-005 <a name="BIS-005"></a>

A schema reference must specify a three-part version number (in the same format described above).

#### BIS-006 <a name="BIS-006"></a>

If the schema contains 'dynamic' (case-insensitive) in its name it must apply the **CoreCA:DynamicSchema** custom attribute.

#### BIS-007 <a name="BIS-007"></a>

Classes within the same schema cannot have the same display label.

#### BIS-008 <a name="BIS-008"></a>

A schema should not reference a deprecated schema.

#### BIS-009 <a name="BIS-009"></a>

An alias in the schema reference must be the same as the alias defined by the schema.

### Class Rules

#### BIS-100 <a name="BIS-100"></a>

Properties within the same class and category cannot have the same display label.

#### BIS-101 <a name="BIS-101"></a>

Classes not within the **BisCore**, **Functional**, or **Generic** schema cannot applied **bis:ClassHasHandler**.

#### BIS-102 <a name="BIS-102"></a>

Class should not derive from a deprecated class.

#### BIS-103 <a name="BIS-103"></a>

Class should not have deprecated properties.

#### BIS-104 <a name="BIS-104"></a>

Class should not have properties which are of deprecated struct types.

#### BIS-105 <a name="BIS-105"></a>

Classes should not use custom attributes that are deprecated.

### Custom Attribute Classes

#### BIS-400 <a name="BIS-400"></a>

Custom Attribute classes must not have base classes.

### Entity Class Rules

#### BIS-600 <a name="BIS-600"></a>

Entity classes must derive from the BIS hierarchy.

#### BIS-601 <a name="BIS-601"></a>

Entity classes may only derive from one base Entity class.

#### BIS-602 <a name="BIS-602"></a>

Entity classes may not inherit a property from more than one base class.

#### BIS-603 <a name="BIS-603"></a>

A mixin property cannot override an Entity property inherited from a base Entity class.

#### BIS-604 <a name="BIS-604"></a>

If any aspect (ECClass which derives from **bis:ElementMultiAspect**) exists, there must be a relationship that derives from the **bis:ElementOwnsMultiAspects** relationship with this class supported as a target constraint.

- Treated as warning if the schema has the **CoreCA:DynamicSchema** CA applied.

#### BIS-605 <a name="BIS-605"></a>

If any aspect (ECClass which derives from **bis:ElementUniqueAspect**) exists, there must be a relationship that derives from the **bis:ElementOwnsUniqueAspect** relationship with this class supported as a target constraint.

- Treated as warning if the schema has the **CoreCA:DynamicSchema** CA applied.

#### BIS-606 <a name="BIS-606"></a>

Entity classes cannot implement both **bis:IParentElement** and **bis:ISubModeledElement**.

#### BIS-607 <a name="BIS-607"></a>

Entity classes cannot subclass the following classes:

- **bis:PhysicalModel**
- **bis:SpatialLocationModel**
- **bis:GroupInformationModel**
- **bis:InformationRecordModel**
- **bis:DefinitionModel**
  - **bis:DictionaryModel** and **bis:RepositoryModel** are the only classes allowed to subclass **bis:DefinitionModel**
- **bis:DocumentListModel**
- **bis:LinkModel**

#### BIS-608 <a name="BIS-608"></a>

Property overrides cannot change the persistence unit.

#### BIS-609 <a name="BIS-609"></a>

Subclasses of **bis:Model** cannot have additional properties defined outside of **BisCore**.

#### BIS-610 <a name="BIS-610"></a>

Entity classes may not subclass deprecated classes.

#### BIS-611 <a name="BIS-611"></a>

Entity classes should not derive from deprecated mixin classes.

### KindOfQuantities

#### BIS-1000 <a name="BIS-1000"></a>

Kind Of Quantities must not use 'PERCENTAGE' or other unitless ratios.

#### BIS-1001 <a name="BIS-1001"></a>

Kind Of Quantities must use an SI Unit for their persistence unit.

#### BIS-1002 <a name="BIS-1002"></a>

Kind Of Quantities must not have duplicate presentation format.

### Mixin Rules

#### BIS-1100 <a name="BIS-1100"></a>

Mixin classes may not override an inherited property.

### Properties

#### BIS-1300 <a name="BIS-1300"></a>

Properties should not be of type **long**. These properties should be navigation properties if they represent a FK or be of type **int** or **double** if they represent a number.

#### BIS-1301 <a name="BIS-1301"></a>

Properties within the same class and category cannot have the same display label.

#### BIS-1302 <a name="BIS-1302"></a>

Properties must use the following supported ExtendedTypes:

- **BeGuid**
- **GeometryStream**
- **Json**

#### BIS-1303 <a name="BIS-1303"></a>

Properties must not use CustomAttribute **bis:CustomHandledProperty** unless CustomAttribute **bis:ClassHasHandler** is defined on their parent class (**not** derived from a base class).

### Relationship Classes

#### BIS-1500 <a name="BIS-1500"></a>

Relationship classes must not use the holding strength.

#### BIS-1501 <a name="BIS-1501"></a>

Relationship classes must not have a source constraint multiplicity upper bound greater than 1 if the strength is embedding and the direction is forward.

#### BIS-1502 <a name="BIS-1502"></a>

Relationship classes must not have a target constraint multiplicity upper bound greater than 1 if the strength is embedding and the direction is backward.

#### BIS-1503 <a name="BIS-1503"></a>

Relationship classes must not have an abstract constraint if there is only one concrete constraint set.

#### BIS-1504 <a name="BIS-1504"></a>

Relationship classes must not have an **bis:ElementAspect** target constraint (or source constraint if direction is backwards), unless they derive from **bis:ElementOwnsUniqueAspect** or **bis:ElementOwnsMultiAspects**.

#### BIS-1505 <a name="BIS-1505"></a>

Embedding relationships should not have 'Has' in the class name.

#### BIS-1506 <a name="BIS-1506"></a>

Relationship Constraint should not use a deprecated class or mixin as a constraint class.

#### BIS-1507 <a name="BIS-1507"></a>

Relationship Constraint should not use a deprecated class or mixin as an abstract constraint.

#### BIS-1508 <a name="BIS-1508"></a>

Relationship Constraint should not use constraint classes which derives from a deprecated base class or deprecated mixin classes.

#### BIS-1509 <a name="BIS-1509"></a>

Relationship Constraint should not use abstract constraint which derives from a deprecated base class or deprecated mixin classes.

### Struct Classes

#### BIS-1700 <a name="BIS-1700"></a>

Struct classes must not have base classes.

---
| Next: [BIS Glossary](./glossary.md)
|:---
