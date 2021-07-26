---
title: iModel Connector Developer's Guide
---

# Contents {#contents .TOC-Heading}

[Introduction:](#introduction)

[Preface](#preface)

[What is a connector](#what-is-a-connector)

[Who should read this guide?](#who-should-read-this-guide)

[Preliminary Reading](#preliminary-reading)

[Structure of the guide](#structure-of-the-guide)

[Foundations](#foundations)

[iTwin](#itwin)

[iModelHub](#imodelhub)

[iModel](#imodel)

[Briefcases](#briefcases)

[Element](#element)

[Changeset](#changeset)

[The basics of writing a connector](#the-basics-of-writing-a-connector)

[Getting started](#getting-started)

[Data Extraction](#data-extraction)

[Data alignment](#data-alignment)

[Schemas](#schemas)

[Dynamic Schemas](#dynamic-schemas)

[Sync](#sync)

[Provenance](#provenance)

[Change detection](#change-detection)

[Connector SDK Classes](#connector-sdk-classes)

[BridgeRunner](#bridgerunner)

[Synchronizer](#synchronizer)

[Connector interface methods](#connector-interface-methods)

[InitializeJob](#initializejob)

[OpenSourceData](#opensourcedata)

[ImportDefinitions](#importdefinitions)

[ImportDomainSchema](#importdomainschema)

[ImportDynamicSchema](#importdynamicschema)

[UpdateExistingData](#updateexistingdata)

[Execution Sequence](#execution-sequence)

[Visualizing the result](#visualizing-the-result)

[ECSQL](#ecsql)

[Logs](#logs)

[Error Messages](#error-messages)

[Building a test for a connector](#building-a-test-for-a-connector)

[Advanced Topics](#advanced-topics)

[Job Subjects](#job-subjects)

[Schema merging](#schema-merging)

[Coordinate systems](#coordinate-systems)

[Dealing with geometry](#dealing-with-geometry)

[Authentication](#authentication)

[Locks & Codes](#locks-codes)

[External repository information](#external-repository-information)

## Introduction

## Preface

### What is a connector

iTwin connectors play an essential role in enabling a wide range of both
Bentley and third-party design applications to contribute to an iTwin.
Bentley iTwin Services provides connectors to support a wide array of
design applications to ensure that all engineering data can be
aggregated into a single digital twin environment inside an iModel.

As explained in the [overview](../learning/imodel-connectors.md), a "connector" is a program that:

1. Reads information from a data source,
2. Aligns the source data with the BIS schema and preferably a domain schema, and
3. Writes BIS data to an iModel.

A complete list of available connectors can be found in [iTwin Services
Community

Wiki](<https://communities.bentley.com/products/digital-twin-cloud-services/itwin-services/w/synchronization-wiki/47595/supported-applications-and-file-formats>)

Examples of iTwin Connector include:

![Bentley iTwin Connectors](https://communities.bentley.com/resized-image/__size/650x450/__key/communityserver-wikis-components-files/00-00-00-05-55/Bentley.png)
![3rd Party iTwin Connectors](https://communities.bentley.com/resized-image/__size/650x450/__key/communityserver-wikis-components-files/00-00-00-05-55/3rdParty.PNG)

See \[Section on iTwin Synchronization\](#ways-to-sync-data-to-an-itwin)
for more details on existing connectors.

However, in some instances, where a specific format is not covered, one
can develop a new connector using [iModel.js SDK](https://www.itwinjs.org/)

![iModel Connector Backend](./imodel_connector_backend.png)

The imodel-bridge package provided as part of the iModel.js SDK makes it
easier to write an iTwin connector backend that brings custom data into
a digital twin. To run this environment with the iModel.js library that
this package depends on requires a JavaScript engine with es2017
support.

Note: Please keep in mind iModelBridge is sometimes used as a synonym
for iTwin Connector since it bridges the gap between input data and a
digital twin.

### Who should read this guide?

This guide explains how to write a new connector for a new format or
data source.

It is not relevant for someone trying to bring in data for which a
connector already exists or is trying to federate data without it being
part of the iTwin.

### Preliminary Reading

The guide assumes that you are somewhat familiar with iModel and iTwin
concepts. A short

To understand the APIs, you will need to have an understanding of
typescript.

### Structure of the guide

## Foundations

This guide section is a quick refresher on the basic concepts one needs
to know to write a new connector.

### iTwin

An iTwin is an infrastructure digital twin. An iTwin incorporates
different types of data repositories -- including drawings,
specifications, documents, analytical models, photos, reality meshes,
IoT feeds, and enterprise resource and enterprise asset management data
-- into a living digital twin. This [link](http://www.bentley.com/itwin)
to get additional information about iTwins and Bentley iTwin Services

### iModelHub

iModelHub is the control center for iModels. It is responsible for
coordinating concurrent access to iModels and changes made to them
in [ChangeSets](https://www.itwinjs.org/learning/glossary/#changeset).
iModel connectors interact with iModelHub using the iModel.js API. The
Connector SDK provides a framework through which a connector can easily
maintain this interaction. For more information about iModelHub, please
see <https://www.itwinjs.org/learning/imodelhub/>

### iModel

An iModel is a specialized information container for exchanging data
associated with the lifecycle of infrastructure assets. It contains
digital components assembled from many sources. They are
self-describing, geometrically precise, open, portable, and secure. The
file format is based on open source SQLite relational database format
and forms the backbone for iTwins

iModels were created to facilitate the sharing and distribution of
information regardless of the source and format of the information.
iModels are an essential part of the digital twin world. But a digital
twin means a lot more than just an iModel.

An iTwin connector provides a workflow to easily synchronize information
from various third-party design applications or data repositories into
an iModel.

### Briefcases

[Briefcases](https://www.itwinjs.org/learning/glossary/#briefcase) are
the local copies of iModel that users can acquire to work with the
iModel. A connector will download a briefcase locally using the Bridge
Runner and change their copy of iModel. Once all the work is done, the
results are then pushed into the iModel. Please see the section on
Execution sequence on the different steps involved.

For more information, please see

<https://www.itwinjs.org/learning/imodelhub/briefcases/>

###

### Element

### Changeset

# The basics of writing a connector

## Getting started

### Connecting data to an iTwin

![iTwin Connector Steps](./imodel_connector_steps.png)

There are three main steps that a connector needs to undertake to bring data into a digital twin

- Extract data from the input source
- Transform and align the data to the digital twin.
- Generate [changesets](https://github.com/imodeljs/imodeljs/blob/master/docs/learning/iModelHub/index.md#the-timeline-of-changes-to-an-imodel) and load data into an iModel.

The sections below give a high level overview of the various parts that go into creating an iTwin Connector.

## Data Extraction

Extraction of data from the input depends on the source format and the availablity of a library capable of understanding it.  There are two strategies typically employed for data extraction.

1. If the extraction library is compatible with TypeScript, write an extraction module and use that to connect the input data with the alignment phase.
2. If a TypeScript binding is not available, extract the data into an intermediary format that can be then ingested by the alignment phase.

## Data alignment

An iModel Connector must carefully transform the source data to BIS-based data in the iModel, and hence each connector is written for a specific data source.

- Mappings of data are *from* source *into* an iModel.
- Typically, a connector stores enough information about source data to detect the differences in it between job-runs. In this manner tge connector generates *changesets* that are sent to iModelHub. This is the key difference between a connector and a one-time converter.
- Each job generates data in the iModel that is isolated from all other jobs' data. The resulting combined iModel is partitioned at the Subject level of the iModel; each connector job has its own Subject.

For each iTwin Connector author, there will always be two conflicting goals:

1. To transform the data in such a way that it appears logical and "correct" to the users of the authoring application.
2. To transform the data in such a way that data from disparate authoring applications appear consistent.

The appropriate balancing of these two conflicting goals is not an easy task. However, where clear BIS schema types exist, they should always be used.

### Schemas

### Dynamic Schemas

Sometimes BIS domain schemas are not adequate to capture all the data in the authoring application. To avoid losing data, iTwin Connector may dynamically create application-specific schemas whose classes descend from the most appropriate BIS domain classes.

As an iModel Connector always runs multiple times to keep an iModel synchronized, the schemas created by previous executions limit the schemas that can be used by subsequent executions. To provide consistency and enable concise changesets, the Connector adds to the previously-defined schemas (creating new schema versions). This follows the general schema update strategy defined in [Schema Versioning and Generations](https://github.com/imodeljs/imodeljs/tree/master/docs/bis/intro/schema-versioning-and-generations.md)

The `DynamicSchema` custom attribute should be set on customer-specific application schemas. This custom attribute can be found in the standard schema `CoreCustomAttributes` and it enables iModelHub to programmatically detect dynamic schemas. Dynamic schemas require special handling since their name and version are typically duplicated between iModels from different work sets.

### Display Labels

Wherever practical, the Elements generated from an iModel Connector should be identifiable through an optimal "Display Label".

As discussed in [Element Fundamentals](https://github.com/imodeljs/imodeljs/tree/master/docs/bis/intro/element-fundamentals.md), the Display Labels are created through the following logic:

1. If the UserLabel property is set, it is taken as the Display Label.
2. If the CodeValue is set (and the UserLabel is not set), the CodeValue becomes the Display Label.
3. If neither UserLabel nor CodeValue is set, then a default Display Label is generated from the following data:
   - Class Name
   - Associated Type's Name (if any)

iTwin Connector data transformations should be written considering the Display Label logic; UserLabel is the appropriate property for a connector to set to control the Display Label (CodeValue should never be set for anything other than coding purposes).

*But what value should an iModel connector set UserLabel to?* There are two goals to consider in the generation of UserLabels. Those goals, in priority order, are:

1. Consistency with source application label usage.
2. Consistency with BIS domain default labeling strategy.

If the source application data has a property that conceptually matches the BIS UserLabel property, that value should always be transformed to UserLabel.

## Sync

### Provenance

### Detecting and pushing changes

Rather than starting over when the source data changes, a connector should be able to detect and convert only the changes. That makes for compact, meaningful changesets, which are added to the iModel's [timeline](https://github.com/imodeljs/imodeljs/blob/master/docs/learning/iModelHub/index.md#the-timeline-of-changes-to-an-imodel).

In the case of source data that was previously converted and has changed, the connector should update the data in the iModel that were the results of the previous conversion. In the case of source data that was previously converted and has been deleted in the source, the connector should delete the results of the previous conversion. Source data that has been added should be inserted.

To do incremental updates, a connector must do Id mapping and change-detection. An iTwin Connector uses the ExternalSourceAspect class defined in the BIS schema to acheive both. The following sections describe how this is acheived.

### Id mapping

Id mapping is a way of looking up the data in the iModel that corresponds to a given piece of source data. If the source data has stable, unique IDs, then Id mapping could be straightforward.

See [updateElementClass](https://github.com/imodeljs/itwin-connector-sample/blob/main/COBie-connector/src/DataAligner.ts) function in the provided sample. When the identifier is provided to the synchronizer, it is stored inside the ExternalSourceAspect class, in the Identifier property.

Note: If the source data does not have stable, unique IDs, then the connector will have to use some other means of identifying pieces of source data in a stable way. A cryptographic hash of the source data itself can work as a stable Id -- that is, it can be used to identify data that has not changed.

### Change detection

Change-detection is a way of detecting changes in the source data.

If the source data is timestamped in some way, then the change-detection logic should be easy. The connector just has to save the highest timestamp at the end of the conversion and then look for source data with later timestamps the next time it runs.

If the source data is timestamped in some way, then the change-detection logic should be easy. The connector just has to save the highest timestamp at the end of the conversion and then look for source data with later timestamps the next time it runs.

If timestamps are not available, then the connector will have to use some other means of recording and then comparing the state of the source data from run to run. If conversion is cheap, then the source data can be be converted again and the results compared to the previous results, as stored in the iModel. Or, a cryptographic hash of the source data may be used to represent the source data. The hash could be stored along with the mappings and used to detect changes.

The change-detection algorithm implemented is

- For each source data item:
  - add source item's Id to the *source_items_seen* set
  - Look in the mappings for the corresponding data in the iModel (element, aspect, model)
  - If found,
    - Detect if the source item's current data has changed. If so,
      - Convert the source item to BIS data.
      - Update the corresponding data in the iModel
  - Else,
    - Convert the source data to BIS data
    - Insert the new data into the iModel
    - Add the source data item's Id to the mappings

Infer deletions:

- For each source data item Id previously converted
  - if item Id is not in *source_items_seen*
    - Find the the corresponding data in the iModel
      - Delete the data in the iModel
      - Remove the the source data item's Id from the mappings

## Connector SDK Classes

The connector SDK exposes its functionality through three main clases
BridgeRunner, Synchronizer and iModelBridge Interface.

### BridgeRunner

### Synchronizer

### Connector interface methods

#### InitializeJob

#### OpenSourceData

#### ImportDefinitions

#### ImportDomainSchema

#### ImportDynamicSchema

#### UpdateExistingData

## Execution Sequence

The ultimate purpose of a connector is to synchronize an iModel with the data in one or more source documents. That involves not only converting data but also authorization, communicating with an iModel server, and concurrency control. iModel.js defines a framework in which the connector itself can focus on the tasks of extraction, alignment, and change-detection. The other tasks are handled by classes provided by iModel.js. The framework is implemented by the BridgeRunner class. A BridgeRunner conducts the overall synchronization process. It loads and calls functions on a connector at the appropriate points in the sequence. The process may be summarized as follows:

- BridgeRunner: [Opens a local briefcase copy](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/IModelDb.md) of the iModel that is to be updated.
- Import or Update Schema
  - Connector: Possibly [import an appropriate BIS schema into the briefcase](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/SchemasAndElementsInTypeScript.md#importing-the-schema)  or upgrade an existing schema.
  - BridgeRunner: [Push](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/IModelDbReadwrite.md#pushing-changes-to-imodelhub) the results to the iModelServer.
- Convert Changed Data
  - Connector:
    - Opens to the data source.
    - Detect changes to the source data.
    - [Transform](#data-alignment) the new or changed source data into the target BIS schema.
    - Write the resulting BIS data to the local briefcase.
    - Remove BIS data corresponding to deleted source data.
  - BridgeRunner: Obtain required [Locks and Codes](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/ConcurrencyControl.md) from the iModel server and/or code server.
- BridgeRunner: [Push](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/IModelDbReadwrite.md#pushing-changes-to-imodelhub) changes to the iModel server.

## Ways to sync data to an iTwin

[The iTwin Synchronizer portal](https://communities.bentley.com/products/digital-twin-cloud-services/itwin-services/w/synchronization-wiki/47606/itwin-synchronizer-portal) and [iTwin Sychronizer client](https://communities.bentley.com/products/digital-twin-cloud-services/itwin-services/w/synchronization-wiki/47597/itwin-synchronizer-client) provides synchronization mechanism to bring data into an iTwin through a connector

The following are the various steps involved in that workflow.
![iTwin workflow](https://communities.bentley.com/resized-image/__size/650x340/__key/communityserver-wikis-components-files/00-00-00-05-55/pastedimage1591602805184v1.png)

More on synchronization using connectors could be found [here](https://communities.bentley.com/products/digital-twin-cloud-services/itwin-services/w/synchronization-wiki/47596/ways-to-sync-your-data-to-an-itwin)

## Visualizing the result

## ECSQL

## Logs

## Error Messages

## Building a test for a connector

# Advanced Topics

## Job Subjects

## Schema merging

## Coordinate systems

For the basics of coordinate systems in iModels, please see
<https://www.itwinjs.org/learning/geolocation/>

For any iModel, a connector should

1. If the iModel has coordinate system information, reproject the
    existing data into the coordinate system of the iModel

2. If the iModel does not have coordinate system information,
    initialize the iModel with the coordinate system appropriate to the
    input data.

As a general rule, for iModels that are primarily generated from
connectors that deals with building data, a coordinate transform with
linear transformation like ECEF will be better

## Dealing with geometry

## Authentication

## Locks & Codes

## External repository information

## More information

For more indepth information please see:

- [Importing a schema and bootstrapping definitions](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/SchemasAndElementsInTypeScript.md#importing-the-schema)
- [AccessToken](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/common/AccessToken.md)
- [BriefcaseManager.create](https://www.itwinjs.org/reference/imodeljs-backend/imodels/briefcasemanager/createstatic/#create)
- [BriefcaseDb.open](https://www.itwinjs.org/reference/imodeljs-backend/imodels/briefcasedb/openstatic/#open)
- [IModelDb.saveChanges](https://www.itwinjs.org/reference/imodeljs-backend/imodels/imodeldb/savechanges/#savechanges)
- [BriefcaseDb.pullAndMergeChanges](https://www.itwinjs.org/reference/imodeljs-backend/imodels/briefcasedb/pullandmergechanges/#pullandmergechanges)
- [BriefcaseDb.pushChanges](https://www.itwinjs.org/reference/imodeljs-backend/imodels/briefcasedb/pushchanges/#pushchanges)
- [ConcurrencyControl](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/ConcurrencyControl.md)
- [DefinitionModel.insert](https://www.itwinjs.org/reference/imodeljs-backend/models/definitionmodel/insertstatic/#insert)
- [PhysicalModel.insert](https://www.itwinjs.org/reference/imodeljs-backend/models/physicalmodel/insertstatic/#insert)
- [Insert a Subject element](https://www.itwinjs.org/learning/backend/createelements/#subject)
- [Insert a ModelSelector element](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/CreateElements.md#ModelSelector)
- [Insert a CategorySelector element](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/CreateElements.md#CategorySelector)
- [Insert a DisplayStyle3d element](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/CreateElements.md#DisplayStyle3d)
- [Insert a OrthographicViewDefinition element](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/backend/CreateElements.md#OrthographicViewDefinition)
- [Logging](https://github.com/imodeljs/imodeljs/tree/master/docs/learning/common/Logging.md)
