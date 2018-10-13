# Named Versions
Every [ChangeSet]($clients) pushed to iModelHub creates a new Version of iModel. To distinguish a specific ChangeSet in iModel's timeline, that represents an important milestone or significant event for that iModel, its Version can be given a unique human-readable name, creating a Named [Version]($clients). It will allow Version to be easier to recognize and access. Named Versions can be queried separately from ChangeSets and they get [Thumbnail]($clients)s rendered.

## Creating Named Versions
Named Version can be created by calling [VersionHandler.create]($clients). To create a Named Version a ChangeSet id has to be specified. [BriefcaseEntry.changeSetId]($backend) provides latest ChangeSet id applied to the briefcase file. It's also possible to query all ChangeSets through [ChangeSetHandler.get]($clients).

To create a Named Version from a ChangeSet query:
``` ts
[[include:VersionHandler.create.example-code]]
```

## Querying Named Versions
After creating Named Version, its possible to query them by calling [VersionHandler.get]($clients). Results of this query can be modified by using [VersionQuery]($clients). Named Versions by default are ordered from the newest ChangeSet to the oldest.

``` ts
[[include:VersionHandler.get.example-code]]
```

## Downloading Thumbnails
Once a Named Version is created, iModelHub generates its [Thumbnail]($clients) in the background. To get this Thumbnail, a Version query can be specified with [VersionQuery.selectThumbnailId]($clients) or all Thumbnails can be queried through [ThumbnailHandler.get]($clients).

Thumbnail might not be immediately available after creating a Named Version, as generating it could take some time. If Thumbnail is not returned after creating Named Version, you can try querying it again later.

``` ts
[[include:VersionHandler.thumbnail.example-code]]
```
