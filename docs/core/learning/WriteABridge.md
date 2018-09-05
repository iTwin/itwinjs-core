# Write an iModel Bridge

As explained in the [overview](../overview/imodel-bridges.md), a "bridge" is a program that:
1. Reads information from a data source,
2. Aligns the source data with the BIS schema and preferrably a domain schema, and
3. Writes BIS data to an iModel.

A bridge works directly with a local [briefcase](./Glossary.md#briefcase), using the [IModelDb]($backend) class. It then pushes [ChangeSets](./Glossary.md#changeset) to the server that manages the iModel, such as [iModelHub](../overview/imodelHub.md).

## Bridge Tasks
A bridge must:
* [Open a local briefcase copy](./backend/IModelDb.md) of the iModel that is to be updated.
* Import or Update Schema
  * Possibly [import an appropriate BIS schema into the briefcase](./backend/SchemasAndElementsInTypeScript.md#importing-the-schema)  or upgrade an existing schema.
  * Push the results to the iModelServer.
* Convert Changed Data
  * Connect to the data source.
  * Detect changes to the source data.
  * [Transform](../overview/imodel-bridges.md#data-alignment) the new or changed source data into the target BIS schema.
  * Write BIS data to the local briefcase.
  * Handle deleted source data.
  * Obtain required Locks and Codes from the iModel server and/or code server.
  * Push changes to the iModel server.

## Example

* Bridge imports:
``` ts
[[include:Bridge.imports.example-code]]
```

* The bridge must obtain an AccessToken (iModelHub):
``` ts
[[include:Bridge.getAccessToken.example-code]]
```

* If necessary, the bridge may create an iModel in the server (iModelHub only):
``` ts
[[include:Bridge.create-imodel.example-code]]
```

* The bridge converts source data for the very first time:
``` ts
[[include:Bridge.firstTime.example-code]]
```

* Importing a schema and bootstrapping definitions, such as categories:
``` ts
[[include:IModelDb.importSchema]]
```

* A simple example of a fictitious source data format:
``` ts
[[include:Bridge.source-data.example-code]]
```
