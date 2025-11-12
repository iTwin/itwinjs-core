# iModel File Format

An iModel is a specialized SQLite database file that stores infrastructure asset information according to the [BIS (Base Infrastructure Schemas)](../../bis/index.md) standard. Understanding the internal structure and reserved elements of an iModel file is important for backend developers working with iModel data.

## Database Structure

iModels are based on the [SQLite](https://www.sqlite.org/index.html) relational database format, providing:

- **Transactional integrity** - ACID compliance for data consistency
- **Portability** - Single-file databases that work across platforms
- **Performance** - Efficient indexing and query planning
- **Embedded storage** - No separate server process required

The iModel extends SQLite with:

- [BIS-defined schemas](../../bis/index.md) mapped to database tables
- [ECSQL](../ECSQL.md) query language for class-based queries
- Change tracking for distributed synchronization via [ChangeSets](../Glossary.md#changeset)

## System Tables

Every iModel contains several system tables that manage metadata and configuration:

### Core System Tables

| Table Name     | Purpose                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `be_Prop`      | Stores file properties as name-id-value triplets. Uses a two-part namespace/name to identify properties and a majorId/subId pair for arrays. |
| `be_Local`     | Stores briefcase-local values specific to each copy of the database. These values are not synchronized with the team server.                 |
| `be_EmbedFile` | Holds embedded files as BLOBs within the database.                                                                                           |

### ECDb Metadata Tables

The ECDb profile provides metadata tables (prefixed with `ec_`) that store schema information:

**Schema and Class/Property Definitions:**
- `ec_Schema` - Stores schema definitions and version information
- `ec_SchemaReference` - Records dependencies between schemas
- `ec_Class` - Stores ECClass definitions with type, modifier, and relationship metadata
- `ec_ClassHasBaseClasses` - Defines class inheritance hierarchy
- `ec_Enumeration` - Stores enumeration definitions
- `ec_PropertyCategory` - Defines property categories for organization
- `ec_Property` - Stores property definitions for all classes
- `ec_PropertyPath` - Stores property paths for navigation
- `ec_RelationshipConstraint` - Stores relationship endpoint constraints
- `ec_RelationshipConstraintClass` - Maps constraint classes to relationships

**Units and Quantities:**
- `ec_UnitSystem` - Defines unit systems (metric, imperial, etc.)
- `ec_Phenomenon` - Defines physical phenomena (length, mass, time, etc.)
- `ec_Unit` - Stores unit definitions
- `ec_KindOfQuantity` - Defines units and display formats for properties
- `ec_Format` - Defines formatting rules for value display
- `ec_FormatCompositeUnit` - Stores composite unit definitions

**Storage Mapping:**
- `ec_ClassMap` - Maps classes to their storage tables
- `ec_PropertyMap` - Maps properties to table columns
- `ec_Table` - Defines physical database tables for EC data
- `ec_Column` - Defines columns in EC tables
- `ec_Index` - Stores index definitions
- `ec_IndexColumn` - Maps columns to indexes

**Custom Attributes:**
- `ec_CustomAttribute` - Stores custom attribute instances

**Performance Caches:**
- `ec_cache_ClassHierarchy` - Cached class hierarchy for query optimization
- `ec_cache_ClassHasTables` - Cached class-to-table mappings

## Profile Versions

iModels maintain version information for the file format through profile versions:

- **ECDb Profile** - Version of the ECDb database schema and ECSQL capabilities (current: 4.0.0.x)
- **DgnDb Profile** - Version of iModel-specific extensions and BIS schema support

Profile versions are stored in the `be_Prop` table.

When opening an iModel, the profile version is checked to ensure compatibility. Files with older profiles can be automatically upgraded if they meet the minimum upgradable version.

## BIS Schema to Database Mapping

BIS schemas are mapped to SQLite tables through the ECDb schema mapping system:

- **ECClasses** map to database tables (or share tables through inheritance)
- **ECProperties** map to table columns with appropriate SQLite types
- **Relationship classes** can be stored as foreign keys or in separate link tables

Each table storing EC data includes system columns:
- `ECInstanceId` - The primary key (64-bit integer)
- `ECClassId` - Identifies the specific class of the instance (for polymorphism)

## Element ID Generation

iModel elements use **BriefcaseBasedIds** - 64-bit identifiers that ensure uniqueness across distributed copies:

- **Upper 24 bits**: BriefcaseId (identifies the specific briefcase/copy)
- **Lower 40 bits**: Local sequence number (unique within the briefcase)

This design allows each briefcase to generate IDs independently without central coordination, supporting up to 2^40 (~1 trillion) elements per briefcase.

## Pre-created Elements

Every newly created iModel contains several pre-initialized elements with reserved IDs:

| Element ID  | ECClass               | Purpose              |
| ----------- | --------------------- | -------------------- |
| `0x1` (1)   | `Subject`             | Root Subject         |
| `0xe` (14)  | `LinkPartition`       | Reality Data Sources |
| `0x10` (16) | `DefinitionPartition` | Dictionary Model     |

## Reserved Element IDs

**Element IDs 2 through 13 (0x2 - 0xd) are reserved for internal system use and should not be used for application data.**

Currently, these reserved IDs serve special internal purposes:

- **ID 2 (0x2)**: Used to manage **schema table locks** for concurrent schema modifications in multi-user scenarios.

### Why Reserved IDs Are Safe

In normal operation, application code will not accidentally use these reserved IDs because new element IDs are generated by combining the briefcase's ID with a sequential counter in the lower 40 bits.

## See Also

- [iModel Overview](../iModels.md) - High-level introduction to iModels
- [iModel Contents](./IModelContents.md) - Guidance on what data belongs in an iModel
- [IModelDb](./IModelDb.md) - Working with iModel databases programmatically
- [Element Fundamentals](../../bis/guide/fundamentals/element-fundamentals.md) - Understanding elements and their IDs
- [BIS Schemas](../../bis/index.md) - The schema definitions used in iModels
