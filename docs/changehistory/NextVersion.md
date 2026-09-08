---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [Schema sync rework](#schema-sync-rework)
    - [Import CSV data into ECDb](#import-csv-data-into-ecdb)
  - [Electron 44 support](#electron-44-support)

## @itwin/core-backend

### Schema sync rework

Schema sync lets the briefcases of one iModel import ECSchemas without taking the exclusive schema lock. This new version explicitly splits between updates, which update the sync db, and upgrades which rewrite the sync db and push it with the briefcase at the same time via the new `BriefcaseDb.upgradeSchemas` API.

Updates no longer automatically end up in other users' briefcases when they import schemas. Instead, they only pick the reference closure of what they import, so updates only hit when a briefcase pushes.

A change that would move or destroy existing data is now refused with `BE_SQLITE_ERROR_DataTransformRequired` or the new `BE_SQLITE_ERROR_DataDeletionRequired`; the new `@alpha` `BriefcaseDb.upgradeSchemas` runs those under the exclusive schema lock and lands the changeset and the sync db together. iModels without schema sync are unaffected.

SchemaSync databases now require version 5.0.0. Existing version 4 containers are outside this compatibility boundary and cannot be opened by this release.

### Import CSV data into ECDb

CSV data can be imported into an ECClass from in-memory string rows or streamed from a file. Both beta APIs return the number of inserted rows:

```ts
const options = {
  className: "Example.Person",
  mapping: [
    { columnIndex: 0, propertyName: "Name" },
    { columnIndex: 1, propertyName: "Age" },
  ],
};

ecdb.importCSVData([["Alice", "42"], ["Bob", "37"]], options);
ecdb.importCSVFile(csvFilePath, { ...options, hasHeader: true });
```

[ECDb.importCSVData]($backend) uses V8 serialization to cross the JavaScript-to-native boundary once. [ECDb.importCSVFile]($backend) reads and parses the file in native code; its path must be accessible to the backend process. Both reuse one ECSQL statement, convert each CSV string according to its mapped EC property type, ignore unmapped columns, and roll back the complete import if parsing, conversion, or insertion fails.

## Electron 44 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 44](https://www.electronjs.org/blog/electron-44-0).
