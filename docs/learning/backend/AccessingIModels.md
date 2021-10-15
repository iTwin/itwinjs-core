# Accessing iModels with the iTwin.js library

iTwin.js is an open platform for creating, maintaining, and accessing Infrastructure Digital Twins using iModels. The open source nature of iTwin.js promotes an ecosystem of independent innovation using iModels. At the same time, iTwin.js strives to provide ways to limit access to your intellectual property stored in iModels to *only people and programs that you designate*, in real time.

These two somewhat competing goals are addressed internally by iTwin.js by two important details:

1. **Snapshot** iModels
2. The `@bentley/imodeljs-native` module

## Snapshot iModels

Snapshot iModels are a **static** point-in-time representation of the state of an iModel. Once created, they can not be modified.

There are two common use cases for Snapshot iModels:

1. Export the state of an iModel at a point in time, for archival purposes.
2. A static but intelligent format for exchange of Infrastructure Digital Twins.

When you create a Snapshot iModel, you implicitly *opt-out of enforcement* of any user or application authentication. *Snapshot iModels may be accessed by any iTwin.js program*, so there is no need or requirement for authentication by iTwin.js.

> Note: A password can optionally be provided when creating and opening Snapshot iModels.

### Creating Snapshot iModels

The iTwin.js api has two ways to create a Snapshot iModel. Both are methods on the [SnapshotDb]($backend) class:

1. [SnapshotDb.createFrom]($backend)
2. [SnapshotDb.createEmpty]($backend)

The first method creates a Snapshot iModel from an existing iModel into the supplied filename.  This requires permission from the owner of the original iModel (which obviously must have been previously obtained to open the source iModel.) The `SnapshotDb` may be used to modify and/or extend the copy of the original iModel, but once closed it becomes immutable.

The second method creates an *empty* Snapshot iModel given a filename. This is useful for applications that wish to create static iModels from external data sources. The `SnapshotDb` may be used to populate the Snapshot, but once closed it becomes immutable.

#### Create Snapshots with *iTwin Snapshot*

[iTwin Snapshot]($docs/learning/tutorials/create-test-imodel-offline.md), is a free tool for creating snapshots. iTwin Snapshot was designed for developers to quickly generate snapshots for use in iTwin.js development.

### Important properties of Snapshot iModels

- They are "real" iModels. There are no limitations on size or content of Snapshot iModels.
- They may be accessed by anyone, and iTwin.js does not require authentication (though it may log usage) when it operates on them.
- They cannot be modified and therefore have no timeline. The ability to synchronize non-Snapshot iModels and track and store changes to iModels is a service offered by Bentley (or third parties licensed by Bentley) for a fee. Synchronized iModels can be offline temporarily when a network connection is not available. Being offline via a local briefcase is a different concept than a Snapshot iModel. A local briefcase will eventually be synchronized when online, while a Snapshot iModel is static.
- They are identified by a special value of the "briefcase id" property inside the iModel. Changing the briefcase id of a Snapshot iModel (via subterfuge) violates the spirit and intent of the license agreement. Don't do this.
- You may use the iTwin.js library on Snapshot iModels as outlined in the [LICENSE.md](https://github.com/iTwin/itwinjs-core/blob/master/core/backend/src/imodeljs-native-LICENSE.md).

## The `@bentley/imodeljs-native` module

The `@bentley/imodeljs-native` module is written in C++, is delivered as a platform-specific binary, and is *not* open source. It contains the SQLite code that directly accesses iModel files and implements all the low-level APIs upon which `@itwin/core-backend` is based. It is always required for all backends.

`@bentley/imodeljs-native` implements the authentication and access enforcement expressed by iModel owners for (non-Snapshot) iModels. User authentication and access rights are a service of Bentley Systems, as a part of if its iTwin Services offerings. Bentley may also license third parties to supply similar services. **This is Bentley Systems' commercial motivation for creating iTwin.js**. Any attempt to circumvent or disrupt this checking is a violation of the [license agreement](https://github.com/iTwin/itwinjs-core/blob/master/core/backend/src/imodeljs-native-LICENSE.md).

> Note that only the imodeljs-backend module has a dependency on imodeljs-native. Frontend applications do not require a right-to-run (the iTwin.js libraries are MIT Licensed), though they may connect to a backend that does.
