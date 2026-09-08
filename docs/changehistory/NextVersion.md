---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-frontend](#itwincore-frontend)
    - [Download progress for pushChanges](#download-progress-for-pushchanges)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-frontend

### Download progress for pushChanges

Pushing local changes first pulls, applies, and merges any changesets made by other users. That download could not previously be observed or cancelled. A new `@beta` overload of [BriefcaseConnection.pushChanges]($frontend) accepts [PushChangesOptions]($frontend), mirroring the options already available on [BriefcaseConnection.pullChanges]($frontend):

```ts
const abortSignal = new AbortController();
await briefcase.pushChanges("my changes", {
  downloadProgressCallback: (progress) => console.log(`${progress.loaded} of ${progress.total} bytes`),
  downloadProgressInterval: 500,
  abortSignal: abortSignal.signal,
});
```

Aborting rejects the returned promise and leaves the local changes pending, so the push can be retried later.

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
