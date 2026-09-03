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
  - [Electron 44 support](#electron-44-support)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

### ChangesetReader changes

#### ChangesetReader row options

The `useJsName` option has been removed from the `@beta` `RowFormatOptions` used by [ChangesetReader]($backend). EC property keys are now always returned using their original EC property names; use `classIdsToClassNames` to resolve class Id values to fully-qualified class names.

#### ChangeInstance ECInstanceId and ECClassId

The `@beta` [ChangeInstance]($backend) interface produced by [ChangesetReader]($backend) now declares `ECInstanceId` and `ECClassId` as explicit `string` properties. They were previously only reachable through the interface's index signature, so no runtime behavior changes — the values were always present — but consumers now get proper typing and IntelliSense when accessing `instance.ECInstanceId` and `instance.ECClassId`.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
