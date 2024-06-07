# Property Stores

A "Property Store" is a SQLiteDb (a [PropertyStore.PropertyDb]($backend)) that holds name/value pairs. The *value* is called a `Property`.

## PropertyStore.PropertyDb

A `PropertyDb` may be either be just a local file or stored in a *cloud storage container* accessed through RBAC permissions. Each `PropertyDb` is completely independent of and isolated from all others, and there can be an unbounded number of them.

There is no hard limit on the number of properties in a `PropertyDb`, nor on the size of individual properties within a `PropertyDb`.

## PropertyStore.CloudAccess

The [PropertyStore.CloudAccess]($backend) class provides convenient access to cloud-based `PropertyDb`s. It connects the cloud database with a local cache, held on a local fast disk drive, on each computer using it. Reads are always against the local cache, as of some point of time in the past when it was last *synced*. The local cache need not be fully populated - it starts out empty. Whenever `Property` data not held in the local cache is needed, it is read from the cloud container, as of the time of the last sync. If the same property is read multiple times in a row, subsequent reads after the first will never require network access.

Likewise, writes are always against the local cache. However, writes to the local cache *may only happen with the container write lock held*. Only one user at a time may hold the write lock. The write lock is obtained by the [PropertyStore.CloudAccess.writeLocker]($backend) proxy. After obtaining the write lock and before any local changes may be made, the local cache is synchronized with the most recent changes. In this manner, writes are "serialized" and each user must wait for the container to become *available* before writing. The amount of *write lock contention* will vary according to:

- the number of simultaneous writers
- bandwidth and latency of writers

Generally writes to `PropertyDb`s are rare, relative to reads, and the number of simultaneous writers is small.

### Offline usage

Sometimes it is desirable to permit access to Property data when a network connection is either unavailable, unreliable, or slow. To facilitate this, it is possible to initiate a "prefetch" operation (e.g. while connected to a fast network) to download the entire contents of a `PropertyDb`. Thereafter all properties may be successfully read, without requiring any network traffic.

> Note: no writes to a cloud `PropertyDb` are possible when offline.

## PropertyDb Scope

Each `PropertyDb` is a separate entity, with an independent identity, lifecycle, RBAC controls, and location. Therefore, the choice of *which properties to put in which PropertyDb* can be non-obvious.

For example, the *scope* of a `PropertyDb` can be:

- an entire iTwin
- a single iModel
- a team of users for an iTwin
- a team of users for an iModel
- a single user of a single iModel
- a single user for all iModels
- many other permutations on these themes.

One tradeoff comes from access control. Each user may be granted either read or read/write permission to an entire `PropertyStore`. To create more fine-grained access rights, create more than one `PropertyStore`. Also, the larger the number of users with write access to a given `PropertyStore`, the greater the potential for write lock contention.

## PropertyTypes

A `PropertyDb` may hold values of type:

- `string`: saved from and loaded into JavaScript `string` primitives.
- `number`:  saved from and loaded into JavaScript `number` primitives. As in JavaScript, there is no distinction between integers and real numbers.
- `boolean`:  saved from and loaded into JavaScript `boolean` primitives
- `blob`: binary data, saved from and loaded into JavaScript `Uint8Array` objects.
- `object`: comprised of JavaScript `objects` with named members of type `string`, `number`, `boolean`, nested objects, or arrays of the same. Objects are saved with [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and loaded with [JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse). They may not contain blobs or instances of classes.

## PropertyNames

Each property within a `PropertyDb` is identified by a unique string called a `PropertyName`. `PropertyNames` must be between 3 and 2048 characters long, and may not begin or end with a space.

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

## PropertyDb vs. Settings vs. Workspaces

There can be some confusion about the roles of `PropertyDb`, `Settings`, and `WorkspaceDb`, since each deal with name/value pairs in some way.

These facts may help:

- `Settings` *exist only in memory* and must be stored and loaded using some other technique. `Settings` map a name (a [SettingName]($backend)) to a JavaScript object (a [SettingContainer]($backend)). They exist for applications to quickly get a *current value* for a concept that may be supplied externally. The [Settings]($backend) api provides ways to *load* `Settings`from JSON files, JSON strings, or simply from JavaScript objects created by programs. Importantly, the api provides a hierarchical way to predictably *override* a value. That is, if the same `SettingName` has multiple possible values supplied, the *highest priority* value is used.

- A `PropertyDb` can be a cloud based persistent storage for name/value pairs. Given a `PropertyDb`, there will be 0 or 1 `Property` value for a given `PropertyName` (i.e. it either exists or it doesn't). The value of a `Property` is not cached in memory, but is instead (re-)read "from the cloud"\* every time it is accessed. `PropertyStores` are modified using *serialized transactions*, wherein there can only be one writer at a time and all changes "overwrite" previous values. One potential use of a `PropertyStore` is to save and load `Settings`.

- A `WorkspaceDb` is a versioned, "write once," cloud based persistent store for name/value pairs. Multiple versions of the same `WorkspaceDb` may be held in the same `WorkspaceContainer`, and once a version is created it is *immutable* (may never be changed again). In this manner "all versions" of a `WorkspaceDb` are available indefinitely, and applications (and users) may decide whether to access the *most recent* version or some older version, as appropriate. It is generally expected that `WorkspaceDb`s have a small number of *trusted* (but infrequent) writers and a much larger number of readers. Like `PropertyStore` values, `WorkspaceResource`s are never cached in memory, but (re-)read "from the cloud"\* every time they're accessed. One potential use of a `WorkspaceResources` is to save and load `Settings`.

\* in reality values are read from a local cache. There is only network activity on the first access or if the value has been changed in the cloud since it was last read.
