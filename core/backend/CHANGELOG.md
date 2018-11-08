# Change Log - @bentley/imodeljs-backend

This log was last generated on Thu, 08 Nov 2018 17:59:20 GMT and should not be manually modified.

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

