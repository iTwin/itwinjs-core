# Change Log - @bentley/imodeljs-backend

This log was last generated on Mon, 03 Jun 2019 18:09:39 GMT and should not be manually modified.

## 1.0.0
Mon, 03 Jun 2019 18:09:39 GMT

### Updates

- Migrated agent applications to the newer client 
- RPC system now accepts only basic values (primitives, "interface" objects, and binary).
- Switched from iModelHub Project API to Context API
- Fix bug in IModelDb.createSnapshotFromSeed
- Add BriefcaseId.Snapshot
- Improve reading and binding binary blob using concurrent query manager
- Fixed typo in function name
- Modified ElementAspect Performance tests
- Add options to IModelHost for logging large tile sizes and long tile load times.
- Add TypeScript wrapper for BisCore:ExternalSourceAspect
- Made poll interval configurable for concurrent query manager.
- Updated code to use new ownedByMe option when quering briefcases
- Logging changes. 
- Refactored and simplified implementation of IModelDb.open
- IModelDb.openSnapshot cannot open a briefcase copy of an iModel managed by iModelHub
- The IModelDb.createSnapshot instance method replaces the IModelDb.createSnapshotFromSeed static method
- crash reporting, node-report opt-in
- rush extract-api + rush change
- Throw IModelError if an IModelDb query would return too many rows
- Retire some tile-related feature gates.
- Introduced tile format v4.0
- improve ulas error message logs
- Catch tile upload errors.

## 0.191.0
Mon, 13 May 2019 15:52:05 GMT

### Updates

- Support spatial classification of context reality models.
- Fix incorrect elevation for background map display.
- Adds parameter for api-extractor to validate missing release tags
- remove requirement that JavaScript classnames match BIS classnames
- Avoided iModelHub calls when opening iModels for Design Review. 
- Fixed reinitializing briefcase cache when there are .tiles files.
- Enabled use of checkpoint service. 
- Added option to use azure-based tile caching
- Added a utility to diagnose backends
- Improved backend diagnostic utility. 
- adapt to Range2d name change
- Allow a view to define a set of elements which should never be drawn in that view.
- Added texture support to exportGraphics
- Fixes for file-based tile caching"
- Catch tile upload errors
- fix for release tags
- Fix broken links
- LoggerCategory -> BackendLoggerCategory
- cleanup old imodelbank references
- back out experimental changes
- crash reporting WIP
- Add InformationRecordModel.insert, GroupModel.insert
- Fixed integration tests. 
- Introduce LoggerCategory enum to advertise logger categories used by this package.
- Limited maximum cache size of the backend PromiseMemoizer. 
- missing dependency on node-report
- rush update
- node-report
- Fixed memoization problem that caused an endless stream of 404 NotFound errors. 
- Reinstated old version of OidcAgentClient
- Unauthorized open requests should cause a more obvious error. 
- Improved performance logging, especially of IModelDb open operations; ChangeSets are merged one-by-one to prevent hogging the event loop. 
- Memoization fix when opening iModels in shared, read-only mode .
- Fixed setup of application version. 
- Updated Element CRUD perf tests
- added tile generation perf test
- queryPage use memoization/pending pattern
- Remove IModelDb.createStandalone, use IModelDb.createSnapshot instead.
- Remove ElementPropertyFormatter, IModelDb.getElementPropertiesForDisplay (use presentation rules instead)
- Remove StandaloneIModelRpcImpl
- Fix for Render Gradient.Symb test
- Setup a generic context for tracking client requests, and made various related enhancements to logging, usage tracking and authorization. 
- Add IModelDb.createSnapshot/openSnapshot/closeSnapshot, deprecate IModelDb.createStandalone/openStandalone/closeStandalone
- Moved IModelJsExpressServer class into a new package (@bentley/express-server).
- Simplified tile caching IModelHost config and removed dev flags. Allow
- typo in documentation
- fix missing ULAS client request data
- ExportGraphicsFunction return type is now void
- Upgrade TypeDoc dependency to 0.14.2
- add usage logging tests
- edit usage logging tests to support revised usage logging syntax

## 0.190.0
Thu, 14 Mar 2019 14:26:49 GMT

### Updates

- Added IModelDb.exportGraphics
- fix issue for ios

## 0.189.0
Wed, 06 Mar 2019 15:41:22 GMT

### Updates

- Changes package.json to include api-extractor and adds api-extractor.json
- Use new buildIModelJsBuild script
- AxisAlignedBox and ElementAlignedBox are now typed to Range3d rather than classes
- Moved AzureFileHandler, IOSAzureFileHandler, UrlFileHandler and the iModelHub tests to the imodeljs-clients-backend package. This removes the dependency of imodeljs-clients on the "fs" module, and turns it into a browser only package. 
- clone methods are no longer generic
- Remove unneeded typedoc plugin dependency
- Added spatial <-> cartographic methods that check/use the geographic coordinate system before using ecef location.
- Added async method for ECSqlStatement and SqliteStatement for step and stepAndInsert
- Create iModel from empty template if seed file path not defined.
- Add IModelImporter for importing data between iModels
- Enable IModelWriteTest create/delete iModels on per user-machine basis
- Enable IModelWriteTest create/delete iModels on per user-machine basis
- Validated size of change sets before applying them. 
- codespec lock example
- Add backend Material API
- Validated version of Node.js in IModelHost.startup()
- Save BUILD_SEMVER to globally accessible map
- Fixed resolution of queryable promises. 
- added queryModelRange 
- IModelConnection.close() always disposes the briefcase held at the backend in the case of ReadWrite connections. 
- Move the IModelUnitTestRpcImpl into the testbed and out of the public API and marked nativeDb as hidden
- Remove loadNativeAsset and formatElements RPC calls from the IModelReadRpcInterface
- debugging aid
- Removed IModelConnection.connectionId, added IModelApp.sessionId
- Tile requests can optionally specify a retryInterval.
- Improve tile request logging and make timeout configurable.
- Prevent tile generation from interfering with other asynchronous requests.
- Handled error with fetching host information on deployed machines.
- Quick fix to ULAS failures. 
- WIP fixes to Usage Logging. 
- upgrade to TypeScript 3.2.2

## 0.188.0
Wed, 16 Jan 2019 16:36:09 GMT

### Updates

- Changed Elements Db class for backend processing

## 0.187.0
Tue, 15 Jan 2019 15:18:59 GMT

*Version update only*

## 0.186.0
Mon, 14 Jan 2019 23:09:10 GMT

### Updates

- More logging of HTTP requests, and enabled use of fiddler for backend diagnostics. 
- Removed IModelDb's cache of accessToken. For long running operations like AutoPush, the user must explicitly supply an IAccessTokenManager to keep the token current. 
- Renamed RequestProxy->RequestHost. Allowed applications to configure proxy server with HTTPS_PROXY env.
- Add backend TextureAPI and accompanying test

## 0.185.0
Fri, 11 Jan 2019 18:29:00 GMT

*Version update only*

## 0.184.0
Thu, 10 Jan 2019 22:46:17 GMT

### Updates

- Generalize create method for display styles
- Property Changeset.Author in IModelChange ECSchema was renamed UserCreated. It holds the user ID instead of the user e-mail.

## 0.183.0
Mon, 07 Jan 2019 21:49:21 GMT

### Updates

- Moved electron utilities into a separate "@bentley/electron-manager" package.

## 0.182.0
Mon, 07 Jan 2019 13:31:34 GMT

### Updates

- Implement the typescript side for new Geocoordinate services in the native iModel.js addon
- upgrade to Node 10. There is no longer separate packages for Node and Electron.

## 0.181.0
Fri, 04 Jan 2019 13:02:40 GMT

### Updates

- upgrade to Node 10. There is no longer separate packages for Node and Electron.

## 0.180.0
Wed, 02 Jan 2019 15:18:23 GMT

*Version update only*

## 0.179.0
Wed, 19 Dec 2018 18:26:14 GMT

### Updates

- Fix CodeSpecs.load
- Add CodeSpecs.hasId, CodeSpecs.hasName

## 0.178.0
Thu, 13 Dec 2018 22:06:10 GMT

### Updates

- temporarily disable TxnManager events.

## 0.177.0
Wed, 12 Dec 2018 17:21:31 GMT

*Version update only*

## 0.176.0
Mon, 10 Dec 2018 21:19:45 GMT

### Updates

- fix for timing problem in TxnManager test
- Add IModelDb.Elements.updateAspect

## 0.175.0
Mon, 10 Dec 2018 17:08:55 GMT

*Version update only*

## 0.174.0
Mon, 10 Dec 2018 13:24:09 GMT

### Updates

- Add static create methods for certain Element classes

## 0.173.0
Thu, 06 Dec 2018 22:03:29 GMT

### Updates

- Use IOSAzureFileHandler when on mobile
- added IModelConnection.findClassFor
- Custom imodelJs noDirectImport lint rule implemented, noDuplicateImport lint rule turned on.

## 0.172.0
Tue, 04 Dec 2018 17:24:39 GMT

### Updates

- don't register testing domain multiple times

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
- rename LinkTableRelationship to just Relationship. Work on adding callbacks for dependency propagation.

## 0.169.0
Tue, 20 Nov 2018 16:17:15 GMT

*Version update only*

## 0.168.0
Sat, 17 Nov 2018 14:20:11 GMT

*Version update only*

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

- clean up IModelImporter
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
- remove obsolete script

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

- move up to new version of addon (updated electron dependency to 2.0.8)
- Removed KnownRegions Enum

## 0.158.0
Mon, 15 Oct 2018 19:36:09 GMT

*Version update only*

## 0.157.0
Sun, 14 Oct 2018 17:20:06 GMT

### Updates

- Fixing scripts for linux

## 0.156.0
Fri, 12 Oct 2018 23:00:10 GMT

### Updates

- Initial release

