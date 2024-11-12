# Change Log - @itwin/core-backend

This log was last generated on Wed, 06 Nov 2024 19:24:30 GMT and should not be manually modified.

## 4.9.7
Wed, 06 Nov 2024 19:23:04 GMT

_Version update only_

## 4.9.6
Tue, 05 Nov 2024 15:22:45 GMT

_Version update only_

## 4.9.5
Tue, 22 Oct 2024 20:01:40 GMT

### Updates

- Comply with 4.8.x ECSql row format

## 4.9.4
Wed, 09 Oct 2024 20:22:04 GMT

### Updates

- fix regression related to classid

## 4.9.3
Thu, 03 Oct 2024 19:15:45 GMT

_Version update only_

## 4.9.2
Wed, 02 Oct 2024 15:14:43 GMT

_Version update only_

## 4.9.1
Wed, 25 Sep 2024 20:10:58 GMT

### Updates

- Removed added tests for boolean exps in select statement

## 4.9.0
Mon, 23 Sep 2024 13:44:01 GMT

### Updates

- Added tests cases as we now support boolean exps in select statements
- Added support for CTE in subquery for the command "PRAGMA parseTree"
- Added support for CTE without columns and also for insert statement to use ONLY keyword
- Add openGroup() and writeToFile to sqliteChagnesetReader
- Exposing a new function `computeGraphemeOffsets` that calculates the grapheme offsets for a RunLayoutResult.
- set LogMask to ALl if CloudSqlite LoggerCatetory is Trace
- Optional base uri added to TokenProps interface
- base uri added to BlobContainer.TokenProps interface
- Newly created WorkspaceDbs will have version 0.0.0. All prerelease (0.x.x or x.x.x-identifier) WorkspaceDbs can be edited. 

## 4.8.7
Fri, 13 Sep 2024 15:11:17 GMT

_Version update only_

## 4.8.6
Fri, 06 Sep 2024 05:06:49 GMT

_Version update only_

## 4.8.5
Wed, 28 Aug 2024 17:27:23 GMT

_Version update only_

## 4.8.4
Thu, 22 Aug 2024 17:37:06 GMT

_Version update only_

## 4.8.3
Fri, 16 Aug 2024 18:18:14 GMT

_Version update only_

## 4.8.2
Thu, 15 Aug 2024 15:33:49 GMT

_Version update only_

## 4.8.1
Mon, 12 Aug 2024 14:05:54 GMT

_Version update only_

## 4.8.0
Thu, 08 Aug 2024 16:15:37 GMT

### Updates

- Append a test for null handling using updateElement
- Able to recover from when ExclusiveRootClassId is NULL for overflow table
- SchemaSync.pull() should not obtain write-lock on container
- Update changed elements process options for bounding box calculations
- set a fake codeService that always throws for verifyCode if code is not null if codeServiceDb is not available
- delete briefcase .bim file on a failed download
- Don't throw an error if sourceMap is null/undefined
- keep sourceMap undefined/null in targetProps
- Added a function `computeLayoutTextBlockResult` to get the results of calculating a TextBlock's layout.
- revise @beta apis for Settings and Workspaces to allow loading dictionaries from iModel and WorkspaceDbs
- Add RPC method queryAllUsedSpatialSubCategories() to fetch all subcategories of used spatial categories and 3D elements.
- Make cleanDeletedBlocks interruptible, and remove function from CloudContainer object. Add it to CloudSqlite namespace
- Add static metadata to OpenTelemetry spans
- produceTextAnnotationGeometry aligns the anchor point with the origin.
- Update IModel.changeset when changes are made by another process.
- Begin deprecating @internal APIs.
- Improve TextAnnotation layout to use Unicode line-breaking algorithm for wrapping long lines.
- Deprecate the internal `nativeDb` fields of IModelDb, ECDb, and SQLiteDb, to be removed in 5.0
- Add LockControl.releaseAllLocks, which throws if the briefcase contains local changes.
- Fix bugs with TextAnnotation wrapping and justification.
- deleteElementTree handles case where GeometryStream refers to LineStyle
- BriefcaseDb.closeAndReopen now refreshes the changeset property in case another process pulled changes

## 4.7.8
Wed, 31 Jul 2024 13:38:04 GMT

_Version update only_

## 4.7.7
Fri, 19 Jul 2024 14:52:42 GMT

_Version update only_

## 4.7.6
Fri, 12 Jul 2024 14:42:55 GMT

### Updates

- Add static metadata to OpenTelemetry spans

## 4.7.5
Thu, 11 Jul 2024 15:24:55 GMT

### Updates

- Able to recover from when ExclusiveRootClassId is NULL for overflow table

## 4.7.4
Mon, 01 Jul 2024 14:06:23 GMT

### Updates

- Update IModel.changeset when changes are made by another process.

## 4.7.3
Thu, 27 Jun 2024 21:09:02 GMT

_Version update only_

## 4.7.2
Sat, 22 Jun 2024 01:09:54 GMT

### Updates

- Update changed elements process options for bounding box calculations
- BriefcaseDb.closeAndReopen now refreshes the changeset property in case another process pulled changes

## 4.7.1
Thu, 13 Jun 2024 22:47:31 GMT

_Version update only_

## 4.7.0
Wed, 12 Jun 2024 18:02:16 GMT

### Updates

- schemaUpgrade() now push change to schema sync
- Remove @alpha BackendLoggerCategory.Editing
- Added getAvailableCoordinateReferenceSystems.
- Brotli compression enabled for RPC requests.
- Increase restrictions on native app storage name.
- Added computeTextBlockExtents

## 4.6.2
Sat, 08 Jun 2024 00:50:25 GMT

_Version update only_

## 4.6.1
Wed, 29 May 2024 14:35:17 GMT

_Version update only_

## 4.6.0
Mon, 13 May 2024 20:32:51 GMT

### Updates

- Improve ChangesetConflictArgs & SqliteChangeSetReader API
- Add awareness to legacy Channels created by Batch Connectors. Update tests and documentation regarding creation of Channels against Partitions instead of Subjects. Remove sharedChannel from the list of allowedChannels by default.
- add test logic to extract fb from iModel
- Remove @alpha BackendLoggerCategory.Editing
- change signature to updateElement to be Partial<ElementProps>. Also update documentation that model and classFullName may not be changed.
- Add metadata to errors thrown by `insertElement`, `updateElement` and `deleteElement` in `IModelDb`
- Don't save to lock-database when inserting elements if their Model is locked
- Promote ClassRegistry.register to public.
- Change SpanKind of RPC requests to Internal
- Fix text annotation rotation around anchor point.
- Add TextAnnotation APIs.
- allow pushing changes from a briefcase opened readonly
- deleteElementTree handles DefinitionContainers
- log only an info message on no aspects

## 4.5.2
Tue, 16 Apr 2024 14:46:21 GMT

_Version update only_

## 4.5.1
Wed, 03 Apr 2024 18:26:58 GMT

_Version update only_

## 4.5.0
Tue, 02 Apr 2024 19:06:00 GMT

### Updates

- Fix SectionDrawing.insert to insert a SectionDrawingModel, not a DrawingModel.
- Added busyTimeout parameter to allow read/write connection to set it.
- Added new tests for selecting duplicate property names using UseECSqlPropertyNames QueryRowFormat.
- Add metadata to errors thrown by `insertElement`, `updateElement` and `deleteElement` in `IModelDb`
- make case of pattern_useconstantlod match backend code
- `IModelDb`: Fix `IModelDb.views.accessViewStore` ignoring supplied `userToken` and `accessLevel` values
- Throws an error if BlobContainer.service is undefined in CloudSqlite.requestToken
- add SnapshotDb.openCheckpoint to open a checkpoint directly from its cloud container
- Introduce EditableWorkspaceDb.

## 4.4.9
Mon, 15 Apr 2024 20:29:22 GMT

_Version update only_

## 4.4.8
Mon, 25 Mar 2024 22:22:26 GMT

_Version update only_

## 4.4.7
Fri, 15 Mar 2024 19:15:14 GMT

_Version update only_

## 4.4.6
Fri, 08 Mar 2024 15:57:11 GMT

_Version update only_

## 4.4.5
Tue, 05 Mar 2024 20:37:18 GMT

_Version update only_

## 4.4.4
Fri, 01 Mar 2024 18:21:01 GMT

_Version update only_

## 4.4.3
Fri, 23 Feb 2024 21:26:07 GMT

_Version update only_

## 4.4.2
Fri, 16 Feb 2024 14:22:01 GMT

_Version update only_

## 4.4.1
Fri, 16 Feb 2024 14:17:48 GMT

_Version update only_

## 4.4.0
Mon, 12 Feb 2024 18:15:58 GMT

### Updates

- Inserting, updating and deleting of an element aspect requires exclusive lock on the element that owns it
- Add changeset reader api
- Update ChangesetReader API and fix bug.
- Save changes before closing IModels opened in ReadWrite mode
- Bump @itwin/object-storage-azure and @itwin/object-storage-core
- vDirection is deprecated
- Add `ECDb.getSchemaProps`
- fix texture remapping in RenderMaterialElement.onCloned
- Add support for Node 20.
- make case of pattern_useconstantlod match backend code
- Fix a breaking internal API change affecting @itwin/imodels-access-backend"
- Change reserved SQLite keywords from tests.
- modified getAspects to handle dot separator in full class name
- lint fix

## 4.3.5
Mon, 25 Mar 2024 16:54:36 GMT

_Version update only_

## 4.3.4
Fri, 22 Mar 2024 13:30:30 GMT

### Updates

- Bump @itwin/object-storage-azure and @itwin/object-storage-core

## 4.3.3
Wed, 03 Jan 2024 19:28:38 GMT

### Updates

- Update ChangesetReader API and fix bug.

## 4.3.2
Thu, 14 Dec 2023 20:23:02 GMT

_Version update only_

## 4.3.1
Wed, 13 Dec 2023 17:25:54 GMT

### Updates

- Fix a breaking internal API change affecting @itwin/imodels-access-backend"

## 4.3.0
Thu, 07 Dec 2023 17:43:09 GMT

### Updates

- Inserting, updating and deleting of an element aspect requires exclusive lock on the element that owns it
- Add changeset reader api
- Save changes before closing IModels opened in ReadWrite mode
- vDirection is deprecated
- Add `ECDb.getSchemaProps`
- Add support for Node 20.
- Change reserved SQLite keywords from tests.
- modified getAspects to handle dot separator in full class name
- lint fix

## 4.2.4
Mon, 20 Nov 2023 16:14:45 GMT

_Version update only_

## 4.2.3
Mon, 06 Nov 2023 14:01:52 GMT

_Version update only_

## 4.2.2
Thu, 02 Nov 2023 15:36:20 GMT

_Version update only_

## 4.2.1
Tue, 24 Oct 2023 15:09:13 GMT

_Version update only_

## 4.2.0
Tue, 17 Oct 2023 15:14:32 GMT

### Updates

- Add ECSqlExpr api
- Add support for schema synchronization
- Fixed a null reference error when upgrading schemas to EC3
- Adds logging for checkpoint application and V2 checkpoint downloads
- add exportGraphics test to verify uv-parameter output
- ECDb.createQueryReader and IModelDb.createQueryReader are now public
- restart default txn after 10 minutes inactivity on v2 checkpoints
- Add TxnManager events raised when applying external txns.
- Fix RenderMaterialElement using the wrong CodeSpec.
- Fix two potential bugs when closing and reopening an iModel while pulling changes."
- Make watching for briefcase changes more reliable.
- As instance access no longer an experimental feature, removed experimental features option from relevant ecsql.
- Use instance query to get aspects for abstract classes
- ViewStore.ViewDb.getViewGroups select statement was referring to ParentId when parent was meant
- Remove `storageType` from `BlobContainer.RequestTokenProps`.
- Add 'provider' to 'BlobContainer.CreatedContainerProps' 
- add TileStorage.getCachedTilesGenerator

## 4.1.9
Tue, 10 Oct 2023 18:48:12 GMT

_Version update only_

## 4.1.8
Fri, 06 Oct 2023 04:00:18 GMT

_Version update only_

## 4.1.7
Thu, 28 Sep 2023 21:41:33 GMT

_Version update only_

## 4.1.6
Tue, 12 Sep 2023 15:38:52 GMT

_Version update only_

## 4.1.5
Fri, 08 Sep 2023 13:37:23 GMT

_Version update only_

## 4.1.4
Thu, 07 Sep 2023 18:26:02 GMT

### Updates

- restart default txn after 10 minutes inactivity on v2 checkpoints

## 4.1.3
Wed, 30 Aug 2023 15:35:27 GMT

_Version update only_

## 4.1.2
Wed, 23 Aug 2023 15:25:29 GMT

### Updates

- add TileStorage.getCachedTilesGenerator

## 4.1.1
Fri, 18 Aug 2023 13:02:53 GMT

### Updates

- add `internal` `codeValueBehavior` API 

## 4.1.0
Mon, 14 Aug 2023 14:36:34 GMT

### Updates

- Added the ability to convert EC2 XML schemas to EC3.2 XML schemas using the convertEC2SchemasToEC3Schemas method. Also added the ability to convert custom attributes of schemas using the upgradeCustomAttributesToEC3 method.
- Promote ECSchemaXmlContext to beta
- Made MetaDataRegistry internal again
- add auto-refresh tokens for CloudSqlite containers
- Added unit test to check if retry was triggered when concurrent query faces a timeout
- Upgrade sinon to 15.0.4
- add ChannelAdmin.makeChannelRoot
- Prefetches triggered by attach now have configurable minRequests/maxRequests through ApplicationSettings
- Promote MetaDataRegistry to beta.
- Fix RenderMaterialElement using the wrong CodeSpec.
- Promote Entity methods and constructors to @public; mark constructors protected.
- Promote ElementAspect constructors to public.
- add watchForChanges to OpenBriefcaseArgs
- fix PatternParams.applyTransform to update origin property
- Add ContainerType
- Modify BlobContainerStorage Interfaces
- add ViewStore apis
- Switch to ESLint new flat config system

## 4.0.7
Thu, 10 Aug 2023 13:19:24 GMT

### Updates

- @bentley/imodeljs-native@4.0.14

## 4.0.6
Mon, 24 Jul 2023 05:07:33 GMT

_Version update only_

## 4.0.5
Tue, 18 Jul 2023 12:21:56 GMT

_Version update only_

## 4.0.4
Wed, 12 Jul 2023 15:50:01 GMT

_Version update only_

## 4.0.3
Mon, 03 Jul 2023 15:28:41 GMT

_Version update only_

## 4.0.2
Wed, 21 Jun 2023 22:04:43 GMT

_Version update only_

## 4.0.1
Wed, 21 Jun 2023 20:29:13 GMT

_Version update only_

## 4.0.0
Mon, 22 May 2023 15:34:14 GMT

### Updates

- use baseUri rather than accountName for cloud containers
- added support for index of internal codes
- added IModelHost.profileDir. No two process may use the same profile directory at the same time.
- implemented constant lod texture mapping for tiles
- Deprecate IModelDb's and ECDb's query, queryRowCount, and restartQuery methods.
- Remove `ChangeSummaryManager.extractChangeSummaries`
- added ChannelControl
- Update to eslint@8
- add flag schemaLockHeld
- add public methods to BriefcaseManager to query the hub for changesets
- Drop Node 12 and Node 14.
- Drop Node 16 support.
- Prevent IPC requests from blocking the backend.
- cloudsqlite: add bcvhttplog and pragma bcv_client support
- change backendhubaccess and related properties to @internal
- Add SpatialViewState.fromJSON.
- remove old entity-unaware implementation of getReferenceIds
- rename members of @alpha CodeService interfaces
- DrawingViewDefinition.fromJSON
- Fix for timing issue in core tests
- allow passing a custom schema read context to IModelDb.importSchemas
- Added test to verify Id serialization to hex for system properties.

## 3.8.0
Fri, 08 Dec 2023 15:23:59 GMT

_Version update only_

## 3.7.17
Mon, 20 Nov 2023 18:24:23 GMT

_Version update only_

## 3.7.16
Mon, 16 Oct 2023 12:49:07 GMT

_Version update only_

## 3.7.15
Tue, 10 Oct 2023 19:58:35 GMT

_Version update only_

## 3.7.14
Fri, 29 Sep 2023 16:57:16 GMT

_Version update only_

## 3.7.13
Tue, 08 Aug 2023 19:49:18 GMT

_Version update only_

## 3.7.12
Thu, 27 Jul 2023 21:50:57 GMT

_Version update only_

## 3.7.11
Tue, 11 Jul 2023 17:17:21 GMT

_Version update only_

## 3.7.10
Wed, 05 Jul 2023 13:41:21 GMT

_Version update only_

## 3.7.9
Tue, 20 Jun 2023 12:51:02 GMT

_Version update only_

## 3.7.8
Thu, 01 Jun 2023 17:00:39 GMT

### Updates

- Prefetches triggered by attach now have configurable minRequests/maxRequests through ApplicationSettings

## 3.7.7
Wed, 24 May 2023 17:27:09 GMT

_Version update only_

## 3.7.6
Mon, 15 May 2023 18:23:40 GMT

### Updates

- log metadata when uploading tiles
- disable native sqlite logger category when calling 'updateToRequestedVersion'

## 3.7.5
Thu, 04 May 2023 19:43:18 GMT

_Version update only_

## 3.7.4
Tue, 25 Apr 2023 17:50:35 GMT

_Version update only_

## 3.7.3
Thu, 20 Apr 2023 13:19:28 GMT

### Updates

- Prevent IPC requests from blocking the backend.
- Fix for timing issue in core tests

## 3.7.2
Wed, 12 Apr 2023 13:12:42 GMT

_Version update only_

## 3.7.1
Mon, 03 Apr 2023 15:15:36 GMT

_Version update only_

## 3.7.0
Wed, 29 Mar 2023 15:02:27 GMT

### Updates

- Deprecate IModelDb's and ECDb's query, queryRowCount, and restartQuery methods.

## 3.6.3
Mon, 27 Mar 2023 16:26:47 GMT

_Version update only_

## 3.6.2
Fri, 17 Mar 2023 17:52:32 GMT

_Version update only_

## 3.6.1
Fri, 24 Feb 2023 22:00:48 GMT

_Version update only_

## 3.6.0
Wed, 08 Feb 2023 14:58:39 GMT

### Updates

- add CodeSpecs.updateProperties
- add flag schemaLockHeld
- Added getOriginPropertyName() method to column info.
- add allowPreceding as an optional boolean to CheckpointProps interface
- Log a warning when we fail to download a v2 checkpoint, but download a v1 checkpoint successfully.
- Promote IModelHost.authorizationClient to public.
- Add support for material elements with normal maps
- React to RPC deprecations.
- Fix documentation of ExternalSourceAspectProps.jsonProperties. It must be a string.
- Element.toJSON should not include undefined values for userLabel or federationGuid
- allow passing a custom schema read context to IModelDb.importSchemas

## 3.5.6
Fri, 24 Feb 2023 16:02:47 GMT

_Version update only_

## 3.5.5
Thu, 26 Jan 2023 22:53:27 GMT

_Version update only_

## 3.5.4
Wed, 18 Jan 2023 15:27:15 GMT

_Version update only_

## 3.5.3
Fri, 13 Jan 2023 17:23:07 GMT

_Version update only_

## 3.5.2
Wed, 11 Jan 2023 16:46:30 GMT

### Updates

- security fixes

## 3.5.1
Thu, 15 Dec 2022 16:38:28 GMT

_Version update only_

## 3.5.0
Wed, 07 Dec 2022 19:12:36 GMT

### Updates

- Add EntityReferences and associated utilities
- Added node-dependent RPC function implementations (that previously contaminated common).
- add exportGraphics test for fixed-block mesh
- return empty change summary array on empty changeset range in ChangeSummaryManager
- WorkspaceContainer.Props.syncOnConnect now defaults to true
- Expose Progress API for changeset(s) download in higher levels (BriefcaseManager, IpcAppHandler, etc.)
- add "maybe" binding methods to SqliteStatement
- Add IModelHostOptions.maxTileCacheDbSize for limiting the amount of disk space consumed by local tile cache databases.
- deprecate ExternalSourceAspects.findBySource, add findAllBySource

## 3.4.7
Wed, 30 Nov 2022 14:28:19 GMT

_Version update only_

## 3.4.6
Tue, 22 Nov 2022 14:24:19 GMT

_Version update only_

## 3.4.5
Thu, 17 Nov 2022 21:32:50 GMT

_Version update only_

## 3.4.4
Thu, 10 Nov 2022 19:32:17 GMT

### Updates

- fix ClassRegistry.getRootMetaData mixin handling, handle null ExternalSourceAspect.scope

## 3.4.3
Fri, 28 Oct 2022 13:34:57 GMT

_Version update only_

## 3.4.2
Mon, 24 Oct 2022 13:23:45 GMT

### Updates

- Add asynchronous functions to obtain the extents of geometric models.
- Return a pending response from calls to IModelReadRpcInterface.getCustomViewState3dData if they take too long.

## 3.4.1
Mon, 17 Oct 2022 20:06:51 GMT

### Updates

- Add EntityReferences and associated utilities

## 3.4.0
Thu, 13 Oct 2022 20:24:47 GMT

### Updates

- Removed IModelSchemaLoader, replaced with function to return schema from iModel by and a generic SchemaLoader added to ecschema-metadata
- Chunk traversal options for ChangedElementsDb
- Deprecated CloudStorage in favor of TileStorage + iTwin/object-storage
- added "onlyBaseProperties" to ElementLoadOptions to limit properties to only those in ElementProps, not subclasses
- BoxProps.origin name changed to baseOrigin to agree with json format
- Replace node-report crash reporting with Node.js Diagnostic Reporting
- Clarify RenderMaterialElement documentation
- `IModelJsFs.readdirSync` will now check if dir exists before reading
- add tokenFunc argument to getWorkspaceDb
- Add some logging in CustomViewState3dCreator.
- add querySubCategories function
- call container.checkForChanges before attempting to open a v2 checkpoint
- remove typescript retries for v2 checkpoint downloads
- Updated Node types declaration to support latest v16
- add PropertyStore interface
- delete definition models
- IModelDb.Elements.queryParent
-  deleteElementTree and deleteElementSubTrees
- add doc for CloudCache.setLogMask
- added @beta CloudSqlite
- generate correct date format in local hub changesets

## 3.3.5
Tue, 27 Sep 2022 11:50:59 GMT

### Updates

- Add some logging in CustomViewState3dCreator.
- time getmodelextents per modelid

## 3.3.4
Thu, 08 Sep 2022 19:00:04 GMT

### Updates

- call container.checkForChanges before attempting to open a v2 checkpoint

## 3.3.3
Tue, 06 Sep 2022 20:54:19 GMT

### Updates

- Chunk traversal options for ChangedElementsDb

## 3.3.2
Thu, 01 Sep 2022 14:37:22 GMT

### Updates

- await new promise in CustomViewState3dCreator getModelExtents

## 3.3.1
Fri, 26 Aug 2022 15:40:02 GMT

_Version update only_

## 3.3.0
Thu, 18 Aug 2022 19:08:02 GMT

### Updates

- upgrade mocha to version 10.0.0
- Update links to BIS documentation.
- vacuum is now an instance method
- enable loading gcs data from workspace at https://geocoord-workspace.itwinjs.org/
- Progress API for downloading changesets.
- IModelHost.startup now accepts IModelHostOptions interface rather than IModelHostConfiguration instance
- added computeSchemaChecksum function to IModelHost
- Transport RPC requests over IPC when available.
- make prefetch opt-in instead of opt-out
- move HubMock to core-backend
- retry v2checkpoint downloads when they fail with "Failure when receiving data from the peer"
- set cloud cache size to 50G
- move LocalHub to @internal in core-backend
- deprecate collectPredecessorIds and getPredecessorIds in favor of collectReferenceIds and getReferenceIds
- added SQLiteDb.withOpenDb

## 3.2.9
Fri, 26 Aug 2022 14:21:40 GMT

### Updates

- Update to @bentley/imodeljs-native@3.2.15

## 3.2.8
Tue, 09 Aug 2022 15:52:41 GMT

_Version update only_

## 3.2.7
Mon, 01 Aug 2022 13:36:56 GMT

_Version update only_

## 3.2.6
Fri, 15 Jul 2022 19:04:43 GMT

_Version update only_

## 3.2.5
Wed, 13 Jul 2022 15:45:52 GMT

_Version update only_

## 3.2.4
Tue, 21 Jun 2022 18:06:33 GMT

_Version update only_

## 3.2.3
Fri, 17 Jun 2022 15:18:39 GMT

_Version update only_

## 3.2.2
Fri, 10 Jun 2022 16:11:36 GMT

_Version update only_

## 3.2.1
Tue, 07 Jun 2022 15:02:56 GMT

_Version update only_

## 3.2.0
Fri, 20 May 2022 13:10:54 GMT

### Updates

- Added new additionalTransformPath property to GeodeticDatums and tests
- changed name of GCS in test dataset
- Create an ios test project to run webpacked core tests.
- Added "getMassPropertiesPerCandidate" RPC operation to IModelReadRpcInterface which returns mass properties for each candidate separately.
- Add two new rpcimpls, hydrateViewState and getCustomViewState3dData
- add imodel import context state saving/loading functions for transformer

## 3.1.3
Fri, 15 Apr 2022 13:49:25 GMT

_Version update only_

## 3.1.2
Wed, 06 Apr 2022 22:27:56 GMT

_Version update only_

## 3.1.1
Thu, 31 Mar 2022 15:55:48 GMT

_Version update only_

## 3.1.0
Tue, 29 Mar 2022 20:53:47 GMT

### Updates

- Deprecate IModelReadRpcInterface.getViewThumbnail
- generated element classes now have a default implementation of collectPredecessors returning all set navigation properties
- Correct return status for processGeometryStream and createBRepGeometry.
- Remove IModelDb.elementGeometryUpdate.
- You may specify an element's geometry in terms of an ElementGeometryDataEntry array
- Web IPC fix (when reloading frontend).

## 3.0.3
Fri, 25 Mar 2022 15:10:01 GMT

_Version update only_

## 3.0.2
Thu, 10 Mar 2022 21:18:13 GMT

_Version update only_

## 3.0.1
Thu, 24 Feb 2022 15:26:55 GMT

_Version update only_

## 3.0.0
Mon, 24 Jan 2022 14:00:52 GMT

### Updates

- add briefcaseAlias argument to acquireNewBriefcaseId
- make one method to acquire both shared and exclusive locks
- Add GeometryClass to ExportGraphics
- Update SQLiteDb to public release tag
- initial support for cloud-based WorkspaceContainers
- added IModelDb.workspace
- improve concurrent query changes
- Skip full schema load that cause OOM error on node backend
- Do not reopen connection on schema change
- Remove usage-logging-client
- Upgrade target to ES2019
- Entity no longer implements EntityProps.
- suppress error logging during test that expect errors
- add test and improved concurrent query support
- fix flaky test
- Update BackendHubAccess api to use ChangesetIndexAndId
- Add new GeoServices class and first method to interpret WKT or complete GCS JSON."
- getAccessToken always returns a token
- Fix an exception when attempting to pull changes into a briefcase that already has all the changes.
- LocalhostIpcHost, display-test-app support for R/W web (via orchestrator)
- Added ability to convert iModel coordinates to or from any Geographic CRS
- rename contextId -> iTwinId
- Tests for solid kernel severe error exceptions.
- throw rather than returning status from IModelDb.saveFileProperty and IModelDb.deleteFileProperty
- use db.locks to release all locks
- rename to @itwin/core-backend
- export blobdaemon, blobdaemoncommandargs from imodeljs-native
- Log the error that we catch when v2 checkpoint fails to open
- use BentleyError.getErrorProps(e) instead of just logging e
- Introduce no-non-null-assertion lint rule.
- remove ClientRequestContext and its subclasses
- Removed config.app usage
- Remove deprecated APIs for 3.0.
- allow apps to set safety interval for reattaching deamon
- removed several previously-deprecated apis
- remove IModelWriteRpcInterface
- remove ClientRequestContext.current
- Renamed all occurrences of the term revision0 to version0.
- rework locks
- Removed NativeAppAuthorizationBackend
- Removed two unit tests for reproj and added one
- added RpcTrace
- Bumped dotenv and removed deprecated @types/dotenv
- Replaced ContextRegistry with generalized ITwinAccess interface
- Switching to consume new Projects-Client
-  Renamed an iModel's parent container to iTwin
- Removed references to the deleted config-loader package
- split imodel-transformer out of imodel-backend package
- remove use of "any" types in SqliteStatement
- IModelDb.getTextureImage is async.
- Support for TypeDoc v0.22.7. Fix various broken docs links.
- only export necessary schemas during imodel transformation
- Improved log message when v2 checkpoint downloaded is not for the changeset requested
- caching options for changed elements processing
- Adding WebEditServer (test scenarios only for now)
- add persistent iModel-based settings
- initial implementation of Workspace and Settings

## 2.19.28
Wed, 12 Jan 2022 14:52:38 GMT

_Version update only_

## 2.19.27
Wed, 05 Jan 2022 20:07:20 GMT

_Version update only_

## 2.19.26
Wed, 08 Dec 2021 20:54:52 GMT

_Version update only_

## 2.19.25
Fri, 03 Dec 2021 20:05:49 GMT

_Version update only_

## 2.19.24
Mon, 29 Nov 2021 18:44:31 GMT

_Version update only_

## 2.19.23
Mon, 22 Nov 2021 20:41:39 GMT

_Version update only_

## 2.19.22
Wed, 17 Nov 2021 01:23:26 GMT

### Updates

- Avoid unnecessarily loading schemas that in extreme cases may exhaust JavaScript heap.

## 2.19.21
Wed, 10 Nov 2021 10:58:24 GMT

_Version update only_

## 2.19.20
Fri, 29 Oct 2021 16:14:22 GMT

### Updates

- Additional test for GCS reprojection

## 2.19.19
Mon, 25 Oct 2021 16:16:25 GMT

_Version update only_

## 2.19.18
Thu, 21 Oct 2021 20:59:44 GMT

### Updates

- Backport from PR#2451 enable reprojection and merge

## 2.19.17
Thu, 14 Oct 2021 21:19:43 GMT

_Version update only_

## 2.19.16
Mon, 11 Oct 2021 17:37:46 GMT

_Version update only_

## 2.19.15
Fri, 08 Oct 2021 16:44:23 GMT

_Version update only_

## 2.19.14
Fri, 01 Oct 2021 13:07:03 GMT

_Version update only_

## 2.19.13
Tue, 21 Sep 2021 21:06:40 GMT

_Version update only_

## 2.19.12
Wed, 15 Sep 2021 18:06:46 GMT

_Version update only_

## 2.19.11
Thu, 09 Sep 2021 21:04:58 GMT

_Version update only_

## 2.19.10
Wed, 08 Sep 2021 14:36:01 GMT

_Version update only_

## 2.19.9
Wed, 25 Aug 2021 15:36:01 GMT

### Updates

- throw better exception if IModelHost.startup has not been called

## 2.19.8
Mon, 23 Aug 2021 13:23:13 GMT

_Version update only_

## 2.19.7
Fri, 20 Aug 2021 17:47:22 GMT

### Updates

- add queryV2Checkpoint to BackendHubAccess
- use native serializer for processing schemas in transformer
- only export necessary schemas during imodel transformation

## 2.19.6
Tue, 17 Aug 2021 20:34:29 GMT

_Version update only_

## 2.19.5
Fri, 13 Aug 2021 21:48:08 GMT

_Version update only_

## 2.19.4
Thu, 12 Aug 2021 13:09:26 GMT

### Updates

- clear statement cache before applying schema changesets
- Tests for solid kernel severe error exceptions.

## 2.19.3
Wed, 04 Aug 2021 20:29:34 GMT

_Version update only_

## 2.19.2
Tue, 03 Aug 2021 18:26:23 GMT

_Version update only_

## 2.19.1
Thu, 29 Jul 2021 20:01:11 GMT

### Updates

- Refresh access token when setting up V1 Checkpoints if possible

## 2.19.0
Mon, 26 Jul 2021 12:21:25 GMT

### Updates

- Reactivated test that stopped working when a previous PR for ecef dependency to geographicCRS was reverted
- store changesetIndex on IModelDb
- Better error checks when creating SpatialViewDefinition-s. 
- remove internal barrel-import usage
- throw exception when attempting to download a briefcase on top of an existing file
- Add case for InterpolationCurve3d
- Use worker thread for mass properties calculations.
- Add offset body operation for IFC connector.
- Correctly handle case where subtract operation consumes target body.
- await returned promise to ensure finally block doesn't intercept it

## 2.18.4
Tue, 10 Aug 2021 19:35:13 GMT

_Version update only_

## 2.18.3
Wed, 28 Jul 2021 17:16:30 GMT

_Version update only_

## 2.18.2
Mon, 26 Jul 2021 16:18:31 GMT

_Version update only_

## 2.18.1
Fri, 16 Jul 2021 17:45:09 GMT

_Version update only_

## 2.18.0
Fri, 09 Jul 2021 18:11:24 GMT

### Updates

- TemplateModelCloner now assigns a new FederationGuid for cloned element instances.
- Accomodated the inability to reverse Changesets when creating change summaries. 
- fix lint issue
- begin api transition to changeset index rather than changeset Id
- Use ecef location calculated for projected iModels
- Push refreshes access token if necessary. 
- Do not reuse briefcase ids in ReadWrite workflows when using the RPC interfaces (if the briefcase was not found in the local file system)
- Add missing SectionDrawing properties.

## 2.17.3
Mon, 26 Jul 2021 16:08:36 GMT

_Version update only_

## 2.17.2
Thu, 08 Jul 2021 15:23:00 GMT

### Updates

- Do not reuse briefcase ids in ReadWrite workflows when using the RPC interfaces (if the briefcase was not found in the local file system)

## 2.17.1
Fri, 02 Jul 2021 15:38:31 GMT

### Updates

- Update to @bentley/imodeljs-native@2.17.10 

## 2.17.0
Mon, 28 Jun 2021 16:20:11 GMT

### Updates

- Promote APIs to public.
- Include ECClass Ids in TxnChangedEntities.
- Changes in BriefcaseHandling and ConcurrencyControl to support recovery after deleted changeset
- download V2 checkpoints asynchronously
- Deprecate IModelExporter.excludeElementCategory in favor of excludeElementsInCategory
- make IModelExporter.onExportSchema async
- Notify frontend via Ipc when IModelDb properties change.
- added IModelHost.hubAccess api for mocking IModelHub for tests
- all Element.onInsert and Element.onUpdate methods to modify properties
- Add "first synchronization" optimizations to IModelTransformer
- Don't allow undo of changes to project extents or geolocation.
- promote BriefcaseManager to public
- make IpcHost and NativeHost @public
- Deprecate useless Texture properties.
- added TxnManager.restartSession
- Fixed removal of schema locks if upgrading schemas is a no-op.
- Tests for iModel.UpdateIModelProps()
- fix schema-import occurring potentially out of order
- dont reimport schemas that already exist by default during transformations
- Use ecef location calculated for projected iModels

## 2.16.10
Thu, 22 Jul 2021 20:23:45 GMT

_Version update only_

## 2.16.9
Tue, 06 Jul 2021 22:08:34 GMT

### Updates

- Do not reuse briefcase ids in ReadWrite workflows when using the RPC interfaces (if the briefcase was not found in the local file system)

## 2.16.8
Fri, 02 Jul 2021 17:40:46 GMT

_Version update only_

## 2.16.7
Mon, 28 Jun 2021 18:13:04 GMT

_Version update only_

## 2.16.6
Mon, 28 Jun 2021 13:12:55 GMT

_Version update only_

## 2.16.5
Fri, 25 Jun 2021 16:03:01 GMT

_Version update only_

## 2.16.4
Wed, 23 Jun 2021 17:09:07 GMT

_Version update only_

## 2.16.3
Wed, 16 Jun 2021 20:29:32 GMT

_Version update only_

## 2.16.2
Thu, 03 Jun 2021 18:08:11 GMT

### Updates

- Upgrade to @bentley/imodeljs-native@2.16.2

## 2.16.1
Thu, 27 May 2021 20:04:22 GMT

_Version update only_

## 2.16.0
Mon, 24 May 2021 15:58:39 GMT

### Updates

- Dispatch events when changes are pulled or pushed.
- added IModelDb.withStatement for executing ECSQL without statement caching
- Allow RenderGraphic to be created from flatbuffers format geometry as well as json.
- Improve exclusion handling in IModelTransformer
- Fix `IModelDb.queryEntityIds` when used with `orderBy` and `limit` params.
- IModelExportHandler.onProgress is now async
- Add includeSourceProvenance option to IModelTransformer
- Fixes to desktop/mobile authorization
- return changesetId from pullAndMergeChanges
- Add RenderTimeline element.
- Invoke dependency callbacks only when inputs change
- only add listener for shutdown once for IModelDb
- change arguments to protected static methods of Element, Model, ElementAspect. Only affects schema writers.
- Update version compare classes for property path support and briefcase rolling

## 2.15.6
Wed, 26 May 2021 15:55:19 GMT

_Version update only_

## 2.15.5
Thu, 20 May 2021 15:06:26 GMT

_Version update only_

## 2.15.4
Tue, 18 May 2021 21:59:07 GMT

_Version update only_

## 2.15.3
Mon, 17 May 2021 13:31:37 GMT

_Version update only_

## 2.15.2
Wed, 12 May 2021 18:08:13 GMT

_Version update only_

## 2.15.1
Wed, 05 May 2021 13:18:31 GMT

_Version update only_

## 2.15.0
Fri, 30 Apr 2021 12:36:58 GMT

### Updates

- Update test for AzCopyFileHandler
- Fix tests for changed elements processing
- Properly declare changeSetId variables as string.
- Promote display-related APIs.
- IModelDb.generateElementGraphics can generate graphics for a non-persistent geometry stream.
- Add TypeScript wrappers for ExternalSource and related classes and relationships.
- Fixes to desktop and iOS apps.
- Remove deprecated ElementEditor that was replaced by EditCommands.
- rename (deprecate) BriefcaseIdValue.Standalone to BriefcaseIdValue.Unassigned to reduce confusion
- Add onModelsChanged and onModelGeometryChanged events to TxnManager.
- Saving & restoring Electron main window size, position & maximized state
- add NativeHost.settingsStore

## 2.14.4
Thu, 22 Apr 2021 21:07:33 GMT

_Version update only_

## 2.14.3
Thu, 15 Apr 2021 15:13:16 GMT

_Version update only_

## 2.14.2
Thu, 08 Apr 2021 14:30:09 GMT

_Version update only_

## 2.14.1
Mon, 05 Apr 2021 16:28:00 GMT

### Updates

- Update to @bentley/imodeljs-native@2.14.6

## 2.14.0
Fri, 02 Apr 2021 13:18:42 GMT

### Updates

- move BriefcaseIdValue to imodeljs-common
- Cherry-pick logout fix
- rework Authentication to use IpcHost
- Detect provenance scope conflicts in IModelTransformer
- Update to @bentley/imodeljs-native@2.14.0
- Update to @bentley/imodeljs-native@2.14.4
- Add new exportGraphics options
- add `bindings` member to EntityQueryParams
- Support working in world coords with ElementGeometry.Builder/Iterator. Place line string using ipc command.
- Basic proxy support for web backends and electron applications (WIP)
- Add IpcHost.queryConcurrency.
- Removed hard coded test values in tile upload integration test
- Add additional metadata to tile upload on cache

## 2.13.0
Tue, 09 Mar 2021 20:28:13 GMT

### Updates

- Fixed broken double angle bracket link syntax
- Ensure elements passed to native code are in proper JSON format.
- refactor Ipc layers to use IpcHost/IpcApp
- The export methods of IModelExporter and the process methods of IModelTransformer are now async.
- IPC shim (WIP) for local webviewer apps.
- Add docs and test for CTE support
- Update to @bentley/imodeljs-native@2.13.1
- Update to @bentley/imodeljs-native@2.13.3
- Support Node 14
- add notifications for changed elements on SaveChanges
- Updated to use TypeScript 4.1
- Undo/Redo shortcuts
- begin rename project from iModel.js to iTwin.js

## 2.12.3
Mon, 08 Mar 2021 15:32:00 GMT

_Version update only_

## 2.12.2
Wed, 03 Mar 2021 18:48:52 GMT

### Updates

- Update to @bentley/imodeljs-native@2.12.6

## 2.12.1
Tue, 23 Feb 2021 20:54:45 GMT

_Version update only_

## 2.12.0
Thu, 18 Feb 2021 22:10:13 GMT

### Updates

- Element.code is no longer readonly, so can now be updated
- Deprecate detachChangeCache()
- added optional flag to abbreviate blob properties in queries
- Implement external textures for iModel tiles.
- Updated create display style test to remove credentials from backgroundLayers definition.
- Add IModelTransformerOptions.wasSourceIModelCopiedToTarget to better support branching scenarios.
- Add IModelTransformOptions.isReverseSynchronization to better support synchronizing changes from a branch back to master.
- Mobile IPC fix
- Bump native version to 2.12.1
- Update to @bentley/imodeljs-native@2.12.4
- lock test
- add IpcSocket
- Add beta API for TemplateRecipe2d
- fix incorrect version logic in UsageLoggingUtilities

## 2.11.2
Thu, 18 Feb 2021 02:50:59 GMT

### Updates

- NativeApp download cancellation fix

## 2.11.1
Thu, 04 Feb 2021 17:22:41 GMT

_Version update only_

## 2.11.0
Thu, 28 Jan 2021 13:39:27 GMT

### Updates

- Changed storageType from azure to azure?sas=1 for getCommandArgs function
- Fix brep DataProps to/from flatbuffer to account for base64 string header.
- Element geometry creation by brep operations. 
- Reinstated behavior when re-opening files read-write. 
- enhance BriefcaseManager and BriefcaseDb for edit commands
- Improve ElementGeometry documentation.
- Add a check to verify, and fix, the DbGuid in the iModel if it is different than the Guid in iModelHub.
- ConcurrencyControl.setPolicy was allowing incorrectly typed arguments
- update imodeljs-backend package.json to use 2.11.5 for imodeljs-native
- Update to @bentley/imodeljs-native@2.11.8
- Add IModelExportHandler.onProgress and IModelImporter.onProgress callbacks
- Separated out API to upgrade iModels.
- Version compare property checksums
- return LocalBriefcaseProps from BriefcaseManager.downloadBriefcase

## 2.10.3
Fri, 08 Jan 2021 18:34:03 GMT

_Version update only_

## 2.10.2
Fri, 08 Jan 2021 14:52:02 GMT

### Updates

- Update to @bentley/imodeljs-native@2.10.10

## 2.10.1
Tue, 22 Dec 2020 00:53:38 GMT

### Updates

- Update to @bentley/imodeljs-native@2.10.9

## 2.10.0
Fri, 18 Dec 2020 18:24:01 GMT

### Updates

- Update minimum Node version to 10.17.0
- ECSql Support for Binding Sets of Ids
- Added CheckpointV2 client
- Support compact representation of DisplayStyleSettings.excludedElements.
- Added ElementGeometry.Builder and ElementGeometry.Iterator.
- changed type of member "data" on Texture from string to UInt8Array. ***breaking change***
- Provide better error message when relationship insert/update/delete is not a linktable relationship.
- Compress tiles before upload to blob storage by default.
- Update to @bentley/imodeljs-native@2.10.4
- Update to @bentley/imodeljs-native@2.10.6
- Update to @bentley/imodeljs-native@2.10.8
- channel documentation
- Version compare top parents test update

## 2.9.9
Sun, 13 Dec 2020 19:00:03 GMT

### Updates

- Update to @bentley/imodeljs-native@2.9.10

## 2.9.8
Fri, 11 Dec 2020 02:57:36 GMT

### Updates

- Update to @bentley/imodeljs-native@2.9.9

## 2.9.7
Wed, 09 Dec 2020 20:58:23 GMT

_Version update only_

## 2.9.6
Mon, 07 Dec 2020 18:40:48 GMT

### Updates

- Update to @bentley/imodeljs-native@2.9.8 to consume a performance enhancement to Presentation Rules

## 2.9.5
Sat, 05 Dec 2020 01:55:56 GMT

### Updates

- Update to @bentley/imodeljs-native@2.9.7

## 2.9.4
Wed, 02 Dec 2020 20:55:40 GMT

### Updates

- Update to @bentley/imodeljs-native@2.9.5

## 2.9.3
Mon, 23 Nov 2020 20:57:56 GMT

_Version update only_

## 2.9.2
Mon, 23 Nov 2020 15:33:50 GMT

### Updates

- Update to @bentley/imodeljs-native@2.9.4

## 2.9.1
Thu, 19 Nov 2020 17:03:42 GMT

_Version update only_

## 2.9.0
Wed, 18 Nov 2020 16:01:50 GMT

### Updates

- getElement and getModel can optionally validate the expected class
- Preliminary support for interactive editing sessions.
- Clean up EventSink API for push events.
- GeometryStream query and update using flatbuffer schema.
- Improve projectExtents handling for IModelTransformer and IModelImporter
- Add IModelImporter option to simplify element geometry
- avoid waiting on usage logging requests to succeed/fail; disable backend Bentley telemetry in iModelBank use case
- RpcPushConnection fix
- Support for push events
- Update ConcurrencyControl docs on locking and code management
- Reorganize ConcurrencyControl API

## 2.8.1
Tue, 03 Nov 2020 00:33:56 GMT

### Updates

- avoid waiting on usage logging requests to succeed/fail; disable backend Bentley telemetry in iModelBank use case
- Update to @bentley/imodeljs-native@2.8.8
- Update to @bentley/imodeljs-native@2.8.9

## 2.8.0
Fri, 23 Oct 2020 17:04:02 GMT

### Updates

- Update to @bentleey/imodeljs-native@2.8.5
- Update to @bentley/imodeljs-native@2.8.7
- Add mapImagery to DisplayStyleCreationOptions
- Allow DisplayStyleCreationOptions to specify any properties of DisplayStyle3dSettingsProps.
- Elemeent CRUD perf test fixed
- Add IModelTileRpcInterface.queryVersionInfo().
- ConcurrencyManager documentation

## 2.7.6
Wed, 11 Nov 2020 16:28:23 GMT

### Updates

- Update to @bentley/imodeljs-native@2.7.9

## 2.7.5
Fri, 23 Oct 2020 16:23:50 GMT

_Version update only_

## 2.7.4
Mon, 19 Oct 2020 17:57:01 GMT

### Updates

- Update to @bentley/imodeljs-native@2.7.8

## 2.7.3
Wed, 14 Oct 2020 17:00:59 GMT

_Version update only_

## 2.7.2
Tue, 13 Oct 2020 18:20:38 GMT

### Updates

- Update to @bentley/imodeljs-native@2.7.6

## 2.7.1
Thu, 08 Oct 2020 13:04:35 GMT

### Updates

- Update to @bentley/imodeljs-native@2.7.5

## 2.7.0
Fri, 02 Oct 2020 18:03:32 GMT

### Updates

- Update to @bentley/imodeljs-native@2.7.4
- Fixes to front end methods to pull, merge and push. 
- Setup IModelHost.startup() to use proxy servers if configured/available - this is valuable for debugging agents, backends and electron applications. 
- On iOS download in background
- Fix ios hang issue
- Modify queryModelRanges to handle non geometric model errors
- Introduce NoContentError (transmitted via 204)
- Tile gen performance script in package.json

## 2.6.5
Sat, 26 Sep 2020 16:06:34 GMT

### Updates

- changed elements properties for version compare
- Update to @bentley/imodeljs-native@2.6.4

## 2.6.4
Tue, 22 Sep 2020 17:40:07 GMT

### Updates

- Update to @bentley/imodeljs-native@2.6.3

## 2.6.3
Mon, 21 Sep 2020 14:47:09 GMT

_Version update only_

## 2.6.2
Mon, 21 Sep 2020 13:07:44 GMT

_Version update only_

## 2.6.1
Fri, 18 Sep 2020 13:15:09 GMT

### Updates

- Update to @bentley/imodeljs-native@2.6.2

## 2.6.0
Thu, 17 Sep 2020 13:16:12 GMT

### Updates

- Update to @bentley/imodeljs-native@2.6.0
- Allow an Element's FederationGuid to be cleared with the empty string during update.
- Allow "" to clear UserLabel when element is updated.
- Moved ESLint configuration to a plugin
- fix failing usageloggingutilities tests from missing productVersion
- Add IModelExporter.visitElements and IModelExporter.visitRelationships flags to optimize exports that don't need to visit element and/or relationship instances.
- react to telemetry and introspection client changes
- Tile Gen Performance tests: use local paths
- Tile generation performance test updates to use the latest tile format version

## 2.5.5
Wed, 02 Sep 2020 17:42:23 GMT

_Version update only_

## 2.5.4
Fri, 28 Aug 2020 15:34:15 GMT

### Updates

- Update to @bentley/imodeljs-native@2.5.8

## 2.5.3
Wed, 26 Aug 2020 11:46:00 GMT

_Version update only_

## 2.5.2
Tue, 25 Aug 2020 22:09:08 GMT

### Updates

- Update to @bentley/imodeljs-native@2.5.7

## 2.5.1
Mon, 24 Aug 2020 18:13:04 GMT

### Updates

- Update to @bentley/imodeljs-native@2.5.6

## 2.5.0
Thu, 20 Aug 2020 20:57:09 GMT

### Updates

- Update to imodeljs-native 2.5.0
- VSTS#419723: Accomodated "bad" checkpoints that may have serialized transactions preventing their use in ReadWrite cases. 
- Fix for a recursive exception while closing a briefcase
- Added mobile oidc client
- Remove special code handling for mobile.
- locking, deleting of assemblies
- Switch to ESLint

## 2.4.2
Fri, 14 Aug 2020 16:34:09 GMT

### Updates

- Update to @bentley/imodeljs-native@2.4.4
- Added suport for restart query

## 2.4.1
Fri, 07 Aug 2020 19:57:43 GMT

### Updates

- Update to @bentley/imodeljs-native@2.4.3
- add missing rbac-client dep
- Removed unnecessary binary decode from IModelSchemaLoader

## 2.4.0
Tue, 28 Jul 2020 16:26:24 GMT

### Updates

- apply changeset performance tests with own iModels and data
- Element geometry clip containment tests and interactive test tool.
- Changes to support imodel-bridge
- Add IModelExporter.exportSchemas
- Add ability for IModelExporter to skip template models
- Allow app to set additional crash report properties dynamically

## 2.3.3
Thu, 23 Jul 2020 12:57:15 GMT

_Version update only_

## 2.3.2
Tue, 14 Jul 2020 23:50:36 GMT

_Version update only_

## 2.3.1
Mon, 13 Jul 2020 18:50:14 GMT

_Version update only_

## 2.3.0
Fri, 10 Jul 2020 17:23:14 GMT

### Updates

- geometry clip containment
- allow opening briefcases readonly with SnapshotDb.openFile and StandaloneDb.openFile
- Bug fix and doc fix
- Add IModelDb.computeProjectExtents().
- Performance tests for 2D Elemen CRUD operations
- Changes to support imodel-bridge
- fix spelling mistakes in Device class
- Fix typo in comments
- Setup BriefcaseDb.open() to allow profile and domain schema validation and upgrades. 
- disallow protected operations for missing schemas marked with SchemaHasBehavior custom attribute

## 2.2.1
Tue, 07 Jul 2020 14:44:52 GMT

### Updates

- Update to @bentley/imodeljs-native@2.2.7

## 2.2.0
Fri, 19 Jun 2020 14:10:03 GMT

### Updates

- Update to imodeljs-native 2.2.4
- Move analytical domain classes out to new package.
- close file on error in StandaloneDb.openFile
- Add DefinitionContainer, DefinitionSet
- Add missing properties to UrlLink and RepositoryLink
- Bump tile version
- Add IModelExporter.wantGeometry to optimize cases where geometry is not required
- Move linear referencing domain types out to new @itwin/linear-referencing-backend package.
- Added test for null string access via ECSqlStatement
- Add PhysicalElement.physicalMaterial
- Add PhysicalMaterial
- Add PhysicalMaterial.createCode, PhysicalMaterial.create
- Remove IOS Azure downloader
- reactivate native ULAS tests
- Update to BisCore.01.00.11: Add new SectionDrawing properties, deprecate SectionLocation in favor of SectionDrawingLocation.
- Switching from JSC to V8

## 2.1.0
Thu, 28 May 2020 22:48:59 GMT

### Updates

- Add a new BackendLoggerCategory for usage logging, 'BackendLoggerCategory.UsageLogging'.
- Update to imodeljs-native 2.1.0
- Support for finding an ExternalSourceAspect given scope, id, and kind/hash.
- ApplyChangeset perf tests updated
- Fixed token expiry check for desktop authorization. 
- Download ChangeSets in chunks
- (1) In xy region booleans, support curved edges; (2) ExportGraphicsMeshVisitor class
- Add ability to convert ExportGraphicsMesh to Polyface
- Fixed validation of Guids (ContextId, IModelId) cached within a briefcase.
- Moved iModelBridgeFwk to a separate package
- Simplified logging for monitoring briefcase operations. 
- Fix transforms for creating and querying part instance geometry in world coordinate.
- Fix and improvement to performance tests
- Added support for schema XML import to iModelJs backend via the IModelDb.importSchemaStrings method.
- channel rules
- Fixed logging usage when opening connections. 

## 2.0.0
Wed, 06 May 2020 13:17:49 GMT

### Updates

- Fixed setup of UserInfo from browser clients, and more cleanups to AccessToken API. 
- Added RivisionUtility class for debug/testing
- node addon 2.0.18
- addon 2.0.25
- Update to addon 2.0.5
- imodeljs-addon 2.0.6
- New IModelJS Node Addon 2.0.8
- Update to imodeljs-native 2.0.24
- Accusnap: improve performance and accuracy.
- BriefcaseIModelDb.pushChanges now requires a description
- Performance tests for Applying Changesets
- `IModelHost.startup` is now async.
- `IModelHost.shutdown` is now async.
- Refined checks for briefcase id, and fixed failing integration tests. 
- Product Backlog Item 276268: Deleting the briefcase cache if the cache version is incorrect should not attempt to delete the root directory.
- Setup initialization of briefcase cache for offline workflows. (VSTS#286489)
- Monitor progress of downloading briefcases, ability to cancel download of briefcases. 
- Move briefcase-specific events into BriefcaseIModelDb subclass
- Fixed param when calling logger so that it is a function as the logger expects
- Setup a common cache locaton for iModel.js, with briefcases taking up a sub-folder. 
- Changed ChangeSets download API
- Added unlink for file handler
- Update UlasClient tests to send more detailed feature log data
- react to renaming of imodeljs-clients-backend to backend-itwin-client
- apply changeset performance tests with local datasets
- BriefcaseManager.delete should work in offline scenarios. 
- Remove deprecated members of SectionLocation and downgrade to alpha pending refactor.
- Support for progress/cancel from ios
- Remove deprecated ExportGraphics types etc for 2.0
- Updated docs. 
- IModelDb.findByKey replaces IModelDb.find
- Include model extents with ViewStateProps for drawing views.
- Remove deprecated APIs; see NextVersion.md for details.
- Entity.forEachProperty has moved from beta to public. Please note that the default value of includeCustom has changed to better match typical use.
- Removed/moved some properties from AuthorizationClient interf
- Add IModelDb.Elements.getAspect method
- txn.hasPendingTxns returns false if all local changes have been undone
- Adding a new method setFirstSchemaLocater to ECSchemaXMLContext to allow control over the first locater used to locate schemas.
- IModelDb.containsClass now supports schema aliases
- react to changes in imodeljs-clients
- Promote properties from IModelToken onto IModelDb
- IModelTransformer now processes RepositoryLinks
- Update minimum Node version to 10.16.0
- test
-  Logging fixes, separated open/download of briefcases a little more.
- Fix issue when initialize briefcase cache from disk and cache folder does not exist
- openBriefcase RPC method now find the cached briefcase before opening it.
- Introduce the BriefcaseIModelDb class, make IModelDb abstract.
- Cleaned up unused async-s in BriefcaseManager
- Avoided casting of BriefcaseProps to IModelRpcProps.
- Added NativeApp.deleteBriefcase, avoided authorization exceptions when offline. 
- Move briefcase property from IModelDb --> BriefcaseIModelDb
- BriefcaseId is now an enum instead of a class
- Rename BriefcaseId --> ReservedBriefcaseId, introduce BriefcaseId type
- VSTS#297017: Update cached briefcase information if changes were applied. 
- Refactored NativeApp API and RPC interfaces. This continues to be WIP. 
- Removed the call to simultaneously download and open the briefcase at the backend. This should be done in two separate steps henceforth. The download must be done with BriefcaseManager, and the open is now a synchronous call in BriefcaseDb. 
- Added DownloadBriefcaseOptions and OpenBriefcaseOptions as parameters to the download/open calls for a briefcase. 
- Removed BriefcaseDb.create
- Setup ability to use NativeApp.openBriefcase() in offline scenarios. 
- fixed flaky test
- VSTS#217447, 162382: Cleanups to implementation of downloading/opening/discovering briefcases in native applications (WIP). 
- do not throw exception in NativeAppBackend.startup()
- VSTS#296110: Setup a way to close briefcases when the native application is offline. 
- Move concurrencyControl from IModelDb to BriefcaseIModelDb
- Renamed OIDC constructs for consistency; Removed SAML support.
- Add support for password-protecting snapshot iModels
- Fixed typo for ElementAspect perf tests
- VSTS#217447, VSTS#162382: Reinstated option to open briefcases with SyncMode = PullOnly. 
- Add purge dir method to iModelJsFs
- react to creation of new clients packages from imodeljs-clients
- ; substitute current date for feature usage without any set start/end dates
- Removed deprecated utilities. 
- enforce opening Snapshots readonly through StandaloneDb
- Remove the deprecated Entity.clone method
- Adjusted calls to some node addon changes (ECUtils removed)
- Upgrade to Rush 5.23.2
- support for editing
- The API for snapshot iModels is now public.
- When creating a snapshot iModel, there is now an option to create class views for interoperability.
- Add IModelHost.snapshotFileNameResolver
- Add FileNameResolver class
- Move snapshot methods out of IModelDb and into new SnapshotIModelDb class.
- Add TemplateModelCloner to place instances of a template model
- Renamed TestOidcClient and related constructs for consistency. 
- Add IModelDb.tryPrepareStatement
- Fixed usage logging. 
- fix failing ulas tests due to invalid featureId
- update ULAS test logging & feedback
- Update UlasUtilities to support exception-throwing native functions
- Use standalone briefcases for PullOnly cases. 

## 1.14.1
Wed, 22 Apr 2020 19:04:00 GMT

### Updates

- Documentation

## 1.14.0
Tue, 31 Mar 2020 15:44:19 GMT

### Updates

- Update to addon 1.14.1
- Fixed downloading of files using https/streaming to resolve when the filestream is closed instead of when the input stream is exhausted. 
- Add handling for invalid predecessor ids to IModelTransformer
- Accomodate updated imodeljs-native ULAS functions

## 1.13.0
Wed, 04 Mar 2020 16:16:31 GMT

_Version update only_

## 1.12.0
Wed, 12 Feb 2020 17:45:50 GMT

### Updates

- Fix IGeometry roundtripping issue through ECSql.  Fix insert/update binary properties for Element Aspect.
- Separated out routines to download and open briefcases. 
- bulk mode
- Consolidated sign-in for integration tests
- bulkmode
- iModel write API development
- Prevent reuse of cached tiles after project extents change.
- A new optional dependency, ecschema-metadata, allows for retrieval of full Schema information from an iModel using the new IModelSchemaLoader utility class.
- Added parameters for ruleset directory and temp cache location for version compare processing
- Add ViewDefinition.getAuxiliaryCoordinateSystemId and ViewDefinition.setAuxiliaryCoordinateSystemId methods
- Add SpatialLocationModel.insert
- Add optional isPlantProjection parameter to PhysicalModel.insert
- VSTS#256133: Fixed issue with reopening connections if the backend crashes. Fixes to integration tests. 
- Better documentation of OidcDesktopClient
- Fixed changeset perf test by using another iModel on Hub
- Add ViewDetails to ViewDefinition.
- Add support for plan projection models with 3d display priority.
- UlasUtilities exported as an module.

## 1.11.0
Wed, 22 Jan 2020 19:24:12 GMT

### Updates

- Native apps can now cancel tile requests in progress on the backend.
- Remove echo test function from devTools
- Allow outline fill to be specified by subcategory appearance.
- Upgrade to TypeScript 3.7.2.
- Added TypeScript wrapper over the native SaaSClient.

## 1.10.0
Tue, 07 Jan 2020 19:44:01 GMT

### Updates

- Typescript code for the classes in the Analytical schema.
- Return error message from concurrent query manager
- Added support for embedding images in a GeometryStream.
- IModelExporter, IModelTransformer, and IModelImporter are now beta and provide low-level functionality needed for iModel transformation and data exchange.
- Added IModelDb.isBriefcase() getter.
- Implementing LinearlyLocatedBase interface by base LR abstract element-classes.
- Moving data-holder structures used during the LinearElement.queryLinearLocations API to imodeljs-common.
- Allow events to be sent from backend to frontend
- Add tryGetInstance / tryGetInstanceProps methods to the Relationship class which return undefined rather than throwing an exception when a relationship is not found.
- Fix webpack for ios test that were failing due to new dependencies
- VSTS#225894 - Allowed agents to bypass usage logging calls. These cause usage logging errors. 
- Add tryGetElement / tryGetElementProps which return undefined rather than throwing an exception when an element is not found.
- Add tryGetModel, tryGetModelProps, tryGetSubModel which return undefined instead of throwing exceptions when the model is not found.

## 1.9.0
Tue, 10 Dec 2019 18:08:56 GMT

### Updates

- Updated to addon 9.1.3
- Added AliCloud tile cache service
- Added framework to run imodeljs-backend test on ios using appcenter
- Setup OidcDesktopClient for Electron use cases. 
- fix warnings from static analysis
- Enabling testing code for updating LR aspects after fix in native side.
- Addressing typo in a couple of members, making them match the schema properly.
- Avoid concurrent tile uploads

## 1.8.0
Fri, 22 Nov 2019 14:03:34 GMT

### Updates

- Option to include part references in GeometrySummary output.
- Expose isTwoSided flag on ExportGraphicsMesh
- SchemaDesignPerf import tests
- Added missing topic descriptions
- Add experimental Node 12 support
- Change SectionLocationProps.clipGeometry type to string. Add get/set ClipVector methods on SectionLocation.
- Add support for view-independent display of geometry streams.

## 1.7.0
Fri, 01 Nov 2019 13:28:37 GMT

### Updates

- Add TypeScript wrapper class for BisCore:ElementOwnsExternalSourceAspects
- New wip plugin for hypermodeling support.
- Calling IModelDb.pushChanges is now a no-op if there are no changes
- Adding accessor for LinearElementId from LinearlyLocated. Adding convenience APIs to manipulate LinearReferencing data stored in multi-aspects.
- Add TypeScript wrappers for GeometricElement2dHasTypeDefinition and GeometricElement3dHasTypeDefinition navigation relationships
- Tests for Mixin impact on CRUD
- Add and fix npm script to create backend test for mobile.
- Schema Design Perf tests for Polymorphic queries
- Add IModelDb.querySchemaVersion
- Schema Design Perf tests for relationships
- Resurrected the old way of doing agent registrations

## 1.6.0
Wed, 09 Oct 2019 20:28:42 GMT

### Updates

- Add isNotSpatiallyLocated and isPlanProjection to GeometricModel3d
- Add SectionLocation
- Add GraphicalPartition3d and GraphicalModel3d
- Schema perf tests
- Addressing bug while querying for linearLocations filtering on more than 1 classes.
- Addressing rush lint issues.
- Addressing issues while returning LinearLocationReferences.
- Deprecating importSchema on the LinearReferencing domain in favor of its bulk-version.

## 1.5.0
Mon, 30 Sep 2019 22:28:48 GMT

### Updates

- added support for blank IModelConnections
- Setup a way to supply authorization through the backend for frontend requests. 
- Error log when downloading change sets should include iModelId for context. 
- Fixed the iModelHub client to properly dispose a file handle after upload to the iModelHub. 
- Add IModelDb.Elements.hasSubModel
- Make ExternalSourceAspect.checksum optional
- Clear statement cache after schema import
- Added utility to summarize geometry
- filter redundant hub requests
- Removed the `[propName: string]: any` indexed from Entity. It prevented the compiler from catching many basic errors.
- briefcase editing and undo/redo
- upgrade to TypeScript 3.6.2

## 1.4.0
Tue, 10 Sep 2019 12:09:49 GMT

### Updates

- Setup a way to supply authorization through the backend for frontend requests. 
- Allow attaching change cache file before change summary extraction. 
- Added change summary test, and improved doc a little. 
- Add minimum brep size option to IModelDb.exportGraphics
- FunctionalSchema.importSchema is now deprecated.
- Add support for GeometricModel.geometryGuid for detecting whether tiles for a model can be reused across versions
- Added performance logging for tile upload
- IModelConnection.close() for read-only connections should not close the Db at the backend; Opening an iModel with SyncModel.PullAndPush() multiple times (without disposing it) must reuse the briefcase. 
- Add method to create view with camera
- Fixed misleading logging output in tile upload

## 1.3.0
Tue, 13 Aug 2019 20:25:53 GMT

### Updates

- Allow custom tile cache services.
- Always acquire a briefcase when creating a new backend instance for PullAndPush workflows. 
- Added Change Summary integration test, and fixed documentation. 
- Trial code for tile upload errors
- Fixed changeset performance tests
- Tile upload logging.
- Mark ExportGraphics API as public
- Support for gzip compression of tiles
- Fixed issue with opening iModels with names that are invalid on Unix or Windows. 
- Add IModelDb.isSnapshot
- Tile upload error catching.
- Azure tile upload logging
- Upgrade azure storage library.

## 1.2.0
Wed, 24 Jul 2019 11:47:26 GMT

### Updates

- Added option to restrict tile cache URLs by client IP address.
- Apply change sets at the backend in a non-blocking worker thread. 
- Add ElementAspect handler methods
- When deleting a parent element, make sure there are onDelete/onDeleted callbacks for child elements
- Add support for linework to IModelDb.exportGraphics
- The className parameter to IModelDb.Element.getAspects is now optional to allow all aspects to be returned
- Deprecate IModelDb.importSchema in favor of IModelDb.importSchemas
- Added method to get element mass properties.
- Add exportPartGraphics and accompanying interfaces
- Capture tile upload errors using JSON.stringify.
- Fallback to toString for Error derivative errors in tile upload
- Always report tile upload response on failure
- Discover properties of azure 'error' object

## 1.1.0
Mon, 01 Jul 2019 19:04:29 GMT

### Updates

- Open fixes when briefcase requires merges. 
- Catch tile upload errors.
- Setting up briefcase is always from an older checkpoint. 
- Add materialId, subCategory to ExportGraphicsInfo
- Fix crash in getViewThumbnail for odd number of bytes 
- Adding relationship class for GraphicalElement3dRepresentsElement.
- Initial implementation of the LinearReferencing typescript domain
- Adding domain classes for all relatinships in the LinearReferencing schema.
- Exporting relationships module.
- Fixes to opening iModel-s ReadWrite from mutiple IModelConnection-s. 
- Fixed issues with deleting briefcases if there were errors with preparing briefcases. 
- Add a new method `forceLoadSchemas` to `IModelJsNative.ECPresentationManager`.
- Introduced AsyncMutex - a utility to run async blocks of code in sequence. 
- Properly document ModelSelector.models and CategorySelector.categories as Id64String arrays
- Made `insertElement` not return Id64.invalid, throws error instead
- Update to TypeScript 3.5
- Update property referenced in ULAS error message

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Migrated agent applications to the newer client 
- RPC system now accepts only basic values (primitives, "interface" objects, and binary).
- Switched from iModelHub Project API to Context API
- Fix bug in IModelDb.createSnapshotFromSeed
- Add BriefcaseId.Snapshot
- Improve reading and binding binary blob using concurrent query manager
- Modified ElementAspect Performance tests
- Add options to IModelHost for logging large tile sizes and long tile load times.
- Add TypeScript wrapper for BisCore:ExternalSourceAspect
- Made poll interval configurable for concurrent query manager.
- Updated code to use new ownedByMe option when quering briefcases
- Logging changes.
- Refactored and simplified implementation of IModelDb.open
- IModelDb.openSnapshot cannot open a briefcase copy of an iModel managed by iModelHub
- The IModelDb.createSnapshot instance method replaces the IModelDb.createSnapshotFromSeed static method
- Crash reporting, node-report opt-in
- Throw IModelError if an IModelDb query would return too many rows
- Retire some tile-related feature gates.
- Introduced tile format v4.0
- Improve ulas error message logs
- Catch tile upload errors.

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Support spatial classification of context reality models.
- Fix incorrect elevation for background map display.
- Adds parameter for api-extractor to validate missing release tags
- Remove requirement that JavaScript classnames match BIS classnames
- Avoided iModelHub calls when opening iModels for Design Review.
- Fixed reinitializing briefcase cache when there are .tiles files.
- Enabled use of checkpoint service.
- Added option to use azure-based tile caching
- Added a utility to diagnose backends
- Improved backend diagnostic utility.
- Adapt to Range2d name change
- Allow a view to define a set of elements which should never be drawn in that view.
- Added texture support to exportGraphics
- Fixes for file-based tile caching
- Catch tile upload errors
- Fix for release tags
- Fix broken links
- LoggerCategory -> BackendLoggerCategory
- Cleanup old imodelbank references
- Add InformationRecordModel.insert, GroupModel.insert
- Introduce LoggerCategory enum to advertise logger categories used by this package.
- Limited maximum cache size of the backend PromiseMemoizer. 
- Missing dependency on node-report
- Fixed memoization problem that caused an endless stream of 404 NotFound errors. 
- Reinstated old version of OidcAgentClient
- Unauthorized open requests should cause a more obvious error. 
- Improved performance logging, especially of IModelDb open operations; ChangeSets are merged one-by-one to prevent hogging the event loop. 
- Memoization fix when opening iModels in shared, read-only mode .
- Fixed setup of application version.
- Updated Element CRUD perf tests
- Added tile generation perf test
- QueryPage use memoization/pending pattern
- Remove IModelDb.createStandalone, use IModelDb.createSnapshot instead.
- Remove ElementPropertyFormatter, IModelDb.getElementPropertiesForDisplay (use presentation rules instead)
- Remove StandaloneIModelRpcImpl
- Fix for Render Gradient.Symb test
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- Add IModelDb.createSnapshot/openSnapshot/closeSnapshot, deprecate IModelDb.createStandalone/openStandalone/closeStandalone
- Moved IModelJsExpressServer class into a new package (@itwin/express-server).
- Simplified tile caching IModelHost config and removed dev flags. Allow
- Typo in documentation
- Fix missing ULAS client request data
- ExportGraphicsFunction return type is now void
- Upgrade TypeDoc dependency to 0.14.2
- Add usage logging tests
- Edit usage logging tests to support revised usage logging syntax

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Added IModelDb.exportGraphics
- Fix issue for ios

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Changes package.json to include api-extractor and adds api-extractor.json
- Use new buildIModelJsBuild script
- AxisAlignedBox and ElementAlignedBox are now typed to Range3d rather than classes
- Moved AzureFileHandler, IOSAzureFileHandler, UrlFileHandler and the iModelHub tests to the imodeljs-clients-backend package. This removes the dependency of imodeljs-clients on the "fs" module, and turns it into a browser only package. 
- Clone methods are no longer generic
- Remove unneeded typedoc plugin dependency
- Added spatial <-> cartographic methods that check/use the geographic coordinate system before using ecef location.
- Added async method for ECSqlStatement and SqliteStatement for step and stepAndInsert
- Create iModel from empty template if seed file path not defined.
- Add IModelImporter for importing data between iModels
- Enable IModelWriteTest create/delete iModels on per user-machine basis
- Enable IModelWriteTest create/delete iModels on per user-machine basis
- Validated size of change sets before applying them.
- Codespec lock example
- Add backend Material API
- Validated version of Node.js in IModelHost.startup()
- Save BUILD_SEMVER to globally accessible map
- Fixed resolution of queryable promises.
- Added queryModelRange
- IModelConnection.close() always disposes the briefcase held at the backend in the case of ReadWrite connections.
- Move the IModelUnitTestRpcImpl into the testbed and out of the public API and marked nativeDb as hidden
- Remove loadNativeAsset and formatElements RPC calls from the IModelReadRpcInterface
- Removed IModelConnection.connectionId, added IModelApp.sessionId
- Tile requests can optionally specify a retryInterval.
- Improve tile request logging and make timeout configurable.
- Prevent tile generation from interfering with other asynchronous requests.
- Handled error with fetching host information on deployed machines.
- Quick fix to ULAS failures.
- WIP fixes to Usage Logging.
- Upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

### Updates

- Changed Elements Db class for backend processing

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

_Version update only_

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

### Updates

- More logging of HTTP requests, and enabled use of fiddler for backend diagnostics. 
- Removed IModelDb's cache of accessToken. For long running operations like AutoPush, the user must explicitly supply an IAccessTokenManager to keep the token current. 
- Renamed RequestProxy->RequestHost. Allowed applications to configure proxy server with HTTPS_PROXY env.
- Add backend TextureAPI and accompanying test

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

_Version update only_

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Generalize create method for display styles
- Property Changeset.Author in IModelChange ECSchema was renamed UserCreated. It holds the user ID instead of the user e-mail.

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

### Updates

- Moved electron utilities into a separate "@itwin/core-electron" package.

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

### Updates

- Implement the typescript side for new Geocoordinate services in the native iModel.js addon
- Upgrade to Node 10. There is no longer separate packages for Node and Electron.

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

### Updates

- Upgrade to Node 10. There is no longer separate packages for Node and Electron.

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

_Version update only_

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Fix CodeSpecs.load
- Add CodeSpecs.hasId, CodeSpecs.hasName

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

### Updates

- Temporarily disable TxnManager events.

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

_Version update only_

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

### Updates

- Fix for timing problem in TxnManager test
- Add IModelDb.Elements.updateAspect

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

_Version update only_

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

### Updates

- Add static create methods for certain Element classes

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- Use IOSAzureFileHandler when on mobile
- Added IModelConnection.findClassFor
- Custom imodelJs noDirectImport lint rule implemented, noDuplicateImport lint rule turned on.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- Don't register testing domain multiple times

## 0.171.0
Mon, 03 Dec 2018 18:52:58 GMT

### Updates

- More information logged from BriefcaseManager.\nFixed deletion/cleanup of invalid briefcases.\nAdded OIDC support for simpleviewtest application. 
- Add ElementRefersToElements.insert
- Fixed front end integration tests.
- Document the intended purpose of IModelJsExpressServer within a deployment environment.
- Fixed integration tests.
- added tests for ElementDrivesElement handlers
- Fixes to integration tests.
- Add OrthographicViewDefinition.setRange
- Cleaned up use of mocks in core tests.
- Enable test now that addon was updated.
- Fix Subject.insert to set parent

## 0.170.0
Mon, 26 Nov 2018 19:38:42 GMT

### Updates

- Add DrawingViewDefinition.insert
- Fix GeometryParams constructor. Added test to ensure subcategory id set correctly.
- Rename LinkTableRelationship to just Relationship. Work on adding callbacks for dependency propagation.

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

_Version update only_

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

_Version update only_

## 0.167.0
Fri, 16 Nov 2018 21:45:44 GMT

### Updates

- Add IModelDb.CodeSpecs.insert overload
- Add SubCategory.insert
- Add missing createCode methods
- Changes to debug utilities.
- Added IModelHubClient.IModel, removed IModelQuery.primary(), use IModelHubClient.IModel.Get instead
- Add IModelDb.Views.setDefaultViewId
- Add OrthographicViewDefinition.insert

## 0.166.0
Mon, 12 Nov 2018 16:42:10 GMT

### Updates

- Hydrated briefcases for ReadOnly cases from the latest checkpoint, rather than the seed files. This significantly improves performance of IModelDb/IModelConnection.open() for typical cases.

## 0.165.0
Mon, 12 Nov 2018 15:47:00 GMT

### Updates

- Clean up IModelImporter
- Add static insert methods to many classes to simplify iModel creation.
- Add more TypeScript wrapper classes for BisCore relationships
- Add Subject.createCode and Subject.insert methods
- Add FunctionalModel.insert method

## 0.164.0
Thu, 08 Nov 2018 17:59:20 GMT

### Updates

- Fix JSON representation of DisplayStyle.
- Add IModelImporter as a base class for utility methods needed by all importers
- Removed assertion when deleting a memoized open call. 
- Add more methods to IModelImporter
- Fix snapping test
- OIDC related enhancments (WIP).
- Re-enabled several backend integration tests. 
- Refactor analysis-importer to use IModelImporter
- Updated to TypeScript 3.1

## 0.163.0
Wed, 31 Oct 2018 20:55:37 GMT

### Updates

- Guids can now be bound as strings to ECSQL. BLOBs in ECSQL and SQLite are now mapped to UInt8Array instead of ArrayBuffer (as only the former can be marshaled between backend and frontend).
- Fully support mixed binary and JSON content in both directions in RPC la
- Remove obsolete script

## 0.162.0
Wed, 24 Oct 2018 19:20:06 GMT

### Updates

- Removed uncessary comments
- Breaking changes to optimize usage of 64-bit IDs.
- Ids and date times can now be directly bound as hex strings or date time ISO strings respectively in ECSQL statements.
- Remove unused createAndInsert methods from IModelWriteRpcInterface
- Added classes to reduce electron and express boilerplate in sample apps.

## 0.161.0
Fri, 19 Oct 2018 13:04:14 GMT

### Updates

- Update native-platform version to 0.64.2, which now includes a new package to handle electron for linux.
- Update iModel.js native platform to version 0.64.3

## 0.160.0
Wed, 17 Oct 2018 18:18:38 GMT

### Updates

- Fix for incorrect conversion in ConcurrencyControl

## 0.159.0
Tue, 16 Oct 2018 14:09:09 GMT

### Updates

- Move up to new version of addon (updated electron dependency to 2.0.8)
- Removed KnownRegions Enum

## 0.158.0
Mon, 15 Oct 2018 19:36:09 GMT

_Version update only_

## 0.157.0
Sun, 14 Oct 2018 17:20:06 GMT

### Updates

- Fixing scripts for linux

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

