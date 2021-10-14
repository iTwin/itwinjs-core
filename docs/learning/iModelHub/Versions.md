# Named Versions

Every `Changeset` pushed to iModelHub creates a new Version of the iModel. To distinguish a specific ChangeSet in an iModel's timeline, that represents an important milestone or significant event for that iModel, its Version can be given a unique human-readable name, creating a Named Version (`IModelVersion.name`). It enables the Version to be easier to recognize and access.

## Creating Named Versions

Named Version can be created by calling `VersionHandler.create`. To create a Named Version a ChangeSet id has to be specified. You can get ChangeSet ids by querying ChangeSets through `ChangeSetHandler.get`.

To create a Named Version from a ChangeSet query:

``` ts
[[include:VersionHandler.create.example-code]]
```

## Querying Named Versions

After creating Named Version, its possible to query them by calling `VersionHandler.get`. Results of this query can be modified by using `VersionQuery`. Named Versions by default are ordered from the newest ChangeSet to the oldest.

``` ts
[[include:VersionHandler.get.example-code]]
```
