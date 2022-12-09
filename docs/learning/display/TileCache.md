# Tile Cache

[Tiles](./Tiles.md) can be expensive to generate - both in terms of processing time and in demand on the backend - and an iModel may be viewed repeatedly by many different users during its lifetime. Therefore caching of previously-generated tiles is an important performance optimization. iTwin.js provides two tile caching mechanisms, suited for different purposes:

- [TileStorage]($backend) that caches tiles in the cloud (or on a more restricted network) using the chosen cloud provider.
- A SQLite database stored on the backend's local file system.

Cloud-based caches are appropriate for multi-user web apps. If such a cache is configured, then the frontend will first check for cached tile content before asking the backend to generate content for a given tile. The backend uploads each tile it generates to that same cache.

A local SQLite database is appropriate for desktop and mobile apps, for which the backend (and the iModel) resides on the same device as the frontend and which may sometimes be operated in an environment with poor or no connectivity. In the future, it could be made possible for such apps to employ a hybrid approach in which they consult a cloud-based cache while connected to the network but fall back to the local cache during periods of poor connectivity.

A cached tile remains valid as long as the following conditions hold:

- The geometry contained with the tile tree's corresponding model has not changed.
  - This is tracked by a GeometryGuid column that is automatically updated when the placement or geometry of any element within the model is modified, or a geometric element is added or removed.
- The version number of the tile format has not changed since the tile was generated.
  - The format version is incremented conservatively, primarily for bug fixes and performance optimizations. If a change to the tile generation code can be made without incrementing the format version, we avoid doing so.

A tile generation agent may be employed to prepopulate portions of a cloud-based cache, for example, by generating content for the first N levels of each tile tree when a new revision of the iModel is produced. A tile *regeneration* agent may be employed when a new version of the tile format is deployed to production; it locates all extant tiles in the cache and generates new tiles using the new version of the tile format. This minimizes the impact on users when large numbers of tiles become invalidated at once.

You can configure a cloud-storage tile cache for your application backend in one of two ways:

1. Supply your Azure blob storage credentials to [IModelHostOptions.tileCacheAzureCredentials]($backend) to use the built-in Azure blob storage cache; or
2. Supply a [custom cloud storage provider](https://github.com/iTwin/object-storage/) to [IModelHostOptions.tileCacheStorage]($backend).

By default, frontends can retrieve tiles from Azure blob storage container supplied by the backend. `IModelAppOptions.tileAdmin.tileStorage` can optionally be supplied to enable other storage providers. Note that supplying your own implementation will disable the built-in Azure support.
