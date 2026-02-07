# iModels for Developers

This document is an attempt to give a quick overview of iModels from a developer perspective and to provide links to more detailed documentation and actual code. 

## Overview

### The Data

iModels are designed to store BIM/CAD Engineering data in a format that is ideal for editing applications.  It standardizes the data stored so common concepts are represented the same way across different editing applications. This standardization is accomplished using a 'conceptual schema' called [BIS](https://www.itwinjs.org/bis/guide/intro/overview/) that expresses taxonomy, data structure and relationships for modeling real-world Entities.

### The File

A snapshot of an iModel is a standard SQLite file.  Two standard SQLite extensions are used to create a change history and ease working with large files.

- The [Session Extension](https://sqlite.org/sessionintro.html) to record changes to the database and package them into 'changesets'
- The [Cloud Backed SQLite VFS](https://sqlite.org/cloudsqlite/doc/trunk/www/index.wiki) to allow access to the database without first downloading the entire database.

### The Tables

iModels store data using a SQL persistence schema but expose the data as BIS entities using [ECSql](https://www.itwinjs.org/learning/ecsql/), an implementation of SQL that targets the logical (BIS) schema instead of the database's persistence schema.  The data tables in an iModel are defined by the BIS schemas imported into it, additional tables store the BIS schemas and how to map the persistence schema to the logical schema.

### Beyond the file

iModels are stored as a seed SQLite file plus a sequence of SQLite changesets making a linear and immutable change history. Thus, it is always possible to recreate a version of an iModel by applying changesets in order up to the revision desired.

The change history can be managed via the [iModels API](https://developer.bentley.com/apis/imodels-v2/overview/) and enables operations like [Forks](https://developer.bentley.com/apis/imodels-v2/operations/fork-imodel/) and [Clones](https://developer.bentley.com/apis/imodels-v2/operations/clone-imodel/).

### Editing

It is possible to edit an iModel as a standalone SQLite file and produce no change history.  To produce a change history (ChangeSets) it is managed by the [iModel Hub](https://developer.bentley.com/apis/imodels-v2/overview/).  When managed by the Hub the user checkouts a [Briefcase](https://developer.bentley.com/apis/imodels-v2/operations/acquire-imodel-briefcase/) and is able to use [Locks](https://developer.bentley.com/apis/imodels-v2/operations/get-imodel-locks/) on elements to avoid data conflicts.

Briefcases ensure users get unique Element Ids by appending the unique briefcase id with the sequential id for the next element.  Locks are optional and restrict who can modify an Element and its Children allowing conflict free editing.

When multiple users edit an iModel they push changesets with their changes and pull changesets with others changes.  A briefcase must be at the tip to push a changeset, if they are not the incoming changesets are pulled and the local changes are rebased on top of them.  Once conflicts are resolved the local changes are pushed as one or more changesets.

Forks create an independent copy of the change history, creating an iModel which can be edited independently from the source iModel. Changes must be merged back using [iModel Transformation](https://www.itwinjs.org/learning/transformer/) which works at the BIS Element level rather than with SQLite changesets.

### BIS Basics

Base Infrastructure Schemas (BIS) is an open source set of schemas ([GitHub Repo](https://github.com/itwin/bis-schemas)).  The [BisCore](https://www.itwinjs.org/bis/domains/biscore.ecschema/) schema defines the iModel file format, and all other schemas derive from the base classes BisCore defines.  BisCore defines [**Elements**](https://www.itwinjs.org/bis/guide/fundamentals/element-fundamentals/) which store all data and [**Models**](https://www.itwinjs.org/bis/guide/fundamentals/model-fundamentals/) which contain all Elements.  Elements may also be extended via [**ElementAspects**](https://www.itwinjs.org/bis/guide/fundamentals/elementaspect-fundamentals/) which are considered conceptually to be part of the Element.  Individual Elements are connected via [**Relationships**](https://www.itwinjs.org/bis/guide/fundamentals/relationship-fundamentals/) to build assemblies, systems, networks, hierarchies or other arbitrary connections.

BIS can model real world objects from multiple [Perspectives](https://www.itwinjs.org/bis/guide/intro/modeling-with-bis/) using different Elements to represent the object in each perspective.  For example a pump can have a functional perspective defining the requirements of a pump, a physical perspective defining the pumps location the actual pump ordered from a catalog and an analytical perspective defining the attributes needed for flow simulation.

### Code Basics

The [ECDb](https://github.com/iTwin/imodel-native/tree/main/iModelCore/ECDb) library underpins the iModel file format and uses [ECSchemas](https://www.itwinjs.org/bis/ec/) as its data modeling language.  ECSchemas can be represented in [XML](https://github.com/iTwin/bis-schemas/blob/master/System/xsd/ECSchemaXML3.2.xsd) or [JSON](https://github.com/iTwin/bis-schemas/blob/master/System/json_schema/ec32/ecschema.schema.json) and loaded using TypeScript ([ecschema-metadata](https://github.com/iTwin/itwinjs-core/tree/master/core/ecschema-metadata)) or C++ ([ECObjects](https://github.com/iTwin/imodel-native/tree/main/iModelCore/ecobjects)) libraries.  The C++ [iModelPlatform](https://github.com/iTwin/imodel-native/tree/main/iModelCore/iModelPlatform) layer adds basic logic that understands and enforces BisCore concepts.  This internal API is exposed to TypeScript via a [NAPI interface](https://github.com/iTwin/imodel-native/tree/main/iModelCore/iModelPlatform) consumed by the iTwin.js [core-backend](https://github.com/iTwin/itwinjs-core/tree/master/core/backend) package.

> NOTE: ECDb files without BisCore imported are called 'ecdb' files
