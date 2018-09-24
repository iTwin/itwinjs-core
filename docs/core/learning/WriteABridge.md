# Write an iModel Bridge

As explained in the [overview](../learning/imodel-bridges.md), a "bridge" is a program that:
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
  * [Transform](../learning/imodel-bridges.md#data-alignment) the new or changed source data into the target BIS schema.
  * Write the resulting BIS data to the local briefcase.
  * Remove BIS data corresponding to deleted source data.
  * Obtain required Locks and Codes from the iModel server and/or code server.
  * Push changes to the iModel server.

## Writing a bridge

A bridge would import the following packages:

``` ts
[[include:Bridge.imports.example-code]]
```

When the bridge runs for the very first time, it would look like the following. This example revolves around the fictitious "RobotWorld" schema. RobotWorld consists of Robots and Barriers. The details of RobotWorld and its schema are not important. The steps, such as importing a schema, reserving codes, pushing changesets, creating definition models, etc., are the important points to see in the example code.

``` ts
[[include:Bridge.firstTime.example-code]]
```

See:
* [Importing a schema and bootstrapping definitions](./backend/SchemasAndElementsInTypeScript.md#importing-the-schema)
* [AccessToken](./common/AccessToken.md)
* [IModelDb.create]($backend)
* [IModelDb.saveChanges]($backend)
* [IModelDb.pullAndMergeChanges]($backend)
* [IModelDb.pushChanges]($backend)
* [ConcurrencyControl](./backend/ConcurrencyControl.md)
* [Insert a DefinitionModel](./backend/CreateModels.md#DefinitionModel)
* [Insert a PhysicalModel](./backend/CreateModels.md#PhysicalModel)
* [Insert a Subject element](./backend/CreateElements.md#Subject)
* [Insert a ModelSelector element](./backend/CreateElements.md#ModelSelector)
* [Insert a CategorySelector element](./backend/CreateElements.md#CategorySelector)
* [Insert a DisplayStyle3d element](./backend/CreateElements.md#DisplayStyle3d)
* [Insert a OrthographicViewDefinition element](./backend/CreateElements.md#OrthographicViewDefinition)
* [Logging](./common/Logging.md)

Here is a simple example of a fictitious source data format and the logic to convert and write it to an iModel:

``` ts
[[include:Bridge.source-data.example-code]]
```

## Detecting and pushing changes

Rather than starting over when the source data changes, a bridge should be able to detect and convert only the changes. That makes for compact, meaningful ChangeSets, which are added to the iModel's
[timeline](../learning/IModelHub.md#the-timeline-of-changes-to-an-imodel).

In the case of source data that was previously converted and has changed, the bridge should update the data in the iModel that were the results of the previous conversion. In the case of source data that was previously converted and has been deleted in the source, the bridge should delete the results of the previous conversion. Source data that has been added should be inserted.

In order to do incremental updates, a bridge must do Id mapping and change-detection.

### Id mapping

Id mapping is a way of looking up the data in the iModel that corresponds to a given piece of source data.

If the source data has stable, unique IDs, then Id mapping could be straightforward. The bridge just needs to record the source -> BIS Id mappings somewhere. If the source data IDs are GUIDs, then the bridge can assign them to the federationGuid property value of the BIS elements that it creates. That way, the mappings will be directly recorded in the iModel itself.

If the soruce data does not have stable, unique IDs, then the bridge will have to use some other means of identifying pieces of source data in a stable way. A crytographic hash of the source data itself can work as a stable Id -- that is, it can be used to identify data that has not changed.


### Change-detection

Change-detection is a way of detecting changes in the source data.

If the source data is timestamped in some way, then the change-detection logic should be easy. The bridge just has to save the highest timestamp at the end of the conversion and then look for source data with later timestamps the next time it runs.

If timestamps are not available, then the bridge will have to use some other means of recording and then comparing the state of the source data from run to run. If conversion is cheap, then the source data can be be converted again and the results compared to the previous results, as stored in the iModel. Or, a crytographic hash of the source data may be used to represent the source data. The hash could be stored along with the mappings and used to detect changes.

A basic change-detection algorithm is:
* For each source data item:
  * add source item's Id to the *source_items_seen* set
  * Look in the mappings for the corresponding data in the iModel (element, aspect, model)
  * If found,
    * Detect if the source item's current data has changed. If so,
      * Convert the source item to BIS data.
      * Update the corresponding data in the iModel
  * Else,
    * Convert the source data to BIS data
    * Insert the new data into the iModel
    * Add the source data item's Id to the mappings

Infer deletions:
* For each source data item Id previously converted
  * if item Id is not in *source_items_seen*
    * Find the the corresponind data in the iModel
      * Delete the data in the iModel
      * Remove the the source data item's Id from the mappings
