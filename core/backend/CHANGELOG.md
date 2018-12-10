# Change Log - @bentley/imodeljs-backend

This log was last generated on Mon, 10 Dec 2018 13:24:09 GMT and should not be manually modified.

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

