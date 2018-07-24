# Schema Versioning and Generations

## Schema Versions

As products (applications and services) evolve, they will require new and/or different data organization. As the data organization is defined in schemas, schemas must change to support the newer products. This leads to the need to clearly version schemas.

Schema versioning should not be confused with data versioning. Data will be changed very frequently by users. Schemas will change less frequently, only as improved products that require new data organization are released.

## Need for Schema Upgrade Strategy

Most iModels are accessed by multiple products. Products will synchronize through iModelHub. The data that products store will be organized by a single (versioned) set of schemas.

One potential strategy to ensure that all the products can work with the schemas in an iModel is limit the products used to the subset of products that are written for the exact versions of the schemas that are in the iModel. If there is a desire to update a product and that update requires newer schemas, then all of the products accessing the iModel are updated simultaneously. This quickly becomes an untenable strategy when more than a very small number of applications and services are used. For that reason, our schema evolution strategy needs to accommodate non-aligned product releases.

The BIS schema upgrade strategy is based on the concept of *Generations* which are closely related to *Minor Schema Upgrades* and *Major Schema Upgrades*.

Some services that do not directly work with iModels will use *BIS semantics*. These services will also benefit from versioning strategy described in this section.

## EC Schema Versioning

There are clear EC schema versioning rules that are based on the repercussion of changes made during a schema upgrade.

### Minor Schema Upgrades

Minor schema upgrades are schema changes that don’t break compatibility with applications written for the previous schema.

Minor schema upgrades can **ONLY** include:

* The addition of optional classes.
* The addition of optional properties.
* The addition of Kinds of Quantities
* The addition of Categories
* Changes to items that don’t affect code (or meaning), such as label changes, description changes and other changes that just affect presentation.

Minor schema upgrades may **NOT** include:

* The removal of classes.
* The removal of properties.
* The change of class definition (for example, changing the base class).
* The change of property definition (for example, changing the type).
* The change of relationship constraints, cardinality or strength.

### Major Schema Upgrades

Major schema upgrade can potentially break compatibility with applications written for the previous schema. Any schema
change that does not qualify as minor is major. Some examples of changes that trigger a major schema change are:

* Removal of a class.
* Removal of a property.
* Renaming of a class or property.
* Changing of a base class in a way that makes the former parent class no longer a direct ancestor (currently any change in parent class is a major schema upgrade).
* Changing the type of a property.
* Changing relationship constraints or cardinality.

### Schema Version Numbers

To be able to detect schema changes that are backward compatible for reading data, but not backward compatible for writing data, EC Schema version numbers have 3 parts

| Digit       | Meaning | Changes Imply |
|-------------|----|-------------------------------------|
| 1st (read)  | Generation of the schema that guarantees (*if digit matches*) that newer schemas' data can be **read** by older software.    | No compatibility can be assumed for previous schema versions (breaks *read* and *write* logic)  |
| 2nd (write) |   Sub-generation of the schema that guarantees (*if digit matches*) that newer schemas' data can be **written** by older software. |  Additions have been made to the schema which break existing *write* logic (but not *read* logic)  |
| 3rd (minor) | Least significant version number that increments with *read/write* compatible additions.  | Additions have been made to the schema, but they do not break existing schema *read* or *write* logic.  |

This 3-digit system is a little different from the standard 3-digit versioning strategy described at [Semantic Versioning](https:://semver.org). This is due primarily due to Semantic Versioning pertaining to APIs and code instead of schemas.

### The Middle Version Number

The second *write* version number is a bit difficult to understand - *how does it correspond to a Major Schema Updates and Minor Schema Updates?*

Effectively the second *write* version number is updated when a schema upgrade can be considered a major update for writers of the data, but is only a minor update for readers of the data.

For example, consider in schema 1 that we have a *Student* class that stores grades and has (double) properties:

* *Language*
* *Math*
* *Science*
* *Music*
* *Overall GPA* (an average of the previous 4 properties)

If schema 2 adds to *Student* a double property *Psychology*, the meaning of *Overall GPA* changes slightly and hence, applications written for Schema 1:

* Can still safely read all the values that were in schema 1
* Cannot modify any values that were in schema 1 because they will likely set *Overall GPA* incorrectly.

Updating data for a schema update with a *write* version change usually requires some custom logic. This should not be surprising as the previous data was written by applications that are not write-compatible with the newer schema.

#### Examples of Write incompatible changes
* Adding a *Not Null* or *Unique* constraint on a new property in an existing class
* Adding a new *Navigation Property* with a *Foreign Key* constraint to an existing class

There are other examples of write incompatible changes which, however, are prohibited by the software because they
would modify how EC content is mapped to the database (which is generally not allowed):
* Adding a *Not Null* or *Unique* constraint to an existing property
* Adding a new unique index to an existing class
* Adding a *Foreign Key* constraint to an existing *Navigation Property*

### Application Schema Compatibility Logic

The general logic for an application written for a particular version of a schema working with a repository that potentially
has a different version of the schema would be:

* If schema in the repository is newer (or same):
  * If first digit matches, app can safely read.
  * If first two digits match, app can safely write (and read).
  * If no digit matches, the schema is of a different generation and the application cannot do anything.
* If schema in the repository is older:
  * If first two digits match, app can upgrade repository schema without breaking read or write for other apps.
  * If only first digit matches, app can upgrade repository schema, but upgrade will prevent some older apps from writing.
  * If no digit matches, the schema is of a different generation and the application cannot do anything.

## BIS Generations

Major schema upgrades are eventually required in any evolving product or system. If every Domain was allowed to select when its major schema updates occurred, then – as BIS will have a large number of Domains – nearly every BIS release would contain some major schema updates.

To avoid the confusion of continual major schema updates, BIS Generations are defined and major schema updates are restricted.

### BIS Generation

A BIS Generation consists of a series of releases during which major schema upgrades are not allowed for any Domain. As minor schema upgrades will not break application compatibility, any application based on the same BIS Generation can work together through an iModel.

The 3-digit schema version numbers of EC Schemas (*Read.Write.Minor*) allow two types of Major schema version to be defined. As an **emergency** outlet, it will be allowed to change the *Write* version number within a Generation, but this will be severely discouraged. To ensure that changes to the *Write* version number are taken seriously enough, OCTO review is recommended for any such *Write* changes.

It must be remembered that repositories can be updated from one Generation to the next Generation without loss of data. It is the individual applications that can only work with repositories from a single Generation.

### Generation Schema Numbering

As BIS Generations are tightly aligned with major schema upgrades, it is natural to use the Generation number as the major schema version for all BIS Domains. The numbering for all schemas in a Generation is *Generation.Write.Minor*, where all the *Generation* numbers in a BIS repository match. The *Write* numbers will almost always all be 0. The *Minor* numbers can and will vary.

<!-- TODO
### Length of Generations

The optimal length of time for Bentley to maintain a BIS Generation is a business decision that needs to be based on many factors. The benefit of Generational compatibility comes with the cost of backward compatibility. In the absence of other information, 3 years appears to be a reasonable Generation duration, but it is likely the first one or two Generations will be shorter as we learn and the platform evolves.
-->

<!-- TODO - do we want this level of detail?
## iModel Minor Schema Upgrade Rules

The following rules apply to all iModel upgrades:

### Not permitted in Minor Upgrades

Deleting ECClasses, ECEnumerations, KindOfQuantities, or ECProperties.

### Minor Upgrade Changes for ECSchemas

* Modify
  * Description
  * DisplayLabel
  * Alias
  * Version (VersionWrite, VersionMinor).
  * Modifying VersionRead is not allowed though as read version changes cannot be performed through an ECSchema upgrade.
  * ECSchema references
    * Add, delete, modify
  * ECClasses
    * Add a new ECClass
      * Delete
        * an ECEntityClass which
          * does not have subclasses
          * is not used as constraint class in an ECRelationshipConstraint
        * an ECRelationshipClass which is mapped as link table
  * ECEnumerations
    * Add a new ECEnumeration
  * KindOfQuantities
    * Add a new KindOfQuantity
  * PropertyCategories
    * Add a new PropertyCategory
  * CustomAttributes on the ECSchema
    * Add, delete, modify

### Minor Upgrade Changes for ECClasses

* Modify
  * Description
  * DisplayLabel
  * BaseClasses
    * Only empty (with no properties) Mixin type EntityClass can be Added or Deleted from baseClass list
  * ECClassModifier
    * from Sealed to None, but only if
    * the class is no ECRelationshipClass
    * the class is mapped as 'TablePerHierarchy'
    * from None to Sealed (for leaf classes only, of course)
  * ECProperties
    * Add a new ECProperty
    * Delete an ECProperty which is
      * mapped to a shared column (see ShareColumns custom attribute in The ClassMap custom attribute for Entity ECClasses and link table ECRelationshipClasses)
      * not used in an ECStructClass
      * not overridden
      * BentleyApi::ECN::NavigationECProperty cannot be deleted
  * CustomAttributes on the ECClass
    * Add, delete, modify

### Minor Upgrade Changes for ECProperties

* Modify
  * Description
  * DisplayLabel
  * IsReadOnly
  * Category
  * Priority
  * MinimumValue
  * MaximumValue
  * MinimumLength
  * MaximumLength
  * KindOfQuantity
    * It is possible to
      * assign a KindOfQuantity to an ECProperty that didn't have one before
      * change the KindOfQuantity of an ECProperty to another KindOfQuantity
      * remove the KindOfQuantity from the ECProperty
* CustomAttributes on the ECProperty
  * Add, delete, modify

### Minor Upgrade Changes for Primitive ECProperties

* Modify
  * ExtendedTypeName
  * ECEnumeration
    * It is possible to
      * assign an ECEnumeration to an ECProperty that was an ordinary primitive property before
      * change the ECEnumeration of an ECProperty to another ECEnumeration
      * remove the ECEnumeration from the ECProperty, so that it becomes an ordinary primitive property
    * This is possible only if
      * the involved ECEnumerations are not strict
      * the underlying type of the involved ECEnumerations is the same, or if the property type and the ECEnumeration's underlying type is the same.

### Minor Upgrade Changes for Primitive EC Array Properties

* Modify
  * ExtendedTypeName
  * ECEnumeration
    * It is possible to
      * assign an ECEnumeration to an ECProperty that was an ordinary primitive property before
      * change the ECEnumeration of an ECProperty to another ECEnumeration
      * remove the ECEnumeration from the ECProperty, so that it becomes an ordinary primitive property
    * This is possible only if
      * the involved ECEnumerations are not strict
      * the underlying type of the involved ECEnumerations is the same, or if the array element type and the ECEnumeration's underlying type is the same.

### Minor Upgrade Changes for ECRelationshipConstraint

* Modify
  * RoleLabel
* CustomAttributes on the ECRelationshipConstraint
  * Add, delete, modify

### Minor Upgrade Changes for ECDbMap ECSchema Custom Attributes

Generally, the Custom Attributes from the ECDbMap ECSchema cannot be added, deleted, or modified if they affected the mapping of the ECSchemas and therefore the layout of the database schema.
-->
