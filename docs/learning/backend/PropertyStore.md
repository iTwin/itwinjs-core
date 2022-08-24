# Property Store

A `PropertyStore` is a cloud-backed storage of name/value pairs. The *value* is called a `Property`.

A `PropertyStore` is conceptually a *cloud storage container of properties* accessed through RBAC permissions. Each `PropertyStore` is completely independent of and isolated from all others, and there can be an unbounded number of them. `PropertyStore`s are created and deleted merely by creating and deleting cloud storage containers.

There is no hard limit on the number of properties in a `PropertyStore`, nor on the size of individual properties within a `PropertyStore`.

## PropertyStore "Residency"

A `PropertyStore` is a *cloud storage container of properties*, and may be implemented using the "blob store" features of various cloud providers (e.g. [Azure Blob Store](https://azure.microsoft.com/en-us/services/storage/blobs/), [Amazon S3](https://aws.amazon.com/s3/), [Google Cloud Storage](https://cloud.google.com/storage), [Alibaba OSS](https://www.alibabacloud.com/product/object-storage-service), etc.)

Each `PropertyStore` is stored in a datacenter. The provider and geographical location of the datacenter can be different for each `PropertyStore`. The choice may be based on factors including government regulations, or proximity to its users (often they are the same.)

`PropertyStore` cloud containers may be geo-replicated for read access or for backup, but all writes are directed to single "master" copy.

## PropertyStore Local Caching

The `PropertyStore` api relies on there being a local cache, held on a local fast disk drive, on each computer using it. Reads are always against the local cache, as of some point of time in the past when the PropertyStore was last *synced*. The local cache need not be fully populated - it starts out empty. Whenever `Property` data not held in the local cache is needed, it is read from the cloud container, as of the time of the last sync. If the same property is read multiple times in a row, subsequent reads after the first will never require network access.

Likewise, writes are always against the local cache. However, writes to the local cache *may only happen with the container write lock held*. Only one user at a time may hold the write lock. After obtaining the write lock and before any local changes may be made, the local cache is synchronized with the most recent changes. In this manner, writes are "serialized" and each user must wait for the container to become *available* before writing. The amount of *write lock contention* will vary according to:

- the number of simultaneous writers
- bandwidth and latency of writers

Generally writes to `PropertyStore`s are rare, relative to reads, and the number of simultaneous writers is small.

### Offline usage

Sometimes it is desirable to permit access to Property data when a network connection is either unavailable, unreliable, or slow. To facilitate this, it is possible to initiate a "prefetch" operation (e.g. while connected to a fast network) to download the entire contents of a `PropertyStore`. Thereafter all properties may be successfully read, without requiring any network traffic.

> Note: no writes to a `PropertyStore` are possible when offline.

## PropertyStore Access Control

All access to the content of a `PropertyStore` is through the cloud provider's apis. To access a cloud container, a user must supply their credentials and desired access (read or write) to an "access server", and be validated. The response is in the form of an *AccessToken* that encodes their right to access the container. This token must be supplied to the `PropertyStore` api, which in turn incorporates it into its requests to read or write to the cloud container.

AccessTokens expire, generally after a number of hours. Applications should note the expiration time and *refresh* (by re-supplying the user's credentials) AccessTokens before they expire.

User management, RBAC administration, and authentication each require services outside the scope of the `PropertyStore` api.

> Note: All Property data that is cached locally does *not* require a network connection, and therefore an AccessToken, to be read. If a PropertyStore has been "prefetched", it may be accessed offline without requiring additional authentication (which of course is the point.)

## PropertyStore Scope

Each `PropertyStore` is a separate entity, with an independent identity, lifecycle, RBAC controls, and location. Therefore, the choice of *which properties to put in which PropertyStore* can be non-obvious.

For example, the *scope* of a `PropertyStore` can be:

- an entire iTwin
- a single iModel
- a team of users for an iTwin
- a team of users for an iModel
- a single user of a single iModel
- a single user for all iModels
- many other permutations on these themes.

One tradeoff comes from access control. Each user may be granted either read or read/write permission to an entire `PropertyStore`. To create more fine-grained access rights, create more than one `PropertyStore`. Also, the larger the number of users with write access to a given `PropertyStore`, the greater the potential for write lock contention.

## PropertyTypes

A `PropertyStore` may hold values of type:

- `string`: saved from and loaded into JavaScript `string` primitives.
- `number`:  saved from and loaded into JavaScript `number` primitives. As in JavaScript, there is no distinction between integers and real numbers.
- `boolean`:  saved from and loaded into JavaScript `boolean` primitives
- `blob`: binary data, saved from and loaded into JavaScript `Uint8Array` objects.
- `object`: comprised of JavaScript `objects` with named members of type `string`, `number`, `boolean`, nested objects, or arrays of the same. Objects are saved with [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and loaded with [JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse). They may not contain blobs or instances of classes.

## PropertyNames

Each property within a `PropertyStore` is identified by a unique string called a `PropertyName`. `PropertyNames` must be between 3 and 2048 characters long, and may not begin or end with a space.

Since properties are (only) identified by their `PropertyName`, applications should organize them according to some convention, usually by forming a hierarchy, much like naming folders and files on a disk drive. By convention, the first part of a `PropertyName` should be a *namespace* (identifying the "application" that owns it) followed by "/".

- `FliteGen/paths/run1`
- `AlrViewer/symbology/lights/emf`
- `AlrViewer/symbology/materials/emf`

Additionally, it may be desirable to form an "URI-like" convention wherein parts of `PropertyNames` can identify individual members of a collection, or options, e.g.:

- `RtsSimulation/scenario1/results`
- `RtsSimulation/scenario36/results`
- `RtsSimulation/scenario36/results/?excList={33,4}`
- `SeismicRecord/?user="Frieda Green"&prot=1`
- `SeismicRecord/?profile=[last,medium,highest]`

Other than enforcing uniqueness, `PropertyStore`s never "interpret" `PropertyName`s. Applications do that using whatever parsing conventions they deem appropriate.

## The PropertyStore API

The PropertyStore API runs only on the backend. If property values are needed in frontend code (i.e. in a browser), applications will need to create custom IPC, RPC, or REST apis to supply them.

The PropertyStore api has two interfaces:

- [PropertyStore]($backend) provides functions for writing, synchronizing with the cloud container, and providing the AccessToken.
- [PropertyStore.Values]($backend) provides functions to obtain the current value of Properties as well as iterating over them.

## PropertyStore vs. Settings vs. Workspaces

There can be some confusion about the roles of `PropertyStore`, `Settings`, and `WorkspaceDb`, since each deal with name/value pairs in some way.

These facts may help:

- `Settings` *exist only in memory* and must be stored and loaded using some other technique. `Settings` map a name (a [SettingName]($backend)) to a JavaScript object (a [SettingObject]($backend)). They exist for applications to quickly get a *current value* for a concept that may be supplied externally. The [Settings]($backend) api provides ways to *load* `Settings`from JSON files, JSON strings, or simply from JavaScript objects created by programs. Importantly, the api provides a hierarchical way to predictably *override* a value. That is, if the same `SettingName` has multiple possible values supplied, the *highest priority* value is used.

- A `PropertyStore` is a cloud based persistent storage for name/value pairs. Given a [PropertyStore]($backend), there will be 0 or 1 `Property` value for a given `PropertyName` (i.e. it either exists or it doesn't). The value of a `Property` is not cached in memory, but is instead (re-)read "from the cloud"\* every time it is accessed. `PropertyStores` are modified using *serialized transactions*, wherein there can only be one writer at a time and all changes "overwrite" previous values. One potential use of a `PropertyStore` is to save and load `Settings`.

- A `WorkspaceDb` is a versioned, "write once," cloud based persistent store for name/value pairs. Multiple versions of the same `WorkspaceDb` may be held in the same `WorkspaceContainer`, and once a version is created it is *immutable* (may never be changed again). In this manner "all versions" of a `WorkspaceDb` are available indefinitely, and applications (and users) may decide whether to access the *most recent* version or some older version, as appropriate. It is generally expected that `WorkspaceDb`s have a small number of *trusted* (but infrequent) writers and a much larger number of readers. Like `PropertyStore` values, `WorkspaceResource`s are never cached in memory, but (re-)read "from the cloud"\* every time they're accessed. One potential use of a `WorkspaceResources` is to save and load `Settings`.

\* in reality values are read from a local cache. There is only network activity on the first access or if the value has been changed in the cloud since it was last read.
