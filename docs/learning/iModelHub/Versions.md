# Named Versions

Every [ChangeSet]($imodelhub-client) pushed to iModelHub creates a new Version of iModel. To distinguish a specific ChangeSet in iModel's timeline, that represents an important milestone or significant event for that iModel, its Version can be given a unique human-readable name, creating a Named [Version]($imodelhub-client). It will allow Version to be easier to recognize and access. Named Versions can be queried separately from ChangeSets and they get [Thumbnail]($imodelhub-client)s rendered.

## Creating Named Versions

Named Version can be created by calling [VersionHandler.create]($imodelhub-client). To create a Named Version a ChangeSet id has to be specified. You can get ChangeSet ids by querying ChangeSets through [ChangeSetHandler.get]($imodelhub-client).

To create a Named Version from a ChangeSet query:

``` ts
[[include:VersionHandler.create.example-code]]
```

## Querying Named Versions

After creating Named Version, its possible to query them by calling [VersionHandler.get]($imodelhub-client). Results of this query can be modified by using [VersionQuery]($imodelhub-client). Named Versions by default are ordered from the newest ChangeSet to the oldest.

``` ts
[[include:VersionHandler.get.example-code]]
```

## detachChangeCache() deprecated

The only way to detach change cache is to close the connection. The api will be remove in future.
