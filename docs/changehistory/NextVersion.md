---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
    - [ChangesetReader changes](#changesetreader-changes)
      - [ChangesetReader row options](#changesetreader-row-options)
      - [ChangeInstance ECInstanceId and ECClassId](#changeinstance-ecinstanceid-and-ecclassid)
      - [SQLite changeset schema sources](#sqlite-changeset-schema-sources)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

### ChangesetReader changes

#### ChangesetReader row options

The `useJsName` option has been deprecated in the `@beta` `RowFormatOptions` used by [ChangesetReader]($backend). Use `classIdsToClassNames` to resolve class Id values to fully-qualified class names.

#### SQLite changeset schema sources

The `@beta` `SqliteChangesetReader.openFile` method now accepts a plain `SQLiteDb` as its source of table and column metadata. The database must be open and contain every table referenced by the changeset. Set `disableSchemaCheck` to tolerate changeset columns that are not present in the database. EC-specific consumers such as `ChangesetECAdaptor` continue to require an `IModelDb` or `ECDb`.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
