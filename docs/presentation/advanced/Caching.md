# Caching

The presentation backend uses a number of caches to improve performance. This page provides a list of caches that may have a notable effect on either disk or memory.

## Primary connection schema cache

Each iModel contains a number of ECSchemas which consist of ECClass, ECProperty and other entity definitions (see [ECSchema page](../../bis/ec/ec-schema.md) for more details). All of that is used to describe the data stored in an iModel and is leveraged by the presentation library to create efficient ECSQL queries based on given presentation rules.

There's an in-memory schema cache associated with each iModel to improve performance of getting that meta-data. Any time a new meta-data entity is requested to be loaded, it's also put into the cache. The cache is unbounded in size and may grow as much as necessary to cache all schemas, possibly reaching several hundred megabytes for iModels with many large schemas. It's only released when the associated iModel is closed.

## Worker connections cache

Presentation manager uses worker threads to fulfil requests to avoid blocking the main thread (see [PresentationManagerProps.workerThreadsCount]($presentation-backend)). Each worker thread uses a separate SQLite connection to the iModel to be able to run multiple queries in parallel. Each SQLite connection uses an in-memory page cache to increase query performance (see [SQLite's cache_size documentation](https://www.sqlite.org/pragma.html#pragma_cache_size)), which by default is configured at 32 MB. This means that the total amount for memory these caches may consume is:

`{number of iModels used for requests} * {number of worker threads} * {worker connection cache size}`

The cache is released when the worker connection is closed, which happens when either the iModel is closed or the presentation manager is disposed.

Size of the cache can be controlled when initializing [Presentation]($presentation-backend) or creating [PresentationManager]($presentation-backend) by passing a custom value for [PresentationManagerCachingConfig.workerConnectionCacheSize]($presentation-backend).

## Hierarchies cache

Presentation manager caches created hierarchy parts in a separate SQLite database to avoid having to run expensive queries on iModels more than once.

The cache is per-iModel and per-worker thread, so the the total amount consists of:

`{number of iModels used for requests} * {number of worker threads} * {hierarchy cache size}`

The place where the cache is stored and the amount of space it allocates depends on [PresentationManagerCachingConfig.hierarchies]($presentation-backend) configuration. Available options are:

- [HierarchyCacheMode.Memory]($presentation-backend)
- [HierarchyCacheMode.Disk]($presentation-backend)
- [HierarchyCacheMode.Hybrid]($presentation-backend)

In all cases, the hierarchy cache is configured to have a limit of 1 GB size, except for mobile platforms where it's 50 MB. It may also use an additional in-memory page cache.

By default presentation manager uses the [HierarchyCacheMode.Disk]($presentation-backend) mode.

In-memory iModel-specific caches are released on iModel close. All in-memory caches are released on presentation manager dispose. The cache persisted on disk is not deleted automatically and is reused when possible.

### Memory cache

The memory cache uses SQLite's feature that allows creating [in-memory databases](https://www.sqlite.org/inmemorydb.html) and in this case all the cache is stored in memory. Due to this nature, the cache is lost when presentation manager is disposed or a different presentation manager instance is used to retrieve same data.

### Disk cache

Disk-based cache stores the database on disk, which makes the cache persistent and allows it to be shared between multiple instances of presentation manager.

The location of the database file defaults to the directory of the iModel and may be configured using the [DiskHierarchyCacheConfig.directory]($presentation-backend) configuration attribute when initializing [Presentation]($presentation-backend) or creating [PresentationManager]($presentation-backend).

Size of the in-memory page cache defaults to 32 MB and may be configured using [DiskHierarchyCacheConfig.memoryCacheSize]($presentation-backend) configuration attribute.

### Hybrid cache

Hybrid cache is an experimental feature that uses a combination of disk and memory caches.

When creating hierarchies, there are multiple reads and writes going on in the cache, which requires a write transaction and blocks other readers until the hierarchy level is complete and transaction is committed. To make the lock as short as possible, this approach does all the processing using a memory cache and only at the end of the process all memory cache content is transferred to the disk cache, thus minimizing the time the disk cache is blocked and improving parallelism.

The hybrid cache still uses a disk cache to persist the data and provides ability to configure it as necessary through the [HybridCacheConfig.disk]($presentation-backend) configuration option.

## Content cache

Presentation manager builds content in 2 stages: descriptor (meta-data) and content items (data). Creating the descriptor may be even more expensive than creating the content itself, because it requires analyzing meta-data as well as data in the iModel to determine what classes and relationships to use for querying the requested data. To avoid having to re-create the descriptor when requesting data in pages, the descriptor is cached a LRU in-memory cache.

The number of descriptors cached defaults to `100` and may be controlled through [ContentCacheConfig.size]($presentation-backend) configuration option.
