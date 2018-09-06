# Write an iModel Bridge

As explained in the [overview](../overview/imodel-bridges.md), a "bridge" is a program that:
1. Reads information from a data source,
2. Aligns the source data with the BIS schema and preferrably a domain schema, and
3. Writes BIS data to an iModel.

Specificaly, a bridge must:
* [Open a local briefcase copy](./backend/IModelDb.md) of the iModel that is to be updated.
* Import or Update Schema
  * Possibly [import an appropriate BIS schema into the briefcase](./backend/SchemasAndElementsInTypeScript.md#importing-the-schema)  or upgrade an existing schema.
  * Push the results to the iModelServer.
* Convert Changed Data
  * Connect to the data source.
  * Detect changes to the source data.
  * [Transform](../overview/imodel-bridges.md#data-alignment) the new or changed source data into the target BIS schema.
  * Write the resulting BIS data to the local briefcase.
  * Remove BIS data corresponding to deleted source data.
  * Obtain required Locks and Codes from the iModel server and/or code server.
  * Push changes to the iModel server.

## Example

A bridge would import the following packages:

``` ts
[[include:Bridge.imports.example-code]]
```

The bridge must obtain an AccessToken. Here is an example for Connect/iModelHub:

``` ts
[[include:Bridge.getAccessToken.example-code]]
```

If necessary, a bridge working with iModelHub may create an iModel from scratch. (This does not apply to bridges that work with iModelBank).

``` ts
[[include:Bridge.create-imodel.example-code]]
```

When the bridge runs for the very first time, it would look like this:

``` ts
[[include:Bridge.firstTime.example-code]]
```

Importing a schema and bootstrapping definitions would look like this:

``` ts
[[include:IModelDb.importSchema]]
```

Here is a simple example of a fictitious source data format:

``` ts
[[include:Bridge.source-data.example-code]]
```
